import os
from decimal import Decimal
from urllib.parse import urlencode

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from bookings.models import Booking
from bookings.serializers import HelperBookingTicketSerializer
from .models import Payment, PassengerWallet
from .serializers import (
    CreatePaymentSerializer,
    PaymentSerializer,
    PassengerWalletSerializer,
    WalletTopUpSerializer,
    WalletPassPurchaseSerializer,
)
from .permissions import IsPassenger, IsHelperOrAdmin
from .gateways import (
    GatewayConfigurationError,
    GatewayRequestError,
    esewa_build_form,
    esewa_status_check,
    khalti_customer_phone,
    khalti_initiate,
    khalti_lookup,
    new_uuid,
)
from .wallets import (
    FREE_RIDE_REWARD_POINTS,
    calculate_reward_points,
    pass_expiry_date,
    serialize_pass_plans,
)


def frontend_base_url(request=None):
    if request is not None:
        origin = (request.headers.get("Origin") or "").strip()
        if origin:
            return origin.rstrip("/")

    configured = os.getenv("FRONTEND_URL", "").strip()
    if configured:
        return configured.rstrip("/")

    if request is not None:
        scheme = "https" if request.is_secure() else "http"
        host = request.get_host().split(":")[0]
        return f"{scheme}://{host}:5173"

    return "http://127.0.0.1:5173"


def frontend_url(path: str, request=None):
    return f"{frontend_base_url(request)}{path}"


def payment_result_url(request, **params):
    query = urlencode({key: value for key, value in params.items() if value not in (None, "")})
    suffix = f"?{query}" if query else ""
    return frontend_url(f"/payment/result{suffix}", request)


def _serialize_payment_result(payment, message):
    return {
        "message": message,
        "payment": PaymentSerializer(payment).data,
    }


def _sync_khalti_payment(payment, payload, *, pidx=None, transaction_id="", fallback_status=""):
    gateway_status = payload.get("status") or fallback_status or payment.gateway_status or ""
    resolved_pidx = pidx or payload.get("pidx") or payment.reference or ""
    transaction_value = transaction_id or payload.get("transaction_id") or payment.gateway_transaction_id or ""
    order_value = payload.get("purchase_order_id") or payment.gateway_order_id or ""
    expires_at_raw = payload.get("expires_at") or ""
    expires_at = parse_datetime(expires_at_raw) if expires_at_raw else None

    update_fields = ["reference", "gateway_status", "gateway_transaction_id", "gateway_order_id", "gateway_payload"]
    payment.reference = resolved_pidx
    payment.gateway_status = gateway_status
    payment.gateway_transaction_id = transaction_value
    payment.gateway_order_id = order_value
    payment.gateway_payload = payload or {}

    total_amount = payload.get("total_amount")
    if total_amount not in (None, ""):
        try:
            payment.amount = (Decimal(str(total_amount)) / Decimal("100")).quantize(Decimal("0.01"))
            update_fields.append("amount")
        except Exception:
            pass

    if expires_at:
        payment.gateway_expires_at = expires_at
        update_fields.append("gateway_expires_at")

    if gateway_status == "Completed":
        payment.status = Payment.Status.SUCCESS
        payment.verified_at = timezone.now()
        update_fields.extend(["status", "verified_at"])
    elif gateway_status in {"Initiated", "Pending"}:
        payment.status = Payment.Status.PENDING
        update_fields.append("status")
    elif gateway_status == "User canceled":
        payment.status = Payment.Status.CANCELLED
        update_fields.append("status")
    else:
        payment.status = Payment.Status.FAILED
        update_fields.append("status")

    payment.save(update_fields=list(dict.fromkeys(update_fields)))
    return payment


def _wallet_for(user):
    wallet, _ = PassengerWallet.objects.get_or_create(passenger=user)
    return wallet


def _wallet_response_data(wallet):
    return PassengerWalletSerializer(wallet).data


class CreatePaymentView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        ser = CreatePaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        booking_id = ser.validated_data["booking_id"]
        method = ser.validated_data["method"]

        booking = Booking.objects.filter(id=booking_id, passenger=request.user).first()
        if not booking:
            return Response({"detail": "Booking not found"}, status=404)

        if hasattr(booking, "payment"):
            return Response({"detail": "Payment already exists for this booking"}, status=400)

        wallet = _wallet_for(request.user)
        payment = Payment.objects.create(
            booking=booking,
            method=method,
            status=Payment.Status.PENDING,
            amount=booking.fare_total,
            reference=None,
            created_by=request.user,
        )

        # ----- MOCK ONLINE (instant success)
        if method == Payment.Method.MOCK_ONLINE:
            payment.status = Payment.Status.SUCCESS
            payment.reference = f"MOCK-{payment.id}"
            payment.verified_by = request.user
            payment.verified_at = timezone.now()
            payment.save(update_fields=["status", "reference", "verified_by", "verified_at"])
            return Response({"payment": PaymentSerializer(payment).data, "redirect": None}, status=201)

        # ----- CASH (pending)
        if method == Payment.Method.CASH:
            return Response({"payment": PaymentSerializer(payment).data, "redirect": None}, status=201)

        if method == Payment.Method.WALLET:
            if wallet.balance < booking.fare_total:
                payment.delete()
                return Response(
                    {
                        "detail": "Your MetroBus wallet balance is too low for this ride.",
                        "wallet": _wallet_response_data(wallet),
                    },
                    status=400,
                )

            wallet.balance = Decimal(wallet.balance) - Decimal(booking.fare_total)
            reward_points = calculate_reward_points(booking.fare_total)
            wallet.reward_points += reward_points
            wallet.lifetime_reward_points += reward_points
            wallet.save(update_fields=["balance", "reward_points", "lifetime_reward_points", "updated_at"])

            payment.status = Payment.Status.SUCCESS
            payment.reference = f"WALLET-{payment.id}"
            payment.verified_by = request.user
            payment.verified_at = timezone.now()
            payment.save(update_fields=["status", "reference", "verified_by", "verified_at"])
            return Response(
                {
                    "payment": PaymentSerializer(payment).data,
                    "wallet": _wallet_response_data(wallet),
                    "redirect": None,
                },
                status=201,
            )

        if method == Payment.Method.PASS:
            pass_active = bool(wallet.pass_valid_until and wallet.pass_valid_until >= timezone.localdate() and wallet.pass_rides_remaining > 0)
            if not pass_active:
                payment.delete()
                return Response(
                    {
                        "detail": "You need an active ride pass before using this payment method.",
                        "wallet": _wallet_response_data(wallet),
                    },
                    status=400,
                )

            wallet.pass_rides_remaining -= 1
            reward_points = calculate_reward_points(booking.fare_total)
            wallet.reward_points += reward_points
            wallet.lifetime_reward_points += reward_points
            wallet.save(update_fields=["pass_rides_remaining", "reward_points", "lifetime_reward_points", "updated_at"])

            payment.amount = Decimal("0.00")
            payment.status = Payment.Status.SUCCESS
            payment.reference = f"PASS-{payment.id}"
            payment.verified_by = request.user
            payment.verified_at = timezone.now()
            payment.save(update_fields=["amount", "status", "reference", "verified_by", "verified_at"])
            return Response(
                {
                    "payment": PaymentSerializer(payment).data,
                    "wallet": _wallet_response_data(wallet),
                    "redirect": None,
                },
                status=201,
            )

        if method == Payment.Method.REWARD:
            if wallet.reward_points < FREE_RIDE_REWARD_POINTS:
                payment.delete()
                return Response(
                    {
                        "detail": f"You need {FREE_RIDE_REWARD_POINTS} reward points to redeem a free ride.",
                        "wallet": _wallet_response_data(wallet),
                    },
                    status=400,
                )

            wallet.reward_points -= FREE_RIDE_REWARD_POINTS
            wallet.save(update_fields=["reward_points", "updated_at"])

            payment.amount = Decimal("0.00")
            payment.status = Payment.Status.SUCCESS
            payment.reference = f"REWARD-{payment.id}"
            payment.verified_by = request.user
            payment.verified_at = timezone.now()
            payment.save(update_fields=["amount", "status", "reference", "verified_by", "verified_at"])
            return Response(
                {
                    "payment": PaymentSerializer(payment).data,
                    "wallet": _wallet_response_data(wallet),
                    "redirect": None,
                },
                status=201,
            )

        # ----- eSewa (frontend will post a form)
        if method == Payment.Method.ESEWA:
            txn_uuid = f"MB-{booking.id}-{new_uuid()[:10]}"
            payment.reference = txn_uuid
            payment.save(update_fields=["reference"])

            form_url, fields = esewa_build_form(str(payment.amount), txn_uuid)

            # callbacks to backend, then backend redirects to frontend
            fields["success_url"] = request.build_absolute_uri(f"/api/payments/esewa/success/{payment.id}/")
            fields["failure_url"] = request.build_absolute_uri(f"/api/payments/esewa/failure/{payment.id}/")

            return Response(
                {"payment": PaymentSerializer(payment).data, "redirect": {"type": "FORM_POST", "url": form_url, "fields": fields}},
                status=201,
            )

        # ----- Khalti (backend initiate -> frontend redirect)
        if method == Payment.Method.KHALTI:
            # Khalti expects amount in paisa
            amount_paisa = int(Decimal(payment.amount) * 100)
            purchase_order_id = f"MB-{request.user.id}-{new_uuid()[:10].upper()}"

            return_url = request.build_absolute_uri(f"/api/payments/khalti/return/{payment.id}/")
            website_url = frontend_base_url(request)

            customer = {
                "name": getattr(request.user, "full_name", "Passenger"),
                "email": getattr(request.user, "email", "") or "test@metrob.us",
                "phone": khalti_customer_phone(getattr(request.user, "phone", "9800000000")),
            }

            try:
                data = khalti_initiate(
                    amount_paisa=amount_paisa,
                    purchase_order_id=purchase_order_id,
                    purchase_order_name=f"MetroBus Booking #{booking.id}",
                    return_url=return_url,
                    website_url=website_url,
                    customer_info=customer,
                )
            except GatewayConfigurationError as error:
                payment.delete()
                return Response({"detail": str(error)}, status=503)
            except GatewayRequestError as error:
                payment.delete()
                return Response({"detail": str(error)}, status=502)

            # store pidx
            payment.reference = data.get("pidx")
            payment.gateway_order_id = purchase_order_id
            payment.gateway_status = data.get("status") or "Initiated"
            expires_at_raw = data.get("expires_at")
            update_fields = ["reference", "gateway_order_id", "gateway_status"]
            if expires_at_raw:
                parsed = parse_datetime(expires_at_raw)
                if parsed:
                    payment.gateway_expires_at = parsed
                    update_fields.append("gateway_expires_at")
            payment.gateway_payload = data
            update_fields.append("gateway_payload")
            payment.save(update_fields=update_fields)

            return Response(
                {"payment": PaymentSerializer(payment).data, "redirect": {"type": "REDIRECT", "url": data.get("payment_url")}},
                status=201,
            )

        return Response({"detail": "Unsupported method"}, status=400)


class PassengerWalletSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def get(self, request):
        return Response({"wallet": _wallet_response_data(_wallet_for(request.user)), "pass_plans": serialize_pass_plans()})


class PassengerWalletTopUpView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        serializer = WalletTopUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = _wallet_for(request.user)
        wallet.balance = Decimal(wallet.balance) + serializer.validated_data["amount"]
        wallet.save(update_fields=["balance", "updated_at"])
        return Response(
            {
                "message": "MetroBus wallet topped up successfully.",
                "wallet": _wallet_response_data(wallet),
            },
            status=201,
        )


class PassengerPassPurchaseView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request):
        serializer = WalletPassPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = _wallet_for(request.user)
        wallet.pass_plan = serializer.validated_data["plan"]
        wallet.pass_total_rides = serializer.validated_data["rides_count"]
        wallet.pass_rides_remaining = serializer.validated_data["rides_count"]
        wallet.pass_valid_until = pass_expiry_date(serializer.validated_data["validity_days"])
        wallet.save(update_fields=["pass_plan", "pass_total_rides", "pass_rides_remaining", "pass_valid_until", "updated_at"])
        return Response(
            {
                "message": f"{serializer.validated_data['plan_label']} activated successfully.",
                "wallet": _wallet_response_data(wallet),
                "pass_plans": serialize_pass_plans(),
            },
            status=201,
        )


class VerifyCashPaymentView(APIView):
    permission_classes = [IsAuthenticated, IsHelperOrAdmin]

    def post(self, request, booking_id: int):
        booking = Booking.objects.filter(id=booking_id).first()
        if not booking:
            return Response({"detail": "Booking not found"}, status=404)

        payment = getattr(booking, "payment", None)
        if not payment:
            return Response({"detail": "No payment record found"}, status=404)

        if payment.method != Payment.Method.CASH:
            return Response({"detail": "Only CASH payments can be verified here"}, status=400)
        if getattr(request.user, "role", None) == "HELPER" and not booking.accepted_by_helper_at:
            return Response({"detail": "Accept the passenger ride details before verifying cash."}, status=400)

        payment.status = Payment.Status.SUCCESS
        payment.verified_by = request.user
        payment.verified_at = timezone.now()
        payment.save(update_fields=["status", "verified_by", "verified_at"])

        booking = (
            Booking.objects.select_related("trip__route", "trip__bus", "passenger", "payment", "payment_requested_by", "accepted_by_helper")
            .prefetch_related("booking_seats__seat", "trip__route__route_stops__stop")
            .filter(id=booking.id)
            .first()
        )
        return Response(
            {
                "message": f"Cash payment verified for booking #{booking.id}.",
                "payment": PaymentSerializer(payment).data,
                "booking": HelperBookingTicketSerializer(booking).data,
            }
        )


# =========================
# eSewa callbacks
# =========================
class EsewaSuccessCallback(APIView):
    permission_classes = [AllowAny]

    def get(self, request, payment_id: int):
        payment = Payment.objects.filter(id=payment_id, method=Payment.Method.ESEWA).select_related("booking").first()
        if not payment:
            return redirect(frontend_url("/payment/result?status=failed&reason=payment_not_found", request))

        txn_uuid = payment.reference
        try:
            res = esewa_status_check(transaction_uuid=txn_uuid, total_amount=str(payment.amount))
            status_val = (res.get("status") or "").upper()
        except Exception:
            status_val = "PENDING"

        if status_val == "COMPLETE":
            payment.status = Payment.Status.SUCCESS
            payment.verified_at = timezone.now()
            payment.save(update_fields=["status", "verified_at"])
            return redirect(frontend_url(f"/payment/result?status=success&method=esewa&booking={payment.booking.id}", request))

        payment.status = Payment.Status.PENDING
        payment.save(update_fields=["status"])
        return redirect(frontend_url(f"/payment/result?status=pending&method=esewa&booking={payment.booking.id}", request))


class EsewaFailureCallback(APIView):
    permission_classes = [AllowAny]

    def get(self, request, payment_id: int):
        payment = Payment.objects.filter(id=payment_id, method=Payment.Method.ESEWA).select_related("booking").first()
        if not payment:
            return redirect(frontend_url("/payment/result?status=failed&reason=payment_not_found", request))

        payment.status = Payment.Status.FAILED
        payment.save(update_fields=["status"])
        return redirect(frontend_url(f"/payment/result?status=failed&method=esewa&booking={payment.booking.id}", request))


# =========================
# Khalti callback
# =========================
class KhaltiReturnCallback(APIView):
    permission_classes = [AllowAny]

    def get(self, request, payment_id: int):
        payment = Payment.objects.filter(id=payment_id, method=Payment.Method.KHALTI).select_related("booking").first()
        if not payment:
            return redirect(payment_result_url(request, status="failed", method="khalti", reason="payment_not_found"))

        pidx = request.GET.get("pidx") or payment.reference
        status_hint = request.GET.get("status") or payment.gateway_status or "Pending"
        transaction_id = request.GET.get("transaction_id") or request.GET.get("transactionId") or ""
        if pidx:
            payment.reference = pidx
        if transaction_id:
            payment.gateway_transaction_id = transaction_id
        if status_hint:
            payment.gateway_status = status_hint
        payment.gateway_payload = {**(payment.gateway_payload or {}), "callback": dict(request.GET.items())}
        payment.save(update_fields=["reference", "gateway_transaction_id", "gateway_status", "gateway_payload"])

        try:
            payload = khalti_lookup(pidx)
            payment = _sync_khalti_payment(payment, payload, pidx=pidx, transaction_id=transaction_id, fallback_status=status_hint)
        except (GatewayConfigurationError, GatewayRequestError):
            payment.status = Payment.Status.PENDING
            payment.save(update_fields=["status"])
            return redirect(
                payment_result_url(
                    request,
                    status="pending",
                    method="khalti",
                    booking=payment.booking.id,
                    payment=payment.id,
                )
            )

        status_map = {
            Payment.Status.SUCCESS: "success",
            Payment.Status.PENDING: "pending",
            Payment.Status.CANCELLED: "failed",
            Payment.Status.FAILED: "failed",
        }
        return redirect(
            payment_result_url(
                request,
                status=status_map.get(payment.status, "failed"),
                method="khalti",
                booking=payment.booking.id,
                payment=payment.id,
            )
        )


class KhaltiVerifyPaymentView(APIView):
    permission_classes = [IsAuthenticated, IsPassenger]

    def post(self, request, payment_id: int):
        payment = (
            Payment.objects.select_related("booking")
            .filter(id=payment_id, method=Payment.Method.KHALTI, booking__passenger=request.user)
            .first()
        )
        if not payment:
            return Response({"detail": "Khalti payment not found."}, status=404)
        if not payment.reference:
            return Response({"detail": "This Khalti payment does not have a payment identifier yet."}, status=400)

        try:
            payload = khalti_lookup(payment.reference)
            payment = _sync_khalti_payment(payment, payload, pidx=payment.reference)
        except GatewayConfigurationError as error:
            return Response({"detail": str(error)}, status=503)
        except GatewayRequestError as error:
            return Response({"detail": str(error)}, status=502)

        message = "Khalti payment is still pending."
        if payment.status == Payment.Status.SUCCESS:
            message = "Khalti payment verified successfully."
        elif payment.status == Payment.Status.CANCELLED:
            message = "Khalti payment was cancelled."
        elif payment.status == Payment.Status.FAILED:
            message = "Khalti payment failed."

        return Response(_serialize_payment_result(payment, message), status=200)
