from django.contrib import admin
from .models import Stop, Route, RouteStop, Bus, Seat, RouteFare


@admin.register(Stop)
class StopAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "lat", "lng", "is_active")
    search_fields = ("name",)
    list_filter = ("is_active",)


class RouteStopInline(admin.TabularInline):
    model = RouteStop
    extra = 0
    ordering = ("stop_order",)


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "city", "is_active")
    search_fields = ("name", "city")
    list_filter = ("city", "is_active")
    inlines = [RouteStopInline]


class SeatInline(admin.TabularInline):
    model = Seat
    extra = 0


@admin.register(Bus)
class BusAdmin(admin.ModelAdmin):
    list_display = ("id", "plate_number", "capacity", "is_active", "created_at")
    search_fields = ("plate_number",)
    list_filter = ("is_active",)
    inlines = [SeatInline]


@admin.register(RouteFare)
class RouteFareAdmin(admin.ModelAdmin):
    list_display = ("id", "route", "from_stop_order", "to_stop_order", "fare_amount")
    list_filter = ("route",)
    search_fields = ("route__name",)
