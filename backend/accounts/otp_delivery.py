import os
import requests
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.conf import settings

from .utils import normalize_nepal_phone


class OTPDeliveryError(Exception):
    pass


def _render_message(code: str, template_env_key: str = "OTP_MESSAGE_TEMPLATE") -> str:
    default_text = "MetroBus OTP is {code}. Valid for 5 minutes. Do not share it."
    template = os.getenv(template_env_key, default_text).strip() or default_text
    try:
        return template.format(code=code)
    except KeyError as exc:
        raise OTPDeliveryError(
            f"OTP message template is invalid. Missing placeholder: {exc.args[0]}."
        ) from exc


def _sparrow_recipient(phone: str) -> str:
    try:
        normalized = normalize_nepal_phone(phone)
    except DjangoValidationError as exc:
        raise OTPDeliveryError(exc.messages[0]) from exc

    if not normalized.startswith("+977"):
        raise OTPDeliveryError("Sparrow SMS is configured for Nepal mobile numbers only.")

    recipient = normalized[4:]
    if len(recipient) != 10 or not recipient.isdigit():
        raise OTPDeliveryError("Sparrow SMS expects a 10-digit Nepal mobile number.")
    return recipient


def _send_console(identifier: str, code: str, purpose_label: str):
    print(f"[MetroBus OTP][console] {purpose_label} OTP for {identifier}: {code}")
    return {
        "delivery": "console",
        "detail": f"OTP sent to console for {identifier}.",
        "dev_code": code,
    }


def _send_email_otp(email: str, code: str, purpose_label: str, template_env_key: str = "OTP_MESSAGE_TEMPLATE"):
    subject = f"MetroBus {purpose_label} OTP"
    message = _render_message(code, template_env_key=template_env_key)
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as exc:
        raise OTPDeliveryError(f"Failed to send email OTP: {str(exc)}")

    print(f"[MetroBus OTP][email] {purpose_label} OTP sent to {email}")
    return {
        "delivery": "email",
        "detail": f"OTP sent via email to {email}.",
    }


def _send_sparrow(phone: str, code: str, purpose_label: str, template_env_key: str = "OTP_MESSAGE_TEMPLATE"):
    token = os.getenv("SPARROW_SMS_TOKEN", "").strip()
    sender = os.getenv("SPARROW_SMS_FROM", "").strip()
    url = os.getenv("SPARROW_SMS_URL", "https://api.sparrowsms.com/v2/sms/").strip()

    if not token or not sender:
        raise OTPDeliveryError(
            "Sparrow SMS is selected, but SPARROW_SMS_TOKEN and SPARROW_SMS_FROM are missing."
        )

    response = requests.post(
        url,
        data={
            "token": token,
            "from": sender,
            "to": _sparrow_recipient(phone),
            "text": _render_message(code, template_env_key=template_env_key),
        },
        timeout=15,
    )

    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text}

    if response.status_code >= 400:
        detail = (
            body.get("detail")
            or body.get("message")
            or body.get("response_description")
            or body.get("raw")
            or "Sparrow SMS request failed."
        )
        raise OTPDeliveryError(f"Sparrow SMS request failed: {detail}")

    response_code = body.get("response_code")
    if response_code not in (None, 200, "200"):
        detail = body.get("response_description") or body.get("message") or "Unknown Sparrow SMS error."
        raise OTPDeliveryError(f"Sparrow SMS rejected the OTP request: {detail}")

    print(f"[MetroBus OTP][sparrow] {purpose_label} OTP requested for {phone}")
    return {
        "delivery": "sparrow",
        "detail": "OTP sent via Sparrow SMS.",
        "provider_response": body,
    }


def _dispatch_otp(
    identifier: str,
    code: str,
    *,
    purpose_label: str,
    template_env_key: str = "OTP_MESSAGE_TEMPLATE",
):
    provider = os.getenv("OTP_PROVIDER", "console").strip().lower() or "console"
    
    # Force email if identifier looks like an email
    if "@" in identifier:
        if provider == "console":
            return _send_console(identifier, code, purpose_label)
        return _send_email_otp(identifier, code, purpose_label, template_env_key=template_env_key)

    if provider == "console":
        return _send_console(identifier, code, purpose_label)
    if provider == "sparrow":
        return _send_sparrow(identifier, code, purpose_label, template_env_key=template_env_key)
    
    raise OTPDeliveryError(f"Unsupported OTP provider: {provider}")


def send_registration_otp(identifier: str, code: str):
    return _dispatch_otp(
        identifier,
        code,
        purpose_label="Registration",
        template_env_key="OTP_MESSAGE_TEMPLATE",
    )


def send_password_reset_otp(identifier: str, code: str):
    return _dispatch_otp(
        identifier,
        code,
        purpose_label="Password reset",
        template_env_key="PASSWORD_RESET_OTP_MESSAGE_TEMPLATE",
    )
