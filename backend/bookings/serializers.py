from rest_framework import serializers
from .models import Booking, BookingSeat, OfflineBoarding, OfflineSeat
from .tickets import build_ticket_qr_svg


class BookingSeatSerializer(serializers.ModelSerializer):
    seat_no = serializers.CharField(source="seat.seat_no", read_only=True)

    class Meta:
        model = BookingSeat
        fields = ("id", "seat", "seat_no")


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
    ticket_payload = serializers.CharField(read_only=True)
    ticket_qr_svg = serializers.SerializerMethodField()
    payment_requested_by_name = serializers.CharField(source="payment_requested_by.full_name", read_only=True)
    accepted_by_helper_name = serializers.CharField(source="accepted_by_helper.full_name", read_only=True)
    needs_payment_selection = serializers.SerializerMethodField()
    payment_pending_verification = serializers.SerializerMethodField()

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
            "ticket_payload",
            "ticket_qr_svg",
            "fare_total",
            "discount_applied_amount",
            "payment_requested_at",
            "payment_requested_by_name",
            "accepted_by_helper_at",
            "accepted_by_helper_name",
            "payment_status",
            "payment_method",
            "payment",
            "needs_payment_selection",
            "payment_pending_verification",
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
            "ticket_payload",
            "fare_total",
            "discount_applied_amount",
            "checked_in_at",
            "completed_at",
            "created_at",
        )

    def get_payment(self, obj):
        return self._payment_summary(obj)

    def get_payment_status(self, obj):
        payment = getattr(obj, "payment", None)
        return payment.status if payment else "UNPAID"

    def get_payment_method(self, obj):
        payment = getattr(obj, "payment", None)
        return payment.method if payment else None

    def get_pickup_stop_name(self, obj):
        return self._route_stop_name(obj, obj.from_stop_order)

    def get_destination_stop_name(self, obj):
        return self._route_stop_name(obj, obj.to_stop_order)

    def get_seat_labels(self, obj):
        return [seat.seat.seat_no for seat in obj.booking_seats.all()]

    def get_ticket_qr_svg(self, obj):
        return build_ticket_qr_svg(obj.ticket_payload)

    def get_needs_payment_selection(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(obj.payment_requested_at and (not payment or payment.status in {"FAILED", "CANCELLED"}))

    def get_payment_pending_verification(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(payment and payment.status == "PENDING")


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
    ticket_payload = serializers.CharField(read_only=True)
    ticket_qr_svg = serializers.SerializerMethodField()
    started_at = serializers.DateTimeField(source="trip.started_at", read_only=True)
    ended_at = serializers.DateTimeField(source="trip.ended_at", read_only=True)
    payment_requested_by_name = serializers.CharField(source="payment_requested_by.full_name", read_only=True)
    accepted_by_helper_name = serializers.CharField(source="accepted_by_helper.full_name", read_only=True)
    needs_payment_selection = serializers.SerializerMethodField()
    payment_pending_verification = serializers.SerializerMethodField()

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
            "ticket_payload",
            "ticket_qr_svg",
            "trip_status",
            "payment_requested_at",
            "payment_requested_by_name",
            "accepted_by_helper_at",
            "accepted_by_helper_name",
            "payment_status",
            "payment_method",
            "payment",
            "needs_payment_selection",
            "payment_pending_verification",
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
        payment = getattr(obj, "payment", None)
        return payment.status if payment else "UNPAID"

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

    def get_ticket_qr_svg(self, obj):
        return build_ticket_qr_svg(obj.ticket_payload)

    def get_needs_payment_selection(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(obj.payment_requested_at and (not payment or payment.status in {"FAILED", "CANCELLED"}))

    def get_payment_pending_verification(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(payment and payment.status == "PENDING")


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


class HelperBookingTicketSerializer(PaymentSummaryFieldMixin, serializers.ModelSerializer):
    route_name = serializers.CharField(source="trip.route.name", read_only=True)
    bus_plate = serializers.CharField(source="trip.bus.plate_number", read_only=True)
    passenger_name = serializers.CharField(source="passenger.full_name", read_only=True)
    passenger_phone = serializers.CharField(source="passenger.phone", read_only=True)
    payment = serializers.SerializerMethodField()
    pickup_stop_name = serializers.SerializerMethodField()
    destination_stop_name = serializers.SerializerMethodField()
    seat_labels = serializers.SerializerMethodField()
    ticket_payload = serializers.CharField(read_only=True)
    can_accept = serializers.SerializerMethodField()
    can_verify_cash = serializers.SerializerMethodField()
    can_board = serializers.SerializerMethodField()
    can_complete = serializers.SerializerMethodField()
    can_request_payment = serializers.SerializerMethodField()
    payment_requested_by_name = serializers.CharField(source="payment_requested_by.full_name", read_only=True)
    accepted_by_helper_name = serializers.CharField(source="accepted_by_helper.full_name", read_only=True)

    class Meta:
        model = Booking
        fields = (
            "id",
            "status",
            "ticket_code",
            "ticket_payload",
            "route_name",
            "bus_plate",
            "passenger_name",
            "passenger_phone",
            "pickup_stop_name",
            "destination_stop_name",
            "seat_labels",
            "fare_total",
            "payment_requested_at",
            "payment_requested_by_name",
            "accepted_by_helper_at",
            "accepted_by_helper_name",
            "payment",
            "can_accept",
            "checked_in_at",
            "completed_at",
            "can_request_payment",
            "can_verify_cash",
            "can_board",
            "can_complete",
        )

    def get_payment(self, obj):
        return self._payment_summary(obj)

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

    def get_can_board(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(
            obj.status == Booking.Status.CONFIRMED
            and obj.accepted_by_helper_at
            and not obj.checked_in_at
            and payment
            and payment.status == "SUCCESS"
        )

    def get_can_complete(self, obj):
        return bool(
            obj.status == Booking.Status.CONFIRMED
            and obj.accepted_by_helper_at
            and obj.checked_in_at
            and not obj.completed_at
        )

    def get_can_request_payment(self, obj):
        payment = getattr(obj, "payment", None)
        return bool(
            obj.status == Booking.Status.CONFIRMED
            and obj.accepted_by_helper_at
            and not obj.completed_at
            and (
                not payment
                or payment.status in {"FAILED", "CANCELLED"}
            )
        )
