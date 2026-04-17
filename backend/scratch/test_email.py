import os
import sys
import django
from django.core.mail import send_mail
from django.conf import settings

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

def test_smtp():
    print(f"Testing SMTP with user: {settings.EMAIL_HOST_USER}")
    print(f"Backend: {settings.EMAIL_BACKEND}")
    print(f"Host: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
    
    try:
        send_mail(
            subject="MetroBus SMTP Test",
            message="If you are reading this, MetroBus SMTP is working correctly!",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.EMAIL_HOST_USER], # send to self
            fail_silently=False,
        )
        print("SUCCESS: Email sent successfully!")
    except Exception as e:
        print(f"FAILED: Could not send email. Error: {str(e)}")
        print("\nTIP: Make sure you have set EMAIL_HOST_PASSWORD in your .env file with a valid Gmail App Password.")

if __name__ == "__main__":
    test_smtp()
