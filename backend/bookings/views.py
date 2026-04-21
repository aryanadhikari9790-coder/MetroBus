from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from transport.models import Seat
from transport.services import ensure_bus_seats
from trips.models import Trip
from .models import Booking, BookingReview, BookingSeat, OfflineBoarding, OfflineSeat, SeatHold
from .serializers import (
    BookingSerializer,
    BookingReviewSerializer,
    CreateBookingSerializer,
    OfflineCreateSerializer,
    OfflineBoardingSerializer,
    PassengerBookingListSerializer,
    HelperLookupSerializer,
    HelperBoardBookingActionSerializer,
    HelperBookingTicketSerializer,
    PassengerCancelBookingSerializer,
    SeatHoldSyncSerializer,
    booking_payment_status_label,
)
from .permissions import IsPassenger, IsHelper
from .services import (
    advance_booking_journey_status,
    clear_expired_seat_holds,
    get_active_seat_holds_for_trip,
    validate_seats_available,
    get_fare_for_segment,
    get_taken_seat_ids_for_trip,
    intervals_overlap,
)
from .realtime import emit_booking_event
from .tickets import generate_boarding_otp, parse_ticket_reference


def _booking_queryset():
    return (
        Booking.objects.select_related("trip__route", "trip__bus", "passenger", "payment", "payment_requested_by", "accepted_by_helper", "review")
        .prefetch_related("booking_seats__seat", "trip__route__route_stops__stop")
    )


def _resolve_ticket_booking(reference, *, require_qr_token=False):
    parsed = parse_ticket_reference(reference)
    queryset = _booking_queryset()
    if parsed["booking_id"]:
        booking = queryset.filter(id=parsed["booking_id"]).first()
        if not booking:
            return None, parsed
        if parsed.get("qr_token") and booking.qr_token != parsed["qr_token"]:
            return None, parsed
        if require_qr_token and not parsed.get("qr_token"):
            return None, parsed
        return booking, parsed
    if parsed["ticket_code"]:
        return queryset.filter(ticket_code=parsed["ticket_code"]).first(), parsed
    return None, parsed


def _can_manage_booking(user, booking):
    if not booking:
        return False
    return bool(user.is_superuser or booking.trip.helper_id == user.id)


def _generate_trip_boarding_otp(trip):
    for _ in range(50):
        otp = generate_boarding_otp()
        conflict = (
            Booking.objects.filter(
                trip=trip,
                boarding_otp=otp,
                status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            )
            .exclude(completed_at__isnull=False)
            .exists()
        )
        if not conflict:
            return otp
    return generate_boarding_otp()


def _resolve_helper_booking_by_otp(user, reference):
    otp = "".join(character for character in str(reference or "") if character.isdigit())
    if len(otp) != 4:
        return None, otp, None

    matching_queryset = _booking_queryset().filter(boarding_otp=otp).exclude(
        status__in=[Booking.Status.CANCELLED, Booking.Status.COMPLETED, Booking.Status.NO_SHOW]
    )
    queryset = matching_queryset
    if not user.is_superuser:
        queryset = queryset.filter(trip__helper_id=user.id)

    booking = queryset.filter(trip__status=Trip.Status.LIVE).order_by("-created_at").first()
    if not booking:
        booking = queryset.filter(trip__status=Trip.Status.NOT_STARTED).order_by("-created_at").first()
    if not booking:
        booking = queryset.order_by("-created_at").first()

    matched_booking = matching_queryset.filter(trip__status=Trip.Status.LIVE).order_by("-created_at").first()
    if not matched_booking:
        matched_booking = matching_queryset.filter(trip__status=Trip.Status.NOT_STARTED).order_by("-created_at").first()
    if not matched_booking:
        matched_booking = matching_queryset.order_by("-created_at").first()
    return booking, otp, matched_booking


SEAT_HOLD_MINUTES = 2


class PassengerBookingsView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def get(self, request):
        bookings = _booking_queryset().filter(passenger=request.user).order_by("-created_at")

        route_cache = {}
        for booking in bookings:
            route = booking.trip.route
            if route.id not in route_cache:
                route_cache[route.id] = list(route.route_stops.all())
            route.route_stops_cache = route_cache[route.id]

        return Response({"bookings": PassengerBookingListSerializer(bookings, many=True).data})


class PassengerCancelBookingView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, booking_id: int):
        booking = _booking_queryset().filter(id=booking_id, passenger=request.user).first()
        if not booking:
            return Response({"detail": "Booking not found."}, status=404)
        if booking.status == Booking.Status.CANCELLED:
            return Response(
                {"message": "This ride is already cancelled.", "booking": PassengerBookingListSerializer(booking).data},
                status=200,
            )
        if booking.status in {Booking.Status.COMPLETED, Booking.Status.NO_SHOW}:
            return Response({"detail": "This ride can no longer be cancelled."}, status=400)

        serializer = PassengerCancelBookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking.status = Booking.Status.CANCELLED
        booking.cancelled_at = timezone.now()
        booking.cancelled_by = request.user
        booking.cancellation_reason = serializer.validated_data["reason"]
        booking.cancellation_note = serializer.validated_data.get("note", "")
        booking.journey_status = Booking.JourneyStatus.CANCELLED
        booking.save(
            update_fields=[
                "status",
                "cancelled_at",
                "cancelled_by",
                "cancellation_reason",
                "cancellation_note",
                "journey_status",
            ]
        )

        payment = getattr(booking, "payment", None)
        if payment and payment.status == "PENDING":
            payment.status = "CANCELLED"
            payment.save(update_fields=["status"])

        booking = _booking_queryset().filter(id=booking.id).first()
        emit_booking_event(
            booking,
            "BOOKING_CANCELLED",
            actor=request.user,
            message="This ride was cancelled and the reserved seat is available again.",
        )
        return Response(
            {
                "message": "Your ride was cancelled and the reserved seat is now available again.",
                "booking": PassengerBookingListSerializer(booking).data,
            },
            status=200,
        )


def _seat_availability_payload(trip, from_order: int, to_order: int, *, viewer_id=None):
    ensure_bus_seats(trip.bus)
    try:
        fare_per_seat = get_fare_for_segment(trip.route_id, from_order, to_order)
    except ValueError:
        fare_per_seat = None

    all_seats = list(Seat.objects.filter(bus=trip.bus).order_by("seat_no").values("id", "seat_no"))
    taken = get_taken_seat_ids_for_trip(trip.id, from_order, to_order)
    viewer_hold_ids = set()

    data_by_seat_id = {
        seat["id"]: {
            "seat_id": seat["id"],
            "seat_no": seat["seat_no"],
            "available": seat["id"] not in taken,
            "seat_state": "OPEN" if seat["id"] not in taken else "OCCUPIED",
            "occupant_kind": None,
            "journey_stage": None,
            "payment_status": None,
            "payment_verified": False,
            "payment_tick": "NONE",
            "booking_id": None,
            "offline_boarding_id": None,
            "held_by_me": False,
            "held_until": None,
        }
        for seat in all_seats
    }

    active_holds = get_active_seat_holds_for_trip(trip.id, from_order, to_order)
    for hold in active_holds:
        seat_payload = data_by_seat_id.get(hold.seat_id)
        if not seat_payload:
            continue
        held_by_me = bool(viewer_id and hold.passenger_id == viewer_id)
        if held_by_me:
            viewer_hold_ids.add(hold.seat_id)
        seat_payload.update(
            {
                "available": False,
                "seat_state": "HELD",
                "occupant_kind": "HOLD",
                "held_by_me": held_by_me,
                "held_until": hold.expires_at,
            }
        )

    bookings = (
        Booking.objects.filter(trip_id=trip.id, status=Booking.Status.CONFIRMED)
        .select_related("payment")
        .prefetch_related("booking_seats")
        .order_by("-checked_in_at", "from_stop_order", "created_at")
    )
    for booking in bookings:
        if not intervals_overlap(booking.from_stop_order, booking.to_stop_order, from_order, to_order):
            continue

        payment = getattr(booking, "payment", None)
        payment_status = booking_payment_status_label(booking)
        payment_verified = payment_status == "SUCCESS"
        journey_stage = "dropoff" if booking.checked_in_at else "pickup"
        payment_tick = "PAID" if payment_verified else "PENDING"

        for booking_seat in booking.booking_seats.all():
            seat_payload = data_by_seat_id.get(booking_seat.seat_id)
            if not seat_payload:
                continue
            seat_payload.update(
                {
                    "available": False,
                    "seat_state": "OCCUPIED",
                    "occupant_kind": "ONLINE",
                    "journey_stage": journey_stage,
                    "payment_status": payment_status,
                    "payment_verified": payment_verified,
                    "payment_tick": payment_tick,
                    "booking_id": booking.id,
                    "held_by_me": False,
                    "held_until": None,
                }
            )

    offline_seats = (
        OfflineSeat.objects.filter(offline_boarding__trip_id=trip.id)
        .select_related("offline_boarding")
        .order_by("-offline_boarding__created_at")
    )
    for offline_seat in offline_seats:
        offline_boarding = offline_seat.offline_boarding
        if not intervals_overlap(offline_boarding.from_stop_order, offline_boarding.to_stop_order, from_order, to_order):
            continue

        seat_payload = data_by_seat_id.get(offline_seat.seat_id)
        if not seat_payload:
            continue
        seat_payload.update(
            {
                "available": False,
                "seat_state": "OCCUPIED",
                "occupant_kind": "OFFLINE",
                "journey_stage": "dropoff" if not offline_boarding.completed_at else "completed",
                "payment_status": "OFFLINE_PAID" if offline_boarding.cash_collected else "OFFLINE",
                "payment_verified": offline_boarding.cash_collected,
                "payment_tick": "PAID" if offline_boarding.cash_collected else "PENDING",
                "offline_boarding_id": offline_boarding.id,
                "offline_completed": offline_boarding.completed_at is not None,
                "held_by_me": False,
                "held_until": None,
            }
        )

    data = [data_by_seat_id[seat["id"]] for seat in all_seats]
    return {
        "trip_id": trip.id,
        "from_stop_order": from_order,
        "to_stop_order": to_order,
        "fare_per_seat": fare_per_seat,
        "selected_seat_ids": sorted(viewer_hold_ids),
        "seats": data,
    }


class TripSeatAvailabilityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, trip_id: int):
        clear_expired_seat_holds()
        from_param = request.query_params.get("from", "")
        to_param = request.query_params.get("to", "")

        trip = Trip.objects.select_related("bus", "route").filter(id=trip_id).first()
        if not trip:
            return Response({"detail": "Trip not found"}, status=404)

        # Auto-resolve full route range when params are omitted
        if not from_param or not to_param:
            if trip.start_stop_order and trip.end_stop_order:
                from_order = trip.start_stop_order
                to_order = trip.end_stop_order
            else:
                from transport.models import RouteStop
                route_stop_orders = list(
                    RouteStop.objects.filter(route=trip.route)
                    .order_by("stop_order")
                    .values_list("stop_order", flat=True)
                )
                if len(route_stop_orders) >= 2:
                    from_order = route_stop_orders[0]
                    to_order = route_stop_orders[-1]
                else:
                    return Response({"detail": "Provide valid from and to query params"}, status=400)
        else:
            try:
                from_order = int(from_param)
                to_order = int(to_param)
            except (ValueError, TypeError):
                return Response({"detail": "Provide valid from and to query params"}, status=400)
            if from_order < 1 or to_order < 2 or to_order <= from_order:
                return Response({"detail": "Provide valid from and to query params"}, status=400)

        viewer_id = request.user.id if getattr(request.user, "is_authenticated", False) else None
        return Response(_seat_availability_payload(trip, from_order, to_order, viewer_id=viewer_id))


class PassengerSeatHoldView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, trip_id: int):
        clear_expired_seat_holds()
        trip = Trip.objects.select_related("route", "bus").filter(id=trip_id, status=Trip.Status.LIVE).first()
        if not trip:
            return Response({"detail": "Trip not found or not LIVE"}, status=404)

        existing_booking = (
            Booking.objects.filter(passenger=request.user, status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED])
            .exclude(trip_id=trip_id)
            .order_by("-created_at")
            .first()
        )
        if existing_booking:
            return Response(
                {
                    "detail": "You already have an active ride. Complete or cancel it before reserving seats on another bus.",
                    "booking_id": existing_booking.id,
                    "trip_id": existing_booking.trip_id,
                },
                status=400,
            )

        serializer = SeatHoldSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from_order = serializer.validated_data["from_stop_order"]
        to_order = serializer.validated_data["to_stop_order"]
        seat_ids = serializer.validated_data["seat_ids"]

        ensure_bus_seats(trip.bus)
        valid_bus_seat_ids = set(Seat.objects.filter(bus=trip.bus, id__in=seat_ids).values_list("id", flat=True))
        if len(valid_bus_seat_ids) != len(seat_ids):
            return Response({"detail": "One or more seats are invalid for this bus"}, status=400)

        with transaction.atomic():
            SeatHold.objects.filter(passenger=request.user, trip=trip).delete()

            if seat_ids:
                try:
                    validate_seats_available(
                        trip.id,
                        from_order,
                        to_order,
                        seat_ids,
                        exclude_passenger_id=request.user.id,
                    )
                except ValueError as error:
                    return Response({"detail": str(error)}, status=400)

                expires_at = timezone.now() + timedelta(minutes=SEAT_HOLD_MINUTES)
                SeatHold.objects.bulk_create(
                    [
                        SeatHold(
                            trip=trip,
                            passenger=request.user,
                            seat_id=seat_id,
                            from_stop_order=from_order,
                            to_stop_order=to_order,
                            expires_at=expires_at,
                        )
                        for seat_id in seat_ids
                    ]
                )

        payload = _seat_availability_payload(trip, from_order, to_order, viewer_id=request.user.id)
        payload["hold_expires_in_seconds"] = SEAT_HOLD_MINUTES * 60 if seat_ids else 0
        return Response(payload, status=200)


class CreateBookingView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, trip_id: int):
        existing_booking = (
            Booking.objects
            .filter(passenger=request.user, status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED])
            .order_by("-created_at")
            .first()
        )
        if existing_booking:
            return Response(
                {
                    "detail": "You already have an active ride. Complete or cancel it before booking another one.",
                    "booking_id": existing_booking.id,
                    "trip_id": existing_booking.trip_id,
                },
                status=400,
            )

        trip = Trip.objects.select_related("route", "bus").filter(id=trip_id, status=Trip.Status.LIVE).first()
        if not trip:
            return Response({"detail": "Trip not found or not LIVE"}, status=404)

        ser = CreateBookingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from_order = ser.validated_data["from_stop_order"]
        to_order = ser.validated_data["to_stop_order"]
        seat_ids = ser.validated_data["seat_ids"]

        ensure_bus_seats(trip.bus)
        # Validate seat ids belong to this bus
        valid_bus_seat_ids = set(Seat.objects.filter(bus=trip.bus, id__in=seat_ids).values_list("id", flat=True))
        if len(valid_bus_seat_ids) != len(seat_ids):
            return Response({"detail": "One or more seats are invalid for this bus"}, status=400)

        # Segment availability validation
        try:
            validate_seats_available(trip.id, from_order, to_order, seat_ids, exclude_passenger_id=request.user.id)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        # Fare
        try:
            per_seat_fare = get_fare_for_segment(trip.route_id, from_order, to_order)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        total = per_seat_fare * len(seat_ids)

        booking = Booking.objects.create(
            trip=trip,
            passenger=request.user,
            from_stop_order=from_order,
            to_stop_order=to_order,
            seats_count=len(seat_ids),
            status=Booking.Status.CONFIRMED,
            boarding_otp=_generate_trip_boarding_otp(trip),
            journey_status=Booking.JourneyStatus.BOOKED,
            fare_total=total,
            discount_applied_amount=0,
        )
        for sid in seat_ids:
            BookingSeat.objects.create(booking=booking, seat_id=sid)
        SeatHold.objects.filter(passenger=request.user, trip=trip).delete()

        booking = _booking_queryset().filter(id=booking.id).first()
        emit_booking_event(
            booking,
            "BOOKING_CREATED",
            actor=request.user,
            message=f"Booking #{booking.id} was created and your 4-digit ride OTP is ready.",
        )
        return Response(BookingSerializer(booking).data, status=201)


class CreateOfflineBoardingView(APIView):
    permission_classes = [IsAuthenticated, IsHelper]

    def post(self, request, trip_id: int):
        trip = Trip.objects.select_related("bus").filter(id=trip_id, status=Trip.Status.LIVE).first()
        if not trip:
            return Response({"detail": "Trip not found or not LIVE"}, status=404)

        ser = OfflineCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from_order = ser.validated_data["from_stop_order"]
        to_order = ser.validated_data["to_stop_order"]
        seat_ids = ser.validated_data["seat_ids"]

        ensure_bus_seats(trip.bus)
        valid_bus_seat_ids = set(Seat.objects.filter(bus=trip.bus, id__in=seat_ids).values_list("id", flat=True))
        if len(valid_bus_seat_ids) != len(seat_ids):
            return Response({"detail": "One or more seats are invalid for this bus"}, status=400)

        try:
            validate_seats_available(trip.id, from_order, to_order, seat_ids)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        ob = OfflineBoarding.objects.create(
            trip=trip,
            helper=request.user,
            from_stop_order=from_order,
            to_stop_order=to_order,
            seats_count=len(seat_ids),
        )
        for sid in seat_ids:
            OfflineSeat.objects.create(offline_boarding=ob, seat_id=sid)

        return Response({
            "offline_boarding": OfflineBoardingSerializer(ob).data,
            "seat_ids": seat_ids,
        }, status=201)


class HelperBookingLookupView(APIView):
    permission_classes = [IsAuthenticated, IsHelper]

    def post(self, request):
        ser = HelperLookupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        booking, _parsed = _resolve_ticket_booking(ser.validated_data["reference"])
        if not booking:
            return Response({"detail": "Booking ticket not found."}, status=404)
        if not _can_manage_booking(request.user, booking):
            return Response({"detail": "This ticket does not belong to your assigned trip."}, status=403)

        return Response({"booking": HelperBookingTicketSerializer(booking).data})


class BookingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, booking_id: int):
        booking = _booking_queryset().filter(id=booking_id).first()
        if not booking:
            return Response({"detail": "Booking not found."}, status=404)

        if request.user.is_superuser or request.user.role == "ADMIN":
            serializer = BookingSerializer(booking)
        elif request.user.role == "PASSENGER":
            if booking.passenger_id != request.user.id:
                return Response({"detail": "This booking does not belong to you."}, status=403)
            serializer = PassengerBookingListSerializer(booking)
        elif request.user.role == "HELPER":
            if not _can_manage_booking(request.user, booking):
                return Response({"detail": "This booking does not belong to your assigned trip."}, status=403)
            serializer = HelperBookingTicketSerializer(booking)
        else:
            return Response({"detail": "You do not have access to this booking."}, status=403)

        return Response({"booking": serializer.data})


class PassengerBookingReviewView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, booking_id: int):
        booking = _booking_queryset().filter(id=booking_id, passenger=request.user).first()
        if not booking:
            return Response({"detail": "Booking not found."}, status=404)
        if not (booking.completed_at or booking.status == Booking.Status.COMPLETED):
            return Response({"detail": "You can review a ride only after it is completed."}, status=400)

        serializer = BookingReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review, _created = BookingReview.objects.update_or_create(
            booking=booking,
            defaults={
                "passenger": request.user,
                "rating": serializer.validated_data["rating"],
                "note": serializer.validated_data.get("note", ""),
            },
        )
        return Response(
            {
                "message": "Thanks for reviewing your MetroBus ride.",
                "review": BookingReviewSerializer(review).data,
            },
            status=200,
        )


class HelperVerifyBookingOtpView(APIView):
    permission_classes = [IsAuthenticated, IsHelper]

    def post(self, request):
        ser = HelperLookupSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        reference = ser.validated_data["reference"]
        booking, parsed_otp, matched_booking = _resolve_helper_booking_by_otp(request.user, reference)
        if len(parsed_otp) != 4:
            return Response({"detail": "Enter the passenger 4-digit ride OTP."}, status=400)
        if not booking:
            if matched_booking and matched_booking.trip.helper_id and matched_booking.trip.helper_id != request.user.id:
                assigned_helper = getattr(matched_booking.trip, "helper", None)
                helper_name = getattr(assigned_helper, "full_name", "") or "the assigned helper"
                helper_phone = getattr(assigned_helper, "phone", "") or "the assigned helper account"
                return Response(
                    {
                        "detail": f"This OTP belongs to trip #{matched_booking.trip_id} and is assigned to {helper_name} ({helper_phone}). Sign in with that helper account to continue.",
                    },
                    status=403,
                )
            return Response({"detail": "No active passenger ride matches that 4-digit OTP."}, status=404)
        if booking.status == Booking.Status.CANCELLED:
            return Response({"detail": "This ride was cancelled by the passenger."}, status=400)
        if booking.status in {Booking.Status.COMPLETED, Booking.Status.NO_SHOW} or booking.completed_at:
            return Response({"detail": "This ticket has already been completed and cannot be reused."}, status=400)
        if booking.checked_in_at:
            return Response({"detail": "This ticket has already been used for boarding."}, status=400)

        booking.scanned_at = timezone.now()
        booking.scanned_by = request.user
        advance_booking_journey_status(booking, Booking.JourneyStatus.SCANNED)
        booking.save(update_fields=["scanned_at", "scanned_by", "journey_status"])
        booking = _booking_queryset().filter(id=booking.id).first()
        emit_booking_event(
            booking,
            "BOOKING_SCANNED",
            actor=request.user,
            message=f"Booking #{booking.id} was verified with the helper OTP check.",
        )

        return Response(
            {
                "message": "Ride OTP verified. Passenger booking loaded successfully.",
                "booking": HelperBookingTicketSerializer(booking).data,
            },
            status=200,
        )


class HelperAcceptBookingView(APIView):
    permission_classes = [IsAuthenticated, IsHelper]

    def post(self, request, booking_id: int):
        booking = _booking_queryset().filter(id=booking_id).first()
        if not booking:
            return Response({"detail": "Booking not found."}, status=404)
        if not _can_manage_booking(request.user, booking):
            return Response({"detail": "This booking does not belong to your assigned trip."}, status=403)
        if booking.status == Booking.Status.COMPLETED:
            return Response(
                {"message": "This ride is already completed.", "booking": HelperBookingTicketSerializer(booking).data},
                status=200,
            )
        if booking.status == Booking.Status.CANCELLED:
            return Response({"detail": "This ride was cancelled by the passenger."}, status=400)
        if booking.accepted_by_helper_at:
            return Response(
                {"message": "Ride details already accepted by the helper.", "booking": HelperBookingTicketSerializer(booking).data},
                status=200,
            )

        booking.accepted_by_helper_at = timezone.now()
        booking.accepted_by_helper = request.user
        advance_booking_journey_status(booking, Booking.JourneyStatus.SCANNED)
        booking.save(update_fields=["accepted_by_helper_at", "accepted_by_helper", "journey_status"])
        booking = _booking_queryset().filter(id=booking.id).first()
        emit_booking_event(
            booking,
            "BOOKING_ACCEPTED",
            actor=request.user,
            message="A helper accepted your ride details and is ready to handle payment.",
        )
        return Response(
            {"message": "Passenger ride accepted. You can now request payment or board the passenger when ready.", "booking": HelperBookingTicketSerializer(booking).data},
            status=200,
        )


class HelperBoardBookingView(APIView):
    permission_classes = [IsAuthenticated, IsHelper]

    def post(self, request, booking_id: int):
        serializer = HelperBoardBookingActionSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        request_payment = serializer.validated_data["request_payment"]

        booking = _booking_queryset().filter(id=booking_id).first()
        if not booking:
            return Response({"detail": "Booking not found."}, status=404)
        if not _can_manage_booking(request.user, booking):
            return Response({"detail": "This booking does not belong to your assigned trip."}, status=403)
        if booking.status == Booking.Status.COMPLETED:
            return Response(
                {"message": "This ride is already completed.", "booking": HelperBookingTicketSerializer(booking).data},
                status=200,
            )
        if booking.status == Booking.Status.CANCELLED:
            return Response({"detail": "This ride was cancelled by the passenger."}, status=400)

        payment = getattr(booking, "payment", None)
        payment_is_success = bool(payment and payment.status == "SUCCESS")
        accepted_during_board = False
        requested_during_board = False
        newly_boarded = False
        update_fields = []

        if not booking.accepted_by_helper_at:
            booking.accepted_by_helper_at = timezone.now()
            booking.accepted_by_helper = request.user
            accepted_during_board = True
            update_fields.extend(["accepted_by_helper_at", "accepted_by_helper"])

        if request_payment and not payment_is_success:
            booking.payment_requested_at = timezone.now()
            booking.payment_requested_by = request.user
            requested_during_board = True
            update_fields.extend(["payment_requested_at", "payment_requested_by"])

        if not booking.checked_in_at:
            booking.checked_in_at = timezone.now()
            booking.checked_in_by = request.user
            advance_booking_journey_status(booking, Booking.JourneyStatus.BOARDED)
            newly_boarded = True
            update_fields.extend(["checked_in_at", "checked_in_by", "journey_status"])
        elif requested_during_board:
            advance_booking_journey_status(booking, Booking.JourneyStatus.BOARDED)
            update_fields.append("journey_status")

        if update_fields:
            booking.save(update_fields=list(dict.fromkeys(update_fields)))
            booking = _booking_queryset().filter(id=booking.id).first()

        if requested_during_board:
            emit_booking_event(
                booking,
                "PAYMENT_REQUESTED",
                actor=request.user,
                message="Payment request sent to the passenger while they board the bus.",
            )
        if newly_boarded:
            emit_booking_event(
                booking,
                "BOARDING_CONFIRMED",
                actor=request.user,
                message="Boarding confirmed. Your ride is now marked as boarded.",
            )

        if request_payment and newly_boarded and not payment_is_success:
            message = "Passenger boarded and payment request sent to the passenger."
        elif request_payment and not payment_is_success:
            message = "Passenger is already onboard. Payment request sent to the passenger."
        elif newly_boarded:
            message = "Passenger marked as boarded."
        else:
            message = "Passenger is already onboard."

        return Response(
            {"message": message, "booking": HelperBookingTicketSerializer(booking).data},
            status=200,
        )


class HelperRequestBookingPaymentView(APIView):
    permission_classes = [IsAuthenticated, IsHelper]

    def post(self, request, booking_id: int):
        booking = _booking_queryset().filter(id=booking_id).first()
        if not booking:
            return Response({"detail": "Booking not found."}, status=404)
        if not _can_manage_booking(request.user, booking):
            return Response({"detail": "This booking does not belong to your assigned trip."}, status=403)
        if booking.status == Booking.Status.COMPLETED:
            return Response({"detail": "This ride is already completed."}, status=400)
        if booking.status == Booking.Status.CANCELLED:
            return Response({"detail": "This ride was cancelled by the passenger."}, status=400)

        accepted_during_request = False
        if not booking.accepted_by_helper_at:
            booking.accepted_by_helper_at = timezone.now()
            booking.accepted_by_helper = request.user
            accepted_during_request = True

        payment = getattr(booking, "payment", None)
        if payment and payment.status == "SUCCESS":
            if accepted_during_request:
                next_status = Booking.JourneyStatus.BOARDED if booking.checked_in_at else Booking.JourneyStatus.PAID
                advance_booking_journey_status(booking, next_status)
                booking.save(update_fields=["accepted_by_helper_at", "accepted_by_helper", "journey_status"])
                booking = _booking_queryset().filter(id=booking.id).first()
            return Response(
                {
                    "message": "This booking is already paid.",
                    "booking": HelperBookingTicketSerializer(booking).data,
                },
                status=200,
            )

        booking.payment_requested_at = timezone.now()
        booking.payment_requested_by = request.user
        next_status = Booking.JourneyStatus.BOARDED if booking.checked_in_at else Booking.JourneyStatus.PAYMENT_REQUESTED
        advance_booking_journey_status(booking, next_status)
        update_fields = ["payment_requested_at", "payment_requested_by", "journey_status"]
        if accepted_during_request:
            update_fields.extend(["accepted_by_helper_at", "accepted_by_helper"])
        booking.save(update_fields=update_fields)
        booking = _booking_queryset().filter(id=booking.id).first()

        message = "Payment request sent to the passenger. Ask them to choose a payment option in MetroBus."
        if accepted_during_request:
            message = "Ride accepted and payment request sent to the passenger. Ask them to choose a payment option in MetroBus."
        elif booking.checked_in_at:
            message = "Passenger is onboard. Payment request sent to the passenger. Ask them to choose a payment option in MetroBus."

        emit_booking_event(
            booking,
            "PAYMENT_REQUESTED",
            actor=request.user,
            message=message,
        )
        return Response(
            {
                "message": message,
                "booking": HelperBookingTicketSerializer(booking).data,
            },
            status=200,
        )


class HelperCompleteBookingView(APIView):
    permission_classes = [IsAuthenticated, IsHelper]

    def post(self, request, booking_id: int):
        booking = _booking_queryset().filter(id=booking_id).first()
        if not booking:
            return Response({"detail": "Booking not found."}, status=404)
        if not _can_manage_booking(request.user, booking):
            return Response({"detail": "This booking does not belong to your assigned trip."}, status=403)
        if booking.status == Booking.Status.COMPLETED:
            return Response(
                {"message": "Ride already completed and seat already released.", "booking": HelperBookingTicketSerializer(booking).data},
                status=200,
            )
        if booking.status == Booking.Status.CANCELLED:
            return Response({"detail": "This ride was cancelled by the passenger."}, status=400)
        if not booking.accepted_by_helper_at:
            return Response({"detail": "Accept the passenger ride details before completing the ride."}, status=400)
        if not booking.checked_in_at:
            return Response({"detail": "Passenger must be boarded before completing the ride."}, status=400)

        booking.status = Booking.Status.COMPLETED
        booking.completed_at = timezone.now()
        booking.completed_by = request.user
        booking.journey_status = Booking.JourneyStatus.COMPLETED
        booking.save(update_fields=["status", "completed_at", "completed_by", "journey_status"])
        booking = _booking_queryset().filter(id=booking.id).first()
        emit_booking_event(
            booking,
            "BOARDING_COMPLETED",
            actor=request.user,
            message="Ride completed and the seat is now free for the next segment.",
        )

        return Response(
            {"message": "Ride completed and the seat is now free for the next segment.", "booking": HelperBookingTicketSerializer(booking).data},
            status=200,
        )


class OfflineCollectCashView(APIView):
    """Helper marks cash as collected for an offline-boarded passenger."""
    permission_classes = [IsAuthenticated, IsHelper]

    def post(self, request, offline_boarding_id: int):
        ob = OfflineBoarding.objects.select_related("trip").filter(id=offline_boarding_id).first()
        if not ob:
            return Response({"detail": "Offline boarding record not found."}, status=404)
        # Ensure this helper is assigned to the trip
        if ob.trip.helper_id and ob.trip.helper_id != request.user.id:
            return Response({"detail": "This offline boarding does not belong to your trip."}, status=403)
        if ob.completed_at:
            return Response({"detail": "This offline passenger ride is already completed."}, status=400)

        if ob.cash_collected:
            return Response({"detail": "Cash has already been marked as collected.", "offline_boarding_id": ob.id}, status=200)

        ob.cash_collected = True
        ob.cash_collected_at = timezone.now()
        ob.save(update_fields=["cash_collected", "cash_collected_at"])
        return Response(
            {"message": "Cash collected for offline passenger.", "offline_boarding_id": ob.id, "cash_collected": True},
            status=200,
        )


class OfflineCompleteView(APIView):
    """Helper ends the ride for an offline-boarded passenger, freeing the seat."""
    permission_classes = [IsAuthenticated, IsHelper]

    def post(self, request, offline_boarding_id: int):
        ob = OfflineBoarding.objects.select_related("trip").filter(id=offline_boarding_id).first()
        if not ob:
            return Response({"detail": "Offline boarding record not found."}, status=404)
        if ob.trip.helper_id and ob.trip.helper_id != request.user.id:
            return Response({"detail": "This offline boarding does not belong to your trip."}, status=403)

        if ob.completed_at:
            return Response({"detail": "This offline passenger ride is already completed.", "offline_boarding_id": ob.id}, status=200)

        ob.completed_at = timezone.now()
        ob.save(update_fields=["completed_at"])
        return Response(
            {"message": "Offline passenger ride completed. Seat is now free.", "offline_boarding_id": ob.id},
            status=200,
        )
