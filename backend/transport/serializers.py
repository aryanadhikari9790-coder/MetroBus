from rest_framework import serializers
from .models import Stop, Route, RouteStop, Bus


def _absolute_media_url(serializer, value):
    if not value:
        return None
    try:
        url = value.url
    except ValueError:
        return None
    request = serializer.context.get("request")
    return request.build_absolute_uri(url) if request else url


class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = ("id", "name", "lat", "lng", "is_active")


class CreateStopSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    lat = serializers.DecimalField(max_digits=9, decimal_places=6)
    lng = serializers.DecimalField(max_digits=9, decimal_places=6)
    is_active = serializers.BooleanField(default=True)

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Stop name is required.")
        return name


class RouteStopSerializer(serializers.ModelSerializer):
    stop = StopSerializer(read_only=True)

    class Meta:
        model = RouteStop
        fields = ("stop_order", "stop")


class RouteListSerializer(serializers.ModelSerializer):
    stops_count = serializers.SerializerMethodField()

    def get_stops_count(self, obj):
        return obj.route_stops.count()

    class Meta:
        model = Route
        fields = ("id", "name", "city", "is_active", "stops_count")


class CreateRouteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160)
    city = serializers.CharField(max_length=80, default="Pokhara")
    is_active = serializers.BooleanField(default=True)
    stop_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=2)
    segment_fares = serializers.ListField(
        child=serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0),
        min_length=1,
    )

    def validate(self, attrs):
        stop_ids = attrs["stop_ids"]
        segment_fares = attrs["segment_fares"]

        if len(set(stop_ids)) != len(stop_ids):
            raise serializers.ValidationError("Each stop can only appear once in a route.")

        if len(segment_fares) != len(stop_ids) - 1:
            raise serializers.ValidationError("Provide one segment fare for each consecutive stop pair.")

        existing_stop_ids = set(Stop.objects.filter(id__in=stop_ids, is_active=True).values_list("id", flat=True))
        if existing_stop_ids != set(stop_ids):
            raise serializers.ValidationError("One or more selected stops are invalid or inactive.")

        return attrs


class BusSerializer(serializers.ModelSerializer):
    seats_count = serializers.SerializerMethodField()
    driver_name = serializers.CharField(source="driver.full_name", read_only=True)
    helper_name = serializers.CharField(source="helper.full_name", read_only=True)
    exterior_photo_url = serializers.SerializerMethodField()
    interior_photo_url = serializers.SerializerMethodField()
    seat_photo_url = serializers.SerializerMethodField()

    def get_seats_count(self, obj):
        return obj.seats.count()

    def get_exterior_photo_url(self, obj):
        return _absolute_media_url(self, obj.exterior_photo)

    def get_interior_photo_url(self, obj):
        return _absolute_media_url(self, obj.interior_photo)

    def get_seat_photo_url(self, obj):
        return _absolute_media_url(self, obj.seat_photo)

    class Meta:
        model = Bus
        fields = (
            "id",
            "display_name",
            "plate_number",
            "model_year",
            "condition",
            "layout_rows",
            "layout_columns",
            "capacity",
            "is_active",
            "seats_count",
            "created_at",
            "driver",
            "helper",
            "driver_name",
            "helper_name",
            "exterior_photo_url",
            "interior_photo_url",
            "seat_photo_url",
        )

