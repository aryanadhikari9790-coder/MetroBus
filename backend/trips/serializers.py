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

    class Meta:
        model = Trip
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
            "status",
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
    class Meta:
        model = Bus
        fields = ("id", "plate_number", "capacity")


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
