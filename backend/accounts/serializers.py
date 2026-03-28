from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class PhoneTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD  # resolves to "phone"


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ("full_name", "phone", "email", "password")

    def create(self, validated_data):
        # Passengers self-register only
        return User.objects.create_user(
            phone=validated_data["phone"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            email=validated_data.get("email"),
            role=User.Role.PASSENGER,
            is_active=True,
        )


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "full_name", "phone", "email", "role", "is_staff", "is_superuser", "created_at")


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
        fields = ("id", "full_name", "phone", "email", "role", "is_active", "is_staff", "created_at")


class AdminCreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=["DRIVER", "HELPER", "ADMIN"])

    class Meta:
        model = User
        fields = ("full_name", "phone", "email", "password", "role")

    def create(self, validated_data):
        return User.objects.create_user(
            phone=validated_data["phone"],
            password=validated_data["password"],
            full_name=validated_data["full_name"],
            email=validated_data.get("email"),
            role=validated_data["role"],
            is_active=True,
        )
