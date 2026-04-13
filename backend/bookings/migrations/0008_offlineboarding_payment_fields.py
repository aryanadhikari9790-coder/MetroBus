from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0007_booking_boarding_otp"),
    ]

    operations = [
        migrations.AddField(
            model_name="offlineboarding",
            name="cash_collected",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="offlineboarding",
            name="cash_collected_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="offlineboarding",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
