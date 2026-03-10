from django.urls import path
from .views import (
    CreatePaymentView,
    VerifyCashPaymentView,
    EsewaSuccessCallback,
    EsewaFailureCallback,
    KhaltiReturnCallback,
)

urlpatterns = [
    path("create/", CreatePaymentView.as_view(), name="payment-create"),
    path("cash/verify/<int:booking_id>/", VerifyCashPaymentView.as_view(), name="cash-verify"),

    # eSewa callbacks
    path("esewa/success/<int:payment_id>/", EsewaSuccessCallback.as_view(), name="esewa-success"),
    path("esewa/failure/<int:payment_id>/", EsewaFailureCallback.as_view(), name="esewa-failure"),

    # Khalti callback
    path("khalti/return/<int:payment_id>/", KhaltiReturnCallback.as_view(), name="khalti-return"),
]
