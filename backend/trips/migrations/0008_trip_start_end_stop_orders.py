from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("trips", "0007_tripschedule_helper_assignment_accepted_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="trip",
            name="end_stop_order",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="trip",
            name="start_stop_order",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
