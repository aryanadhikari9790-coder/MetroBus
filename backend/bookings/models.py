from django.db import models
from django.conf import settings
from trips.models import Trip
from transport.models import Seat


class Booking(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="bookings")
    passenger = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bookings")

    from_stop_order = models.PositiveIntegerField()
    to_stop_order = models.PositiveIntegerField()

    seats_count = models.PositiveIntegerField()

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"
        COMPLETED = "COMPLETED", "Completed"
        NO_SHOW = "NO_SHOW", "No show"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CONFIRMED)

    fare_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_applied_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
    condition=models.Q(to_stop_order__gt=models.F("from_stop_order")),
    name="chk_booking_to_gt_from",
)

        ]

    def __str__(self):
        return f"Booking #{self.id} Trip {self.trip_id} ({self.status})"


class BookingSeat(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="booking_seats")
    seat = models.ForeignKey(Seat, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["booking", "seat"], name="uniq_booking_seat"),
        ]

    def __str__(self):
        return f"{self.booking_id} - {self.seat.seat_no}"


class OfflineBoarding(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="offline_boardings")
    helper = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="offline_boardings")

    from_stop_order = models.PositiveIntegerField()
    to_stop_order = models.PositiveIntegerField()

    seats_count = models.PositiveIntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
         models.CheckConstraint(
    condition=models.Q(to_stop_order__gt=models.F("from_stop_order")),
    name="chk_offline_to_gt_from",
)

        ]

    def __str__(self):
        return f"Offline {self.seats_count} seats Trip {self.trip_id}"


class OfflineSeat(models.Model):
    offline_boarding = models.ForeignKey(OfflineBoarding, on_delete=models.CASCADE, related_name="offline_seats")
    seat = models.ForeignKey(Seat, on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["offline_boarding", "seat"], name="uniq_offline_boarding_seat"),
        ]

    def __str__(self):
        return f"Offline {self.offline_boarding_id} - {self.seat.seat_no}"
