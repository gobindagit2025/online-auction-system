"""
Products App - Serializers
"""

from django.utils import timezone
from rest_framework import serializers

from .models import Product


class ProductCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating a product listing."""

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'description', 'image', 'category',
            'starting_price', 'auction_start_time', 'auction_end_time'
        ]

    def validate(self, attrs):
        """Validate auction timing logic."""
        start = attrs.get('auction_start_time')
        end = attrs.get('auction_end_time')
        now = timezone.now()

        if start and start < now:
            raise serializers.ValidationError(
                {"auction_start_time": "Auction start time cannot be in the past."}
            )
        if end and start and end <= start:
            raise serializers.ValidationError(
                {"auction_end_time": "Auction end time must be after start time."}
            )
        return attrs

    def create(self, validated_data):
        """Auto-assign seller from request context."""
        validated_data['seller'] = self.context['request'].user
        return super().create(validated_data)


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer for listing products with seller info."""

    seller_name = serializers.CharField(source='seller.username', read_only=True)
    is_auction_live = serializers.BooleanField(read_only=True)
    minimum_bid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'image', 'category', 'starting_price',
            'current_highest_bid', 'minimum_bid', 'auction_start_time',
            'auction_end_time', 'status', 'is_auction_live',
            'seller_name', 'created_at'
        ]


class ProductDetailSerializer(serializers.ModelSerializer):
    """Full detail serializer for a single product."""

    seller_name = serializers.CharField(source='seller.username', read_only=True)
    seller_id = serializers.IntegerField(source='seller.id', read_only=True)
    is_auction_live = serializers.BooleanField(read_only=True)
    minimum_bid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_bids = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'

    def get_total_bids(self, obj):
        """Count total bids on this product."""
        return obj.bids.count()
