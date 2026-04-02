from .models import Seat


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
    labels = []
    seat_count = 0
    seats_per_row = max(int(seats_per_row or DEFAULT_SEATS_PER_ROW), 1)
    rows_needed = (capacity + seats_per_row - 1) // seats_per_row

    for row_idx in range(rows_needed):
        row_letter = _row_label(row_idx)
        for col in range(1, seats_per_row + 1):
            if seat_count >= capacity:
                break
            labels.append(f"{row_letter}{col}")
            seat_count += 1

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
