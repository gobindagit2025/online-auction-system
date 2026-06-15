"""
Products App - Serializers
"""

import re
from django.utils import timezone
from rest_framework import serializers

from .models import Product, ProductImage, PickupAddress


class ProductImageSerializer(serializers.ModelSerializer):
    """Serializer for a single product image."""

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'order']


class ProductCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating a product listing."""

    # Accepts multiple uploaded files under the key 'images'
    images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'description', 'image', 'category',
            'starting_price', 'auction_start_time', 'auction_end_time',
            'images'
        ]

    def validate(self, attrs):
        """Validate auction timing logic and image count."""
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

        # Validate image count only on create (new listings)
        if self.instance is None:
            images = self.initial_data.getlist('images') if hasattr(self.initial_data, 'getlist') else attrs.get('images', [])
            if not images or len(images) < 1:
                raise serializers.ValidationError(
                    {"images": "At least 1 product image is required."}
                )
            if len(images) > 4:
                raise serializers.ValidationError(
                    {"images": "A maximum of 4 product images is allowed."}
                )
        return attrs

    def create(self, validated_data):
        """Auto-assign seller, save legacy `image` field as first image, create ProductImage rows."""
        images = validated_data.pop('images', [])
        validated_data['seller'] = self.context['request'].user

        # Backward compatibility: keep legacy single `image` field populated
        # with the primary (first) image so old frontend/code paths still work.
        if images:
            validated_data['image'] = images[0]

        product = super().create(validated_data)

        for index, img in enumerate(images):
            ProductImage.objects.create(product=product, image=img, order=index)

        return product

    def update(self, instance, validated_data):
        """Update product; optionally replace gallery images if new ones are provided."""
        images = validated_data.pop('images', None)

        if images:
            if len(images) < 1:
                raise serializers.ValidationError({"images": "At least 1 product image is required."})
            if len(images) > 4:
                raise serializers.ValidationError({"images": "A maximum of 4 product images is allowed."})

            # Replace existing gallery images
            instance.images.all().delete()
            validated_data['image'] = images[0]
            for index, img in enumerate(images):
                ProductImage.objects.create(product=instance, image=img, order=index)

        return super().update(instance, validated_data)


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer for listing products with seller info."""

    seller_name = serializers.CharField(source='seller.username', read_only=True)
    is_auction_live = serializers.BooleanField(read_only=True)
    minimum_bid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    images_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'image', 'category', 'starting_price',
            'current_highest_bid', 'minimum_bid', 'auction_start_time',
            'auction_end_time', 'status', 'is_auction_live',
            'seller_name', 'created_at', 'images_count'
        ]

    def get_images_count(self, obj):
        """Total gallery images for this product (falls back to 1 if legacy image only)."""
        count = obj.images.count()
        if count == 0 and obj.image:
            return 1
        return count


class ProductAddImagesSerializer(serializers.Serializer):
    """Serializer for sellers adding more images to an existing product (up to max 4 total)."""

    images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=True
    )

    MAX_IMAGES = 4

    def validate_images(self, value):
        if not value:
            raise serializers.ValidationError("Please select at least 1 image to upload.")

        product = self.context['product']
        existing_count = product.images.count()
        if existing_count == 0 and product.image:
            existing_count = 1  # legacy single image counts as the first slot

        remaining = self.MAX_IMAGES - existing_count
        if remaining <= 0:
            raise serializers.ValidationError(
                f"This product already has the maximum of {self.MAX_IMAGES} images."
            )
        if len(value) > remaining:
            raise serializers.ValidationError(
                f"Only {remaining} more image(s) can be added (maximum {self.MAX_IMAGES} total)."
            )
        return value

    def save(self):
        product = self.context['product']
        images = self.validated_data['images']

        # If product currently relies only on the legacy `image` field,
        # migrate it into a ProductImage row first so ordering stays correct.
        if product.images.count() == 0 and product.image:
            ProductImage.objects.create(product=product, image=product.image, order=0)

        next_order = product.images.count()
        created = []
        for offset, img in enumerate(images):
            created.append(
                ProductImage.objects.create(product=product, image=img, order=next_order + offset)
            )

        # Keep legacy `image` field pointing at the primary (first) image
        first_image = product.images.order_by('order', 'id').first()
        if first_image and not product.image:
            product.image = first_image.image
            product.save(update_fields=['image'])

        return created


class ProductDetailSerializer(serializers.ModelSerializer):
    """Full detail serializer for a single product."""

    seller_name = serializers.CharField(source='seller.username', read_only=True)
    seller_id = serializers.IntegerField(source='seller.id', read_only=True)
    is_auction_live = serializers.BooleanField(read_only=True)
    minimum_bid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_bids = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = '__all__'

    def get_total_bids(self, obj):
        """Count total bids on this product."""
        return obj.bids.count()


# ─────────────────────────────────────────────────────────
# Seller Pickup Address (Feature: Seller Pickup Address Collection)
# ─────────────────────────────────────────────────────────

PHONE_REGEX = re.compile(r'^[0-9+\-\s()]{7,15}$')


class PickupAddressSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating the item-specific pickup address
    for a single auction listing. `product` is assigned by the view
    based on the URL, so it is not accepted from the request body.
    """

    class Meta:
        model = PickupAddress
        fields = [
            'id', 'full_name', 'phone_number', 'email',
            'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_full_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Full name is required.")
        return value.strip()

    def validate_phone_number(self, value):
        if not PHONE_REGEX.match(value.strip()):
            raise serializers.ValidationError("Enter a valid phone number.")
        return value.strip()

    def validate_address_line1(self, value):
        if not value.strip():
            raise serializers.ValidationError("Address Line 1 is required.")
        return value.strip()

    def validate_postal_code(self, value):
        if not value.strip():
            raise serializers.ValidationError("Postal code is required.")
        return value.strip()


class AdminPickupAddressSerializer(serializers.ModelSerializer):
    """
    Admin-facing serializer that surfaces pickup address details alongside
    the related auction listing and seller information
    (Feature: Admin Visibility - Seller Pickup Information).
    """

    listing_id = serializers.IntegerField(source='product.id', read_only=True)
    auction_title = serializers.CharField(source='product.title', read_only=True)
    seller_name = serializers.CharField(source='product.seller.username', read_only=True)
    pickup_address = serializers.SerializerMethodField()
    contact_info = serializers.SerializerMethodField()

    class Meta:
        model = PickupAddress
        fields = [
            'id', 'listing_id', 'auction_title', 'seller_name',
            'full_name', 'phone_number', 'email',
            'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country',
            'pickup_address', 'contact_info', 'created_at',
        ]

    def get_pickup_address(self, obj):
        parts = [
            obj.address_line1, obj.address_line2,
            obj.city, obj.state, obj.postal_code, obj.country,
        ]
        return ', '.join([p for p in parts if p])

    def get_contact_info(self, obj):
        return f"{obj.full_name} | {obj.phone_number} | {obj.email}"
