from django.urls import path
from .views import ActiveStopsView, AdminTransportRouteBuilderView


urlpatterns = [
    path("stops/", ActiveStopsView.as_view(), name="transport-stops"),
    path("admin/route-builder/", AdminTransportRouteBuilderView.as_view(), name="transport-admin-route-builder"),
]
