from django.utils import timezone
from rest_framework import serializers
from .models import Payment, PassengerWallet
from .wallets import (
    DEFAULT_PASS_PLAN,
    FREE_RIDE_REWARD_POINTS,
    PASS_DEFAULT_RIDES,
    PASS_DEFAULT_VALIDITY_DAYS,
    get_pass_plan,
    pass_plan_choices,
)


class CreatePaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=["CASH", "MOCK_ONLINE", "ESEWA", "KHALTI", "WALLET", "PASS", "REWARD"])
    booking_id = serializers.IntegerField()


class WalletTopUpSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=1)


class WalletPassPurchaseSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=pass_plan_choices(), required=False, default=DEFAULT_PASS_PLAN)
    rides_count = serializers.IntegerField(min_value=1, default=PASS_DEFAULT_RIDES, required=False)
    validity_days = serializers.IntegerField(min_value=1, max_value=365, default=PASS_DEFAULT_VALIDITY_DAYS, required=False)

    def validate(self, attrs):
        plan = get_pass_plan(attrs.get("plan"))
        attrs["plan"] = plan["code"]
        attrs["plan_label"] = plan["label"]
        attrs["rides_count"] = plan["rides_count"]
        attrs["validity_days"] = plan["validity_days"]
        attrs["plan_summary"] = plan["summary"]
        return attrs


class PassengerWalletSerializer(serializers.ModelSerializer):
    pass_active = serializers.SerializerMethodField()
    pass_plan_label = serializers.SerializerMethodField()
    pass_summary = serializers.SerializerMethodField()
    reward_points_needed = serializers.SerializerMethodField()
    reward_free_ride_ready = serializers.SerializerMethodField()

    class Meta:
        model = PassengerWallet
        fields = (
            "balance",
            "reward_points",
            "lifetime_reward_points",
            "pass_plan",
            "pass_plan_label",
            "pass_summary",
            "pass_total_rides",
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

    def get_pass_plan_label(self, obj):
        if not obj.pass_plan:
            return ""
        return get_pass_plan(obj.pass_plan).get("label")

    def get_pass_summary(self, obj):
        if not obj.pass_plan:
            return ""
        return get_pass_plan(obj.pass_plan).get("summary")

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
            "gateway_order_id",
            "gateway_transaction_id",
            "gateway_status",
            "gateway_expires_at",
            "created_by",
            "verified_by",
            "verified_at",
            "created_at",
        )
        read_only_fields = fields
