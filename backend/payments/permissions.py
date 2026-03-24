from rest_framework.permissions import BasePermission


class IsPassenger(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == "PASSENGER" or request.user.is_superuser)
        )


class IsHelperOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role in ["HELPER", "ADMIN"] or request.user.is_superuser)
        )
