from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone

from .utils import normalize_nepal_phone


class UserManager(BaseUserManager):
    def create_user(self, phone, password=None, **extra_fields):
        if not phone:
            raise ValueError("Phone is required")
        phone = normalize_nepal_phone(phone)

        user = self.model(phone=phone, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(phone, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        PASSENGER = "PASSENGER", "Passenger"
        DRIVER = "DRIVER", "Driver"
        HELPER = "HELPER", "Helper"
        ADMIN = "ADMIN", "Admin"

    phone = models.CharField(max_length=20, unique=True)
    email = models.EmailField(blank=True, null=True, unique=True)
    full_name = models.CharField(max_length=150)
    address = models.CharField(max_length=255, blank=True, default="")
    official_photo = models.ImageField(upload_to="users/official_photos/", null=True, blank=True)
    official_photo_verified = models.BooleanField(default=False)
    license_number = models.CharField(max_length=120, blank=True, default="")
    license_photo = models.ImageField(upload_to="users/license_photos/", null=True, blank=True)
    license_verified = models.BooleanField(default=False)
    phone_verified = models.BooleanField(default=False)
    home_location_label = models.CharField(max_length=255, blank=True, default="")
    home_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    home_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_corporate_employee = models.BooleanField(default=False)
    office_location_label = models.CharField(max_length=255, blank=True, default="")
    office_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    office_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    school_location_label = models.CharField(max_length=255, blank=True, default="")
    school_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    school_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    email_verified = models.BooleanField(default=False)

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.PASSENGER)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    def __str__(self):
        return f"{self.full_name} ({self.phone})"


class AuthOTP(models.Model):
    class Purpose(models.TextChoices):
        REGISTER = "REGISTER", "Account registration"
        PASSWORD_RESET = "PASSWORD_RESET", "Password reset"

    phone = models.CharField(max_length=20, db_index=True, null=True, blank=True)
    email = models.EmailField(db_index=True, null=True, blank=True)
    purpose = models.CharField(max_length=20, choices=Purpose.choices, default=Purpose.REGISTER)
    code_hash = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def set_code(self, code: str):
        self.code_hash = make_password(code)

    def matches(self, code: str) -> bool:
        return check_password(str(code or ""), self.code_hash)

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    def consume(self):
        self.consumed_at = timezone.now()
        self.save(update_fields=["consumed_at"])


class Notification(models.Model):
    """Persistent, per-user notification record (ride events, payment alerts, etc.)."""

    class Kind(models.TextChoices):
        TRIP_STARTED = "TRIP_STARTED", "Trip Started"
        TRIP_ENDED = "TRIP_ENDED", "Trip Ended"
        PAYMENT_REQUESTED = "PAYMENT_REQUESTED", "Payment Requested"
        ASSIGNMENT_UPDATED = "ASSIGNMENT_UPDATED", "Assignment Updated"
        REVIEW_PROMPT = "REVIEW_PROMPT", "Review Prompt"
        GENERAL = "GENERAL", "General"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    kind = models.CharField(max_length=30, choices=Kind.choices, default=Kind.GENERAL)
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")
    related_booking_id = models.IntegerField(null=True, blank=True)
    related_trip_id = models.IntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "-created_at"]),
        ]

    def __str__(self):
        return f"[{self.kind}] {self.title} → {self.user_id}"

    @classmethod
    def push(cls, user, kind, title, message="", *, booking_id=None, trip_id=None):
        """Convenience factory — creates and returns the notification."""
        return cls.objects.create(
            user=user,
            kind=kind,
            title=title,
            message=message,
            related_booking_id=booking_id,
            related_trip_id=trip_id,
        )
