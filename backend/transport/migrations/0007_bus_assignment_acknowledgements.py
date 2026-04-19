from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0006_bus_route"),
    ]

    operations = [
        migrations.AddField(
            model_name="bus",
            name="assignment_updated_at",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name="bus",
            name="driver_assignment_accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="bus",
            name="helper_assignment_accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
