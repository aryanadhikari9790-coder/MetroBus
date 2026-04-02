from django.db import models
from django.conf import settings


class Stop(models.Model):
    name = models.CharField(max_length=120)
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Route(models.Model):
    name = models.CharField(max_length=160)  # e.g., "Lakeside → Prithvi Chowk"
    city = models.CharField(max_length=80, default="Pokhara")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["city", "name"]

    def __str__(self):
        return f"{self.city} - {self.name}"


class RouteStop(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="route_stops")
    stop = models.ForeignKey(Stop, on_delete=models.CASCADE)
    stop_order = models.PositiveIntegerField()

    class Meta:
        ordering = ["route", "stop_order"]
        constraints = [
            models.UniqueConstraint(fields=["route", "stop_order"], name="uniq_route_stop_order"),
            models.UniqueConstraint(fields=["route", "stop"], name="uniq_route_stop"),
        ]

    def __str__(self):
        return f"{self.route.name} - {self.stop_order}. {self.stop.name}"


class Bus(models.Model):
    class Condition(models.TextChoices):
        NEW = "NEW", "New"
        NORMAL = "NORMAL", "Normal"
        OLD = "OLD", "Old"

    display_name = models.CharField(max_length=80, blank=True, default="")
    plate_number = models.CharField(max_length=30, unique=True)
    model_year = models.PositiveIntegerField(null=True, blank=True)
    condition = models.CharField(max_length=20, choices=Condition.choices, default=Condition.NORMAL)
    layout_rows = models.PositiveIntegerField(default=9)
    layout_columns = models.PositiveIntegerField(default=4)
    capacity = models.PositiveIntegerField(default=35)
    exterior_photo = models.ImageField(upload_to="buses/exterior/", null=True, blank=True)
    interior_photo = models.ImageField(upload_to="buses/interior/", null=True, blank=True)
    seat_photo = models.ImageField(upload_to="buses/seats/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="driven_buses",
        limit_choices_to={"role": "DRIVER"},
    )
    helper = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="helped_buses",
        limit_choices_to={"role": "HELPER"},
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["plate_number"]

    def __str__(self):
        return self.plate_number


class Seat(models.Model):
    bus = models.ForeignKey(Bus, on_delete=models.CASCADE, related_name="seats")
    seat_no = models.CharField(max_length=10)  # e.g., A1, A2, B1...

    class Meta:
        ordering = ["bus", "seat_no"]
        constraints = [
            models.UniqueConstraint(fields=["bus", "seat_no"], name="uniq_bus_seat_no"),
        ]

    def __str__(self):
        return f"{self.bus.plate_number} - {self.seat_no}"


class RouteFare(models.Model):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name="fares")
    from_stop_order = models.PositiveIntegerField()
    to_stop_order = models.PositiveIntegerField()
    fare_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ["route", "from_stop_order", "to_stop_order"]
        constraints = [
            models.UniqueConstraint(
                fields=["route", "from_stop_order", "to_stop_order"],
                name="uniq_route_fare_pair",
            ),
            models.CheckConstraint(
                condition=models.Q(to_stop_order__gt=models.F("from_stop_order")),
                name="chk_to_greater_than_from",
            ),
        ]

    def __str__(self):
        return f"{self.route.name}: {self.from_stop_order}->{self.to_stop_order} = {self.fare_amount}"
