from django.urls import re_path

from .consumers import BookingEventConsumer


websocket_urlpatterns = [
    re_path(r"ws/bookings/stream/$", BookingEventConsumer.as_asgi()),
]
