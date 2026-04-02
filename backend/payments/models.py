from django.db import models
from django.conf import settings
from bookings.models import Booking


class Payment(models.Model):
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name="payment")

    class Method(models.TextChoices):
        CASH = "CASH", "Cash"
        MOCK_ONLINE = "MOCK_ONLINE", "Mock Online"
        ESEWA = "ESEWA", "eSewa"
        KHALTI = "KHALTI", "Khalti"
        WALLET = "WALLET", "Metro Wallet"
        PASS = "PASS", "Ride Pass"
        REWARD = "REWARD", "Reward Ride"

    method = models.CharField(max_length=20, choices=Method.choices)

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SUCCESS = "SUCCESS", "Success"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    amount = models.DecimalField(max_digits=10, decimal_places=2)

    reference = models.CharField(max_length=200, blank=True, null=True)  # gateway ref id, txn id etc.

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments_created")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="payments_verified"
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payment {self.id} {self.method} {self.status}"


class PassengerWallet(models.Model):
    passenger = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet")
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    reward_points = models.PositiveIntegerField(default=0)
    lifetime_reward_points = models.PositiveIntegerField(default=0)
    pass_plan = models.CharField(max_length=24, blank=True, default="")
    pass_total_rides = models.PositiveIntegerField(default=0)
    pass_rides_remaining = models.PositiveIntegerField(default=0)
    pass_valid_until = models.DateField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Wallet for {self.passenger_id}"
