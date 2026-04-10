from io import BytesIO
from uuid import uuid4

import qrcode
from qrcode.image.svg import SvgPathImage


LEGACY_QR_PREFIX = "METROBUS:TICKET:"
QR_PREFIX = "METROBUS:BOOKING:"


def generate_ticket_code():
    return f"MBT-{uuid4().hex[:12].upper()}"


def generate_qr_token():
    return uuid4().hex.upper()


def build_ticket_payload(booking_id, qr_token):
    return f"{QR_PREFIX}{booking_id}:{qr_token}"


def parse_ticket_reference(value):
    raw = str(value or "").strip()
    if not raw:
        return {"ticket_code": None, "booking_id": None, "qr_token": None}

    normalized = raw.upper()
    if normalized.startswith(QR_PREFIX):
        encoded = normalized.removeprefix(QR_PREFIX)
        booking_id, separator, qr_token = encoded.partition(":")
        if booking_id.isdigit() and separator and qr_token:
            return {"ticket_code": None, "booking_id": int(booking_id), "qr_token": qr_token}
        return {"ticket_code": None, "booking_id": None, "qr_token": None}

    if normalized.startswith(LEGACY_QR_PREFIX):
        return {"ticket_code": normalized.removeprefix(LEGACY_QR_PREFIX), "booking_id": None, "qr_token": None}

    if normalized.startswith("MBT-"):
        return {"ticket_code": normalized, "booking_id": None, "qr_token": None}

    if raw.isdigit():
        return {"ticket_code": None, "booking_id": int(raw), "qr_token": None}

    digits_only = "".join(character for character in raw if character.isdigit())
    if digits_only and digits_only == raw.replace("#", ""):
        return {"ticket_code": None, "booking_id": int(digits_only), "qr_token": None}

    return {"ticket_code": normalized, "booking_id": None, "qr_token": None}


def build_ticket_qr_svg(payload):
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=1,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    image = qr.make_image(image_factory=SvgPathImage)
    buffer = BytesIO()
    image.save(buffer)
    return buffer.getvalue().decode("utf-8")
