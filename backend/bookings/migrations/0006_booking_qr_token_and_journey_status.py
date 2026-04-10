from django.conf import settings
from django.db import migrations, models
import bookings.tickets
from uuid import uuid4


def populate_booking_qr_tokens_and_status(apps, schema_editor):
    Booking = apps.get_model("bookings", "Booking")
    Payment = apps.get_model("payments", "Payment")

    payment_map = {payment.booking_id: payment for payment in Payment.objects.all()}

    for booking in Booking.objects.all().iterator():
        booking.qr_token = uuid4().hex.upper()

        payment = payment_map.get(booking.id)
        if booking.status == "CANCELLED":
            booking.journey_status = "CANCELLED"
        elif booking.status == "COMPLETED" or booking.completed_at:
            booking.journey_status = "COMPLETED"
        elif booking.checked_in_at:
            booking.journey_status = "BOARDED"
        elif payment and payment.status == "SUCCESS":
            booking.journey_status = "PAID"
        elif booking.payment_requested_at:
            booking.journey_status = "PAYMENT_REQUESTED"
        elif booking.accepted_by_helper_at:
            booking.journey_status = "SCANNED"
            if not booking.scanned_at:
                booking.scanned_at = booking.accepted_by_helper_at
            if not booking.scanned_by_id and booking.accepted_by_helper_id:
                booking.scanned_by_id = booking.accepted_by_helper_id
        else:
            booking.journey_status = "BOOKED"

        booking.save(update_fields=["qr_token", "journey_status", "scanned_at", "scanned_by"])


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0005_booking_cancellation_note_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("payments", "0004_payment_gateway_expires_at_payment_gateway_order_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="journey_status",
            field=models.CharField(
                choices=[
                    ("BOOKED", "Booked"),
                    ("SCANNED", "Scanned"),
                    ("PAYMENT_REQUESTED", "Payment requested"),
                    ("PAID", "Paid"),
                    ("BOARDED", "Boarded"),
                    ("COMPLETED", "Completed"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="BOOKED",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="qr_token",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="booking",
            name="scanned_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="scanned_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.PROTECT, related_name="scanned_bookings", to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(populate_booking_qr_tokens_and_status, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="booking",
            name="qr_token",
            field=models.CharField(default=bookings.tickets.generate_qr_token, editable=False, max_length=32, unique=True),
        ),
    ]
