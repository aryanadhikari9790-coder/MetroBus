from django.db import models
from django.conf import settings
from transport.models import Route, Bus


class TripSchedule(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="schedules")
    bus = models.ForeignKey(Bus, on_delete=models.CASCADE, related_name="schedules")
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="driver_schedules")
    helper = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="helper_schedules")
    scheduled_start_time = models.DateTimeField()

    class Status(models.TextChoices):
        PLANNED = "PLANNED", "Planned"
        CANCELLED = "CANCELLED", "Cancelled"
        COMPLETED = "COMPLETED", "Completed"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-scheduled_start_time"]

    def __str__(self):
        return f"{self.route.name} @ {self.scheduled_start_time}"


class Trip(models.Model):
    schedule = models.ForeignKey(TripSchedule, on_delete=models.SET_NULL, null=True, blank=True, related_name="trips")

    route = models.ForeignKey(Route, on_delete=models.PROTECT, related_name="trips")
    bus = models.ForeignKey(Bus, on_delete=models.PROTECT, related_name="trips")
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="driver_trips")
    helper = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="helper_trips")

    class Status(models.TextChoices):
        NOT_STARTED = "NOT_STARTED", "Not started"
        LIVE = "LIVE", "Live"
        ENDED = "ENDED", "Ended"
        CANCELLED = "CANCELLED", "Cancelled"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)

    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    deviation_mode = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.route.name} ({self.status})"
class TripLocation(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="locations")
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    speed = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    heading = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"Trip {self.trip_id} @ {self.lat},{self.lng}"


class TripSimulation(models.Model):
    trip = models.OneToOneField(Trip, on_delete=models.CASCADE, related_name="simulation")
    points = models.JSONField(default=list, blank=True)
    current_index = models.PositiveIntegerField(default=0)
    last_persisted_index = models.PositiveIntegerField(default=0)
    step_interval_ms = models.PositiveIntegerField(default=2000)
    is_active = models.BooleanField(default=False)
    last_advanced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Simulation for trip {self.trip_id}"
