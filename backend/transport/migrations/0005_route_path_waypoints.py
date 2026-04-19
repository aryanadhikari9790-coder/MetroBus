from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0004_route_path_points_route_path_distance_km"),
    ]

    operations = [
        migrations.AddField(
            model_name="route",
            name="path_waypoints",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
