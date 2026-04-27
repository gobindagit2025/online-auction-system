"""Users App - Django Admin Registration"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'role', 'is_blocked', 'is_active', 'created_at']
    list_filter = ['role', 'is_blocked', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    fieldsets = UserAdmin.fieldsets + (
        ('Auction System Fields', {
            'fields': ('role', 'phone', 'address', 'profile_image', 'is_blocked')
        }),
    )
