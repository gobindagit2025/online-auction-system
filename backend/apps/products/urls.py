"""Products App - URL Configuration"""

from django.urls import path
from .views import (
    ProductListView,
    ProductDetailView,
    SellerProductCreateView,
    SellerProductUpdateView,
    SellerProductListView,
    SellerProductAddImagesView,
    AdminProductListView,
    AdminProductStatusView,
    PickupAddressView,
    AdminPickupAddressListView,
)

urlpatterns = [
    # Public
    path('', ProductListView.as_view(), name='product-list'),

    # Seller — pickup address (registered before the generic '<int:pk>/'
    # detail route so the more specific path is matched first)
    path('<int:pk>/pickup-address/', PickupAddressView.as_view(), name='pickup-address'),

    path('<int:pk>/', ProductDetailView.as_view(), name='product-detail'),

    # Seller
    path('create/', SellerProductCreateView.as_view(), name='product-create'),
    path('<int:pk>/update/', SellerProductUpdateView.as_view(), name='product-update'),
    path('<int:pk>/add-images/', SellerProductAddImagesView.as_view(), name='product-add-images'),
    path('my-products/', SellerProductListView.as_view(), name='my-products'),

    # Admin
    path('admin/all/', AdminProductListView.as_view(), name='admin-product-list'),
    path('admin/<int:pk>/status/', AdminProductStatusView.as_view(), name='admin-product-status'),
    path('admin/pickup-addresses/', AdminPickupAddressListView.as_view(), name='admin-pickup-addresses'),
]
