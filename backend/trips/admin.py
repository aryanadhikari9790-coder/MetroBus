from django.contrib import admin
from .models import TripSchedule, Trip, TripLocation, TripSimulation



@admin.register(TripSchedule)
class TripScheduleAdmin(admin.ModelAdmin):
    list_display = ("id", "route", "bus", "driver", "helper", "scheduled_start_time", "status")
    list_filter = ("status", "route")
    search_fields = ("route__name", "bus__plate_number", "driver__full_name", "helper__full_name")


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("id", "route", "bus", "driver", "helper", "status", "started_at", "ended_at", "deviation_mode")
    list_filter = ("status", "route")
    search_fields = ("route__name", "bus__plate_number", "driver__full_name", "helper__full_name")


@admin.register(TripLocation)
class TripLocationAdmin(admin.ModelAdmin):
    list_display = ("id", "trip", "lat", "lng", "speed", "heading", "recorded_at")
    list_filter = ("trip",)


@admin.register(TripSimulation)
class TripSimulationAdmin(admin.ModelAdmin):
    list_display = ("trip", "is_active", "current_index", "last_persisted_index", "step_interval_ms", "updated_at")
    list_filter = ("is_active",)
