from django.urls import path
from .views import PassengerBookingsView, TripSeatAvailabilityView, CreateBookingView, CreateOfflineBoardingView

urlpatterns = [
    path("my/", PassengerBookingsView.as_view(), name="passenger-bookings"),
    path("trips/<int:trip_id>/availability/", TripSeatAvailabilityView.as_view(), name="trip-seat-availability"),
    path("trips/<int:trip_id>/book/", CreateBookingView.as_view(), name="trip-book"),
    path("trips/<int:trip_id>/offline/", CreateOfflineBoardingView.as_view(), name="trip-offline"),
]
