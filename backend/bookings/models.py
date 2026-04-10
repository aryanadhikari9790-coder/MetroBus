from django.db import models
from django.conf import settings
from trips.models import Trip
from transport.models import Seat
from .tickets import build_ticket_payload, generate_boarding_otp, generate_qr_token, generate_ticket_code


class Booking(models.Model):
    class JourneyStatus(models.TextChoices):
        BOOKED = "BOOKED", "Booked"
        SCANNED = "SCANNED", "Scanned"
        PAYMENT_REQUESTED = "PAYMENT_REQUESTED", "Payment requested"
        PAID = "PAID", "Paid"
        BOARDED = "BOARDED", "Boarded"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

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

    class CancellationReason(models.TextChoices):
        CHANGE_OF_PLANS = "CHANGE_OF_PLANS", "Change of plans"
        WRONG_ROUTE = "WRONG_ROUTE", "Booked the wrong route"
        DELAY = "DELAY", "Bus arrival delay"
        PAYMENT_ISSUE = "PAYMENT_ISSUE", "Payment issue"
        EMERGENCY = "EMERGENCY", "Emergency or urgent issue"
        LOGOUT = "LOGOUT", "Passenger logged out mid-ride"
        OTHER = "OTHER", "Other"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CONFIRMED)

    ticket_code = models.CharField(max_length=20, unique=True, default=generate_ticket_code, editable=False)
    qr_token = models.CharField(max_length=32, unique=True, default=generate_qr_token, editable=False)
    boarding_otp = models.CharField(max_length=4, default=generate_boarding_otp, editable=False)
    journey_status = models.CharField(max_length=24, choices=JourneyStatus.choices, default=JourneyStatus.BOOKED)
    fare_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_applied_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    scanned_at = models.DateTimeField(null=True, blank=True)
    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="scanned_bookings",
    )
    payment_requested_at = models.DateTimeField(null=True, blank=True)
    payment_requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="payment_requests_sent",
    )
    accepted_by_helper_at = models.DateTimeField(null=True, blank=True)
    accepted_by_helper = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="accepted_bookings",
    )
    checked_in_at = models.DateTimeField(null=True, blank=True)
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="checked_in_bookings",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="completed_bookings",
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_bookings",
    )
    cancellation_reason = models.CharField(
        max_length=32,
        choices=CancellationReason.choices,
        blank=True,
        default="",
    )
    cancellation_note = models.CharField(max_length=255, blank=True, default="")

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

    @property
    def ticket_payload(self):
        return build_ticket_payload(self.id, self.qr_token)


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
