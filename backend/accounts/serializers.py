from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings

from .models import PhoneOTP
from .utils import build_full_name, normalize_nepal_phone

User = get_user_model()


class PhoneTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD  # resolves to "phone"

    def validate(self, attrs):
        identifier = str(attrs.get(self.username_field) or "").strip()
        password = attrs.get("password")

        if not identifier:
            raise serializers.ValidationError({self.username_field: "Phone number is required."})
        if not password:
            raise serializers.ValidationError({"password": "Password is required."})

        candidates = []
        compact = identifier.replace(" ", "").replace("-", "")

        for value in (identifier, compact, compact.lstrip("+")):
            if value and value not in candidates:
                candidates.append(value)

        try:
            normalized = normalize_nepal_phone(identifier)
        except DjangoValidationError:
            normalized = None
        else:
            for value in (
                normalized,
                normalized[1:],
                normalized[4:],
                f"0{normalized[4:]}",
            ):
                if value and value not in candidates:
                    candidates.append(value)

        query = Q(phone__in=candidates)
        if "@" in identifier:
            query |= Q(email__iexact=identifier)

        user = User.objects.filter(query).order_by("id").first()
        if not user or not user.check_password(password):
            raise serializers.ValidationError({"detail": "No active account found with the given credentials."})
        if not user.is_active:
            raise serializers.ValidationError({"detail": "This account is inactive."})

        refresh = self.get_token(user)
        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)

        return data


class RegisterOTPRequestSerializer(serializers.Serializer):
    phone = serializers.CharField()

    def validate_phone(self, value):
        try:
            phone = normalize_nepal_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0])

        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return phone


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(write_only=True, max_length=80)
    middle_name = serializers.CharField(write_only=True, max_length=80, required=False, allow_blank=True)
    last_name = serializers.CharField(write_only=True, max_length=80)
    otp_code = serializers.CharField(write_only=True, min_length=4, max_length=4)
    home_location_label = serializers.CharField(max_length=255)
    home_lat = serializers.DecimalField(max_digits=9, decimal_places=6)
    home_lng = serializers.DecimalField(max_digits=9, decimal_places=6)
    is_corporate_employee = serializers.BooleanField(required=False, default=False)
    office_location_label = serializers.CharField(max_length=255, required=False, allow_blank=True)
    office_lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    office_lng = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)

    class Meta:
        model = User
        fields = (
            "first_name",
            "middle_name",
            "last_name",
            "phone",
            "email",
            "password",
            "otp_code",
            "home_location_label",
            "home_lat",
            "home_lng",
            "is_corporate_employee",
            "office_location_label",
            "office_lat",
            "office_lng",
        )

    def validate_phone(self, value):
        try:
            phone = normalize_nepal_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0])

        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return phone

    def validate_email(self, value):
        if value in ("", None):
            return None

        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        is_corporate = attrs.get("is_corporate_employee", False)

        if is_corporate:
            missing = [
                field
                for field in ("office_location_label", "office_lat", "office_lng")
                if attrs.get(field) in ("", None)
            ]
            if missing:
                raise serializers.ValidationError(
                    {"office_location_label": "Office location is required for corporate employees."}
                )
        else:
            attrs["office_location_label"] = ""
            attrs["office_lat"] = None
            attrs["office_lng"] = None

        otp = (
            PhoneOTP.objects.filter(
                phone=attrs["phone"],
                purpose=PhoneOTP.Purpose.REGISTER,
                consumed_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            .order_by("-created_at")
            .first()
        )
        if not otp or not otp.matches(attrs["otp_code"]):
            raise serializers.ValidationError({"otp_code": "Invalid or expired OTP."})

        attrs["_otp"] = otp
        attrs["full_name"] = build_full_name(
            attrs["first_name"],
            attrs.get("middle_name", ""),
            attrs["last_name"],
        )
        return attrs

    def create(self, validated_data):
        otp = validated_data.pop("_otp")
        validated_data.pop("otp_code", None)
        validated_data.pop("first_name", None)
        validated_data.pop("middle_name", None)
        validated_data.pop("last_name", None)

        # Passengers self-register only
        user = User.objects.create_user(
            phone=validated_data["phone"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            email=validated_data.get("email"),
            role=User.Role.PASSENGER,
            phone_verified=True,
            is_active=True,
            home_location_label=validated_data["home_location_label"],
            home_lat=validated_data["home_lat"],
            home_lng=validated_data["home_lng"],
            is_corporate_employee=validated_data.get("is_corporate_employee", False),
            office_location_label=validated_data.get("office_location_label", ""),
            office_lat=validated_data.get("office_lat"),
            office_lng=validated_data.get("office_lng"),
        )
        otp.consume()
        return user


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "phone",
            "phone_verified",
            "email",
            "role",
            "is_staff",
            "is_superuser",
            "home_location_label",
            "home_lat",
            "home_lng",
            "is_corporate_employee",
            "office_location_label",
            "office_lat",
            "office_lng",
            "created_at",
        )


class MeUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = User
        fields = ("full_name", "email")

    def validate_email(self, value):
        if value in ("", None):
            return None

        existing = User.objects.filter(email=value).exclude(id=self.instance.id).exists()
        if existing:
            raise serializers.ValidationError("This email is already in use.")
        return value


class AdminUserListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "phone", "phone_verified", "email", "role", "is_active", "is_staff", "created_at")


class AdminCreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=["DRIVER", "HELPER", "ADMIN"])

    class Meta:
        model = User
        fields = ("full_name", "phone", "email", "password", "role")

    def validate_phone(self, value):
        try:
            phone = normalize_nepal_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0])

        if User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return phone

    def validate_email(self, value):
        if value in ("", None):
            return None

        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            phone=validated_data["phone"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            email=validated_data.get("email"),
            role=validated_data["role"],
            phone_verified=True,
            is_active=True,
        )
