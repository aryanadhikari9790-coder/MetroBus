from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from accounts.models import User
from bookings.models import Booking
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
from .permissions import IsDriver, IsHelper, IsDriverOrHelper
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
    qs = Trip.objects.filter(status__in=[Trip.Status.LIVE, Trip.Status.NOT_STARTED])
    if bus is not None and qs.filter(bus=bus).exists():
        return "This bus already has an active or pending trip."
    if driver is not None and qs.filter(driver=driver).exists():
        return "This driver already has an active or pending trip."
    if helper is not None and qs.filter(helper=helper).exists():
        return "This helper already has an active or pending trip."
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


def _role_label(user):
    if user.is_superuser:
        return "admin"
    return "driver" if user.role == User.Role.DRIVER else "helper"


def _user_trip_filters(user):
    if user.is_superuser:
        return {}
    if user.role == User.Role.DRIVER:
        return {"driver": user}
    if user.role == User.Role.HELPER:
        return {"helper": user}
    return {"id": -1}


def _user_schedule_filters(user):
    if user.is_superuser:
        return {}
    if user.role == User.Role.DRIVER:
        return {"driver": user}
    if user.role == User.Role.HELPER:
        return {"helper": user}
    return {"id": -1}


def _waiting_copy(roles):
    labels = []
    if "driver" in roles:
        labels.append("driver")
    if "helper" in roles:
        labels.append("helper")
    if not labels:
        return "No further confirmation is required."
    if len(labels) == 1:
        return f"Waiting for the {labels[0]} confirmation."
    return "Waiting for both driver and helper confirmation."


def _respond_with_trip(trip, message, status_code=200):
    return Response(
        {
            "message": message,
            "trip": TripSerializer(trip).data,
        },
        status=status_code,
    )


def _can_view_trip_bookings(user, trip):
    if not user or not user.is_authenticated:
        return False
    if _is_admin_user(user):
        return True
    return user.id in {trip.driver_id, trip.helper_id}


def _serialize_trip_passenger_requests(trip, route_stops):
    stop_lookup = {item.stop_order: item.stop for item in route_stops}
    requests = []
    summary = {
        "pending_pickups": 0,
        "onboard_dropoffs": 0,
        "total_active_bookings": 0,
    }

    bookings = (
        Booking.objects.filter(trip=trip, status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED])
        .select_related("passenger", "payment")
        .prefetch_related("booking_seats__seat")
        .order_by("from_stop_order", "created_at")
    )

    for booking in bookings:
        if booking.completed_at:
            continue

        pickup_stop = stop_lookup.get(booking.from_stop_order)
        destination_stop = stop_lookup.get(booking.to_stop_order)
        stage = "dropoff" if booking.checked_in_at else "pickup"
        marker_stop = destination_stop if stage == "dropoff" else pickup_stop

        if not marker_stop:
            continue

        summary["total_active_bookings"] += 1
        if stage == "pickup":
            summary["pending_pickups"] += 1
        else:
            summary["onboard_dropoffs"] += 1

        requests.append(
            {
                "booking_id": booking.id,
                "passenger_name": booking.passenger.full_name,
                "passenger_phone": booking.passenger.phone,
                "stage": stage,
                "stage_label": "Waiting Pickup" if stage == "pickup" else "Onboard Drop-off",
                "pickup_stop_name": pickup_stop.name if pickup_stop else f"Stop {booking.from_stop_order}",
                "pickup_stop_order": booking.from_stop_order,
                "destination_stop_name": destination_stop.name if destination_stop else f"Stop {booking.to_stop_order}",
                "destination_stop_order": booking.to_stop_order,
                "marker_stop_name": marker_stop.name,
                "marker_stop_order": booking.to_stop_order if stage == "dropoff" else booking.from_stop_order,
                "marker_lat": marker_stop.lat,
                "marker_lng": marker_stop.lng,
                "seats_count": booking.seats_count,
                "seat_labels": [item.seat.seat_no for item in booking.booking_seats.all()],
                "payment_status": booking.payment.status if getattr(booking, "payment", None) else "UNPAID",
                "payment_method": booking.payment.method if getattr(booking, "payment", None) else None,
                "checked_in_at": booking.checked_in_at,
            }
        )

    return requests, summary


def _confirm_trip_start(trip, actor):
    now = timezone.now()
    update_fields = []
    actor_role = _role_label(actor)

    if actor_role == "driver" and not trip.driver_start_confirmed_at:
        trip.driver_start_confirmed_at = now
        update_fields.append("driver_start_confirmed_at")
    if actor_role == "helper" and not trip.helper_start_confirmed_at:
        trip.helper_start_confirmed_at = now
        update_fields.append("helper_start_confirmed_at")

    just_went_live = False
    if trip.driver_start_confirmed_at and trip.helper_start_confirmed_at and trip.status != Trip.Status.LIVE:
        trip.status = Trip.Status.LIVE
        trip.started_at = trip.started_at or now
        update_fields.extend(["status", "started_at"])
        just_went_live = True

    if update_fields:
        trip.save(update_fields=update_fields)

    if just_went_live:
        return trip, "Trip is now officially LIVE after both confirmations."
    return trip, _waiting_copy(trip.missing_start_confirmations())


def _confirm_trip_end(trip, actor):
    now = timezone.now()
    update_fields = []
    actor_role = _role_label(actor)

    if actor_role == "driver" and not trip.driver_end_confirmed_at:
        trip.driver_end_confirmed_at = now
        update_fields.append("driver_end_confirmed_at")
    if actor_role == "helper" and not trip.helper_end_confirmed_at:
        trip.helper_end_confirmed_at = now
        update_fields.append("helper_end_confirmed_at")

    just_ended = False
    if trip.driver_end_confirmed_at and trip.helper_end_confirmed_at and trip.status != Trip.Status.ENDED:
        trip.status = Trip.Status.ENDED
        trip.ended_at = trip.ended_at or now
        update_fields.extend(["status", "ended_at"])
        just_ended = True

    if update_fields:
        trip.save(update_fields=update_fields)

    if just_ended:
        stop_trip_simulation(trip)
        if trip.schedule and trip.schedule.status == TripSchedule.Status.PLANNED:
            trip.schedule.status = TripSchedule.Status.COMPLETED
            trip.schedule.save(update_fields=["status"])
        return trip, "Trip is now officially ended after both confirmations."

    return trip, _waiting_copy(trip.missing_end_confirmations())


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
        trip_filter = _user_trip_filters(request.user)
        schedule_filter = _user_schedule_filters(request.user)

        active_trip = (
            Trip.objects.filter(status=Trip.Status.LIVE, **trip_filter)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by("-started_at", "-created_at")
            .first()
        )
        pending_trip = (
            Trip.objects.filter(status=Trip.Status.NOT_STARTED, **trip_filter)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by("-created_at")
            .first()
        )

        schedules = (
            TripSchedule.objects.filter(status=TripSchedule.Status.PLANNED, **schedule_filter)
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
                "pending_trip": TripSerializer(pending_trip).data if pending_trip else None,
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


class HelperDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsHelper]

    def get(self, request):
        trip_filter = _user_trip_filters(request.user)
        schedule_filter = _user_schedule_filters(request.user)

        active_trip = (
            Trip.objects.filter(status=Trip.Status.LIVE, **trip_filter)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by("-started_at", "-created_at")
            .first()
        )
        pending_trip = (
            Trip.objects.filter(status=Trip.Status.NOT_STARTED, **trip_filter)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by("-created_at")
            .first()
        )
        schedules = (
            TripSchedule.objects.filter(status=TripSchedule.Status.PLANNED, **schedule_filter)
            .select_related("route", "bus", "helper", "driver")
            .order_by("scheduled_start_time")[:10]
        )

        latest_location = None
        if active_trip:
            loc = sync_trip_simulation(active_trip)
            if loc:
                latest_location = TripLocationSerializer(loc).data

        return Response(
            {
                "active_trip": TripSerializer(active_trip).data if active_trip else None,
                "pending_trip": TripSerializer(pending_trip).data if pending_trip else None,
                "latest_location": latest_location,
                "schedules": TripScheduleSerializer(schedules, many=True).data,
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
            scheduled_start_time=scheduled_start_time,
            status=TripSchedule.Status.PLANNED,
        ).exists():
            return Response({"detail": "This bus already has a planned trip at that start time."}, status=400)

        if TripSchedule.objects.filter(
            driver=driver,
            scheduled_start_time=scheduled_start_time,
            status=TripSchedule.Status.PLANNED,
        ).exists():
            return Response({"detail": "This driver already has a planned trip at that start time."}, status=400)

        if TripSchedule.objects.filter(
            helper=helper,
            scheduled_start_time=scheduled_start_time,
            status=TripSchedule.Status.PLANNED,
        ).exists():
            return Response({"detail": "This helper already has a planned trip at that start time."}, status=400)

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
    permission_classes = [IsAuthenticated, IsDriverOrHelper]

    def post(self, request):
        actor = request.user
        role_label = _role_label(actor)
        existing_live_trip = Trip.objects.filter(status=Trip.Status.LIVE, **_user_trip_filters(actor)).first()
        if existing_live_trip:
            return Response({"detail": "You already have a LIVE trip."}, status=400)

        schedule_id = request.data.get("schedule_id")
        deviation_mode = bool(request.data.get("deviation_mode", False))

        if schedule_id:
            try:
                schedule = TripSchedule.objects.select_related("route", "bus", "helper", "driver").get(id=schedule_id)
            except TripSchedule.DoesNotExist:
                return Response({"detail": "Invalid schedule_id"}, status=400)

            if not request.user.is_superuser and actor.id not in {schedule.driver_id, schedule.helper_id}:
                return Response({"detail": "Not your schedule"}, status=403)

            if schedule.status != TripSchedule.Status.PLANNED:
                return Response({"detail": "This schedule is no longer available to start."}, status=400)

            trip = (
                schedule.trips.select_related("route", "bus", "driver", "helper", "simulation")
                .order_by("-created_at")
                .first()
            )

            if trip and trip.status == Trip.Status.ENDED:
                return Response({"detail": "This scheduled trip has already been completed."}, status=400)
            if trip and trip.status == Trip.Status.CANCELLED:
                return Response({"detail": "This scheduled trip was cancelled."}, status=400)
            if trip and trip.status == Trip.Status.LIVE:
                return _respond_with_trip(trip, "Trip is already LIVE.", status_code=200)

            if not trip:
                conflict = _live_trip_conflict(bus=schedule.bus, driver=schedule.driver, helper=schedule.helper)
                if conflict:
                    return Response({"detail": conflict}, status=400)

                trip = Trip.objects.create(
                    schedule=schedule,
                    route=schedule.route,
                    bus=schedule.bus,
                    driver=schedule.driver,
                    helper=schedule.helper,
                    status=Trip.Status.NOT_STARTED,
                    deviation_mode=deviation_mode if role_label == "driver" else False,
                )
                created = True
            else:
                created = False
                if role_label == "driver":
                    trip.deviation_mode = deviation_mode
                    trip.save(update_fields=["deviation_mode"])

            trip, message = _confirm_trip_start(trip, actor)
            return _respond_with_trip(trip, message, status_code=201 if created else 200)

        route_id = request.data.get("route_id")
        bus_id = request.data.get("bus_id")
        helper_id = request.data.get("helper_id")

        if role_label != "driver":
            return Response({"detail": "Helpers can only start scheduled trips."}, status=400)

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

        pending_trip = (
            Trip.objects.filter(driver=actor, status=Trip.Status.NOT_STARTED, schedule__isnull=True)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by("-created_at")
            .first()
        )
        if pending_trip and (
            pending_trip.route_id != route.id
            or pending_trip.bus_id != bus.id
            or pending_trip.helper_id != helper.id
        ):
            return Response({"detail": "You already have a pending manual trip waiting for helper confirmation."}, status=400)

        if not pending_trip:
            conflict = _live_trip_conflict(bus=bus, driver=actor, helper=helper)
            if conflict:
                return Response({"detail": conflict}, status=400)

            pending_trip = Trip.objects.create(
                schedule=None,
                route=route,
                bus=bus,
                driver=actor,
                helper=helper,
                status=Trip.Status.NOT_STARTED,
                deviation_mode=deviation_mode,
            )
            created = True
        else:
            created = False
            if pending_trip.deviation_mode != deviation_mode:
                pending_trip.deviation_mode = deviation_mode
                pending_trip.save(update_fields=["deviation_mode"])

        trip, message = _confirm_trip_start(pending_trip, actor)
        return _respond_with_trip(trip, message, status_code=201 if created else 200)


class EndTripView(APIView):
    permission_classes = [IsAuthenticated, IsDriverOrHelper]

    def post(self, request, trip_id: int):
        try:
            trip = Trip.objects.get(id=trip_id)
        except Trip.DoesNotExist:
            return Response({"detail": "Trip not found"}, status=404)

        if not request.user.is_superuser and request.user.id not in {trip.driver_id, trip.helper_id}:
            return Response({"detail": "Not your trip"}, status=403)

        if trip.status != Trip.Status.LIVE:
            return Response({"detail": "Trip is not LIVE"}, status=400)

        trip, message = _confirm_trip_end(trip, request.user)
        return _respond_with_trip(trip, message)


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
        payload = {
            "trip": TripSerializer(trip).data,
            "route_stops": RouteStopSerializer(route_stops, many=True).data,
        }

        if _can_view_trip_bookings(request.user, trip):
            passenger_requests, passenger_summary = _serialize_trip_passenger_requests(trip, route_stops)
            payload["passenger_requests"] = passenger_requests
            payload["passenger_summary"] = passenger_summary

        return Response(payload)


class TripSimulationStartView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, trip_id: int):
        trip, denial = _driver_trip_or_403(request, trip_id)
        if denial:
            return denial

        points = request.data.get("points") or []
        step_interval_ms = request.data.get("step_interval_ms", 3000)
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
