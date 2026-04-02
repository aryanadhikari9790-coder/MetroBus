from uuid import uuid4

import bookings.tickets
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def generate_ticket_code():
    return f"MBT-{uuid4().hex[:12].upper()}"


def populate_ticket_codes(apps, schema_editor):
    Booking = apps.get_model("bookings", "Booking")
    existing_codes = {
        code
        for code in Booking.objects.exclude(ticket_code__isnull=True)
        .exclude(ticket_code="")
        .values_list("ticket_code", flat=True)
    }

    for booking in Booking.objects.all().iterator():
        if booking.ticket_code:
            continue
        ticket_code = generate_ticket_code()
        while ticket_code in existing_codes:
            ticket_code = generate_ticket_code()
        existing_codes.add(ticket_code)
        booking.ticket_code = ticket_code
        booking.save(update_fields=["ticket_code"])


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="checked_in_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="ticket_code",
            field=models.CharField(blank=True, editable=False, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="booking",
            name="checked_in_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="checked_in_bookings",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="booking",
            name="completed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="completed_bookings",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.RunPython(populate_ticket_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="booking",
            name="ticket_code",
            field=models.CharField(
                default=bookings.tickets.generate_ticket_code,
                editable=False,
                max_length=20,
                unique=True,
            ),
        ),
    ]
