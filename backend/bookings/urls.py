from django.urls import path
from .views import (
    PassengerBookingsView,
    TripSeatAvailabilityView,
    CreateBookingView,
    CreateOfflineBoardingView,
    HelperBookingLookupView,
    HelperBoardBookingView,
    HelperRequestBookingPaymentView,
    HelperCompleteBookingView,
)

urlpatterns = [
    path("my/", PassengerBookingsView.as_view(), name="passenger-bookings"),
    path("lookup/", HelperBookingLookupView.as_view(), name="booking-lookup"),
    path("trips/<int:trip_id>/availability/", TripSeatAvailabilityView.as_view(), name="trip-seat-availability"),
    path("trips/<int:trip_id>/book/", CreateBookingView.as_view(), name="trip-book"),
    path("trips/<int:trip_id>/offline/", CreateOfflineBoardingView.as_view(), name="trip-offline"),
    path("<int:booking_id>/request-payment/", HelperRequestBookingPaymentView.as_view(), name="booking-request-payment"),
    path("<int:booking_id>/board/", HelperBoardBookingView.as_view(), name="booking-board"),
    path("<int:booking_id>/complete/", HelperCompleteBookingView.as_view(), name="booking-complete"),
]
