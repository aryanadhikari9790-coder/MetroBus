from rest_framework import serializers
from .models import Payment


class CreatePaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=["CASH", "MOCK_ONLINE", "ESEWA", "KHALTI"])
    booking_id = serializers.IntegerField()



class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            "id",
            "booking",
            "method",
            "status",
            "amount",
            "reference",
            "created_by",
            "verified_by",
            "verified_at",
            "created_at",
        )
        read_only_fields = fields
