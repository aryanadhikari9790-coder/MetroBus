from .models import Seat


SEATS_PER_ROW = 4


def default_seat_labels(capacity: int) -> list[str]:
    labels = []
    seat_count = 0
    rows_needed = (capacity + SEATS_PER_ROW - 1) // SEATS_PER_ROW

    for row_idx in range(rows_needed):
        row_letter = chr(ord("A") + row_idx)
        for col in range(1, SEATS_PER_ROW + 1):
            if seat_count >= capacity:
                break
            labels.append(f"{row_letter}{col}")
            seat_count += 1

    return labels


def ensure_bus_seats(bus) -> int:
    existing_labels = set(bus.seats.values_list("seat_no", flat=True))
    if existing_labels and len(existing_labels) >= bus.capacity:
        return len(existing_labels)

    missing_labels = [label for label in default_seat_labels(bus.capacity) if label not in existing_labels]
    if missing_labels:
        Seat.objects.bulk_create([Seat(bus=bus, seat_no=label) for label in missing_labels], ignore_conflicts=True)

    return bus.seats.count()
