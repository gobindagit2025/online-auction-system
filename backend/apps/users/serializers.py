"""
Users App - Serializers
Handles serialization/deserialization of User data
"""

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for user registration with password confirmation."""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'password', 'password2', 'role', 'phone', 'address'
        ]
        extra_kwargs = {
            'email': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate(self, attrs):
        """Ensure both passwords match."""
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError(
                {"password": "Password fields didn't match."}
            )
        return attrs

    def validate_role(self, value):
        """Prevent self-assignment of Admin role during registration."""
        if value == User.Role.ADMIN:
            raise serializers.ValidationError(
                "Cannot register as Admin. Contact system administrator."
            )
        return value

    def create(self, validated_data):
        """Create user with hashed password."""
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for viewing and updating user profiles."""

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'address', 'profile_image',
            'is_blocked', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'username', 'role', 'is_blocked', 'created_at', 'updated_at']


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users (Admin use)."""

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'is_blocked', 'is_active', 'created_at'
        ]


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing user password."""

    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])

    def validate_old_password(self, value):
        """Check old password is correct."""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer that adds user info to response."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims to token payload
        token['username'] = user.username
        token['role'] = user.role
        token['email'] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Check if user is blocked
        if self.user.is_blocked:
            raise serializers.ValidationError(
                "Your account has been blocked. Contact administrator."
            )
        # Add user data to response
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'role': self.user.role,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
        }
        return data


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for Admin to update user details."""

    class Meta:
        model = User
        fields = ['is_blocked', 'is_active', 'role']
