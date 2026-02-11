class Payment:
    def __init__(self, amount, payment_method, status="pending"):
        self.amount = amount
        self.payment_method = payment_method
        self.status = status

    def process_payment(self):
        # Implement payment processing logic here
        pass

    def refund(self):
        # Implement refund logic here
        pass

class CreditCardPayment(Payment):
    def __init__(self, amount, card_number, card_expiry, card_cvc):
        super().__init__(amount, "credit_card")
        self.card_number = card_number
        self.card_expiry = card_expiry
        self.card_cvc = card_cvc

class PayPalPayment(Payment):
    def __init__(self, amount, email):
        super().__init__(amount, "paypal")
        self.email = email

class BankTransferPayment(Payment):
    def __init__(self, amount, bank_account):
        super().__init__(amount, "bank_transfer")
        self.bank_account = bank_account

# Example usage:
# payment = CreditCardPayment(100, "1234567812345678", "12/25", "123")
# payment.process_payment()