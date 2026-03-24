from django.urls import path
from .views import AdminTransportRouteBuilderView


urlpatterns = [
    path("admin/route-builder/", AdminTransportRouteBuilderView.as_view(), name="transport-admin-route-builder"),
]
