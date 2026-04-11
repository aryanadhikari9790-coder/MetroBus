from django.urls import path
from .views import (
    LiveTripsView,
    DriverDashboardView,
    HelperDashboardView,
    AdminTripScheduleBuilderView,
    AdminTripScheduleDetailView,
    StartTripView,
    EndTripView,
    PostTripLocationView,
    LatestTripLocationView,
    TripDetailView,
    TripSimulationPauseView,
    TripSimulationResetView,
    TripSimulationStartView,
    TripSimulationStepView,
)

urlpatterns = [
    path("live/", LiveTripsView.as_view(), name="trips-live"),
    path("driver/dashboard/", DriverDashboardView.as_view(), name="driver-dashboard"),
    path("helper/dashboard/", HelperDashboardView.as_view(), name="helper-dashboard"),
    path("admin/schedules/", AdminTripScheduleBuilderView.as_view(), name="admin-trip-schedules"),
    path("admin/schedules/<int:schedule_id>/", AdminTripScheduleDetailView.as_view(), name="admin-trip-schedule-detail"),
    path("start/", StartTripView.as_view(), name="trips-start"),
    path("<int:trip_id>/", TripDetailView.as_view(), name="trip-detail"),
    path("<int:trip_id>/end/", EndTripView.as_view(), name="trips-end"),
    path("<int:trip_id>/location/", PostTripLocationView.as_view(), name="trip-location-post"),
    path("<int:trip_id>/location/latest/", LatestTripLocationView.as_view(), name="trip-location-latest"),
    path("<int:trip_id>/simulate/start/", TripSimulationStartView.as_view(), name="trip-sim-start"),
    path("<int:trip_id>/simulate/pause/", TripSimulationPauseView.as_view(), name="trip-sim-pause"),
    path("<int:trip_id>/simulate/reset/", TripSimulationResetView.as_view(), name="trip-sim-reset"),
    path("<int:trip_id>/simulate/step/", TripSimulationStepView.as_view(), name="trip-sim-step"),
]
