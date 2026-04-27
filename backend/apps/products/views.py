"""
Products App - Views
CRUD operations for auction product listings
"""

from django.utils import timezone
from rest_framework import generics, status, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from .models import Product
from .serializers import (
    ProductCreateSerializer,
    ProductListSerializer,
    ProductDetailSerializer,
)
from apps.users.permissions import IsSellerOrAdmin, IsAdminRole, IsNotBlocked


class ProductListView(generics.ListAPIView):
    """
    GET /api/products/
    List all active/available products for buyers to browse.
    """
    serializer_class = ProductListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category']
    search_fields = ['title', 'description', 'category']
    ordering_fields = ['starting_price', 'auction_end_time', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        """Auto-update product statuses before listing."""
        products = Product.objects.all()
        # Update status for each product based on current time
        now = timezone.now()
        products.filter(
            status=Product.Status.PENDING,
            auction_start_time__lte=now
        ).update(status=Product.Status.ACTIVE)
        products.filter(
            status=Product.Status.ACTIVE,
            auction_end_time__lt=now
        ).update(status=Product.Status.CLOSED)
        return Product.objects.all()


class ProductDetailView(generics.RetrieveAPIView):
    """
    GET /api/products/<id>/
    Get full details of a product including bid count.
    """
    serializer_class = ProductDetailSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Product.objects.all()


class SellerProductCreateView(generics.CreateAPIView):
    """
    POST /api/products/create/
    Seller: Create a new product/auction listing.
    """
    serializer_class = ProductCreateSerializer
    permission_classes = [IsSellerOrAdmin, IsNotBlocked]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response({
            'message': 'Product listed for auction successfully.',
            'product': ProductDetailSerializer(product).data
        }, status=status.HTTP_201_CREATED)


class SellerProductUpdateView(generics.UpdateAPIView):
    """
    PUT/PATCH /api/products/<id>/update/
    Seller: Update their own product (only if auction not started).
    """
    serializer_class = ProductCreateSerializer
    permission_classes = [IsSellerOrAdmin, IsNotBlocked]

    def get_queryset(self):
        # Sellers can only update their own products
        if self.request.user.role == 'ADMIN':
            return Product.objects.all()
        return Product.objects.filter(seller=self.request.user)

    def update(self, request, *args, **kwargs):
        product = self.get_object()
        # Cannot update if auction has started
        if product.status not in [Product.Status.PENDING]:
            return Response(
                {'error': 'Cannot update product once auction has started.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().update(request, *args, **kwargs)


class SellerProductListView(generics.ListAPIView):
    """
    GET /api/products/my-products/
    Seller: List all their own products.
    """
    serializer_class = ProductListSerializer
    permission_classes = [IsSellerOrAdmin, IsNotBlocked]

    def get_queryset(self):
        if self.request.user.role == 'ADMIN':
            return Product.objects.all()
        return Product.objects.filter(seller=self.request.user)


class AdminProductListView(generics.ListAPIView):
    """
    GET /api/products/admin/all/
    Admin: View all products with all statuses.
    """
    serializer_class = ProductDetailSerializer
    permission_classes = [IsAdminRole]
    queryset = Product.objects.all()
    filterset_fields = ['status', 'category']
    search_fields = ['title', 'seller__username']


class AdminProductStatusView(APIView):
    """
    PATCH /api/products/admin/<id>/status/
    Admin: Manually change product status (e.g., cancel).
    """
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        try:
            product = Product.objects.get(pk=pk)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        valid_statuses = [s[0] for s in Product.Status.choices]
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Invalid status. Choose from {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        product.status = new_status
        product.save()
        return Response({
            'message': f'Product status updated to {new_status}.',
            'product': ProductDetailSerializer(product).data
        })
