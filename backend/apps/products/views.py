"""
Products App - Views
CRUD operations for auction product listings
"""

from django.utils import timezone
from rest_framework import generics, status, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend

from .models import Product, PickupAddress
from .serializers import (
    ProductCreateSerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    ProductAddImagesSerializer,
    PickupAddressSerializer,
    AdminPickupAddressSerializer,
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


class SellerProductAddImagesView(APIView):
    """
    POST /api/products/<id>/add-images/
    Seller: Upload additional images for their own product
    (up to a combined maximum of 4 images total).
    """
    permission_classes = [IsSellerOrAdmin, IsNotBlocked]

    def post(self, request, pk):
        if request.user.role == 'ADMIN':
            product = Product.objects.filter(pk=pk).first()
        else:
            product = Product.objects.filter(pk=pk, seller=request.user).first()

        if not product:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ProductAddImagesSerializer(
            data=request.data,
            context={'product': product, 'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            'message': 'Images added successfully.',
            'product': ProductDetailSerializer(product).data
        }, status=status.HTTP_201_CREATED)


# ─────────────────────────────────────────────────────────
# Seller Pickup Address (Feature: Seller Pickup Address Collection)
# ─────────────────────────────────────────────────────────

class PickupAddressView(APIView):
    """
    GET  /api/products/<id>/pickup-address/
        Seller (or Admin): retrieve the pickup address saved for this listing.
    POST /api/products/<id>/pickup-address/
        Seller: save/update the pickup address for their own listing,
        immediately after successful listing-fee payment.
    """
    permission_classes = [IsSellerOrAdmin, IsNotBlocked]

    def _get_product(self, pk, user):
        if user.role == 'ADMIN':
            return Product.objects.filter(pk=pk).first()
        return Product.objects.filter(pk=pk, seller=user).first()

    def get(self, request, pk):
        product = self._get_product(pk, request.user)
        if not product:
            return Response({'error': 'Product not found or not yours.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            pickup_address = product.pickup_address
        except PickupAddress.DoesNotExist:
            return Response({'error': 'No pickup address saved for this listing yet.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PickupAddressSerializer(pickup_address).data)

    def post(self, request, pk):
        product = self._get_product(pk, request.user)
        if not product:
            return Response({'error': 'Product not found or not yours.'}, status=status.HTTP_404_NOT_FOUND)

        # Pickup address is collected immediately after the listing-fee
        # payment, so require that the listing fee has been paid first.
        listing_fee = getattr(product, 'listing_fee', None)
        if listing_fee is None or listing_fee.status not in ['PAID', 'REFUNDED']:
            return Response(
                {'error': 'Listing fee must be paid before adding a pickup address.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = PickupAddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # One pickup address per listing — create on first save,
        # update in place if the seller revisits this page.
        pickup_address, created = PickupAddress.objects.update_or_create(
            product=product,
            defaults=serializer.validated_data
        )

        return Response({
            'message': 'Pickup address saved successfully.',
            'pickup_address': PickupAddressSerializer(pickup_address).data,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AdminPickupAddressListView(generics.ListAPIView):
    """
    GET /api/products/admin/pickup-addresses/
    Admin: view all seller pickup addresses across all listings
    (Feature: Admin Visibility - Seller Pickup Information).
    """
    serializer_class = AdminPickupAddressSerializer
    permission_classes = [IsAdminRole]
    queryset = PickupAddress.objects.select_related('product', 'product__seller').all()
