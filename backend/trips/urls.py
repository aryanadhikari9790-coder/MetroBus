from django.urls import path
from .views import (
    LiveTripsView,
    DriverDashboardView,
    StartTripView,
    EndTripView,
    PostTripLocationView,
    LatestTripLocationView,
    TripDetailView,
)

urlpatterns = [
    path("live/", LiveTripsView.as_view(), name="trips-live"),
    path("driver/dashboard/", DriverDashboardView.as_view(), name="driver-dashboard"),
    path("start/", StartTripView.as_view(), name="trips-start"),
    path("<int:trip_id>/", TripDetailView.as_view(), name="trip-detail"),
    path("<int:trip_id>/end/", EndTripView.as_view(), name="trips-end"),
    path("<int:trip_id>/location/", PostTripLocationView.as_view(), name="trip-location-post"),
    path("<int:trip_id>/location/latest/", LatestTripLocationView.as_view(), name="trip-location-latest"),
]
