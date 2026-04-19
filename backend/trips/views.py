from django.db import models
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from accounts.models import User
from bookings.models import Booking
from bookings.serializers import HelperBookingTicketSerializer
from transport.models import Route, Bus, RouteStop
from transport.serializers import RouteStopSerializer
from .models import Trip, TripExpense, TripLocation, TripSchedule
from .serializers import (
    AdminTripScheduleUserSerializer,
    CreateTripScheduleSerializer,
    TripSerializer,
    TripExpenseSerializer,
    TripScheduleSerializer,
    DriverStartOptionRouteSerializer,
    DriverStartOptionBusSerializer,
    DriverStartOptionHelperSerializer,
)
from .permissions import IsDriver, IsHelper, IsDriverOrHelper
from .location_serializers import TripLocationCreateSerializer, TripLocationSerializer
from .services import (
    ensure_trip_simulation,
    pause_trip_simulation,
    reset_trip_simulation,
    resume_trip_simulation,
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


def _assigned_bus_for_user(user):
    if not user or not user.is_authenticated or user.is_superuser:
        return None
    filters = {"is_active": True}
    if user.role == User.Role.DRIVER:
        filters["driver"] = user
    elif user.role == User.Role.HELPER:
        filters["helper"] = user
    else:
        return None
    return (
        Bus.objects.select_related("route", "driver", "helper")
        .filter(**filters)
        .order_by("plate_number")
        .first()
    )


def _assigned_bus_acknowledged_for_user(bus, user):
    if not bus or not user or not user.is_authenticated:
        return False
    if user.role == User.Role.DRIVER:
        return bool(bus.driver_assignment_accepted)
    if user.role == User.Role.HELPER:
        return bool(bus.helper_assignment_accepted)
    return False


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


def _serialize_helper_booking_groups(trip):
    summary = {
        "needs_acceptance_count": 0,
        "awaiting_payment_count": 0,
        "ready_to_board_count": 0,
        "onboard_count": 0,
        "completed_recent_count": 0,
    }
    empty_payload = {
        "summary": summary,
        "needs_acceptance": [],
        "awaiting_payment": [],
        "ready_to_board": [],
        "onboard": [],
        "completed_recent": [],
    }
    if not trip:
        return empty_payload

    trip.route.route_stops_cache = list(trip.route.route_stops.select_related("stop").order_by("stop_order"))
    bookings = (
        Booking.objects.filter(trip=trip)
        .select_related("trip__route", "trip__bus", "passenger", "payment", "payment_requested_by")
        .prefetch_related("booking_seats__seat", "trip__route__route_stops__stop")
        .order_by("from_stop_order", "created_at")
    )

    needs_acceptance = []
    awaiting_payment = []
    ready_to_board = []
    onboard = []
    completed_recent = []

    for booking in bookings:
        serialized = HelperBookingTicketSerializer(booking).data
        payment = getattr(booking, "payment", None)

        if booking.status == Booking.Status.COMPLETED or booking.completed_at:
            completed_recent.append(serialized)
            continue

        if not booking.accepted_by_helper_at:
            needs_acceptance.append(serialized)
            continue

        if booking.checked_in_at and not booking.completed_at:
            onboard.append(serialized)
            continue

        if payment and payment.status == "SUCCESS":
            ready_to_board.append(serialized)
            continue

        awaiting_payment.append(serialized)

    summary.update(
        {
            "needs_acceptance_count": len(needs_acceptance),
            "awaiting_payment_count": len(awaiting_payment),
            "ready_to_board_count": len(ready_to_board),
            "onboard_count": len(onboard),
            "completed_recent_count": len(completed_recent),
        }
    )

    return {
        "summary": summary,
        "needs_acceptance": needs_acceptance[:8],
        "awaiting_payment": awaiting_payment[:8],
        "ready_to_board": ready_to_board[:8],
        "onboard": onboard[:8],
        "completed_recent": completed_recent[:5],
    }


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
        ensure_trip_simulation(trip)
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

        # Pre-fetch all route stops for all live trips in a single query
        trip_list = list(qs)
        route_ids = list({trip.route_id for trip in trip_list})
        route_stops_qs = (
            RouteStop.objects.filter(route_id__in=route_ids)
            .select_related("stop")
            .order_by("stop_order")
        )
        route_stops_by_route = {}
        for rs in route_stops_qs:
            route_stops_by_route.setdefault(rs.route_id, []).append(rs)

        payload = []
        for trip in trip_list:
            trip_data = TripSerializer(trip).data
            ensure_trip_simulation(trip)
            latest_location = sync_trip_simulation(trip)
            trip_data["latest_location"] = TripLocationSerializer(latest_location).data if latest_location else None
            # Embed route_stops so the frontend can match without a second round-trip
            trip_data["route_stops"] = RouteStopSerializer(
                route_stops_by_route.get(trip.route_id, []), many=True
            ).data
            payload.append(trip_data)

        return Response(payload)


class DriverDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        trip_filter = _user_trip_filters(request.user)
        schedule_filter = _user_schedule_filters(request.user)
        assigned_bus = _assigned_bus_for_user(request.user)

        active_trip = (
            Trip.objects.filter(status=Trip.Status.LIVE, **trip_filter)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by("-started_at", "-created_at")
            .first()
        )
        pending_trip = (
            Trip.objects.filter(status=Trip.Status.NOT_STARTED, **trip_filter)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by(
                # Trips where driver OR helper has already confirmed come first
                models.F("driver_start_confirmed_at").desc(nulls_last=True),
                models.F("helper_start_confirmed_at").desc(nulls_last=True),
                "-created_at",
            )
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
            ensure_trip_simulation(active_trip)
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
                "assigned_bus": DriverStartOptionBusSerializer(assigned_bus).data if assigned_bus else None,
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
        assigned_bus = _assigned_bus_for_user(request.user)

        active_trip = (
            Trip.objects.filter(status=Trip.Status.LIVE, **trip_filter)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by("-started_at", "-created_at")
            .first()
        )
        pending_trip = (
            Trip.objects.filter(status=Trip.Status.NOT_STARTED, **trip_filter)
            .select_related("route", "bus", "driver", "helper", "simulation")
            .order_by(
                # Trips where driver OR helper has already confirmed come first
                models.F("driver_start_confirmed_at").desc(nulls_last=True),
                models.F("helper_start_confirmed_at").desc(nulls_last=True),
                "-created_at",
            )
            .first()
        )
        schedules = (
            TripSchedule.objects.filter(status=TripSchedule.Status.PLANNED, **schedule_filter)
            .select_related("route", "bus", "helper", "driver")
            .order_by("scheduled_start_time")[:10]
        )

        latest_location = None
        if active_trip:
            ensure_trip_simulation(active_trip)
            loc = sync_trip_simulation(active_trip)
            if loc:
                latest_location = TripLocationSerializer(loc).data
        helper_bookings = _serialize_helper_booking_groups(active_trip)

        return Response(
            {
                "active_trip": TripSerializer(active_trip).data if active_trip else None,
                "pending_trip": TripSerializer(pending_trip).data if pending_trip else None,
                "latest_location": latest_location,
                "schedules": TripScheduleSerializer(schedules, many=True).data,
                "assigned_bus": DriverStartOptionBusSerializer(assigned_bus).data if assigned_bus else None,
                "helper_bookings": helper_bookings,
            }
        )


class DriverTripHistoryView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        trips = (
            Trip.objects.filter(driver=request.user)
            .select_related("route", "bus", "helper")
            .prefetch_related("bookings", "expenses")
            .order_by("-created_at")[:30]
        )

        items = []
        for trip in trips:
            bookings_count = trip.bookings.exclude(status=Booking.Status.CANCELLED).count()
            completed_count = trip.bookings.filter(completed_at__isnull=False).count()
            expenses_total = sum((expense.amount for expense in trip.expenses.all()), start=0)
            items.append(
                {
                    **TripSerializer(trip).data,
                    "bookings_count": bookings_count,
                    "completed_bookings_count": completed_count,
                    "expenses_total": expenses_total,
                }
            )

        ended = [item for item in items if item["status"] == Trip.Status.ENDED]
        live = [item for item in items if item["status"] == Trip.Status.LIVE]
        return Response(
            {
                "summary": {
                    "total_trips": len(items),
                    "completed_trips": len(ended),
                    "live_trips": len(live),
                },
                "trips": items,
            }
        )


class HelperTripHistoryView(APIView):
    permission_classes = [IsAuthenticated, IsHelper]

    def get(self, request):
        trips = (
            Trip.objects.filter(helper=request.user)
            .select_related("route", "bus", "driver")
            .prefetch_related("bookings")
            .order_by("-created_at")[:30]
        )

        items = []
        for trip in trips:
            onboard_count = trip.bookings.filter(checked_in_at__isnull=False).count()
            completed_count = trip.bookings.filter(completed_at__isnull=False).count()
            items.append(
                {
                    **TripSerializer(trip).data,
                    "onboard_count": onboard_count,
                    "completed_bookings_count": completed_count,
                }
            )

        return Response(
            {
                "summary": {
                    "total_trips": len(items),
                    "completed_trips": len([item for item in items if item["status"] == Trip.Status.ENDED]),
                    "live_trips": len([item for item in items if item["status"] == Trip.Status.LIVE]),
                },
                "trips": items,
            }
        )


class DriverExpenseListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def get(self, request):
        expenses = (
            TripExpense.objects.filter(driver=request.user)
            .select_related("trip__route", "bus")
            .order_by("-incurred_at", "-created_at")[:50]
        )
        totals = {}
        for category, _label in TripExpense.Category.choices:
            totals[category] = sum((expense.amount for expense in expenses if expense.category == category), start=0)
        return Response(
            {
                "summary": {
                    "total_amount": sum((expense.amount for expense in expenses), start=0),
                    "count": len(expenses),
                    "by_category": totals,
                },
                "expenses": TripExpenseSerializer(expenses, many=True).data,
            }
        )

    def post(self, request):
        assigned_bus = _assigned_bus_for_user(request.user)
        if not assigned_bus:
            return Response({"detail": "Assign a bus to this driver before logging expenses."}, status=400)

        payload = {
            "trip": request.data.get("trip") or None,
            "bus": assigned_bus.id,
            "category": request.data.get("category"),
            "amount": request.data.get("amount"),
            "note": request.data.get("note", ""),
            "incurred_at": request.data.get("incurred_at"),
        }
        serializer = TripExpenseSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        trip = serializer.validated_data.get("trip")
        if trip and trip.driver_id != request.user.id:
            return Response({"detail": "This trip does not belong to you."}, status=403)

        expense = TripExpense.objects.create(
            trip=trip,
            bus=assigned_bus,
            driver=request.user,
            category=serializer.validated_data["category"],
            amount=serializer.validated_data["amount"],
            note=serializer.validated_data.get("note", ""),
            incurred_at=serializer.validated_data.get("incurred_at") or timezone.now(),
        )
        return Response(
            {
                "message": "Driver expense recorded successfully.",
                "expense": TripExpenseSerializer(expense).data,
            },
            status=201,
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
            .order_by("-scheduled_start_time")
        )

        return Response(
            {
                "routes": DriverStartOptionRouteSerializer(routes, many=True).data,
                "buses": DriverStartOptionBusSerializer(buses, many=True).data,
                "drivers": AdminTripScheduleUserSerializer(drivers, many=True).data,
                "helpers": AdminTripScheduleUserSerializer(helpers, many=True).data,
                "recent_schedules": TripScheduleSerializer(schedules[:8], many=True).data,
                "schedules": TripScheduleSerializer(schedules[:50], many=True).data,
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


class AdminTripScheduleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_schedule(self, schedule_id):
        return (
            TripSchedule.objects.select_related("route", "bus", "driver", "helper")
            .prefetch_related("trips")
            .filter(id=schedule_id)
            .first()
        )

    def _check_admin(self, request):
        if not _is_admin_user(request.user):
            return Response({"detail": "You do not have permission to manage schedules."}, status=403)
        return None

    def patch(self, request, schedule_id):
        denial = self._check_admin(request)
        if denial:
            return denial

        schedule = self._get_schedule(schedule_id)
        if not schedule:
            return Response({"detail": "Schedule not found."}, status=404)
        if schedule.status != TripSchedule.Status.PLANNED or schedule.trips.exists():
            return Response({"detail": "Only untouched planned schedules can be updated."}, status=409)

        payload = {
            "route_id": request.data.get("route_id", schedule.route_id),
            "bus_id": request.data.get("bus_id", schedule.bus_id),
            "driver_id": request.data.get("driver_id", schedule.driver_id),
            "helper_id": request.data.get("helper_id", schedule.helper_id),
            "scheduled_start_time": request.data.get("scheduled_start_time", schedule.scheduled_start_time),
        }
        ser = CreateTripScheduleSerializer(data=payload)
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
        ).exclude(id=schedule.id).exists():
            return Response({"detail": "This bus already has a planned trip at that start time."}, status=400)

        if TripSchedule.objects.filter(
            driver=driver,
            scheduled_start_time=scheduled_start_time,
            status=TripSchedule.Status.PLANNED,
        ).exclude(id=schedule.id).exists():
            return Response({"detail": "This driver already has a planned trip at that start time."}, status=400)

        if TripSchedule.objects.filter(
            helper=helper,
            scheduled_start_time=scheduled_start_time,
            status=TripSchedule.Status.PLANNED,
        ).exclude(id=schedule.id).exists():
            return Response({"detail": "This helper already has a planned trip at that start time."}, status=400)

        acceptance_should_reset = any(
            [
                schedule.route_id != route.id,
                schedule.bus_id != bus.id,
                schedule.driver_id != driver.id,
                schedule.helper_id != helper.id,
                schedule.scheduled_start_time != scheduled_start_time,
            ]
        )

        schedule.route = route
        schedule.bus = bus
        schedule.driver = driver
        schedule.helper = helper
        schedule.scheduled_start_time = scheduled_start_time

        update_fields = ["route", "bus", "driver", "helper", "scheduled_start_time"]
        if acceptance_should_reset and schedule.driver_assignment_accepted_at:
            schedule.driver_assignment_accepted_at = None
            update_fields.append("driver_assignment_accepted_at")

        schedule.save(update_fields=update_fields)

        return Response(
            {
                "message": "Schedule updated successfully.",
                "schedule": TripScheduleSerializer(schedule).data,
            }
        )

    def delete(self, request, schedule_id):
        denial = self._check_admin(request)
        if denial:
            return denial

        schedule = self._get_schedule(schedule_id)
        if not schedule:
            return Response({"detail": "Schedule not found."}, status=404)
        # ALLOW EVERYTHING: Removed the 409 block for LIVE trips as per user cleanup request

        label = f"{schedule.route.name} @ {schedule.scheduled_start_time}"
        schedule.delete()
        return Response({"message": f"Deleted schedule '{label}'."}, status=200)


class StartTripView(APIView):
    permission_classes = [IsAuthenticated, IsDriverOrHelper]

    def post(self, request):
        actor = request.user
        role_label = _role_label(actor)
        existing_live_trip = Trip.objects.filter(status=Trip.Status.LIVE, **_user_trip_filters(actor)).first()
        if existing_live_trip:
            return Response({"detail": "You already have a LIVE trip."}, status=400)

        trip_id = request.data.get("trip_id")
        schedule_id = request.data.get("schedule_id")
        deviation_mode = bool(request.data.get("deviation_mode", False))

        trip = None
        created = False

        # Option A: Confirming an existing trip (manual or otherwise)
        if trip_id:
            try:
                trip = Trip.objects.select_related("route", "bus", "driver", "helper", "simulation").get(id=trip_id)
            except Trip.DoesNotExist:
                return Response({"detail": "Invalid trip_id"}, status=404)

            if not request.user.is_superuser and actor.id not in {trip.driver_id, trip.helper_id}:
                return Response({"detail": "Not your trip"}, status=403)
            if trip.status == Trip.Status.ENDED:
                return Response({"detail": "This trip has already been completed."}, status=400)
            if trip.status == Trip.Status.CANCELLED:
                return Response({"detail": "This trip was cancelled."}, status=400)
            if trip.status != Trip.Status.NOT_STARTED:
                return Response({"detail": "Only pending trips can be confirmed by trip_id."}, status=400)

        # Option B: Starting via a schedule
        elif schedule_id:
            try:
                schedule = TripSchedule.objects.select_related("route", "bus", "helper", "driver").get(id=schedule_id)
            except TripSchedule.DoesNotExist:
                return Response({"detail": "Invalid schedule_id"}, status=400)

            if not request.user.is_superuser and actor.id not in {schedule.driver_id, schedule.helper_id}:
                return Response({"detail": "Not your schedule"}, status=403)

            if schedule.status != TripSchedule.Status.PLANNED:
                return Response({"detail": "This schedule is no longer available to start."}, status=400)
            if role_label == "driver" and not schedule.driver_assignment_accepted_at:
                return Response({"detail": "Accept the admin assignment before starting this scheduled trip."}, status=400)
            if role_label == "helper" and not schedule.driver_assignment_accepted_at:
                return Response({"detail": "Waiting for the driver to accept and start this scheduled trip first."}, status=400)

            trip = (
                schedule.trips.select_related("route", "bus", "driver", "helper", "simulation")
                .order_by("-created_at")
                .first()
            )

            if trip and trip.status == Trip.Status.ENDED:
                return Response({"detail": "This scheduled trip has already been completed."}, status=400)
            if trip and trip.status == Trip.Status.CANCELLED:
                return Response({"detail": "This scheduled trip was cancelled."}, status=400)

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

        # Option C: Starting a trip from a permanent bus assignment
        else:
            route_id = request.data.get("route_id")
            bus_id = request.data.get("bus_id")
            helper_id = request.data.get("helper_id")
            driver_id = request.data.get("driver_id")
            assigned_bus = _assigned_bus_for_user(actor)

            if role_label == "driver":
                if route_id and bus_id and helper_id:
                    try:
                        route = Route.objects.get(id=route_id, is_active=True)
                        bus = Bus.objects.get(id=bus_id, is_active=True)
                        helper = User.objects.get(id=helper_id, role=User.Role.HELPER, is_active=True)
                    except (Route.DoesNotExist, Bus.DoesNotExist, User.DoesNotExist):
                        return Response({"detail": "Invalid route_id, bus_id, or helper_id"}, status=400)
                else:
                    if not assigned_bus:
                        return Response({"detail": "No active bus is assigned to this driver."}, status=400)
                    if not assigned_bus.route_id:
                        return Response({"detail": "This bus does not have a route assigned yet."}, status=400)
                    if not assigned_bus.helper_id:
                        return Response({"detail": "This bus does not have a helper assigned yet."}, status=400)
                    if not _assigned_bus_acknowledged_for_user(assigned_bus, actor):
                        return Response({"detail": "Accept the latest admin assignment before starting this route."}, status=400)
                    bus = assigned_bus
                    route = assigned_bus.route
                    helper = assigned_bus.helper

                trip = (
                    Trip.objects.filter(driver=actor, status=Trip.Status.NOT_STARTED, schedule__isnull=True)
                    .select_related("route", "bus", "driver", "helper", "simulation")
                    .order_by("-created_at")
                    .first()
                )

                if trip and (
                    trip.route_id != route.id
                    or trip.bus_id != bus.id
                    or trip.helper_id != helper.id
                ):
                    trip.status = Trip.Status.CANCELLED
                    trip.save(update_fields=["status"])
                    trip = None

                if not trip:
                    conflict = _live_trip_conflict(bus=bus, driver=actor, helper=helper)
                    if conflict:
                        return Response({"detail": conflict}, status=400)

                    trip = Trip.objects.create(
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
                if route_id and bus_id and driver_id:
                    try:
                        route = Route.objects.get(id=route_id, is_active=True)
                        bus = Bus.objects.get(id=bus_id, is_active=True)
                        driver = User.objects.get(id=driver_id, role=User.Role.DRIVER, is_active=True)
                    except (Route.DoesNotExist, Bus.DoesNotExist, User.DoesNotExist):
                        return Response({"detail": "Invalid route_id, bus_id, or driver_id"}, status=400)
                else:
                    if not assigned_bus:
                        return Response({"detail": "No active bus is assigned to this helper."}, status=400)
                    if not assigned_bus.route_id:
                        return Response({"detail": "This bus does not have a route assigned yet."}, status=400)
                    if not assigned_bus.driver_id:
                        return Response({"detail": "This bus does not have a driver assigned yet."}, status=400)
                    if not _assigned_bus_acknowledged_for_user(assigned_bus, actor):
                        return Response({"detail": "Accept the latest admin assignment before starting this route."}, status=400)
                    bus = assigned_bus
                    route = assigned_bus.route
                    driver = assigned_bus.driver

                trip = (
                    Trip.objects.filter(helper=actor, status=Trip.Status.NOT_STARTED, schedule__isnull=True)
                    .select_related("route", "bus", "driver", "helper", "simulation")
                    .order_by("-created_at")
                    .first()
                )

                if trip and (
                    trip.route_id != route.id
                    or trip.bus_id != bus.id
                    or trip.driver_id != driver.id
                ):
                    trip.status = Trip.Status.CANCELLED
                    trip.save(update_fields=["status"])
                    trip = None

                if not trip:
                    conflict = _live_trip_conflict(bus=bus, driver=driver, helper=actor)
                    if conflict:
                        return Response({"detail": conflict}, status=400)

                    trip = Trip.objects.create(
                        schedule=None,
                        route=route,
                        bus=bus,
                        driver=driver,
                        helper=actor,
                        status=Trip.Status.NOT_STARTED,
                        deviation_mode=False,
                    )
                    created = True

        # Common finalize logic
        if trip.status == Trip.Status.LIVE:
            return _respond_with_trip(trip, "Trip is already LIVE.", status_code=200)

        if role_label == "driver" and trip.deviation_mode != deviation_mode:
            trip.deviation_mode = deviation_mode
            trip.save(update_fields=["deviation_mode"])

        trip, message = _confirm_trip_start(trip, actor)
        return _respond_with_trip(trip, message, status_code=201 if created else 200)



class AcceptTripAssignmentView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, schedule_id: int):
        schedule = (
            TripSchedule.objects.select_related("route", "bus", "driver", "helper")
            .filter(id=schedule_id)
            .first()
        )
        if not schedule:
            return Response({"detail": "Schedule not found."}, status=404)
        if request.user.id != schedule.driver_id and not request.user.is_superuser:
            return Response({"detail": "This assignment does not belong to you."}, status=403)
        if schedule.status != TripSchedule.Status.PLANNED:
            return Response({"detail": "Only planned schedules can be accepted."}, status=400)

        if schedule.driver_assignment_accepted_at:
            return Response(
                {
                    "message": "Assignment already accepted.",
                    "schedule": TripScheduleSerializer(schedule).data,
                },
                status=200,
            )

        schedule.driver_assignment_accepted_at = timezone.now()
        schedule.save(update_fields=["driver_assignment_accepted_at"])
        return Response(
            {
                "message": "Assignment accepted. Complete your pre-trip checklist, then start the trip.",
                "schedule": TripScheduleSerializer(schedule).data,
            },
            status=200,
        )


class AcceptAssignedBusView(APIView):
    permission_classes = [IsAuthenticated, IsDriverOrHelper]

    def post(self, request):
        bus = _assigned_bus_for_user(request.user)
        if not bus:
            return Response({"detail": "No active bus assignment was found for this account."}, status=404)

        update_fields = []
        role = _role_label(request.user)
        if role == "driver":
            if bus.driver_id != request.user.id:
                return Response({"detail": "This bus assignment does not belong to you."}, status=403)
            if _assigned_bus_acknowledged_for_user(bus, request.user):
                return Response(
                    {
                        "message": "Latest admin assignment already accepted.",
                        "assigned_bus": DriverStartOptionBusSerializer(bus).data,
                    },
                    status=200,
                )
            bus.driver_assignment_accepted_at = timezone.now()
            update_fields.append("driver_assignment_accepted_at")
            success_message = "Driver assignment accepted. Your latest bus and route plan is ready."
        else:
            if bus.helper_id != request.user.id:
                return Response({"detail": "This bus assignment does not belong to you."}, status=403)
            if _assigned_bus_acknowledged_for_user(bus, request.user):
                return Response(
                    {
                        "message": "Latest admin assignment already accepted.",
                        "assigned_bus": DriverStartOptionBusSerializer(bus).data,
                    },
                    status=200,
                )
            bus.helper_assignment_accepted_at = timezone.now()
            update_fields.append("helper_assignment_accepted_at")
            success_message = "Helper assignment accepted. Your latest bus and route plan is ready."

        bus.save(update_fields=update_fields)
        bus.refresh_from_db()
        return Response(
            {
                "message": success_message,
                "assigned_bus": DriverStartOptionBusSerializer(bus).data,
            },
            status=200,
        )


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
        if trip.status == Trip.Status.LIVE:
            ensure_trip_simulation(trip)
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


class TripSimulationResumeView(APIView):
    permission_classes = [IsAuthenticated, IsDriver]

    def post(self, request, trip_id: int):
        trip, denial = _driver_trip_or_403(request, trip_id)
        if denial:
            return denial

        step_interval_ms = request.data.get("step_interval_ms")
        try:
            latest_location, simulation = resume_trip_simulation(trip, step_interval_ms)
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
