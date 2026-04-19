from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings

from .models import AuthOTP
from .utils import build_full_name, normalize_nepal_phone, phone_lookup_candidates

User = get_user_model()


def _absolute_media_url(serializer, value):
    if not value:
        return None
    try:
        url = value.url
    except ValueError:
        return None
    request = serializer.context.get("request")
    return request.build_absolute_uri(url) if request else url


class PhoneTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD  # resolves to "phone"

    def validate(self, attrs):
        identifier = str(attrs.get(self.username_field) or "").strip()
        password = attrs.get("password")

        if not identifier:
            raise serializers.ValidationError({self.username_field: "Phone number is required."})
        if not password:
            raise serializers.ValidationError({"password": "Password is required."})

        candidates = phone_lookup_candidates(identifier)

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
    email = serializers.EmailField()

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower().strip()


class PasswordResetOTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        email = value.lower().strip()
        user = User.objects.filter(email__iexact=email, role=User.Role.PASSENGER, is_active=True).order_by("id").first()
        if not user:
            raise serializers.ValidationError("No active passenger account was found for this email.")
        self.context["reset_user"] = user
        return email


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(write_only=True, min_length=4, max_length=4)
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, min_length=6)

    def validate_email(self, value):
        email = value.lower().strip()
        user = User.objects.filter(email__iexact=email, role=User.Role.PASSENGER, is_active=True).order_by("id").first()
        if not user:
            raise serializers.ValidationError("No active passenger account was found for this email.")
        self.context["reset_user"] = user
        return email

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        otp = (
            AuthOTP.objects.filter(
                email=attrs["email"],
                purpose=AuthOTP.Purpose.PASSWORD_RESET,
                consumed_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            .order_by("-created_at")
            .first()
        )
        if not otp or not otp.matches(attrs["otp_code"]):
            raise serializers.ValidationError({"otp_code": "Invalid or expired OTP."})

        attrs["_otp"] = otp
        attrs["_user"] = self.context["reset_user"]
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["_user"]
        otp = self.validated_data["_otp"]
        user.set_password(self.validated_data["password"])
        user.save(update_fields=["password"])
        otp.consume()
        return user


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
    school_location_label = serializers.CharField(max_length=255, required=False, allow_blank=True)
    school_lat = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    school_lng = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)

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
            "school_location_label",
            "school_lat",
            "school_lng",
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

        school_fields = ("school_location_label", "school_lat", "school_lng")
        school_values = [attrs.get(field) for field in school_fields]
        if any(value not in ("", None) for value in school_values) and any(value in ("", None) for value in school_values):
            raise serializers.ValidationError(
                {"school_location_label": "School location needs a label and map point together."}
            )
        if all(value in ("", None) for value in school_values):
            attrs["school_location_label"] = ""
            attrs["school_lat"] = None
            attrs["school_lng"] = None

        otp = (
            AuthOTP.objects.filter(
                email=attrs["email"],
                purpose=AuthOTP.Purpose.REGISTER,
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
            email_verified=True,
            is_active=True,
            home_location_label=validated_data["home_location_label"],
            home_lat=validated_data["home_lat"],
            home_lng=validated_data["home_lng"],
            is_corporate_employee=validated_data.get("is_corporate_employee", False),
            office_location_label=validated_data.get("office_location_label", ""),
            office_lat=validated_data.get("office_lat"),
            office_lng=validated_data.get("office_lng"),
            school_location_label=validated_data.get("school_location_label", ""),
            school_lat=validated_data.get("school_lat"),
            school_lng=validated_data.get("school_lng"),
        )
        otp.consume()
        return user


class MeSerializer(serializers.ModelSerializer):
    official_photo_url = serializers.SerializerMethodField()
    license_photo_url = serializers.SerializerMethodField()

    def get_official_photo_url(self, obj):
        return _absolute_media_url(self, obj.official_photo)

    def get_license_photo_url(self, obj):
        return _absolute_media_url(self, obj.license_photo)

    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "phone",
            "phone_verified",
            "email",
            "address",
            "role",
            "is_staff",
            "is_superuser",
            "official_photo_url",
            "official_photo_verified",
            "license_number",
            "license_photo_url",
            "license_verified",
            "home_location_label",
            "home_lat",
            "home_lng",
            "is_corporate_employee",
            "office_location_label",
            "office_lat",
            "office_lng",
            "school_location_label",
            "school_lat",
            "school_lng",
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


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, min_length=6)
    new_password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        if attrs["new_password"] == attrs["current_password"]:
            raise serializers.ValidationError({"new_password": "Choose a different password."})
        return attrs

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class AdminUserListSerializer(serializers.ModelSerializer):
    official_photo_url = serializers.SerializerMethodField()
    license_photo_url = serializers.SerializerMethodField()

    def get_official_photo_url(self, obj):
        return _absolute_media_url(self, obj.official_photo)

    def get_license_photo_url(self, obj):
        return _absolute_media_url(self, obj.license_photo)

    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "phone",
            "phone_verified",
            "email",
            "address",
            "role",
            "is_active",
            "is_staff",
            "official_photo_url",
            "official_photo_verified",
            "license_number",
            "license_photo_url",
            "license_verified",
            "created_at",
        )


class AdminUserReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("official_photo_verified", "license_verified", "is_active")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("official_photo_verified") and not self.instance.official_photo:
            raise serializers.ValidationError({"official_photo_verified": "Upload an official photo before marking it verified."})
        if attrs.get("license_verified") and not self.instance.license_photo:
            raise serializers.ValidationError({"license_verified": "Upload a license photo before marking it verified."})
        return attrs


class AdminCreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=["DRIVER", "HELPER", "ADMIN"])
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    official_photo = serializers.ImageField(required=False, allow_null=True)
    official_photo_verified = serializers.BooleanField(required=False, default=False)
    license_number = serializers.CharField(max_length=120, required=False, allow_blank=True)
    license_photo = serializers.ImageField(required=False, allow_null=True)
    license_verified = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = User
        fields = (
            "full_name",
            "phone",
            "email",
            "password",
            "role",
            "address",
            "official_photo",
            "official_photo_verified",
            "license_number",
            "license_photo",
            "license_verified",
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
        role = attrs.get("role")
        address = (attrs.get("address") or "").strip()
        official_photo = attrs.get("official_photo")
        license_number = (attrs.get("license_number") or "").strip()
        license_photo = attrs.get("license_photo")

        if role in {"DRIVER", "HELPER"}:
            if not address:
                raise serializers.ValidationError({"address": "Address is required for staff accounts."})
            if not official_photo:
                raise serializers.ValidationError({"official_photo": "An official staff photo is required."})

        if role == "DRIVER":
            if not license_number:
                raise serializers.ValidationError({"license_number": "Driver license number is required."})
            if not license_photo:
                raise serializers.ValidationError({"license_photo": "Driver license photo is required."})
        else:
            attrs["license_number"] = ""
            attrs["license_photo"] = None
            attrs["license_verified"] = False

        attrs["address"] = address
        attrs["license_number"] = license_number
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(
            phone=validated_data["phone"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            email=validated_data.get("email"),
            role=validated_data["role"],
            address=validated_data.get("address", ""),
            official_photo=validated_data.get("official_photo"),
            official_photo_verified=validated_data.get("official_photo_verified", False),
            license_number=validated_data.get("license_number", ""),
            license_photo=validated_data.get("license_photo"),
            license_verified=validated_data.get("license_verified", False),
            phone_verified=True,
            is_active=True,
            is_staff=validated_data["role"] == User.Role.ADMIN,
        )


class AdminUpdateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6, required=False, allow_blank=False)
    role = serializers.ChoiceField(choices=["DRIVER", "HELPER", "ADMIN"], required=False)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    official_photo = serializers.ImageField(required=False, allow_null=True)
    license_number = serializers.CharField(max_length=120, required=False, allow_blank=True)
    license_photo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = (
            "full_name",
            "phone",
            "email",
            "password",
            "role",
            "address",
            "official_photo",
            "license_number",
            "license_photo",
        )

    def validate_phone(self, value):
        try:
            phone = normalize_nepal_phone(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0])

        if User.objects.filter(phone=phone).exclude(id=self.instance.id).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return phone

    def validate_email(self, value):
        if value in ("", None):
            return None

        if User.objects.filter(email=value).exclude(id=self.instance.id).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        next_role = attrs.get("role", self.instance.role)
        address = (attrs.get("address", self.instance.address) or "").strip()
        official_photo = attrs.get("official_photo", self.instance.official_photo)
        license_number = (attrs.get("license_number", self.instance.license_number) or "").strip()
        license_photo = attrs.get("license_photo", self.instance.license_photo)

        if next_role in {User.Role.DRIVER, User.Role.HELPER}:
            if not address:
                raise serializers.ValidationError({"address": "Address is required for staff accounts."})
            if not official_photo:
                raise serializers.ValidationError({"official_photo": "An official staff photo is required."})

        if next_role == User.Role.DRIVER:
            if not license_number:
                raise serializers.ValidationError({"license_number": "Driver license number is required."})
            if not license_photo:
                raise serializers.ValidationError({"license_photo": "Driver license photo is required."})

        attrs["address"] = address
        attrs["license_number"] = license_number
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        next_role = validated_data.get("role", instance.role)

        if next_role != User.Role.DRIVER:
            validated_data.setdefault("license_number", "")
            validated_data.setdefault("license_photo", None)
            instance.license_verified = False

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.is_staff = instance.role == User.Role.ADMIN
        if password:
            instance.set_password(password)

        update_fields = list(validated_data.keys()) + ["is_staff"]
        if next_role != User.Role.DRIVER:
            update_fields.append("license_verified")
        if password:
            update_fields.append("password")

        instance.save(update_fields=sorted(set(update_fields)) or None)
        return instance
