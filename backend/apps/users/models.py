"""
Users App - Models
Custom User model with role-based access control (Admin, Seller, Buyer)
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


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
    
