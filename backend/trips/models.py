from django.db import models
from django.conf import settings
from django.utils import timezone
from transport.models import Route, Bus


class TripSchedule(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="schedules")
    bus = models.ForeignKey(Bus, on_delete=models.CASCADE, related_name="schedules")
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="driver_schedules")
    helper = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="helper_schedules")
    scheduled_start_time = models.DateTimeField()
    driver_assignment_accepted_at = models.DateTimeField(null=True, blank=True)

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

    @property
    def driver_assignment_accepted(self):
        return bool(self.driver_assignment_accepted_at)


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

    driver_start_confirmed_at = models.DateTimeField(null=True, blank=True)
    helper_start_confirmed_at = models.DateTimeField(null=True, blank=True)
    driver_end_confirmed_at = models.DateTimeField(null=True, blank=True)
    helper_end_confirmed_at = models.DateTimeField(null=True, blank=True)

    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    deviation_mode = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.route.name} ({self.status})"

    @property
    def driver_start_confirmed(self):
        return bool(self.driver_start_confirmed_at)

    @property
    def helper_start_confirmed(self):
        return bool(self.helper_start_confirmed_at)

    @property
    def driver_end_confirmed(self):
        return bool(self.driver_end_confirmed_at)

    @property
    def helper_end_confirmed(self):
        return bool(self.helper_end_confirmed_at)

    @property
    def waiting_for_start_confirmation(self):
        return self.status == self.Status.NOT_STARTED and not (self.driver_start_confirmed and self.helper_start_confirmed)

    @property
    def waiting_for_end_confirmation(self):
        has_any_end_confirmation = self.driver_end_confirmed or self.helper_end_confirmed
        return self.status == self.Status.LIVE and has_any_end_confirmation and not (self.driver_end_confirmed and self.helper_end_confirmed)

    def missing_start_confirmations(self):
        pending = []
        if not self.driver_start_confirmed:
            pending.append("driver")
        if not self.helper_start_confirmed:
            pending.append("helper")
        return pending

    def missing_end_confirmations(self):
        pending = []
        if not self.driver_end_confirmed:
            pending.append("driver")
        if not self.helper_end_confirmed:
            pending.append("helper")
        return pending

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


class TripExpense(models.Model):
    class Category(models.TextChoices):
        FUEL = "FUEL", "Fuel"
        REPAIR = "REPAIR", "Repair"
        MAINTENANCE = "MAINTENANCE", "Maintenance"
        TOLL = "TOLL", "Toll"
        PARKING = "PARKING", "Parking"
        CLEANING = "CLEANING", "Cleaning"
        OTHER = "OTHER", "Other"

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="expenses", null=True, blank=True)
    bus = models.ForeignKey(Bus, on_delete=models.PROTECT, related_name="expenses")
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="trip_expenses")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.CharField(max_length=255, blank=True, default="")
    incurred_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-incurred_at", "-created_at"]

    def __str__(self):
        return f"{self.category} {self.amount} for bus {self.bus_id}"
