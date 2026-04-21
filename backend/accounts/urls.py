from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .serializers import PhoneTokenObtainPairSerializer
from .views import (
    RegisterView,
    RegisterOTPRequestView,
    PasswordResetOTPRequestView,
    PasswordResetConfirmView,
    MeView,
    PasswordChangeView,
    AdminDashboardView,
    AdminUserListCreateView,
    AdminUserReviewView,
    AdminUserDetailView,
    NotificationListView,
    NotificationMarkReadView,
)


class PhoneTokenObtainPairView(TokenObtainPairView):
    serializer_class = PhoneTokenObtainPairSerializer


urlpatterns = [
    path("otp/request/", RegisterOTPRequestView.as_view(), name="register-otp-request"),
    path("password-reset/request/", PasswordResetOTPRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", PhoneTokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("me/password/", PasswordChangeView.as_view(), name="me-password"),
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("admin/users/", AdminUserListCreateView.as_view(), name="admin-users"),
    path("admin/users/<int:user_id>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/users/<int:user_id>/review/", AdminUserReviewView.as_view(), name="admin-user-review"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
]
