import base64
import hashlib
import hmac
import uuid

import requests
from django.conf import settings
from django.core.exceptions import ValidationError

from accounts.utils import normalize_nepal_phone


class GatewayConfigurationError(Exception):
    pass


class GatewayRequestError(Exception):
    pass


def esewa_build_form(amount: str, transaction_uuid: str):
    """
    Build eSewa v2 form fields.
    Signature is HMAC-SHA256 and base64 over:
    total_amount=<...>,transaction_uuid=<...>,product_code=<...>
    (must be in same order)  :contentReference[oaicite:5]{index=5}
    """
    product_code = getattr(settings, "ESEWA_PRODUCT_CODE", "EPAYTEST")
    secret_key = getattr(settings, "ESEWA_SECRET_KEY", "8gBm/:&EnhH.1/q(")
    form_url = getattr(settings, "ESEWA_FORM_URL", "https://rc-epay.esewa.com.np/api/epay/main/v2/form")

    # MVP: no tax/service/delivery
    tax_amount = "0"
    product_service_charge = "0"
    product_delivery_charge = "0"
    total_amount = amount

    signed_field_names = "total_amount,transaction_uuid,product_code"
    message = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={product_code}"

    dig = hmac.new(secret_key.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    signature = base64.b64encode(dig).decode("utf-8")

    return form_url, {
        "amount": amount,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "transaction_uuid": transaction_uuid,
        "product_code": product_code,
        "product_service_charge": product_service_charge,
        "product_delivery_charge": product_delivery_charge,
        "signed_field_names": signed_field_names,
        "signature": signature,
    }


def esewa_status_check(transaction_uuid: str, total_amount: str):
    status_url = getattr(settings, "ESEWA_STATUS_URL", "https://uat.esewa.com.np/api/epay/transaction/status/")
    product_code = getattr(settings, "ESEWA_PRODUCT_CODE", "EPAYTEST")

    # doc shows:
    # https://uat.esewa.com.np/api/epay/transaction/status/?product_code=...&total_amount=...&transaction_uuid=...
    params = {
        "product_code": product_code,
        "total_amount": total_amount,
        "transaction_uuid": transaction_uuid,
    }
    try:
        response = requests.get(status_url, params=params, timeout=15)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise GatewayRequestError("Unable to verify the eSewa transaction right now.") from exc


def khalti_customer_phone(phone: str) -> str:
    fallback = "9800000000"
    try:
        normalized = normalize_nepal_phone(phone or fallback)
    except ValidationError:
        return fallback
    return normalized[4:]


def _khalti_headers():
    secret = getattr(settings, "KHALTI_SECRET_KEY", "").strip()
    if not secret:
        raise GatewayConfigurationError("Khalti secret key is not configured.")
    return {
        "Authorization": f"Key {secret}",
        "Content-Type": "application/json",
    }


def khalti_initiate(amount_paisa: int, purchase_order_id: str, purchase_order_name: str, return_url: str, website_url: str, customer_info: dict):
    """
    Khalti ePayment initiate (server-side) returns payment_url. :contentReference[oaicite:6]{index=6}
    """
    base = getattr(settings, "KHALTI_API_URL", "https://dev.khalti.com/api/v2").rstrip("/")
    url = f"{base}/epayment/initiate/"
    payload = {
        "return_url": return_url,
        "website_url": website_url,
        "amount": amount_paisa,
        "purchase_order_id": purchase_order_id,
        "purchase_order_name": purchase_order_name,
        "customer_info": customer_info,
    }
    try:
        response = requests.post(url, json=payload, headers=_khalti_headers(), timeout=20)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        detail = "Unable to initiate Khalti payment right now."
        if exc.response is not None:
            try:
                payload = exc.response.json()
            except ValueError:
                payload = None
            if isinstance(payload, dict):
                detail = payload.get("detail") or payload.get("message") or detail
        raise GatewayRequestError(detail) from exc


def khalti_lookup(pidx: str):
    base = getattr(settings, "KHALTI_API_URL", "https://dev.khalti.com/api/v2").rstrip("/")
    url = f"{base}/epayment/lookup/"
    try:
        response = requests.post(url, json={"pidx": pidx}, headers=_khalti_headers(), timeout=20)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        detail = "Unable to verify Khalti payment right now."
        if exc.response is not None:
            try:
                payload = exc.response.json()
            except ValueError:
                payload = None
            if isinstance(payload, dict):
                detail = payload.get("detail") or payload.get("message") or detail
        raise GatewayRequestError(detail) from exc


def new_uuid():
    return uuid.uuid4().hex
