from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("trips", "0004_trip_driver_end_confirmed_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="tripschedule",
            name="driver_assignment_accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
