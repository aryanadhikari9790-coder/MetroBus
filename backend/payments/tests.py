from decimal import Decimal
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings
from requests import HTTPError

from payments.gateways import GatewayRequestError, khalti_initiate, khalti_lookup
from payments.models import Payment
from payments.views import _sync_khalti_payment


class DummyPayment:
    def __init__(self):
        self.reference = ""
        self.gateway_status = ""
        self.gateway_transaction_id = ""
        self.gateway_order_id = ""
        self.gateway_payload = {}
        self.gateway_expires_at = None
        self.amount = Decimal("0.00")
        self.status = Payment.Status.PENDING
        self.verified_at = None
        self.saved_update_fields = None

    def save(self, update_fields=None):
        self.saved_update_fields = list(update_fields or [])


class KhaltiGatewayTests(SimpleTestCase):
    @override_settings(KHALTI_SECRET_KEY="secret", KHALTI_API_URL="https://khalti.com/api/v2")
    @patch("payments.gateways.requests.post")
    def test_khalti_initiate_surfaces_validation_error_message(self, mock_post):
        payload = {
            "amount": ["Amount should be greater than Rs. 10, that is 1000 paisa."],
            "error_key": "validation_error",
        }
        response = Mock()
        response.json.return_value = payload
        response.raise_for_status.side_effect = HTTPError(response=response)
        mock_post.return_value = response

        with self.assertRaisesMessage(GatewayRequestError, "Amount should be greater than Rs. 10, that is 1000 paisa."):
            khalti_initiate(
                amount_paisa=999,
                purchase_order_id="ORDER-1",
                purchase_order_name="MetroBus Booking #1",
                return_url="http://127.0.0.1:8000/api/payments/khalti/return/1/",
                website_url="http://127.0.0.1:5173",
                customer_info={"name": "Passenger", "email": "test@example.com", "phone": "9800000000"},
            )

    @override_settings(KHALTI_SECRET_KEY="secret", KHALTI_API_URL="https://khalti.com/api/v2")
    @patch("payments.gateways.requests.post")
    def test_khalti_lookup_returns_canceled_payload_even_on_http_400(self, mock_post):
        payload = {
            "pidx": "test-pidx",
            "total_amount": 1000,
            "status": "User canceled",
            "transaction_id": None,
            "fee": 0,
            "refunded": False,
        }
        response = Mock()
        response.json.return_value = payload
        response.raise_for_status.side_effect = HTTPError(response=response)
        mock_post.return_value = response

        result = khalti_lookup("test-pidx")

        self.assertEqual(result["status"], "User canceled")
        self.assertEqual(result["pidx"], "test-pidx")

    @override_settings(KHALTI_SECRET_KEY="secret", KHALTI_API_URL="https://khalti.com/api/v2")
    @patch("payments.gateways.requests.post")
    def test_khalti_lookup_raises_for_unknown_gateway_error(self, mock_post):
        payload = {"detail": "Not found.", "error_key": "validation_error"}
        response = Mock()
        response.json.return_value = payload
        response.raise_for_status.side_effect = HTTPError(response=response)
        mock_post.return_value = response

        with self.assertRaisesMessage(GatewayRequestError, "Not found."):
            khalti_lookup("missing-pidx")


class KhaltiPaymentSyncTests(SimpleTestCase):
    def test_sync_marks_expired_payment_as_failed(self):
        payment = DummyPayment()

        updated = _sync_khalti_payment(payment, {"status": "Expired", "total_amount": 1000, "pidx": "expired-pidx"})

        self.assertEqual(updated.status, Payment.Status.FAILED)
        self.assertEqual(updated.reference, "expired-pidx")
        self.assertEqual(updated.amount, Decimal("10.00"))

    def test_sync_marks_user_canceled_payment_as_cancelled(self):
        payment = DummyPayment()

        updated = _sync_khalti_payment(payment, {"status": "User canceled", "pidx": "cancel-pidx"})

        self.assertEqual(updated.status, Payment.Status.CANCELLED)
        self.assertEqual(updated.reference, "cancel-pidx")

    def test_sync_keeps_unknown_status_pending_for_manual_follow_up(self):
        payment = DummyPayment()

        updated = _sync_khalti_payment(payment, {"status": "Investigating", "pidx": "review-pidx"})

        self.assertEqual(updated.status, Payment.Status.PENDING)
        self.assertEqual(updated.reference, "review-pidx")
