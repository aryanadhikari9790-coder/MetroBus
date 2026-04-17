from django.db.models import Q
from django.utils import timezone
from decimal import Decimal
from transport.models import RouteFare
from .models import Booking, BookingSeat, OfflineSeat, SeatHold

JOURNEY_STATUS_ORDER = {
    Booking.JourneyStatus.BOOKED: 1,
    Booking.JourneyStatus.SCANNED: 2,
    Booking.JourneyStatus.PAYMENT_REQUESTED: 3,
    Booking.JourneyStatus.PAID: 4,
    Booking.JourneyStatus.BOARDED: 5,
    Booking.JourneyStatus.COMPLETED: 6,
    Booking.JourneyStatus.CANCELLED: 99,
}


def intervals_overlap(a_from: int, a_to: int, b_from: int, b_to: int) -> bool:
    # overlap if max(from) < min(to) using half-open interval [from,to)
    return max(a_from, b_from) < min(a_to, b_to)


def get_fare_for_segment(route_id: int, from_order: int, to_order: int) -> Decimal:
    fare = RouteFare.objects.filter(
        route_id=route_id,
        from_stop_order=from_order,
        to_stop_order=to_order,
    ).first()
    if not fare:
        raise ValueError("Fare not configured for this stop pair")
    return fare.fare_amount


def clear_expired_seat_holds(*, now=None) -> None:
    snapshot = now or timezone.now()
    SeatHold.objects.filter(expires_at__lte=snapshot).delete()


def get_active_seat_holds_for_trip(trip_id: int, from_order: int, to_order: int):
    clear_expired_seat_holds()
    holds = SeatHold.objects.filter(trip_id=trip_id, expires_at__gt=timezone.now()).select_related("passenger")
    return [
        hold
        for hold in holds
        if intervals_overlap(hold.from_stop_order, hold.to_stop_order, from_order, to_order)
    ]


def get_taken_seat_ids_for_trip(trip_id: int, from_order: int, to_order: int, *, exclude_passenger_id=None) -> set[int]:
    """
    Returns seat_ids that are NOT available for [from_order,to_order)
    considering:
    - confirmed bookings seat segments
    - offline seats seat segments
    - active temporary passenger seat holds
    """
    taken = set()

    # Confirmed bookings
    bookings = (
        Booking.objects.filter(trip_id=trip_id, status=Booking.Status.CONFIRMED)
        .prefetch_related("booking_seats")
    )

    for b in bookings:
        if intervals_overlap(b.from_stop_order, b.to_stop_order, from_order, to_order):
            for bs in b.booking_seats.all():
                taken.add(bs.seat_id)

    # Offline seats
    offline = (
        OfflineSeat.objects.filter(offline_boarding__trip_id=trip_id)
        .select_related("offline_boarding")
    )
    for os in offline:
        ob = os.offline_boarding
        if intervals_overlap(ob.from_stop_order, ob.to_stop_order, from_order, to_order):
            taken.add(os.seat_id)

    for hold in get_active_seat_holds_for_trip(trip_id, from_order, to_order):
        if exclude_passenger_id and hold.passenger_id == exclude_passenger_id:
            continue
        taken.add(hold.seat_id)

    return taken


def validate_seats_available(trip_id: int, from_order: int, to_order: int, seat_ids: list[int], *, exclude_passenger_id=None) -> None:
    taken = get_taken_seat_ids_for_trip(trip_id, from_order, to_order, exclude_passenger_id=exclude_passenger_id)
    conflict = [sid for sid in seat_ids if sid in taken]
    if conflict:
        raise ValueError(f"Seats not available: {conflict}")


def advance_booking_journey_status(booking: Booking, next_status: str) -> str:
    if booking.status == Booking.Status.CANCELLED:
        booking.journey_status = Booking.JourneyStatus.CANCELLED
        return booking.journey_status
    if booking.status == Booking.Status.COMPLETED:
        booking.journey_status = Booking.JourneyStatus.COMPLETED
        return booking.journey_status

    current = booking.journey_status or Booking.JourneyStatus.BOOKED
    if next_status == Booking.JourneyStatus.CANCELLED:
        booking.journey_status = Booking.JourneyStatus.CANCELLED
        return booking.journey_status

    if JOURNEY_STATUS_ORDER.get(next_status, 0) >= JOURNEY_STATUS_ORDER.get(current, 0):
        booking.journey_status = next_status
    return booking.journey_status
