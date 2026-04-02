from datetime import timedelta

from django.utils import timezone


FREE_RIDE_REWARD_POINTS = 100
PASS_DEFAULT_RIDES = 20
PASS_DEFAULT_VALIDITY_DAYS = 30


def calculate_reward_points(amount):
    amount_value = float(amount or 0)
    return max(1, int(amount_value // 25) or 1)


def pass_expiry_date(validity_days=PASS_DEFAULT_VALIDITY_DAYS):
    return timezone.localdate() + timedelta(days=validity_days)

