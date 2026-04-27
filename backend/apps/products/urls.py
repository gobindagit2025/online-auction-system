"""Products App - URL Configuration"""

from django.urls import path
from .views import (
    ProductListView,
    ProductDetailView,
    SellerProductCreateView,
    SellerProductUpdateView,
    SellerProductListView,
    AdminProductListView,
    AdminProductStatusView,
)

urlpatterns = [
    # Public
    path('', ProductListView.as_view(), name='product-list'),
    path('<int:pk>/', ProductDetailView.as_view(), name='product-detail'),

    # Seller
    path('create/', SellerProductCreateView.as_view(), name='product-create'),
    path('<int:pk>/update/', SellerProductUpdateView.as_view(), name='product-update'),
    path('my-products/', SellerProductListView.as_view(), name='my-products'),

    # Admin
    path('admin/all/', AdminProductListView.as_view(), name='admin-product-list'),
    path('admin/<int:pk>/status/', AdminProductStatusView.as_view(), name='admin-product-status'),
]
