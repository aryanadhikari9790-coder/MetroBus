from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/transport/trips/(?P<trip_id>\w+)/$', consumers.BusLocationConsumer.as_asgi()),
]
