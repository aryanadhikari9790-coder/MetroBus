from django.urls import path
from .views import (
    ActiveStopsView,
    AdminStopManageView,
    AdminTransportRouteBuilderView,
    AdminTransportRouteDetailView,
    AdminBusManageView,
    AdminBusDetailView,
    MyAssignedBusView,
)

urlpatterns = [
    path("stops/", ActiveStopsView.as_view(), name="transport-stops"),
    path("admin/stops/", AdminStopManageView.as_view(), name="transport-admin-stops"),
    path("admin/route-builder/", AdminTransportRouteBuilderView.as_view(), name="transport-admin-route-builder"),
    path("admin/routes/<int:route_id>/", AdminTransportRouteDetailView.as_view(), name="transport-admin-route-detail"),
    path("admin/buses/", AdminBusManageView.as_view(), name="transport-admin-buses"),
    path("admin/buses/<int:bus_id>/", AdminBusDetailView.as_view(), name="transport-admin-bus-detail"),
    path("my-bus/", MyAssignedBusView.as_view(), name="transport-my-bus"),
]
