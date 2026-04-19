from rest_framework import serializers
from accounts.models import User
from transport.models import Route, Bus
from .models import Trip, TripExpense, TripSchedule


class TripScheduleSerializer(serializers.ModelSerializer):
    route_name = serializers.CharField(source="route.name", read_only=True)
    bus_plate = serializers.CharField(source="bus.plate_number", read_only=True)
    driver_name = serializers.CharField(source="driver.full_name", read_only=True)
    helper_name = serializers.CharField(source="helper.full_name", read_only=True)
    driver_assignment_accepted = serializers.BooleanField(read_only=True)

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
            "driver_assignment_accepted",
            "driver_assignment_accepted_at",
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
    route_path_points = serializers.JSONField(source="route.path_points", read_only=True)
    route_path_distance_km = serializers.DecimalField(source="route.path_distance_km", max_digits=8, decimal_places=2, read_only=True)

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
            "route_path_points",
            "route_path_distance_km",
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
    route_name = serializers.CharField(source="route.name", read_only=True)
    driver_name = serializers.CharField(source="driver.full_name", read_only=True)
    helper_name = serializers.CharField(source="helper.full_name", read_only=True)
    driver_assignment_accepted = serializers.BooleanField(read_only=True)
    helper_assignment_accepted = serializers.BooleanField(read_only=True)

    class Meta:
        model = Bus
        fields = (
            "id",
            "display_name",
            "plate_number",
            "capacity",
            "route",
            "route_name",
            "driver",
            "driver_name",
            "helper",
            "helper_name",
            "assignment_updated_at",
            "driver_assignment_accepted",
            "driver_assignment_accepted_at",
            "helper_assignment_accepted",
            "helper_assignment_accepted_at",
        )


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


class TripExpenseSerializer(serializers.ModelSerializer):
    bus_label = serializers.CharField(source="bus.display_name", read_only=True)
    bus_plate = serializers.CharField(source="bus.plate_number", read_only=True)
    route_name = serializers.CharField(source="trip.route.name", read_only=True)

    class Meta:
        model = TripExpense
        fields = (
            "id",
            "trip",
            "bus",
            "bus_label",
            "bus_plate",
            "route_name",
            "category",
            "amount",
            "note",
            "incurred_at",
            "created_at",
        )
        read_only_fields = ("id", "bus_label", "bus_plate", "route_name", "created_at")
