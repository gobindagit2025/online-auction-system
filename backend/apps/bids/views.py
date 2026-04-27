"""
Bids App - Views
Handles bid placement, bid history, and winner management
"""

from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Bid
from .serializers import BidCreateSerializer, BidListSerializer
from apps.users.permissions import IsBuyerRole, IsAdminRole, IsNotBlocked
from apps.products.models import Product


class PlaceBidView(generics.CreateAPIView):
    """
    POST /api/bids/place/
    Buyer: Place a bid on an active auction product.
    """
    serializer_class = BidCreateSerializer
    permission_classes = [IsBuyerRole, IsNotBlocked]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        bid = serializer.save()
        return Response({
            'message': 'Bid placed successfully!',
            'bid': BidListSerializer(bid).data
        }, status=status.HTTP_201_CREATED)


class ProductBidHistoryView(generics.ListAPIView):
    """
    GET /api/bids/product/<product_id>/
    Get all bids for a specific product (publicly visible).
    """
    serializer_class = BidListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        product_id = self.kwargs['product_id']
        return Bid.objects.filter(product_id=product_id).order_by('-amount')


class MyBidsView(generics.ListAPIView):
    """
    GET /api/bids/my-bids/
    Buyer: View all their own bid history.
    """
    serializer_class = BidListSerializer
    permission_classes = [IsBuyerRole, IsNotBlocked]

    def get_queryset(self):
        return Bid.objects.filter(bidder=self.request.user)


class MyWinningBidsView(generics.ListAPIView):
    """
    GET /api/bids/my-winning-bids/
    Buyer: View auctions they have won (highest bidder on closed auctions).
    """
    serializer_class = BidListSerializer
    permission_classes = [IsBuyerRole, IsNotBlocked]

    def get_queryset(self):
        return Bid.objects.filter(
            bidder=self.request.user,
            is_winning_bid=True,
            product__status=Product.Status.CLOSED
        )


class AdminBidListView(generics.ListAPIView):
    """
    GET /api/bids/admin/all/
    Admin: View all bids across all products.
    """
    serializer_class = BidListSerializer
    permission_classes = [IsAdminRole]
    queryset = Bid.objects.all()
    filterset_fields = ['is_winning_bid', 'product']
    search_fields = ['bidder__username', 'product__title']
