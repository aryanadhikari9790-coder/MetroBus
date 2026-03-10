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
