import random
from decimal import Decimal
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError
from django.db.models import Count, Sum, Q, Value, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from payments.models import PassengerWallet, Payment
from payments.wallets import FREE_RIDE_REWARD_POINTS
from transport.models import Route, Stop, Bus, Seat
from trips.models import Trip
from .models import PhoneOTP
from .otp_delivery import OTPDeliveryError, send_password_reset_otp, send_registration_otp
from .serializers import (
    RegisterSerializer, MeSerializer, MeUpdateSerializer, RegisterOTPRequestSerializer,
    PasswordResetOTPRequestSerializer, PasswordResetConfirmSerializer,
    AdminCreateUserSerializer, AdminUserListSerializer,
    AdminUserReviewSerializer,
    AdminUpdateUserSerializer,
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer


class RegisterOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone"]
        recent_otp = (
            PhoneOTP.objects.filter(phone=phone, purpose=PhoneOTP.Purpose.REGISTER)
            .order_by("-created_at")
            .first()
        )
        if recent_otp and recent_otp.created_at >= timezone.now() - timedelta(seconds=45):
            return Response({"detail": "Please wait a few seconds before requesting another OTP."}, status=429)

        code = f"{random.randint(0, 9999):04d}"
        otp = PhoneOTP(
            phone=phone,
            purpose=PhoneOTP.Purpose.REGISTER,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        otp.set_code(code)
        otp.save()

        try:
            delivery_result = send_registration_otp(phone, code)
        except OTPDeliveryError as exc:
            otp.delete()
            return Response({"detail": str(exc)}, status=503)

        payload = {
            "message": f"OTP sent to {phone}. It will expire in 5 minutes.",
            "phone": phone,
            "delivery": delivery_result["delivery"],
            "expires_in_seconds": 300,
        }
        if delivery_result.get("detail"):
            payload["detail"] = delivery_result["detail"]
        if delivery_result.get("dev_code"):
            payload["dev_code"] = delivery_result["dev_code"]

        return Response(payload, status=201)


class PasswordResetOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetOTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone"]
        recent_otp = (
            PhoneOTP.objects.filter(phone=phone, purpose=PhoneOTP.Purpose.PASSWORD_RESET)
            .order_by("-created_at")
            .first()
        )
        if recent_otp and recent_otp.created_at >= timezone.now() - timedelta(seconds=45):
            return Response({"detail": "Please wait a few seconds before requesting another OTP."}, status=429)

        code = f"{random.randint(0, 9999):04d}"
        otp = PhoneOTP(
            phone=phone,
            purpose=PhoneOTP.Purpose.PASSWORD_RESET,
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        otp.set_code(code)
        otp.save()

        try:
            delivery_result = send_password_reset_otp(phone, code)
        except OTPDeliveryError as exc:
            otp.delete()
            return Response({"detail": str(exc)}, status=503)

        payload = {
            "message": f"Password reset OTP sent to {phone}. It will expire in 5 minutes.",
            "phone": phone,
            "delivery": delivery_result["delivery"],
            "expires_in_seconds": 300,
        }
        if delivery_result.get("detail"):
            payload["detail"] = delivery_result["detail"]
        if delivery_result.get("dev_code"):
            payload["dev_code"] = delivery_result["dev_code"]

        return Response(payload, status=201)


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "message": f"Password reset complete for {user.phone}. You can sign in now."
            },
            status=200,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MeSerializer(request.user, context={"request": request}).data)


class AdminDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "role", None) != User.Role.ADMIN and not request.user.is_superuser:
            return Response({"detail": "You do not have permission to view the admin dashboard."}, status=403)

        money_zero = Value(Decimal("0.00"), output_field=DecimalField(max_digits=10, decimal_places=2))

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
            total=Coalesce(Sum("amount"), money_zero)
        )["total"]
        confirmed_bookings = Booking.objects.filter(status=Booking.Status.CONFIRMED)
        ride_ops = {
            "awaiting_acceptance": confirmed_bookings.filter(accepted_by_helper_at__isnull=True).count(),
            "awaiting_payment": confirmed_bookings.filter(
                accepted_by_helper_at__isnull=False,
                checked_in_at__isnull=True,
            ).filter(Q(payment__isnull=True) | ~Q(payment__status=Payment.Status.SUCCESS)).count(),
            "ready_to_board": confirmed_bookings.filter(
                accepted_by_helper_at__isnull=False,
                checked_in_at__isnull=True,
                payment__status=Payment.Status.SUCCESS,
            ).count(),
            "onboard": confirmed_bookings.filter(
                accepted_by_helper_at__isnull=False,
                checked_in_at__isnull=False,
                completed_at__isnull=True,
            ).count(),
            "completed_today": Booking.objects.filter(
                status=Booking.Status.COMPLETED,
                completed_at__date=timezone.localdate(),
            ).count(),
        }

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
        wallet_rows = PassengerWallet.objects.select_related("passenger").order_by("-reward_points", "-balance", "-updated_at")[:5]
        recent_booking_flow = (
            Booking.objects.select_related(
                "trip__route",
                "trip__bus",
                "passenger",
                "payment",
                "accepted_by_helper",
                "payment_requested_by",
                "checked_in_by",
                "completed_by",
            )
            .order_by("-created_at")[:8]
        )
        wallet_totals = PassengerWallet.objects.aggregate(
            total_balance=Coalesce(Sum("balance"), money_zero),
            total_reward_points=Coalesce(Sum("reward_points"), 0),
            total_lifetime_reward_points=Coalesce(Sum("lifetime_reward_points"), 0),
            active_passes=Count("id", filter=Q(pass_valid_until__gte=timezone.localdate(), pass_rides_remaining__gt=0)),
            reward_ready=Count("id", filter=Q(reward_points__gte=FREE_RIDE_REWARD_POINTS)),
            weekly_passes=Count("id", filter=Q(pass_plan="WEEKLY", pass_valid_until__gte=timezone.localdate(), pass_rides_remaining__gt=0)),
            monthly_passes=Count("id", filter=Q(pass_plan="MONTHLY", pass_valid_until__gte=timezone.localdate(), pass_rides_remaining__gt=0)),
            flex_passes=Count("id", filter=Q(pass_plan="FLEX_20", pass_valid_until__gte=timezone.localdate(), pass_rides_remaining__gt=0)),
        )

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
                "ride_ops": ride_ops,
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
                        "WALLET": payment_methods.get(Payment.Method.WALLET, {"total": 0, "success": 0}),
                        "PASS": payment_methods.get(Payment.Method.PASS, {"total": 0, "success": 0}),
                        "REWARD": payment_methods.get(Payment.Method.REWARD, {"total": 0, "success": 0}),
                    },
                },
                "wallets": {
                    "total_balance": float(wallet_totals["total_balance"]),
                    "total_reward_points": wallet_totals["total_reward_points"],
                    "total_lifetime_reward_points": wallet_totals["total_lifetime_reward_points"],
                    "active_passes": wallet_totals["active_passes"],
                    "reward_ready": wallet_totals["reward_ready"],
                    "weekly_passes": wallet_totals["weekly_passes"],
                    "monthly_passes": wallet_totals["monthly_passes"],
                    "flex_passes": wallet_totals["flex_passes"],
                    "reward_threshold": FREE_RIDE_REWARD_POINTS,
                    "free_rides_redeemed": payment_methods.get(Payment.Method.REWARD, {"success": 0})["success"],
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
            "recent_booking_flow": [
                {
                    "id": booking.id,
                    "route_name": booking.trip.route.name,
                    "bus_plate": booking.trip.bus.plate_number,
                    "passenger_name": booking.passenger.full_name,
                    "status": booking.status,
                    "payment_status": booking.payment.status if getattr(booking, "payment", None) else "UNPAID",
                    "payment_method": booking.payment.method if getattr(booking, "payment", None) else None,
                    "accepted_by_helper_name": booking.accepted_by_helper.full_name if booking.accepted_by_helper else None,
                    "payment_requested_by_name": booking.payment_requested_by.full_name if booking.payment_requested_by else None,
                    "checked_in_by_name": booking.checked_in_by.full_name if booking.checked_in_by else None,
                    "completed_by_name": booking.completed_by.full_name if booking.completed_by else None,
                    "accepted_by_helper_at": booking.accepted_by_helper_at,
                    "payment_requested_at": booking.payment_requested_at,
                    "checked_in_at": booking.checked_in_at,
                    "completed_at": booking.completed_at,
                    "created_at": booking.created_at,
                }
                for booking in recent_booking_flow
            ],
            "reward_leaderboard": [
                {
                    "passenger_id": wallet.passenger_id,
                    "passenger_name": wallet.passenger.full_name,
                    "phone": wallet.passenger.phone,
                    "balance": float(wallet.balance),
                    "reward_points": wallet.reward_points,
                    "lifetime_reward_points": wallet.lifetime_reward_points,
                    "pass_plan": wallet.pass_plan,
                    "pass_rides_remaining": wallet.pass_rides_remaining,
                    "pass_valid_until": wallet.pass_valid_until,
                }
                for wallet in wallet_rows
            ],
        }
        return Response(data)


class AdminUserListCreateView(APIView):
    """GET all users (filterable by ?role=DRIVER), POST to create a staff user."""
    permission_classes = [permissions.IsAuthenticated]

    def _ensure_admin(self, request):
        if getattr(request.user, "role", None) != User.Role.ADMIN and not request.user.is_superuser:
            return Response({"detail": "Admin only."}, status=403)
        return None

    def get(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        role = request.query_params.get("role")
        qs = User.objects.all().order_by("-created_at")
        if role:
            qs = qs.filter(role=role.upper())
        return Response({"users": AdminUserListSerializer(qs, many=True, context={"request": request}).data})

    def post(self, request):
        denial = self._ensure_admin(request)
        if denial:
            return denial
        serializer = AdminCreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({
            "message": f"User '{user.full_name}' created as {user.role}.",
            "user": AdminUserListSerializer(user, context={"request": request}).data,
        }, status=201)


class AdminUserReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _ensure_admin(self, request):
        if getattr(request.user, "role", None) != User.Role.ADMIN and not request.user.is_superuser:
            return Response({"detail": "Admin only."}, status=403)
        return None

    def patch(self, request, user_id: int):
        denial = self._ensure_admin(request)
        if denial:
            return denial

        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"detail": "User not found."}, status=404)

        serializer = AdminUserReviewSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "message": f"Updated review settings for {user.full_name}.",
                "user": AdminUserListSerializer(user, context={"request": request}).data,
            }
        )


class AdminUserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _ensure_admin(self, request):
        if getattr(request.user, "role", None) != User.Role.ADMIN and not request.user.is_superuser:
            return Response({"detail": "Admin only."}, status=403)
        return None

    def _get_user(self, user_id: int):
        return User.objects.filter(id=user_id).first()

    def patch(self, request, user_id: int):
        denial = self._ensure_admin(request)
        if denial:
            return denial

        user = self._get_user(user_id)
        if not user:
            return Response({"detail": "User not found."}, status=404)

        serializer = AdminUpdateUserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()

        return Response(
            {
                "message": f"Updated {updated_user.full_name}.",
                "user": AdminUserListSerializer(updated_user, context={"request": request}).data,
            }
        )

    def delete(self, request, user_id: int):
        denial = self._ensure_admin(request)
        if denial:
            return denial

        user = self._get_user(user_id)
        if not user:
            return Response({"detail": "User not found."}, status=404)
        if user.id == request.user.id:
            return Response({"detail": "You cannot delete your own admin account from this screen."}, status=400)

        full_name = user.full_name
        try:
            user.delete()
        except ProtectedError:
            return Response(
                {
                    "detail": "This staff account is linked to trips or schedules. Deactivate it or reassign it before deleting."
                },
                status=409,
            )

        return Response({"message": f"Deleted {full_name}."}, status=200)
