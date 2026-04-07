import re

from django.core.exceptions import ValidationError


NEPAL_COUNTRY_CODE = "+977"
NEPAL_MOBILE_LOCAL_LENGTH = 10


def normalize_nepal_phone(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        raise ValidationError("Phone number is required.")

    cleaned = raw.replace(" ", "").replace("-", "")
    cleaned = re.sub(r"(?!^\+)\D", "", cleaned)

    if cleaned.startswith("00"):
        cleaned = f"+{cleaned[2:]}"

    if cleaned.startswith("+977"):
        national = cleaned[4:]
    elif cleaned.startswith("977"):
        national = cleaned[3:]
    elif cleaned.startswith("0"):
        national = cleaned[1:]
    else:
        national = cleaned

    if not national.isdigit():
        raise ValidationError("Enter a valid Nepal mobile number.")

    if len(national) != NEPAL_MOBILE_LOCAL_LENGTH or not national.startswith("9"):
        raise ValidationError("Enter a valid Nepal mobile number in +977 or 98XXXXXXXX format.")

    return f"{NEPAL_COUNTRY_CODE}{national}"


def phone_lookup_candidates(value: str) -> list[str]:
    identifier = str(value or "").strip()
    if not identifier:
        return []

    candidates = []
    compact = identifier.replace(" ", "").replace("-", "")

    for option in (identifier, compact, compact.lstrip("+")):
        if option and option not in candidates:
            candidates.append(option)

    try:
        normalized = normalize_nepal_phone(identifier)
    except ValidationError:
        normalized = None
    else:
        for option in (
            normalized,
            normalized[1:],
            normalized[4:],
            f"0{normalized[4:]}",
        ):
            if option and option not in candidates:
                candidates.append(option)

    return candidates


def build_full_name(first_name: str, middle_name: str = "", last_name: str = "") -> str:
    parts = [str(first_name or "").strip(), str(middle_name or "").strip(), str(last_name or "").strip()]
    return " ".join(part for part in parts if part)
