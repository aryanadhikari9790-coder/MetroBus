from django.utils import timezone
from rest_framework import serializers
from .models import Payment, PassengerWallet
from .wallets import FREE_RIDE_REWARD_POINTS, PASS_DEFAULT_RIDES, PASS_DEFAULT_VALIDITY_DAYS


class CreatePaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=["CASH", "MOCK_ONLINE", "ESEWA", "KHALTI", "WALLET", "PASS", "REWARD"])
    booking_id = serializers.IntegerField()


class WalletTopUpSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=1)


class WalletPassPurchaseSerializer(serializers.Serializer):
    rides_count = serializers.IntegerField(min_value=1, default=PASS_DEFAULT_RIDES)
    validity_days = serializers.IntegerField(min_value=1, max_value=365, default=PASS_DEFAULT_VALIDITY_DAYS)


class PassengerWalletSerializer(serializers.ModelSerializer):
    pass_active = serializers.SerializerMethodField()
    reward_points_needed = serializers.SerializerMethodField()
    reward_free_ride_ready = serializers.SerializerMethodField()

    class Meta:
        model = PassengerWallet
        fields = (
            "balance",
            "reward_points",
            "lifetime_reward_points",
            "pass_rides_remaining",
            "pass_valid_until",
            "pass_active",
            "reward_points_needed",
            "reward_free_ride_ready",
            "updated_at",
        )
        read_only_fields = fields

    def get_pass_active(self, obj):
        return bool(obj.pass_valid_until and obj.pass_valid_until >= timezone.localdate() and obj.pass_rides_remaining > 0)

    def get_reward_points_needed(self, obj):
        return max(FREE_RIDE_REWARD_POINTS - obj.reward_points, 0)

    def get_reward_free_ride_ready(self, obj):
        return obj.reward_points >= FREE_RIDE_REWARD_POINTS



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
