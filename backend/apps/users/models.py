"""
Users App - Models
Custom User model with role-based access control (Admin, Seller, Buyer)
"""

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import random
import string


class User(AbstractUser):
    """
    Custom User model extending Django's AbstractUser.
    Supports three roles: Admin, Seller, Buyer.
    """

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        SELLER = 'SELLER', 'Seller'
        BUYER = 'BUYER', 'Buyer'

    # Role field
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.BUYER,
        help_text="User role: Admin, Seller, or Buyer"
    )

    # Profile fields
    phone = models.CharField(max_length=15, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    profile_image = models.ImageField(
        upload_to='profile_images/',
        blank=True,
        null=True
    )

    # Account status
    is_blocked = models.BooleanField(
        default=False,
        help_text="Admin can block a user from accessing the system"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN

    @property
    def is_seller(self):
        return self.role == self.Role.SELLER

    @property
    def is_buyer(self):
        return self.role == self.Role.BUYER


class PasswordResetOTP(models.Model):
    """
    Stores OTP tokens for password reset requests.
    Each OTP expires after 10 minutes and can only be used once.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_otps')
    otp = models.CharField(max_length=6)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'password_reset_otps'
        verbose_name = 'Password Reset OTP'
        verbose_name_plural = 'Password Reset OTPs'

    def save(self, *args, **kwargs):
        if not self.pk:
            # Set expiry to 10 minutes from now on first save
            self.expires_at = timezone.now() + timezone.timedelta(minutes=10)
        super().save(*args, **kwargs)

    def is_valid(self):
        """Check if OTP is still valid (not used, not expired)."""
        return not self.is_used and timezone.now() <= self.expires_at

    @staticmethod
    def generate_otp():
        """Generate a 6-digit numeric OTP."""
        return ''.join(random.choices(string.digits, k=6))

    def __str__(self):
        return f"OTP for {self.user.email} ({'used' if self.is_used else 'active'})"
