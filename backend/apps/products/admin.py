"""Products App - Django Admin Registration"""
from django.contrib import admin
from .models import Product, ProductImage, PickupAddress


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['title', 'seller', 'starting_price', 'current_highest_bid', 'status', 'auction_end_time']
    list_filter = ['status', 'category']
    search_fields = ['title', 'seller__username']
    readonly_fields = ['current_highest_bid', 'created_at', 'updated_at']
    inlines = [ProductImageInline]


@admin.register(PickupAddress)
class PickupAddressAdmin(admin.ModelAdmin):
    list_display = ['product', 'full_name', 'phone_number', 'email', 'city', 'country', 'created_at']
    search_fields = ['product__title', 'full_name', 'email', 'phone_number']
    readonly_fields = ['created_at', 'updated_at']
