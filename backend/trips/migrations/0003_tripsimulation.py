from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("trips", "0002_triplocation"),
    ]

    operations = [
        migrations.CreateModel(
            name="TripSimulation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("points", models.JSONField(blank=True, default=list)),
                ("current_index", models.PositiveIntegerField(default=0)),
                ("last_persisted_index", models.PositiveIntegerField(default=0)),
                ("step_interval_ms", models.PositiveIntegerField(default=2000)),
                ("is_active", models.BooleanField(default=False)),
                ("last_advanced_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("trip", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="simulation", to="trips.trip")),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
    ]
