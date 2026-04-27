"""Bids App - URL Configuration"""

from django.urls import path
from .views import (
    PlaceBidView,
    ProductBidHistoryView,
    MyBidsView,
    MyWinningBidsView,
    AdminBidListView,
)

urlpatterns = [
    # Buyer
    path('place/', PlaceBidView.as_view(), name='place-bid'),
    path('my-bids/', MyBidsView.as_view(), name='my-bids'),
    path('my-winning-bids/', MyWinningBidsView.as_view(), name='my-winning-bids'),

    # Public
    path('product/<int:product_id>/', ProductBidHistoryView.as_view(), name='product-bid-history'),

    # Admin
    path('admin/all/', AdminBidListView.as_view(), name='admin-bid-list'),
]
