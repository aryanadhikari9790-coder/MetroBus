from django.urls import path
from .views import (
    CreatePaymentView,
    PassengerWalletSummaryView,
    PassengerWalletTopUpView,
    PassengerPassPurchaseView,
    VerifyCashPaymentView,
    EsewaSuccessCallback,
    EsewaFailureCallback,
    KhaltiReturnCallback,
    KhaltiVerifyPaymentView,
)

urlpatterns = [
    path("create/", CreatePaymentView.as_view(), name="payment-create"),
    path("wallet/summary/", PassengerWalletSummaryView.as_view(), name="wallet-summary"),
    path("wallet/top-up/", PassengerWalletTopUpView.as_view(), name="wallet-top-up"),
    path("wallet/pass/", PassengerPassPurchaseView.as_view(), name="wallet-pass"),
    path("cash/verify/<int:booking_id>/", VerifyCashPaymentView.as_view(), name="cash-verify"),

    # eSewa callbacks
    path("esewa/success/<int:payment_id>/", EsewaSuccessCallback.as_view(), name="esewa-success"),
    path("esewa/failure/<int:payment_id>/", EsewaFailureCallback.as_view(), name="esewa-failure"),

    # Khalti callback
    path("khalti/return/<int:payment_id>/", KhaltiReturnCallback.as_view(), name="khalti-return"),
    path("khalti/verify/<int:payment_id>/", KhaltiVerifyPaymentView.as_view(), name="khalti-verify"),
]
