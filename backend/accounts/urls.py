from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .serializers import PhoneTokenObtainPairSerializer
from .views import (
    RegisterView,
    RegisterOTPRequestView,
    MeView,
    AdminDashboardView,
    AdminUserListCreateView,
    AdminUserReviewView,
)


class PhoneTokenObtainPairView(TokenObtainPairView):
    serializer_class = PhoneTokenObtainPairSerializer


urlpatterns = [
    path("otp/request/", RegisterOTPRequestView.as_view(), name="register-otp-request"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", PhoneTokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/users/", AdminUserListCreateView.as_view(), name="admin-users"),
    path("admin/users/<int:user_id>/review/", AdminUserReviewView.as_view(), name="admin-user-review"),
]
