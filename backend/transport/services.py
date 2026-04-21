from decimal import Decimal
from math import atan2, cos, radians, sin, sqrt

from .models import Seat, Stop


DEFAULT_SEATS_PER_ROW = 4


def _row_label(row_idx: int) -> str:
    label = ""
    value = row_idx
    while True:
        value, remainder = divmod(value, 26)
        label = chr(ord("A") + remainder) + label
        if value == 0:
            return label
        value -= 1


def default_seat_labels(capacity: int, seats_per_row: int = DEFAULT_SEATS_PER_ROW) -> list[str]:
    """Generate seat labels for all rows.

    The last row is always a bench that spans the full bus width, adding one seat
    in the aisle space (seats_per_row + 1). Regular rows use *seats_per_row*.
    The *capacity* parameter should already include the back-row seats
    (i.e. capacity = (rows - 1) * seats_per_row + (seats_per_row + 1)).
    """
    labels = []
    seat_count = 0
    seats_per_row = max(int(seats_per_row or DEFAULT_SEATS_PER_ROW), 1)
    back_row_seats = seats_per_row + 1

    remaining = capacity
    row_idx = 0

    while remaining > 0:
        row_letter = _row_label(row_idx)
        # It's the last row if remaining seats match exactly what a back row should have,
        # or if it's the very last set of seats being allocated.
        is_last_row = remaining <= back_row_seats
        cols_this_row = back_row_seats if is_last_row else min(seats_per_row, remaining)

        for col in range(1, cols_this_row + 1):
            labels.append(f"{row_letter}{col}")
            seat_count += 1

        remaining -= cols_this_row
        row_idx += 1

    return labels


def ensure_bus_seats(bus) -> int:
    existing_labels = set(bus.seats.values_list("seat_no", flat=True))
    if existing_labels and len(existing_labels) >= bus.capacity:
        return len(existing_labels)

    seats_per_row = getattr(bus, "layout_columns", None) or DEFAULT_SEATS_PER_ROW
    missing_labels = [label for label in default_seat_labels(bus.capacity, seats_per_row) if label not in existing_labels]
    if missing_labels:
        Seat.objects.bulk_create([Seat(bus=bus, seat_no=label) for label in missing_labels], ignore_conflicts=True)

    return bus.seats.count()


def normalize_route_path_points(path_points) -> list[dict]:
    normalized = []
    for index, item in enumerate(path_points or [], start=1):
        if isinstance(item, dict):
            lat = item.get("lat")
            lng = item.get("lng")
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            lat, lng = item[0], item[1]
        else:
            continue

        try:
            lat_value = float(lat)
            lng_value = float(lng)
        except (TypeError, ValueError):
            continue

        if not (-90 <= lat_value <= 90 and -180 <= lng_value <= 180):
            continue

        normalized.append(
            {
                "seq": index,
                "lat": round(lat_value, 6),
                "lng": round(lng_value, 6),
            }
        )
    return normalized


def stop_points_for_ids(stop_ids) -> list[dict]:
    ordered_stops = list(Stop.objects.filter(id__in=stop_ids))
    stop_map = {stop.id: stop for stop in ordered_stops}
    return [
        {
            "seq": index,
            "lat": round(float(stop_map[stop_id].lat), 6),
            "lng": round(float(stop_map[stop_id].lng), 6),
        }
        for index, stop_id in enumerate(stop_ids, start=1)
        if stop_id in stop_map
    ]


def route_distance_km(path_points) -> Decimal:
    points = normalize_route_path_points(path_points)
    if len(points) < 2:
        return Decimal("0.00")

    total = 0.0
    for index in range(1, len(points)):
        total += _haversine_km(points[index - 1], points[index])
    return Decimal(f"{total:.2f}")


def _haversine_km(a, b) -> float:
    radius_km = 6371
    lat1 = radians(float(a["lat"]))
    lng1 = radians(float(a["lng"]))
    lat2 = radians(float(b["lat"]))
    lng2 = radians(float(b["lng"]))
    d_lat = lat2 - lat1
    d_lng = lng2 - lng1
    h = sin(d_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(d_lng / 2) ** 2
    return 2 * radius_km * atan2(sqrt(h), sqrt(max(0.0, 1 - h)))
