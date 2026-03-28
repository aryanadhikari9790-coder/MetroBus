from django.urls import path
from .views import ActiveStopsView, AdminTransportRouteBuilderView, AdminBusManageView


urlpatterns = [
    path("stops/", ActiveStopsView.as_view(), name="transport-stops"),
    path("admin/route-builder/", AdminTransportRouteBuilderView.as_view(), name="transport-admin-route-builder"),
    path("admin/buses/", AdminBusManageView.as_view(), name="transport-admin-buses"),
]
