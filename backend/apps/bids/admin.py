"""Bids App - Django Admin Registration"""
from django.contrib import admin
from .models import Bid


@admin.register(Bid)
class BidAdmin(admin.ModelAdmin):
    list_display = ['bidder', 'product', 'amount', 'is_winning_bid', 'placed_at']
    list_filter = ['is_winning_bid']
    search_fields = ['bidder__username', 'product__title']
    readonly_fields = ['placed_at']
