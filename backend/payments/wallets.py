from datetime import timedelta

from django.utils import timezone


FREE_RIDE_REWARD_POINTS = 100
DEFAULT_PASS_PLAN = "FLEX_20"
PASS_DEFAULT_RIDES = 20
PASS_DEFAULT_VALIDITY_DAYS = 30
PASS_PLANS = {
    "WEEKLY": {
        "code": "WEEKLY",
        "label": "Weekly Pass",
        "rides_count": 14,
        "validity_days": 7,
        "summary": "Best for one week of regular commuting.",
    },
    "MONTHLY": {
        "code": "MONTHLY",
        "label": "Monthly Pass",
        "rides_count": 60,
        "validity_days": 30,
        "summary": "Built for frequent work and school travel all month.",
    },
    "FLEX_20": {
        "code": "FLEX_20",
        "label": "Flex 20",
        "rides_count": PASS_DEFAULT_RIDES,
        "validity_days": PASS_DEFAULT_VALIDITY_DAYS,
        "summary": "A lighter pass for occasional MetroBus riders.",
    },
}
PASS_PLAN_ORDER = ["WEEKLY", "MONTHLY", "FLEX_20"]


def calculate_reward_points(amount):
    amount_value = float(amount or 0)
    return max(1, int(amount_value // 25) or 1)


def pass_expiry_date(validity_days=PASS_DEFAULT_VALIDITY_DAYS):
    return timezone.localdate() + timedelta(days=validity_days)


def get_pass_plan(plan_code=DEFAULT_PASS_PLAN):
    return PASS_PLANS.get(plan_code or DEFAULT_PASS_PLAN, PASS_PLANS[DEFAULT_PASS_PLAN])


def pass_plan_choices():
    return [(plan["code"], plan["label"]) for plan in serialize_pass_plans()]


def serialize_pass_plans():
    return [PASS_PLANS[code] for code in PASS_PLAN_ORDER if code in PASS_PLANS]
