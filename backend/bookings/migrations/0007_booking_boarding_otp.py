from django.db import migrations, models

import bookings.tickets


ACTIVE_BOOKING_STATUSES = {"PENDING", "CONFIRMED"}


def populate_boarding_otps(apps, schema_editor):
    Booking = apps.get_model("bookings", "Booking")

    for booking in Booking.objects.order_by("id"):
        otp = getattr(booking, "boarding_otp", "") or ""
        needs_new_otp = len(str(otp)) != 4 or not str(otp).isdigit()
        if not needs_new_otp:
            continue

        next_otp = bookings.tickets.generate_boarding_otp()
        if booking.status in ACTIVE_BOOKING_STATUSES:
            while Booking.objects.filter(
                trip_id=booking.trip_id,
                boarding_otp=next_otp,
                status__in=ACTIVE_BOOKING_STATUSES,
            ).exclude(id=booking.id).exists():
                next_otp = bookings.tickets.generate_boarding_otp()

        booking.boarding_otp = next_otp
        booking.save(update_fields=["boarding_otp"])


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0006_booking_qr_token_and_journey_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="boarding_otp",
            field=models.CharField(blank=True, default="", max_length=4),
        ),
        migrations.RunPython(populate_boarding_otps, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="booking",
            name="boarding_otp",
            field=models.CharField(default=bookings.tickets.generate_boarding_otp, editable=False, max_length=4),
        ),
    ]
