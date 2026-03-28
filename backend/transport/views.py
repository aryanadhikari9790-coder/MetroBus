from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Stop, Route, RouteStop, RouteFare, Bus, Seat
from .serializers import StopSerializer, RouteListSerializer, CreateRouteSerializer, BusSerializer

User = get_user_model()


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
        return Response({"buses": BusSerializer(buses, many=True).data})

    @transaction.atomic
    def post(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        plate = request.data.get("plate_number", "").strip().upper()
        capacity = int(request.data.get("capacity", 35))
        is_active = request.data.get("is_active", True)
        if not plate:
            return Response({"detail": "plate_number is required."}, status=400)
        if Bus.objects.filter(plate_number=plate).exists():
            return Response({"detail": f"Bus '{plate}' already exists."}, status=400)
        if capacity < 1 or capacity > 200:
            return Response({"detail": "capacity must be between 1 and 200."}, status=400)
        bus = Bus.objects.create(plate_number=plate, capacity=capacity, is_active=is_active)
        # Auto-generate seats: rows A-Z, columns 1-N
        seats_to_create = []
        cols = 4
        rows_needed = (capacity + cols - 1) // cols
        seat_count = 0
        for row_idx in range(rows_needed):
            row_letter = chr(ord('A') + row_idx)
            for col in range(1, cols + 1):
                if seat_count >= capacity:
                    break
                seats_to_create.append(Seat(bus=bus, seat_no=f"{row_letter}{col}"))
                seat_count += 1
        Seat.objects.bulk_create(seats_to_create)
        return Response({
            "message": f"Bus '{plate}' created with {capacity} seats.",
            "bus": BusSerializer(bus).data,
        }, status=201)
