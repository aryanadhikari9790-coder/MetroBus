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
    AdminTripScheduleUserSerializer,
    CreateTripScheduleSerializer,
)
from .permissions import IsDriver
from .location_serializers import TripLocationCreateSerializer, TripLocationSerializer
from .services import (
    pause_trip_simulation,
    reset_trip_simulation,
    start_trip_simulation,
    step_trip_simulation,
    stop_trip_simulation,
    sync_trip_simulation,
)


def _is_admin_user(user):
    return bool(user and user.is_authenticated and (user.role == User.Role.ADMIN or user.is_superuser))


def _live_trip_conflict(route=None, bus=None, driver=None, helper=None):
    qs = Trip.objects.filter(status=Trip.Status.LIVE)
    if bus is not None and qs.filter(bus=bus).exists():
        return "This bus already has a LIVE trip."
    if driver is not None and qs.filter(driver=driver).exists():
        return "This driver already has a LIVE trip."
    if helper is not None and qs.filter(helper=helper).exists():
        return "This helper already has a LIVE trip."
    return None


def _serialize_simulation(simulation):
    if not simulation:
        return None
    return {
        "is_active": simulation.is_active,
        "current_index": simulation.current_index,
        "points_count": len(simulation.points or []),
        "step_interval_ms": simulation.step_interval_ms,
    }


def _driver_trip_or_403(request, trip_id):
    try:
        trip = Trip.objects.select_related("simulation").get(id=trip_id)
    except Trip.DoesNotExist:
        return None, Response({"detail": "Trip not found"}, status=404)

    if trip.driver_id != request.user.id and not request.user.is_superuser:
        return None, Response({"detail": "Not your trip"}, status=403)

    if trip.status != Trip.Status.LIVE:
        return None, Response({"detail": "Trip is not LIVE"}, status=400)

    return trip, None


class LiveTripsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            Trip.objects.filter(status=Trip.Status.LIVE)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .prefetch_related("locations")
        )

        payload = []
        for trip in qs:
            trip_data = TripSerializer(trip).data
            latest_location = sync_trip_simulation(trip)
            trip_data["latest_location"] = TripLocationSerializer(latest_location).data if latest_location else None
            payload.append(trip_data)

        return Response(payload)


class DriverDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        trip_filter = {"status": Trip.Status.LIVE}
        schedule_filter = {"status": TripSchedule.Status.PLANNED}
        if not request.user.is_superuser:
            trip_filter["driver"] = request.user
            schedule_filter["driver"] = request.user

        active_trip = (
            Trip.objects.filter(**trip_filter)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by("-started_at", "-created_at")
            .first()
        )

        schedules = (
            TripSchedule.objects.filter(**schedule_filter)
            .select_related("route", "bus", "helper", "driver")
            .order_by("scheduled_start_time")[:10]
        )

        routes = Route.objects.filter(is_active=True).order_by("city", "name")
        buses = Bus.objects.filter(is_active=True).order_by("plate_number")
        helpers = User.objects.filter(role=User.Role.HELPER, is_active=True).order_by("full_name")

        latest_location = None
        if active_trip:
            loc = sync_trip_simulation(active_trip)
            if loc:
                latest_location = TripLocationSerializer(loc).data

        return Response(
            {
                "active_trip": TripSerializer(active_trip).data if active_trip else None,
                "latest_location": latest_location,
                "simulation": _serialize_simulation(getattr(active_trip, "simulation", None)) if active_trip else None,
                "schedules": TripScheduleSerializer(schedules, many=True).data,
                "manual_start_options": {
                    "routes": DriverStartOptionRouteSerializer(routes, many=True).data,
                    "buses": DriverStartOptionBusSerializer(buses, many=True).data,
                    "helpers": DriverStartOptionHelperSerializer(helpers, many=True).data,
                },
            }
        )


class AdminTripScheduleBuilderView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_admin_user(request.user):
            return Response({"detail": "You do not have permission to manage schedules."}, status=403)

        routes = Route.objects.filter(is_active=True).order_by("city", "name")
        buses = Bus.objects.filter(is_active=True).order_by("plate_number")
        drivers = User.objects.filter(role=User.Role.DRIVER, is_active=True).order_by("full_name")
        helpers = User.objects.filter(role=User.Role.HELPER, is_active=True).order_by("full_name")
        schedules = (
            TripSchedule.objects.select_related("route", "bus", "driver", "helper")
            .order_by("-scheduled_start_time")[:8]
        )

        return Response(
            {
                "routes": DriverStartOptionRouteSerializer(routes, many=True).data,
                "buses": DriverStartOptionBusSerializer(buses, many=True).data,
                "drivers": AdminTripScheduleUserSerializer(drivers, many=True).data,
                "helpers": AdminTripScheduleUserSerializer(helpers, many=True).data,
                "recent_schedules": TripScheduleSerializer(schedules, many=True).data,
            }
        )

    def post(self, request):
        if not _is_admin_user(request.user):
            return Response({"detail": "You do not have permission to manage schedules."}, status=403)

        ser = CreateTripScheduleSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        route_id = ser.validated_data["route_id"]
        bus_id = ser.validated_data["bus_id"]
        driver_id = ser.validated_data["driver_id"]
        helper_id = ser.validated_data["helper_id"]
        scheduled_start_time = ser.validated_data["scheduled_start_time"]

        try:
            route = Route.objects.get(id=route_id, is_active=True)
            bus = Bus.objects.get(id=bus_id, is_active=True)
            driver = User.objects.get(id=driver_id, role=User.Role.DRIVER, is_active=True)
            helper = User.objects.get(id=helper_id, role=User.Role.HELPER, is_active=True)
        except (Route.DoesNotExist, Bus.DoesNotExist, User.DoesNotExist):
            return Response({"detail": "Invalid route, bus, driver, or helper."}, status=400)

        if TripSchedule.objects.filter(
            bus=bus,
            driver=driver,
            helper=helper,
            scheduled_start_time=scheduled_start_time,
            status=TripSchedule.Status.PLANNED,
        ).exists():
            return Response({"detail": "A matching planned schedule already exists."}, status=400)

        schedule = TripSchedule.objects.create(
            route=route,
            bus=bus,
            driver=driver,
            helper=helper,
            scheduled_start_time=scheduled_start_time,
            status=TripSchedule.Status.PLANNED,
        )
        return Response(
            {
                "message": "Trip schedule created successfully.",
                "schedule": TripScheduleSerializer(schedule).data,
            },
            status=201,
        )


class StartTripView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request):
        """
        Driver can start from schedule_id OR manual with route_id + bus_id + helper_id.
        """
        acting_driver = request.user
        existing_live_trip = Trip.objects.filter(driver=acting_driver, status=Trip.Status.LIVE).first()
        if existing_live_trip:
            return Response({"detail": "You already have a LIVE trip"}, status=400)

        schedule_id = request.data.get("schedule_id")
        deviation_mode = bool(request.data.get("deviation_mode", False))

        if schedule_id:
            try:
                schedule = TripSchedule.objects.select_related("route", "bus", "helper", "driver").get(id=schedule_id)
            except TripSchedule.DoesNotExist:
                return Response({"detail": "Invalid schedule_id"}, status=400)

            if schedule.driver_id != acting_driver.id and not request.user.is_superuser:
                return Response({"detail": "Not your schedule"}, status=403)

            if schedule.status != TripSchedule.Status.PLANNED:
                return Response({"detail": "This schedule is no longer available to start."}, status=400)

            if schedule.trips.exists():
                return Response({"detail": "This schedule has already been used."}, status=400)

            conflict = _live_trip_conflict(bus=schedule.bus, driver=schedule.driver, helper=schedule.helper)
            if conflict:
                return Response({"detail": conflict}, status=400)

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

        conflict = _live_trip_conflict(bus=bus, driver=acting_driver, helper=helper)
        if conflict:
            return Response({"detail": conflict}, status=400)

        trip = Trip.objects.create(
            schedule=None,
            route=route,
            bus=bus,
            driver=acting_driver,
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

        if trip.driver_id != request.user.id and not request.user.is_superuser:
            return Response({"detail": "Not your trip"}, status=403)

        if trip.status != Trip.Status.LIVE:
            return Response({"detail": "Trip is not LIVE"}, status=400)

        trip.status = Trip.Status.ENDED
        trip.ended_at = timezone.now()
        trip.save(update_fields=["status", "ended_at"])
        stop_trip_simulation(trip)

        if trip.schedule and trip.schedule.status == TripSchedule.Status.PLANNED:
            trip.schedule.status = TripSchedule.Status.COMPLETED
            trip.schedule.save(update_fields=["status"])

        return Response(TripSerializer(trip).data)


class PostTripLocationView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, trip_id: int):
        trip, denial = _driver_trip_or_403(request, trip_id)
        if denial:
            return denial

        ser = TripLocationCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        stop_trip_simulation(trip)

        loc = TripLocation.objects.create(
            trip=trip,
            **ser.validated_data,
        )
        return Response(TripLocationSerializer(loc).data, status=201)


class LatestTripLocationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, trip_id: int):
        trip = Trip.objects.select_related("simulation").filter(id=trip_id).first()
        if not trip:
            return Response({"detail": "Trip not found"}, status=404)
        loc = sync_trip_simulation(trip)
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


class TripSimulationStartView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, trip_id: int):
        trip, denial = _driver_trip_or_403(request, trip_id)
        if denial:
            return denial

        points = request.data.get("points") or []
        step_interval_ms = request.data.get("step_interval_ms", 2000)
        try:
            latest_location, simulation = start_trip_simulation(trip, points, step_interval_ms)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        return Response({
            "latest_location": TripLocationSerializer(latest_location).data if latest_location else None,
            "simulation": _serialize_simulation(simulation),
        })


class TripSimulationPauseView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, trip_id: int):
        trip, denial = _driver_trip_or_403(request, trip_id)
        if denial:
            return denial

        try:
            latest_location, simulation = pause_trip_simulation(trip)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        return Response({
            "latest_location": TripLocationSerializer(latest_location).data if latest_location else None,
            "simulation": _serialize_simulation(simulation),
        })


class TripSimulationResetView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, trip_id: int):
        trip, denial = _driver_trip_or_403(request, trip_id)
        if denial:
            return denial

        try:
            latest_location, simulation = reset_trip_simulation(trip)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        return Response({
            "latest_location": TripLocationSerializer(latest_location).data if latest_location else None,
            "simulation": _serialize_simulation(simulation),
        })


class TripSimulationStepView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, trip_id: int):
        trip, denial = _driver_trip_or_403(request, trip_id)
        if denial:
            return denial

        try:
            latest_location, simulation = step_trip_simulation(trip)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)

        return Response({
            "latest_location": TripLocationSerializer(latest_location).data if latest_location else None,
            "simulation": _serialize_simulation(simulation),
        })
