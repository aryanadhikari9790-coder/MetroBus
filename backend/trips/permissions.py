from rest_framework.permissions import BasePermission


class IsDriver(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == "DRIVER" or request.user.is_superuser)
        )


class IsHelper(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == "HELPER" or request.user.is_superuser)
        )


class IsDriverOrHelper(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role in {"DRIVER", "HELPER"} or request.user.is_superuser)
        )
