from rest_framework import serializers
from .models import Booking, BookingSeat, OfflineBoarding, OfflineSeat


class BookingSeatSerializer(serializers.ModelSerializer):
    seat_no = serializers.CharField(source="seat.seat_no", read_only=True)

    class Meta:
        model = BookingSeat
        fields = ("id", "seat", "seat_no")


class BookingSerializer(serializers.ModelSerializer):
    seats = BookingSeatSerializer(source="booking_seats", many=True, read_only=True)

    class Meta:
        model = Booking
        fields = (
            "id",
            "trip",
            "passenger",
            "from_stop_order",
            "to_stop_order",
            "seats_count",
            "status",
            "fare_total",
            "discount_applied_amount",
            "created_at",
            "seats",
        )
        read_only_fields = ("id", "passenger", "status", "fare_total", "discount_applied_amount", "created_at")


class PassengerBookingListSerializer(serializers.ModelSerializer):
    trip_id = serializers.IntegerField(source="trip.id", read_only=True)
    route_name = serializers.CharField(source="trip.route.name", read_only=True)
    bus_plate = serializers.CharField(source="trip.bus.plate_number", read_only=True)
    trip_status = serializers.CharField(source="trip.status", read_only=True)
    payment_status = serializers.SerializerMethodField()
    pickup_stop_name = serializers.SerializerMethodField()
    destination_stop_name = serializers.SerializerMethodField()
    seat_labels = serializers.SerializerMethodField()
    started_at = serializers.DateTimeField(source="trip.started_at", read_only=True)
    ended_at = serializers.DateTimeField(source="trip.ended_at", read_only=True)

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
            "trip_status",
            "payment_status",
            "pickup_stop_name",
            "destination_stop_name",
            "seat_labels",
            "seats_count",
            "started_at",
            "ended_at",
        )

    def _route_stop_name(self, obj, order):
        route_stops = getattr(obj.trip.route, "route_stops_cache", None)
        if route_stops is None:
            route_stops = list(obj.trip.route.route_stops.select_related("stop").order_by("stop_order"))
        match = next((item for item in route_stops if item.stop_order == order), None)
        return match.stop.name if match else f"Stop {order}"

    def get_payment_status(self, obj):
        payment = getattr(obj, "payment", None)
        return payment.status if payment else "UNPAID"

    def get_pickup_stop_name(self, obj):
        return self._route_stop_name(obj, obj.from_stop_order)

    def get_destination_stop_name(self, obj):
        return self._route_stop_name(obj, obj.to_stop_order)

    def get_seat_labels(self, obj):
        return [seat.seat.seat_no for seat in obj.booking_seats.all()]


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
