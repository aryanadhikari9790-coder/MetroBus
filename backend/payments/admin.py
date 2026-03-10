from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "booking", "method", "status", "amount", "reference", "created_by", "verified_by", "created_at")
    list_filter = ("method", "status")
    search_fields = ("reference", "booking__id")
