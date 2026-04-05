from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from transport.models import Seat
from transport.services import ensure_bus_seats
from trips.models import Trip
from .models import Booking, BookingSeat, OfflineBoarding, OfflineSeat
from .serializers import (
    BookingSerializer,
    CreateBookingSerializer,
    OfflineCreateSerializer,
    OfflineBoardingSerializer,
    PassengerBookingListSerializer,
    HelperLookupSerializer,
    HelperBookingTicketSerializer,
)
from .permissions import IsPassenger, IsHelper
from .services import validate_seats_available, get_fare_for_segment, get_taken_seat_ids_for_trip
from .tickets import parse_ticket_reference


def _booking_queryset():
    return (
        Booking.objects.select_related("trip__route", "trip__bus", "passenger", "payment", "payment_requested_by", "accepted_by_helper")
        .prefetch_related("booking_seats__seat", "trip__route__route_stops__stop")
    )


def _resolve_ticket_booking(reference):
    parsed = parse_ticket_reference(reference)
    queryset = _booking_queryset()
    if parsed["booking_id"]:
        return queryset.filter(id=parsed["booking_id"]).first()
    if parsed["ticket_code"]:
        return queryset.filter(ticket_code=parsed["ticket_code"]).first()
    return None


def _can_manage_booking(user, booking):
    if not booking:
        return False
    return bool(user.is_superuser or booking.trip.helper_id == user.id)


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


class TripSeatAvailabilityView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, trip_id: int):
        from_order = int(request.query_params.get("from", "0"))
        to_order = int(request.query_params.get("to", "0"))
        if from_order < 1 or to_order < 2 or to_order <= from_order:
            return Response({"detail": "Provide valid from and to query params"}, status=400)

        trip = Trip.objects.select_related("bus").filter(id=trip_id).first()
        if not trip:
            return Response({"detail": "Trip not found"}, status=404)

        ensure_bus_seats(trip.bus)
        try:
            fare_per_seat = get_fare_for_segment(trip.route_id, from_order, to_order)
        except ValueError:
            fare_per_seat = None
        all_seats = Seat.objects.filter(bus=trip.bus).order_by("seat_no").values("id", "seat_no")
        taken = get_taken_seat_ids_for_trip(trip_id, from_order, to_order)

        data = []
        for s in all_seats:
            data.append({
                "seat_id": s["id"],
                "seat_no": s["seat_no"],
                "available": s["id"] not in taken,
            })

        return Response({
            "trip_id": trip_id,
            "from_stop_order": from_order,
            "to_stop_order": to_order,
            "fare_per_seat": fare_per_seat,
            "seats": data,
        })


class CreateBookingView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, trip_id: int):
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
            validate_seats_available(trip.id, from_order, to_order, seat_ids)
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
            fare_total=total,
            discount_applied_amount=0,
        )
        for sid in seat_ids:
            BookingSeat.objects.create(booking=booking, seat_id=sid)

        booking = _booking_queryset().filter(id=booking.id).first()
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

        booking = _resolve_ticket_booking(ser.validated_data["reference"])
        if not booking:
            return Response({"detail": "Booking ticket not found."}, status=404)
        if not _can_manage_booking(request.user, booking):
            return Response({"detail": "This ticket does not belong to your assigned trip."}, status=403)

        return Response({"booking": HelperBookingTicketSerializer(booking).data})


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
        if booking.accepted_by_helper_at:
            return Response(
                {"message": "Ride details already accepted by the helper.", "booking": HelperBookingTicketSerializer(booking).data},
                status=200,
            )

        booking.accepted_by_helper_at = timezone.now()
        booking.accepted_by_helper = request.user
        booking.save(update_fields=["accepted_by_helper_at", "accepted_by_helper"])
        booking = _booking_queryset().filter(id=booking.id).first()
        return Response(
            {"message": "Passenger ride accepted. You can now request payment or board the passenger when ready.", "booking": HelperBookingTicketSerializer(booking).data},
            status=200,
        )


class HelperBoardBookingView(APIView):
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
        if not booking.accepted_by_helper_at:
            return Response({"detail": "Accept the passenger ride details before boarding."}, status=400)

        payment = getattr(booking, "payment", None)
        if not payment:
            return Response({"detail": "Passenger must choose a payment method before boarding."}, status=400)
        if payment.status != "SUCCESS":
            return Response({"detail": "Payment is not verified yet."}, status=400)

        if not booking.checked_in_at:
            booking.checked_in_at = timezone.now()
            booking.checked_in_by = request.user
            booking.save(update_fields=["checked_in_at", "checked_in_by"])
            booking = _booking_queryset().filter(id=booking.id).first()

        return Response(
            {"message": "Passenger marked as boarded.", "booking": HelperBookingTicketSerializer(booking).data},
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

        accepted_during_request = False
        if not booking.accepted_by_helper_at:
            booking.accepted_by_helper_at = timezone.now()
            booking.accepted_by_helper = request.user
            accepted_during_request = True

        payment = getattr(booking, "payment", None)
        if payment and payment.status == "SUCCESS":
            if accepted_during_request:
                booking.save(update_fields=["accepted_by_helper_at", "accepted_by_helper"])
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
        update_fields = ["payment_requested_at", "payment_requested_by"]
        if accepted_during_request:
            update_fields.extend(["accepted_by_helper_at", "accepted_by_helper"])
        booking.save(update_fields=update_fields)
        booking = _booking_queryset().filter(id=booking.id).first()

        message = "Payment request sent to the passenger. Ask them to choose a payment option in MetroBus."
        if accepted_during_request:
            message = "Ride accepted and payment request sent to the passenger. Ask them to choose a payment option in MetroBus."

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
        if not booking.accepted_by_helper_at:
            return Response({"detail": "Accept the passenger ride details before completing the ride."}, status=400)
        if not booking.checked_in_at:
            return Response({"detail": "Passenger must be boarded before completing the ride."}, status=400)

        booking.status = Booking.Status.COMPLETED
        booking.completed_at = timezone.now()
        booking.completed_by = request.user
        booking.save(update_fields=["status", "completed_at", "completed_by"])
        booking = _booking_queryset().filter(id=booking.id).first()

        return Response(
            {"message": "Ride completed and the seat is now free for the next segment.", "booking": HelperBookingTicketSerializer(booking).data},
            status=200,
        )
