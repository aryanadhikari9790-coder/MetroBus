from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone


def booking_user_group(user_id: int) -> str:
    return f"user_bookings_{user_id}"


def emit_booking_event(booking, event_type: str, *, message: str = "", actor=None, extra=None):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    payload = {
        "type": event_type,
        "booking_id": booking.id,
        "trip_id": booking.trip_id,
        "ticket_code": booking.ticket_code,
        "journey_status": booking.journey_status,
        "booking_status": booking.status,
        "payment_status": getattr(getattr(booking, "payment", None), "status", "UNPAID"),
        "message": message,
        "actor_role": getattr(actor, "role", None) if actor else None,
        "sent_at": timezone.now().isoformat(),
    }
    if extra:
        payload.update(extra)

    recipient_ids = {booking.passenger_id}
    if booking.trip.helper_id:
        recipient_ids.add(booking.trip.helper_id)

    for user_id in recipient_ids:
        async_to_sync(channel_layer.group_send)(
            booking_user_group(user_id),
            {
                "type": "booking_event",
                "payload": payload,
            },
        )
