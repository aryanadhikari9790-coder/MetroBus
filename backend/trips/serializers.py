from rest_framework import serializers
from accounts.models import User
from transport.models import Route, Bus
from .models import Trip, TripSchedule


class TripScheduleSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source="route.name", read_only=True)
    bus_plate = serializers.CharField(source="bus.plate_number", read_only=True)
    driver_name = serializers.CharField(source="driver.full_name", read_only=True)
    helper_name = serializers.CharField(source="helper.full_name", read_only=True)

    class Meta:
        model = TripSchedule
        fields = (
            "id",
            "route",
            "route_name",
            "bus",
            "bus_plate",
            "driver",
            "driver_name",
            "helper",
            "helper_name",
            "scheduled_start_time",
            "status",
        )


class TripSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source="route.name", read_only=True)
    bus_plate = serializers.CharField(source="bus.plate_number", read_only=True)
    helper_name = serializers.CharField(source="helper.full_name", read_only=True)
    driver_name = serializers.CharField(source="driver.full_name", read_only=True)
    schedule_id = serializers.IntegerField(source="schedule.id", read_only=True, allow_null=True)
    driver_start_confirmed = serializers.BooleanField(read_only=True)
    helper_start_confirmed = serializers.BooleanField(read_only=True)
    driver_end_confirmed = serializers.BooleanField(read_only=True)
    helper_end_confirmed = serializers.BooleanField(read_only=True)
    waiting_for_start_confirmation = serializers.BooleanField(read_only=True)
    waiting_for_end_confirmation = serializers.BooleanField(read_only=True)
    missing_start_confirmations = serializers.SerializerMethodField()
    missing_end_confirmations = serializers.SerializerMethodField()

    def get_missing_start_confirmations(self, obj):
        return obj.missing_start_confirmations()

    def get_missing_end_confirmations(self, obj):
        return obj.missing_end_confirmations()

    class Meta:
        model = Trip
        fields = (
            "id",
            "schedule_id",
            "route",
            "route_name",
            "bus",
            "bus_plate",
            "driver",
            "driver_name",
            "helper",
            "helper_name",
            "status",
            "driver_start_confirmed",
            "helper_start_confirmed",
            "driver_end_confirmed",
            "helper_end_confirmed",
            "waiting_for_start_confirmation",
            "waiting_for_end_confirmation",
            "missing_start_confirmations",
            "missing_end_confirmations",
            "started_at",
            "ended_at",
            "deviation_mode",
            "created_at",
        )
        read_only_fields = ("status", "started_at", "ended_at", "created_at")


class DriverStartOptionRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = ("id", "name", "city")


class DriverStartOptionBusSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source="driver.full_name", read_only=True)
    helper_name = serializers.CharField(source="helper.full_name", read_only=True)

    class Meta:
        model = Bus
        fields = ("id", "display_name", "plate_number", "capacity", "driver", "driver_name", "helper", "helper_name")


class DriverStartOptionHelperSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "phone")


class AdminTripScheduleUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "phone", "role")


class CreateTripScheduleSerializer(serializers.Serializer):
    route_id = serializers.IntegerField()
    bus_id = serializers.IntegerField()
    driver_id = serializers.IntegerField()
    helper_id = serializers.IntegerField()
    scheduled_start_time = serializers.DateTimeField()
