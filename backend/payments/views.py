import os
from decimal import Decimal
from django.utils import timezone
from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from bookings.models import Booking
from bookings.serializers import HelperBookingTicketSerializer
from .models import Payment
from .serializers import CreatePaymentSerializer, PaymentSerializer
from .permissions import IsPassenger, IsHelperOrAdmin
from .gateways import esewa_build_form, esewa_status_check, khalti_initiate, khalti_lookup, new_uuid


def frontend_url(path: str):
    base = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")
    return f"{base}{path}"


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

            return_url = request.build_absolute_uri(f"/api/payments/khalti/return/{payment.id}/")
            website_url = os.getenv("FRONTEND_URL", "http://127.0.0.1:5173")

            customer = {
                "name": getattr(request.user, "full_name", "Passenger"),
                "email": getattr(request.user, "email", "") or "test@metrob.us",
                "phone": getattr(request.user, "phone", "9800000000"),
            }

            data = khalti_initiate(
                amount_paisa=amount_paisa,
                purchase_order_id=str(booking.id),
                purchase_order_name=f"MetroBus Booking #{booking.id}",
                return_url=return_url,
                website_url=website_url,
                customer_info=customer,
            )

            # store pidx
            payment.reference = data.get("pidx")
            payment.save(update_fields=["reference"])

            return Response(
                {"payment": PaymentSerializer(payment).data, "redirect": {"type": "REDIRECT", "url": data.get("payment_url")}},
                status=201,
            )

        return Response({"detail": "Unsupported method"}, status=400)


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

        payment.status = Payment.Status.SUCCESS
        payment.verified_by = request.user
        payment.verified_at = timezone.now()
        payment.save(update_fields=["status", "verified_by", "verified_at"])

        booking = (
            Booking.objects.select_related("trip__route", "trip__bus", "passenger", "payment")
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
            return redirect(frontend_url("/payment/result?status=failed&reason=payment_not_found"))

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
            return redirect(frontend_url(f"/payment/result?status=success&method=esewa&booking={payment.booking.id}"))

        payment.status = Payment.Status.PENDING
        payment.save(update_fields=["status"])
        return redirect(frontend_url(f"/payment/result?status=pending&method=esewa&booking={payment.booking.id}"))


class EsewaFailureCallback(APIView):
    permission_classes = [AllowAny]

    def get(self, request, payment_id: int):
        payment = Payment.objects.filter(id=payment_id, method=Payment.Method.ESEWA).select_related("booking").first()
        if not payment:
            return redirect(frontend_url("/payment/result?status=failed&reason=payment_not_found"))

        payment.status = Payment.Status.FAILED
        payment.save(update_fields=["status"])
        return redirect(frontend_url(f"/payment/result?status=failed&method=esewa&booking={payment.booking.id}"))


# =========================
# Khalti callback
# =========================
class KhaltiReturnCallback(APIView):
    permission_classes = [AllowAny]

    def get(self, request, payment_id: int):
        payment = Payment.objects.filter(id=payment_id, method=Payment.Method.KHALTI).select_related("booking").first()
        if not payment:
            return redirect(frontend_url("/payment/result?status=failed&reason=payment_not_found"))

        pidx = request.GET.get("pidx") or payment.reference
        try:
            res = khalti_lookup(pidx)
            status_val = res.get("status")
        except Exception:
            status_val = "Pending"

        if status_val == "Completed":
            payment.status = Payment.Status.SUCCESS
            payment.reference = pidx
            payment.verified_at = timezone.now()
            payment.save(update_fields=["status", "reference", "verified_at"])
            return redirect(frontend_url(f"/payment/result?status=success&method=khalti&booking={payment.booking.id}"))

        if status_val in ["Initiated", "Pending"]:
            payment.status = Payment.Status.PENDING
            payment.reference = pidx
            payment.save(update_fields=["status", "reference"])
            return redirect(frontend_url(f"/payment/result?status=pending&method=khalti&booking={payment.booking.id}"))

        payment.status = Payment.Status.FAILED
        payment.reference = pidx
        payment.save(update_fields=["status", "reference"])
        return redirect(frontend_url(f"/payment/result?status=failed&method=khalti&booking={payment.booking.id}"))
