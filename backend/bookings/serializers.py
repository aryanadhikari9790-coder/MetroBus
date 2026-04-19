from rest_framework import serializers

from .models import Booking, BookingReview, BookingSeat, OfflineBoarding, OfflineSeat


def booking_payment_status_label(booking):
    payment = getattr(booking, "payment", None)
    if payment:
        return payment.status
    if booking.checked_in_at or booking.payment_requested_at:
        return "PENDING"
    return "UNPAID"
class BookingSeatSerializer(serializers.ModelSerializer):
    seat_no = serializers.CharField(source="seat.seat_no", read_only=True)

    class Meta:
        model = BookingSeat
        fields = ("id", "seat", "seat_no")


class BookingReviewSerializer(serializers.ModelSerializer):
    passenger_name = serializers.CharField(source="passenger.full_name", read_only=True)

    class Meta:
        model = BookingReview
        fields = ("id", "rating", "note", "passenger_name", "created_at", "updated_at")
        read_only_fields = ("id", "passenger_name", "created_at", "updated_at")


class PaymentSummaryFieldMixin:
    def _payment_summary(self, obj):
        payment = getattr(obj, "payment", None)
        if not payment:
            return None
        return {
            "id": payment.id,
            "method": payment.method,
            "status": payment.status,
            "amount": payment.amount,
            "reference": payment.reference,
            "verified_at": payment.verified_at,
        }

    def _route_stop_name(self, obj, order):
        route_stops = getattr(obj.trip.route, "route_stops_cache", None)
        if route_stops is None:
            route_stops = list(obj.trip.route.route_stops.select_related("stop").order_by("stop_order"))
        match = next((item for item in route_stops if item.stop_order == order), None)
        return match.stop.name if match else f"Stop {order}"

    def _payment_status_label(self, obj):
        return booking_payment_status_label(obj)


class BookingSerializer(PaymentSummaryFieldMixin, serializers.ModelSerializer):
    seats = BookingSeatSerializer(source="booking_seats", many=True, read_only=True)
    route_name = serializers.CharField(source="trip.route.name", read_only=True)
    bus_plate = serializers.CharField(source="trip.bus.plate_number", read_only=True)
    passenger_name = serializers.CharField(source="passenger.full_name", read_only=True)
    passenger_phone = serializers.CharField(source="passenger.phone", read_only=True)
    payment = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    pickup_stop_name = serializers.SerializerMethodField()
    destination_stop_name = serializers.SerializerMethodField()
    seat_labels = serializers.SerializerMethodField()
    boarding_otp = serializers.CharField(read_only=True)
    journey_status_label = serializers.SerializerMethodField()
    payment_requested_by_name = serializers.CharField(source="payment_requested_by.full_name", read_only=True)
    accepted_by_helper_name = serializers.CharField(source="accepted_by_helper.full_name", read_only=True)
    scanned_by_name = serializers.CharField(source="scanned_by.full_name", read_only=True)
    cancelled_by_name = serializers.CharField(source="cancelled_by.full_name", read_only=True)
    needs_payment_selection = serializers.SerializerMethodField()
    payment_pending_verification = serializers.SerializerMethodField()
    cancellation_reason_label = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "trip",
            "passenger",
            "passenger_name",
            "passenger_phone",
            "route_name",
            "bus_plate",
            "from_stop_order",
            "to_stop_order",
            "seats_count",
            "status",
            "ticket_code",
            "boarding_otp",
            "journey_status",
            "journey_status_label",
            "fare_total",
            "discount_applied_amount",
            "scanned_at",
            "scanned_by_name",
            "payment_requested_at",
            "payment_requested_by_name",
            "accepted_by_helper_at",
            "accepted_by_helper_name",
            "cancelled_at",
            "cancelled_by_name",
            "cancellation_reason",
            "cancellation_reason_label",
            "cancellation_note",
            "payment_status",
            "payment_method",
            "payment",
            "needs_payment_selection",
            "payment_pending_verification",
            "can_cancel",
            "review",
            "pickup_stop_name",
            "destination_stop_name",
            "seat_labels",
            "checked_in_at",
            "completed_at",
            "created_at",
            "seats",
        )
        read_only_fields = (
            "id",
            "passenger",
            "status",
            "ticket_code",
            "fare_total",
            "discount_applied_amount",
            "journey_status",
            "scanned_at",
            "checked_in_at",
            "completed_at",
            "created_at",
        )

    def get_payment(self, obj):
        return self._payment_summary(obj)

    def get_payment_status(self, obj):
        return self._payment_status_label(obj)

    def get_payment_method(self, obj):
        payment = getattr(obj, "payment", None)
        return payment.method if payment else None

    def get_pickup_stop_name(self, obj):
        return self._route_stop_name(obj, obj.from_stop_order)

    def get_destination_stop_name(self, obj):
        return self._route_stop_name(obj, obj.to_stop_order)

    def get_seat_labels(self, obj):
        return [seat.seat.seat_no for seat in obj.booking_seats.all()]

    def get_journey_status_label(self, obj):
        return obj.get_journey_status_display()

    def get_needs_payment_selection(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(obj.payment_requested_at and (not payment or payment.status in {"FAILED", "CANCELLED"}))

    def get_payment_pending_verification(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(payment and payment.status == "PENDING")

    def get_cancellation_reason_label(self, obj):
        return obj.get_cancellation_reason_display() if obj.cancellation_reason else ""

    def get_can_cancel(self, obj):
        return bool(obj.status in {Booking.Status.CONFIRMED, Booking.Status.PENDING})

    def get_review(self, obj):
        review = getattr(obj, "review", None)
        return BookingReviewSerializer(review).data if review else None


class PassengerBookingListSerializer(PaymentSummaryFieldMixin, serializers.ModelSerializer):
    trip_id = serializers.IntegerField(source="trip.id", read_only=True)
    route_name = serializers.CharField(source="trip.route.name", read_only=True)
    bus_plate = serializers.CharField(source="trip.bus.plate_number", read_only=True)
    trip_status = serializers.CharField(source="trip.status", read_only=True)
    payment_status = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    payment = serializers.SerializerMethodField()
    pickup_stop_name = serializers.SerializerMethodField()
    destination_stop_name = serializers.SerializerMethodField()
    seat_labels = serializers.SerializerMethodField()
    passenger_name = serializers.CharField(source="passenger.full_name", read_only=True)
    passenger_phone = serializers.CharField(source="passenger.phone", read_only=True)
    boarding_otp = serializers.CharField(read_only=True)
    journey_status_label = serializers.SerializerMethodField()
    started_at = serializers.DateTimeField(source="trip.started_at", read_only=True)
    ended_at = serializers.DateTimeField(source="trip.ended_at", read_only=True)
    payment_requested_by_name = serializers.CharField(source="payment_requested_by.full_name", read_only=True)
    accepted_by_helper_name = serializers.CharField(source="accepted_by_helper.full_name", read_only=True)
    scanned_by_name = serializers.CharField(source="scanned_by.full_name", read_only=True)
    cancelled_by_name = serializers.CharField(source="cancelled_by.full_name", read_only=True)
    needs_payment_selection = serializers.SerializerMethodField()
    payment_pending_verification = serializers.SerializerMethodField()
    cancellation_reason_label = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "trip_id",
            "status",
            "fare_total",
            "created_at",
            "route_name",
            "bus_plate",
            "passenger_name",
            "passenger_phone",
            "ticket_code",
            "boarding_otp",
            "journey_status",
            "journey_status_label",
            "trip_status",
            "scanned_at",
            "scanned_by_name",
            "payment_requested_at",
            "payment_requested_by_name",
            "accepted_by_helper_at",
            "accepted_by_helper_name",
            "cancelled_at",
            "cancelled_by_name",
            "cancellation_reason",
            "cancellation_reason_label",
            "cancellation_note",
            "payment_status",
            "payment_method",
            "payment",
            "needs_payment_selection",
            "payment_pending_verification",
            "can_cancel",
            "review",
            "pickup_stop_name",
            "destination_stop_name",
            "seat_labels",
            "seats_count",
            "checked_in_at",
            "completed_at",
            "started_at",
            "ended_at",
        )

    def get_payment_status(self, obj):
        return self._payment_status_label(obj)

    def get_payment_method(self, obj):
        payment = getattr(obj, "payment", None)
        return payment.method if payment else None

    def get_payment(self, obj):
        return self._payment_summary(obj)

    def get_pickup_stop_name(self, obj):
        return self._route_stop_name(obj, obj.from_stop_order)

    def get_destination_stop_name(self, obj):
        return self._route_stop_name(obj, obj.to_stop_order)

    def get_seat_labels(self, obj):
        return [seat.seat.seat_no for seat in obj.booking_seats.all()]

    def get_journey_status_label(self, obj):
        return obj.get_journey_status_display()

    def get_needs_payment_selection(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(obj.payment_requested_at and (not payment or payment.status in {"FAILED", "CANCELLED"}))

    def get_payment_pending_verification(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(payment and payment.status == "PENDING")

    def get_cancellation_reason_label(self, obj):
        return obj.get_cancellation_reason_display() if obj.cancellation_reason else ""

    def get_can_cancel(self, obj):
        return bool(obj.status in {Booking.Status.CONFIRMED, Booking.Status.PENDING})

    def get_review(self, obj):
        review = getattr(obj, "review", None)
        return BookingReviewSerializer(review).data if review else None


class CreateBookingSerializer(serializers.Serializer):
    from_stop_order = serializers.IntegerField(min_value=1)
    to_stop_order = serializers.IntegerField(min_value=2)
    seat_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)

    def validate(self, attrs):
        if attrs["to_stop_order"] <= attrs["from_stop_order"]:
            raise serializers.ValidationError("to_stop_order must be greater than from_stop_order")
        if len(set(attrs["seat_ids"])) != len(attrs["seat_ids"]):
            raise serializers.ValidationError("Duplicate seat ids not allowed")
        return attrs


class SeatHoldSyncSerializer(serializers.Serializer):
    from_stop_order = serializers.IntegerField(min_value=1)
    to_stop_order = serializers.IntegerField(min_value=2)
    seat_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)

    def validate(self, attrs):
        if attrs["to_stop_order"] <= attrs["from_stop_order"]:
            raise serializers.ValidationError("to_stop_order must be greater than from_stop_order")
        seat_ids = attrs.get("seat_ids") or []
        if len(set(seat_ids)) != len(seat_ids):
            raise serializers.ValidationError("Duplicate seat ids not allowed")
        attrs["seat_ids"] = seat_ids
        return attrs


class OfflineCreateSerializer(serializers.Serializer):
    from_stop_order = serializers.IntegerField(min_value=1)
    to_stop_order = serializers.IntegerField(min_value=2)
    seat_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)

    def validate(self, attrs):
        if attrs["to_stop_order"] <= attrs["from_stop_order"]:
            raise serializers.ValidationError("to_stop_order must be greater than from_stop_order")
        if len(set(attrs["seat_ids"])) != len(attrs["seat_ids"]):
            raise serializers.ValidationError("Duplicate seat ids not allowed")
        return attrs


class OfflineBoardingSerializer(serializers.ModelSerializer):
    class Meta:
        model = OfflineBoarding
        fields = ("id", "trip", "helper", "from_stop_order", "to_stop_order", "seats_count", "created_at")
        read_only_fields = ("id", "helper", "seats_count", "created_at")


class HelperLookupSerializer(serializers.Serializer):
    reference = serializers.CharField()


class HelperBoardBookingActionSerializer(serializers.Serializer):
    request_payment = serializers.BooleanField(required=False, default=False)


class PassengerCancelBookingSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(
        choices=[
            (Booking.CancellationReason.CHANGE_OF_PLANS, "Change of plans"),
            (Booking.CancellationReason.WRONG_ROUTE, "Booked the wrong route"),
            (Booking.CancellationReason.DELAY, "Bus arrival delay"),
            (Booking.CancellationReason.PAYMENT_ISSUE, "Payment issue"),
            (Booking.CancellationReason.EMERGENCY, "Emergency or urgent issue"),
            (Booking.CancellationReason.LOGOUT, "Passenger logged out mid-ride"),
            (Booking.CancellationReason.OTHER, "Other"),
        ]
    )
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        reason = attrs.get("reason")
        note = (attrs.get("note") or "").strip()
        if reason == Booking.CancellationReason.OTHER and not note:
            raise serializers.ValidationError({"note": "Please provide a short note for the cancellation."})
        attrs["note"] = note
        return attrs


class HelperBookingTicketSerializer(PaymentSummaryFieldMixin, serializers.ModelSerializer):
    route_name = serializers.CharField(source="trip.route.name", read_only=True)
    bus_plate = serializers.CharField(source="trip.bus.plate_number", read_only=True)
    passenger_name = serializers.CharField(source="passenger.full_name", read_only=True)
    passenger_phone = serializers.CharField(source="passenger.phone", read_only=True)
    payment = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    pickup_stop_name = serializers.SerializerMethodField()
    destination_stop_name = serializers.SerializerMethodField()
    seat_labels = serializers.SerializerMethodField()
    boarding_otp = serializers.CharField(read_only=True)
    journey_status_label = serializers.SerializerMethodField()
    can_accept = serializers.SerializerMethodField()
    can_verify_cash = serializers.SerializerMethodField()
    can_verify_manual = serializers.SerializerMethodField()
    can_board = serializers.SerializerMethodField()
    can_complete = serializers.SerializerMethodField()
    can_request_payment = serializers.SerializerMethodField()
    payment_requested_by_name = serializers.CharField(source="payment_requested_by.full_name", read_only=True)
    accepted_by_helper_name = serializers.CharField(source="accepted_by_helper.full_name", read_only=True)
    scanned_by_name = serializers.CharField(source="scanned_by.full_name", read_only=True)
    cancellation_reason_label = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id",
            "status",
            "journey_status",
            "journey_status_label",
            "ticket_code",
            "boarding_otp",
            "route_name",
            "bus_plate",
            "passenger_name",
            "passenger_phone",
            "pickup_stop_name",
            "destination_stop_name",
            "seat_labels",
            "fare_total",
            "payment_status",
            "payment_method",
            "scanned_at",
            "scanned_by_name",
            "payment_requested_at",
            "payment_requested_by_name",
            "accepted_by_helper_at",
            "accepted_by_helper_name",
            "cancelled_at",
            "cancellation_reason",
            "cancellation_reason_label",
            "cancellation_note",
            "payment",
            "can_accept",
            "checked_in_at",
            "completed_at",
            "can_request_payment",
            "can_verify_cash",
            "can_verify_manual",
            "can_board",
            "can_complete",
        )

    def get_payment(self, obj):
        return self._payment_summary(obj)

    def get_payment_status(self, obj):
        return self._payment_status_label(obj)

    def get_payment_method(self, obj):
        payment = getattr(obj, "payment", None)
        return payment.method if payment else None

    def get_journey_status_label(self, obj):
        return obj.get_journey_status_display()

    def get_pickup_stop_name(self, obj):
        return self._route_stop_name(obj, obj.from_stop_order)

    def get_destination_stop_name(self, obj):
        return self._route_stop_name(obj, obj.to_stop_order)

    def get_seat_labels(self, obj):
        return [seat.seat.seat_no for seat in obj.booking_seats.all()]

    def get_can_accept(self, obj):
        return bool(
            obj.status == Booking.Status.CONFIRMED
            and not obj.completed_at
            and not obj.accepted_by_helper_at
        )

    def get_can_verify_cash(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(obj.accepted_by_helper_at and payment and payment.method == "CASH" and payment.status == "PENDING")

    def get_can_verify_manual(self, obj):
        payment = getattr(obj, "payment", None)
        if not obj.accepted_by_helper_at or obj.completed_at or obj.status != Booking.Status.CONFIRMED:
            return False
        if payment and payment.status == "SUCCESS":
            return False
        if payment and payment.method == "CASH" and payment.status == "PENDING":
            return False
        return True

    def get_can_board(self, obj):
        return bool(
            obj.status == Booking.Status.CONFIRMED
            and obj.accepted_by_helper_at
            and not obj.checked_in_at
        )

    def get_can_complete(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(
            obj.status == Booking.Status.CONFIRMED
            and obj.accepted_by_helper_at
            and obj.checked_in_at
            and not obj.completed_at
            and payment
            and payment.status == "SUCCESS"
        )

    def get_can_request_payment(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(
            obj.status == Booking.Status.CONFIRMED
            and not obj.completed_at
            and (
                not payment
                or payment.status in {"FAILED", "CANCELLED"}
            )
        )

    def get_cancellation_reason_label(self, obj):
        return obj.get_cancellation_reason_display() if obj.cancellation_reason else ""
