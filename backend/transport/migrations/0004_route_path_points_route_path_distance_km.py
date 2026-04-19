from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0003_bus_condition_bus_display_name_bus_exterior_photo_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="route",
            name="path_distance_km",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),
        migrations.AddField(
            model_name="route",
            name="path_points",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
