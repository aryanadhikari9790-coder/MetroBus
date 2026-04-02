from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Stop, Route, RouteStop, RouteFare, Bus
from .services import ensure_bus_seats
from .serializers import StopSerializer, RouteListSerializer, CreateRouteSerializer, BusSerializer

User = get_user_model()


def _serializer_context(request):
    return {"request": request}


def _parse_bool(value, default=False):
    if value in (None, ""):
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class ActiveStopsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        stops = Stop.objects.filter(is_active=True).order_by("name")
        return Response({"stops": StopSerializer(stops, many=True).data})


class AdminTransportRouteBuilderView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _ensure_admin(self, request):
        if getattr(request.user, "role", None) != User.Role.ADMIN:
            return Response({"detail": "You do not have permission to manage transport routes."}, status=403)
        return None

    def get(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial

        stops = Stop.objects.filter(is_active=True).order_by("name")
        routes = Route.objects.prefetch_related("route_stops").order_by("-id")[:10]

        return Response(
            {
                "stops": StopSerializer(stops, many=True).data,
                "recent_routes": RouteListSerializer(routes, many=True).data,
            }
        )

    @transaction.atomic
    def post(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial

        serializer = CreateRouteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data["name"]
        city = serializer.validated_data["city"]
        is_active = serializer.validated_data["is_active"]
        stop_ids = serializer.validated_data["stop_ids"]
        segment_fares = serializer.validated_data["segment_fares"]

        route = Route.objects.create(name=name, city=city, is_active=is_active)

        ordered_stops = list(Stop.objects.filter(id__in=stop_ids))
        stop_map = {stop.id: stop for stop in ordered_stops}
        ordered_stop_objects = [stop_map[stop_id] for stop_id in stop_ids]

        for index, stop in enumerate(ordered_stop_objects, start=1):
            RouteStop.objects.create(route=route, stop=stop, stop_order=index)

        # Build complete fare matrix from consecutive segment fares.
        for start_index in range(len(stop_ids) - 1):
            running_total = 0
            for end_index in range(start_index + 1, len(stop_ids)):
                running_total += segment_fares[end_index - 1]
                RouteFare.objects.create(
                    route=route,
                    from_stop_order=start_index + 1,
                    to_stop_order=end_index + 1,
                    fare_amount=running_total,
                )

        return Response(
            {
                "route": {
                    "id": route.id,
                    "name": route.name,
                    "city": route.city,
                    "is_active": route.is_active,
                    "stops_count": len(stop_ids),
                },
                "message": "Route created successfully.",
            },
            status=201,
        )


class AdminBusManageView(APIView):
    """GET list of buses, POST to create a new bus with auto-generated seats."""
    permission_classes = [permissions.IsAuthenticated]

    def _ensure_admin(self, request):
        if getattr(request.user, "role", None) != User.Role.ADMIN and not request.user.is_superuser:
            return Response({"detail": "Admin only."}, status=403)
        return None

    def get(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        buses = Bus.objects.prefetch_related("seats").order_by("-id")
        return Response({"buses": BusSerializer(buses, many=True, context=_serializer_context(request)).data})

    @transaction.atomic
    def post(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        display_name = request.data.get("display_name", "").strip()
        plate = request.data.get("plate_number", "").strip().upper()
        model_year_raw = request.data.get("model_year")
        condition = str(request.data.get("condition", Bus.Condition.NORMAL)).upper()
        layout_rows_raw = request.data.get("layout_rows", 9)
        layout_columns_raw = request.data.get("layout_columns", 4)
        capacity_raw = request.data.get("capacity")
        is_active = _parse_bool(request.data.get("is_active", True), default=True)
        driver_id = request.data.get("driver")
        helper_id = request.data.get("helper")

        if not plate:
            return Response({"detail": "plate_number is required."}, status=400)
        if Bus.objects.filter(plate_number=plate).exists():
            return Response({"detail": f"Bus '{plate}' already exists."}, status=400)
        try:
            layout_rows = int(layout_rows_raw)
            layout_columns = int(layout_columns_raw)
        except (TypeError, ValueError):
            return Response({"detail": "layout_rows and layout_columns must be valid integers."}, status=400)
        if layout_rows < 1 or layout_rows > 30 or layout_columns < 1 or layout_columns > 8:
            return Response({"detail": "Seat layout must be within 1-30 rows and 1-8 columns."}, status=400)

        try:
            capacity = int(capacity_raw) if capacity_raw not in (None, "") else layout_rows * layout_columns
        except (TypeError, ValueError):
            return Response({"detail": "capacity must be a valid integer."}, status=400)
        if capacity < 1 or capacity > 200:
            return Response({"detail": "capacity must be between 1 and 200."}, status=400)
        if capacity > layout_rows * layout_columns:
            return Response({"detail": "Seat capacity cannot be greater than rows × columns."}, status=400)

        model_year = None
        if model_year_raw not in (None, ""):
            try:
                model_year = int(model_year_raw)
            except (TypeError, ValueError):
                return Response({"detail": "model_year must be a valid year."}, status=400)
            if model_year < 1980 or model_year > 2100:
                return Response({"detail": "model_year must be between 1980 and 2100."}, status=400)

        if condition not in Bus.Condition.values:
            return Response({"detail": "condition must be NEW, NORMAL, or OLD."}, status=400)
            
        driver, helper = None, None
        if driver_id:
            driver = User.objects.filter(id=driver_id, role=User.Role.DRIVER).first()
            if not driver: return Response({"detail": "Invalid driver."}, status=400)
        if helper_id:
            helper = User.objects.filter(id=helper_id, role=User.Role.HELPER).first()
            if not helper: return Response({"detail": "Invalid helper."}, status=400)

        bus = Bus.objects.create(
            display_name=display_name,
            plate_number=plate,
            model_year=model_year,
            condition=condition,
            layout_rows=layout_rows,
            layout_columns=layout_columns,
            capacity=capacity,
            exterior_photo=request.data.get("exterior_photo"),
            interior_photo=request.data.get("interior_photo"),
            seat_photo=request.data.get("seat_photo"),
            is_active=is_active,
            driver=driver,
            helper=helper,
        )
        ensure_bus_seats(bus)
        return Response({
            "message": f"Bus '{plate}' created with {capacity} seats.",
            "bus": BusSerializer(bus, context=_serializer_context(request)).data,
        }, status=201)


class AdminBusDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _ensure_admin(self, request):
        if getattr(request.user, "role", None) != User.Role.ADMIN and not request.user.is_superuser:
            return Response({"detail": "Admin only."}, status=403)
        return None

    def patch(self, request, bus_id):
        denial = self._ensure_admin(request)
        if denial:
            return denial
            
        try:
            bus = Bus.objects.get(id=bus_id)
        except Bus.DoesNotExist:
            return Response({"detail": "Bus not found."}, status=404)
            
        driver_id = request.data.get("driver")
        helper_id = request.data.get("helper")
        updated_fields = []
        
        if driver_id is not None:
            if driver_id == "":
                bus.driver = None
            else:
                driver = User.objects.filter(id=driver_id, role=User.Role.DRIVER).first()
                if not driver: return Response({"detail": "Invalid driver."}, status=400)
                bus.driver = driver
            updated_fields.append("driver")
                
        if helper_id is not None:
            if helper_id == "":
                bus.helper = None
            else:
                helper = User.objects.filter(id=helper_id, role=User.Role.HELPER).first()
                if not helper: return Response({"detail": "Invalid helper."}, status=400)
                bus.helper = helper
            updated_fields.append("helper")

        for field in ("display_name", "condition"):
            if field in request.data:
                setattr(bus, field, request.data.get(field) or "")
                updated_fields.append(field)

        if "model_year" in request.data:
            raw_value = request.data.get("model_year")
            if raw_value in ("", None):
                bus.model_year = None
            else:
                try:
                    bus.model_year = int(raw_value)
                except (TypeError, ValueError):
                    return Response({"detail": "model_year must be a valid year."}, status=400)
            updated_fields.append("model_year")

        if "is_active" in request.data:
            bus.is_active = _parse_bool(request.data.get("is_active"), default=bus.is_active)
            updated_fields.append("is_active")

        bus.save(update_fields=sorted(set(updated_fields)) or None)
        
        return Response({
            "message": "Bus assigned staff updated.",
            "bus": BusSerializer(bus, context=_serializer_context(request)).data
        })


class MyAssignedBusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == User.Role.DRIVER:
            bus = Bus.objects.filter(driver=user, is_active=True).first()
        elif user.role == User.Role.HELPER:
            bus = Bus.objects.filter(helper=user, is_active=True).first()
        else:
            return Response({"detail": "Not a driver or helper."}, status=403)
            
        if not bus:
            return Response({"bus": None})
            
        return Response({"bus": BusSerializer(bus, context=_serializer_context(request)).data})
