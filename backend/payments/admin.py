from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "booking",
        "method",
        "status",
        "gateway_status",
        "amount",
        "reference",
        "gateway_transaction_id",
        "created_by",
        "verified_by",
        "created_at",
    )
    list_filter = ("method", "status", "gateway_status")
    search_fields = ("reference", "gateway_order_id", "gateway_transaction_id", "booking__id", "booking__passenger__full_name")
    readonly_fields = (
        "reference",
        "gateway_order_id",
        "gateway_transaction_id",
        "gateway_status",
        "gateway_expires_at",
        "gateway_payload",
    )
