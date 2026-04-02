from io import BytesIO
from uuid import uuid4

import qrcode
from qrcode.image.svg import SvgPathImage


QR_PREFIX = "METROBUS:TICKET:"


def generate_ticket_code():
    return f"MBT-{uuid4().hex[:12].upper()}"


def build_ticket_payload(ticket_code):
    return f"{QR_PREFIX}{ticket_code}"


def parse_ticket_reference(value):
    raw = str(value or "").strip()
    if not raw:
        return {"ticket_code": None, "booking_id": None}

    normalized = raw.upper()
    if normalized.startswith(QR_PREFIX):
        return {"ticket_code": normalized.removeprefix(QR_PREFIX), "booking_id": None}

    if normalized.startswith("MBT-"):
        return {"ticket_code": normalized, "booking_id": None}

    if raw.isdigit():
        return {"ticket_code": None, "booking_id": int(raw)}

    digits_only = "".join(character for character in raw if character.isdigit())
    if digits_only and digits_only == raw.replace("#", ""):
        return {"ticket_code": None, "booking_id": int(digits_only)}

    return {"ticket_code": normalized, "booking_id": None}


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
