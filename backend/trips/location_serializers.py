from rest_framework import serializers
from .models import TripLocation


class TripLocationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripLocation
        fields = ("lat", "lng", "speed", "heading")


class TripLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripLocation
        fields = ("id", "trip", "lat", "lng", "speed", "heading", "recorded_at")
