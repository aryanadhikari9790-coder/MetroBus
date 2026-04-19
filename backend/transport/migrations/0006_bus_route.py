from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("transport", "0005_route_path_waypoints"),
    ]

    operations = [
        migrations.AddField(
            model_name="bus",
            name="route",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assigned_buses",
                to="transport.route",
            ),
        ),
    ]
