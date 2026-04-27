"""
Bids App - Serializers
"""

from django.utils import timezone
from rest_framework import serializers

from .models import Bid
from apps.products.models import Product


class BidCreateSerializer(serializers.ModelSerializer):
    """Serializer for placing a new bid."""

    class Meta:
        model = Bid
        fields = ['id', 'product', 'amount']

    def validate(self, attrs):
        product = attrs.get('product')
        amount = attrs.get('amount')
        now = timezone.now()
        bidder = self.context['request'].user

        # 1. Check auction is active
        if product.status != Product.Status.ACTIVE:
            raise serializers.ValidationError(
                "This auction is not currently active."
            )

        # 2. Check auction hasn't ended
        if now > product.auction_end_time:
            raise serializers.ValidationError(
                "This auction has ended. No more bids accepted."
            )

        # 3. Check auction has started
        if now < product.auction_start_time:
            raise serializers.ValidationError(
                "This auction has not started yet."
            )

        # 4. Seller cannot bid on their own product
        if product.seller == bidder:
            raise serializers.ValidationError(
                "Sellers cannot bid on their own products."
            )

        # 5. Bid must be higher than current highest (or starting price)
        min_bid = product.current_highest_bid or product.starting_price
        if amount <= min_bid:
            raise serializers.ValidationError(
                f"Bid amount must be greater than current highest bid: ₹{min_bid}"
            )

        return attrs

    def create(self, validated_data):
        """
        Create a new bid and:
        1. Mark all previous winning bids as non-winning
        2. Update product's current_highest_bid
        """
        product = validated_data['product']
        bidder = self.context['request'].user

        # Remove winning status from previous highest bid
        Bid.objects.filter(product=product, is_winning_bid=True).update(
            is_winning_bid=False
        )

        # Create new bid as current winner
        bid = Bid.objects.create(
            bidder=bidder,
            product=product,
            amount=validated_data['amount'],
            is_winning_bid=True
        )

        # Update product's current highest bid
        product.current_highest_bid = bid.amount
        product.save(update_fields=['current_highest_bid'])

        return bid


class BidListSerializer(serializers.ModelSerializer):
    """Serializer for listing bids."""

    bidder_name = serializers.CharField(source='bidder.username', read_only=True)
    product_title = serializers.CharField(source='product.title', read_only=True)
    product_image = serializers.ImageField(source='product.image', read_only=True)
    product_status = serializers.CharField(source='product.status', read_only=True)

    class Meta:
        model = Bid
        fields = [
            'id', 'bidder_name', 'product_title', 'product_image',
            'product_status', 'product', 'amount', 'is_winning_bid', 'placed_at'
        ]