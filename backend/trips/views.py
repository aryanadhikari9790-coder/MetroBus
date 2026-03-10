from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from accounts.models import User
from transport.models import Route, Bus, RouteStop
from transport.serializers import RouteStopSerializer
from .models import Trip, TripSchedule, TripLocation
from .serializers import (
    TripSerializer,
    TripScheduleSerializer,
    DriverStartOptionRouteSerializer,
    DriverStartOptionBusSerializer,
    DriverStartOptionHelperSerializer,
)
from .permissions import IsDriver
from .location_serializers import TripLocationCreateSerializer, TripLocationSerializer


class LiveTripsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Trip.objects.filter(status=Trip.Status.LIVE).select_related("route", "bus", "driver", "helper")
        return Response(TripSerializer(qs, many=True).data)


class DriverDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        active_trip = (
            Trip.objects.filter(driver=request.user, status=Trip.Status.LIVE)
            .select_related("route", "bus", "driver", "helper")
            .order_by("-started_at", "-created_at")
            .first()
        )

        schedules = (
            TripSchedule.objects.filter(driver=request.user, status=TripSchedule.Status.PLANNED)
            .select_related("route", "bus", "helper")
            .order_by("scheduled_start_time")[:10]
        )

        routes = Route.objects.filter(is_active=True).order_by("city", "name")
        buses = Bus.objects.filter(is_active=True).order_by("plate_number")
        helpers = User.objects.filter(role=User.Role.HELPER, is_active=True).order_by("full_name")

        latest_location = None
        if active_trip:
            loc = active_trip.locations.order_by("-recorded_at").first()
            if loc:
                latest_location = TripLocationSerializer(loc).data

        return Response(
            {
                "active_trip": TripSerializer(active_trip).data if active_trip else None,
                "latest_location": latest_location,
                "schedules": TripScheduleSerializer(schedules, many=True).data,
                "manual_start_options": {
                    "routes": DriverStartOptionRouteSerializer(routes, many=True).data,
                    "buses": DriverStartOptionBusSerializer(buses, many=True).data,
                    "helpers": DriverStartOptionHelperSerializer(helpers, many=True).data,
                },
            }
        )


class StartTripView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        """
        Driver can start from schedule_id OR manual with route_id + bus_id + helper_id.
        """
        existing_live_trip = Trip.objects.filter(driver=request.user, status=Trip.Status.LIVE).first()
        if existing_live_trip:
            return Response({"detail": "You already have a LIVE trip"}, status=400)

        schedule_id = request.data.get("schedule_id")
        deviation_mode = bool(request.data.get("deviation_mode", False))

        if schedule_id:
            try:
                schedule = TripSchedule.objects.select_related("route", "bus", "helper", "driver").get(id=schedule_id)
            except TripSchedule.DoesNotExist:
                return Response({"detail": "Invalid schedule_id"}, status=400)

            if schedule.driver_id != request.user.id:
                return Response({"detail": "Not your schedule"}, status=403)

            if schedule.trips.filter(status=Trip.Status.LIVE).exists():
                return Response({"detail": "This schedule already has a LIVE trip"}, status=400)

            trip = Trip.objects.create(
                schedule=schedule,
                route=schedule.route,
                bus=schedule.bus,
                driver=schedule.driver,
                helper=schedule.helper,
                status=Trip.Status.LIVE,
                started_at=timezone.now(),
                deviation_mode=deviation_mode,
            )
            return Response(TripSerializer(trip).data, status=201)

        route_id = request.data.get("route_id")
        bus_id = request.data.get("bus_id")
        helper_id = request.data.get("helper_id")

        if not (route_id and bus_id and helper_id):
            return Response(
                {"detail": "Provide schedule_id OR route_id, bus_id, helper_id"},
                status=400,
            )

        try:
            route = Route.objects.get(id=route_id, is_active=True)
            bus = Bus.objects.get(id=bus_id, is_active=True)
            helper = User.objects.get(id=helper_id, role=User.Role.HELPER, is_active=True)
        except (Route.DoesNotExist, Bus.DoesNotExist, User.DoesNotExist):
            return Response({"detail": "Invalid route_id, bus_id, or helper_id"}, status=400)

        trip = Trip.objects.create(
            schedule=None,
            route=route,
            bus=bus,
            driver=request.user,
            helper=helper,
            status=Trip.Status.LIVE,
            started_at=timezone.now(),
            deviation_mode=deviation_mode,
        )
        return Response(TripSerializer(trip).data, status=201)


class EndTripView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, trip_id: int):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({"detail": "Trip not found"}, status=404)

        if trip.driver_id != request.user.id:
            return Response({"detail": "Not your trip"}, status=403)

        if trip.status != Trip.Status.LIVE:
            return Response({"detail": "Trip is not LIVE"}, status=400)

        trip.status = Trip.Status.ENDED
        trip.ended_at = timezone.now()
        trip.save(update_fields=["status", "ended_at"])
        return Response(TripSerializer(trip).data)


class PostTripLocationView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, trip_id: int):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({"detail": "Trip not found"}, status=404)

        if trip.driver_id != request.user.id:
            return Response({"detail": "Not your trip"}, status=403)

        if trip.status != Trip.Status.LIVE:
            return Response({"detail": "Trip is not LIVE"}, status=400)

        ser = TripLocationCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        loc = TripLocation.objects.create(
            trip=trip,
            **ser.validated_data,
        )
        return Response(TripLocationSerializer(loc).data, status=201)


class LatestTripLocationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, trip_id: int):
        loc = TripLocation.objects.filter(trip_id=trip_id).order_by("-recorded_at").first()
        if not loc:
            return Response({"detail": "No location yet"}, status=404)
        return Response(TripLocationSerializer(loc).data)


class TripDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, trip_id: int):
        trip = Trip.objects.select_related("route", "bus").filter(id=trip_id).first()
        if not trip:
            return Response({"detail": "Trip not found"}, status=404)

        route_stops = RouteStop.objects.filter(route=trip.route).select_related("stop").order_by("stop_order")
        return Response({
            "trip": TripSerializer(trip).data,
            "route_stops": RouteStopSerializer(route_stops, many=True).data,
        })
