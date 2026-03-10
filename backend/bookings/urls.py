from django.urls import path
from .views import TripSeatAvailabilityView, CreateBookingView, CreateOfflineBoardingView

urlpatterns = [
    path("trips/<int:trip_id>/availability/", TripSeatAvailabilityView.as_view(), name="trip-seat-availability"),
    path("trips/<int:trip_id>/book/", CreateBookingView.as_view(), name="trip-book"),
    path("trips/<int:trip_id>/offline/", CreateOfflineBoardingView.as_view(), name="trip-offline"),
]
