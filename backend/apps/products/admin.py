"""Products App - Django Admin Registration"""
from django.contrib import admin
from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['title', 'seller', 'starting_price', 'current_highest_bid', 'status', 'auction_end_time']
    list_filter = ['status', 'category']
    search_fields = ['title', 'seller__username']
    readonly_fields = ['current_highest_bid', 'created_at', 'updated_at']
