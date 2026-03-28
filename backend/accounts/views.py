from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, Q
from django.db.models.functions import Coalesce
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from payments.models import Payment
from transport.models import Route, Stop, Bus, Seat
from trips.models import Trip
from .serializers import RegisterSerializer, MeSerializer, MeUpdateSerializer, AdminCreateUserSerializer, AdminUserListSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user).data)


class AdminDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "role", None) != User.Role.ADMIN and not request.user.is_superuser:
            return Response({"detail": "You do not have permission to view the admin dashboard."}, status=403)

        role_rows = User.objects.values("role").annotate(count=Count("id"))
        role_counts = {row["role"]: row["count"] for row in role_rows}

        payment_rows = Payment.objects.values("method").annotate(
            total=Count("id"),
            success=Count("id", filter=Q(status=Payment.Status.SUCCESS)),
        )
        payment_methods = {
            row["method"]: {"total": row["total"], "success": row["success"]}
            for row in payment_rows
        }

        revenue_success = Payment.objects.filter(status=Payment.Status.SUCCESS).aggregate(
            total=Coalesce(Sum("amount"), 0)
        )["total"]

        live_trips = (
            Trip.objects.filter(status=Trip.Status.LIVE)
            .select_related("route", "bus", "driver", "helper")
            .prefetch_related("locations")
            .order_by("-started_at", "-created_at")[:5]
        )
        recent_bookings = (
            Booking.objects.select_related("trip__route", "trip__bus", "passenger")
            .order_by("-created_at")[:5]
        )
        recent_payments = (
            Payment.objects.select_related("booking__trip__route", "created_by", "verified_by")
            .order_by("-created_at")[:5]
        )
        recent_users = User.objects.order_by("-created_at")[:5]

        live_trip_rows = []
        for trip in live_trips:
            latest_location = trip.locations.order_by("-recorded_at").first()
            live_trip_rows.append(
                {
                    "id": trip.id,
                    "route_name": trip.route.name,
                    "bus_plate": trip.bus.plate_number,
                    "driver_name": trip.driver.full_name,
                    "helper_name": trip.helper.full_name,
                    "started_at": trip.started_at,
                    "deviation_mode": trip.deviation_mode,
                    "latest_location": (
                        {
                            "lat": float(latest_location.lat),
                            "lng": float(latest_location.lng),
                            "recorded_at": latest_location.recorded_at,
                        }
                        if latest_location
                        else None
                    ),
                }
            )

        data = {
            "overview": {
                "users_total": User.objects.count(),
                "role_counts": {
                    "PASSENGER": role_counts.get(User.Role.PASSENGER, 0),
                    "DRIVER": role_counts.get(User.Role.DRIVER, 0),
                    "HELPER": role_counts.get(User.Role.HELPER, 0),
                    "ADMIN": role_counts.get(User.Role.ADMIN, 0),
                },
                "transport": {
                    "routes": Route.objects.count(),
                    "stops": Stop.objects.count(),
                    "buses": Bus.objects.count(),
                    "seats": Seat.objects.count(),
                },
                "trips": {
                    "total": Trip.objects.count(),
                    "live": Trip.objects.filter(status=Trip.Status.LIVE).count(),
                    "ended": Trip.objects.filter(status=Trip.Status.ENDED).count(),
                    "not_started": Trip.objects.filter(status=Trip.Status.NOT_STARTED).count(),
                },
                "bookings": {
                    "total": Booking.objects.count(),
                    "confirmed": Booking.objects.filter(status=Booking.Status.CONFIRMED).count(),
                    "completed": Booking.objects.filter(status=Booking.Status.COMPLETED).count(),
                    "cancelled": Booking.objects.filter(status=Booking.Status.CANCELLED).count(),
                },
                "payments": {
                    "total": Payment.objects.count(),
                    "success": Payment.objects.filter(status=Payment.Status.SUCCESS).count(),
                    "pending": Payment.objects.filter(status=Payment.Status.PENDING).count(),
                    "failed": Payment.objects.filter(status=Payment.Status.FAILED).count(),
                    "revenue_success": float(revenue_success),
                    "methods": {
                        "CASH": payment_methods.get(Payment.Method.CASH, {"total": 0, "success": 0}),
                        "MOCK_ONLINE": payment_methods.get(Payment.Method.MOCK_ONLINE, {"total": 0, "success": 0}),
                        "ESEWA": payment_methods.get(Payment.Method.ESEWA, {"total": 0, "success": 0}),
                        "KHALTI": payment_methods.get(Payment.Method.KHALTI, {"total": 0, "success": 0}),
                    },
                },
            },
            "live_trips": live_trip_rows,
            "recent_bookings": [
                {
                    "id": booking.id,
                    "trip_id": booking.trip_id,
                    "route_name": booking.trip.route.name,
                    "bus_plate": booking.trip.bus.plate_number,
                    "passenger_name": booking.passenger.full_name,
                    "status": booking.status,
                    "seats_count": booking.seats_count,
                    "fare_total": float(booking.fare_total),
                    "created_at": booking.created_at,
                }
                for booking in recent_bookings
            ],
            "recent_payments": [
                {
                    "id": payment.id,
                    "booking_id": payment.booking_id,
                    "route_name": payment.booking.trip.route.name,
                    "method": payment.method,
                    "status": payment.status,
                    "amount": float(payment.amount),
                    "created_by_name": payment.created_by.full_name,
                    "verified_by_name": payment.verified_by.full_name if payment.verified_by else None,
                    "created_at": payment.created_at,
                }
                for payment in recent_payments
            ],
            "recent_users": [
                {
                    "id": user.id,
                    "full_name": user.full_name,
                    "phone": user.phone,
                    "role": user.role,
                    "created_at": user.created_at,
                }
                for user in recent_users
            ],
        }
        return Response(data)
