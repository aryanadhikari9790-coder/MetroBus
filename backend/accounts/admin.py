from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import PhoneOTP, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("id",)
    list_display = ("id", "full_name", "phone", "phone_verified", "email", "role", "is_active", "is_staff")
    search_fields = ("full_name", "phone", "email")
    list_filter = ("role", "is_active", "is_staff")

    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        (
            "Personal info",
            {
                "fields": (
                    "full_name",
                    "email",
                    "role",
                    "phone_verified",
                    "is_corporate_employee",
                    "home_location_label",
                    "home_lat",
                    "home_lng",
                    "office_location_label",
                    "office_lat",
                    "office_lng",
                )
            },
        ),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login",)}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("full_name", "phone", "email", "role", "phone_verified", "password1", "password2"),
            },
        ),
    )


@admin.register(PhoneOTP)
class PhoneOTPAdmin(admin.ModelAdmin):
    ordering = ("-created_at",)
    list_display = ("id", "phone", "purpose", "expires_at", "consumed_at", "created_at")
    search_fields = ("phone",)
    list_filter = ("purpose",)
