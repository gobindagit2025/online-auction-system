"""
Products App - Models
Auction product/item management with image upload and time-based auction logic
"""

from django.db import models
from django.utils import timezone
from apps.users.models import User


class Product(models.Model):
    """
    Represents an auction listing created by a Seller.
    Tracks auction timing, pricing, and status.
    """

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'       # Auction not started yet
        ACTIVE = 'ACTIVE', 'Active'          # Auction is live
        CLOSED = 'CLOSED', 'Closed'          # Auction ended (sold / payment pending)
        CANCELLED = 'CANCELLED', 'Cancelled' # Cancelled by seller/admin
        UNSOLD = 'UNSOLD', 'Unsold'          # Closed, but every bidder's payment
                                              # window expired — no eligible
                                              # bidder remains (Winner Payment
                                              # Expiry / Bidder Shift Logic).
                                              # Same underlying CharField/column
                                              # as the statuses above — no DB
                                              # schema change, purely a new
                                              # Python-level enum value.

    # Seller who posted the product
    seller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='products',
        limit_choices_to={'role': 'SELLER'}
    )

    # Product details
    title = models.CharField(max_length=255)
    description = models.TextField()
    image = models.ImageField(
        upload_to='product_images/',
        blank=True,
        null=True
    )
    category = models.CharField(max_length=100, blank=True)

    # Pricing
    starting_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Minimum starting bid price"
    )
    current_highest_bid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Auto-updated when a bid is placed"
    )

    # Auction timing (timezone-aware)
    auction_start_time = models.DateTimeField()
    auction_end_time = models.DateTimeField()

    # Status
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        ordering = ['-created_at']
        verbose_name = 'Product'
        verbose_name_plural = 'Products'

    def __str__(self):
        return f"{self.title} - {self.status}"

    @property
    def is_auction_live(self):
        """Check if auction is currently active."""
        now = timezone.now()
        return (
            self.status == self.Status.ACTIVE and
            self.auction_start_time <= now <= self.auction_end_time
        )

    @property
    def minimum_bid(self):
        """Return the minimum next bid amount."""
        if self.current_highest_bid:
            return self.current_highest_bid + 1
        return self.starting_price

    def update_status(self):
        """
        Check and update product status based on current time.
        Called by signals or scheduled tasks.
        """
        now = timezone.now()
        if self.status == self.Status.PENDING and now >= self.auction_start_time:
            self.status = self.Status.ACTIVE
            self.save(update_fields=['status'])
        elif self.status == self.Status.ACTIVE and now > self.auction_end_time:
            self.status = self.Status.CLOSED
            self.save(update_fields=['status'])


class PickupAddress(models.Model):
    """
    Item-specific pickup address provided by the Seller for a single
    auction listing (Feature: Seller Pickup Address Collection).

    This is intentionally stored per-Product (not on the User profile) so
    that the listing's pickup details remain frozen even if the seller
    later edits their account/profile address. Each Product can have at
    most one PickupAddress (OneToOne).
    """

    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        related_name='pickup_address'
    )

    full_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=15)
    email = models.EmailField()
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pickup_addresses'
        verbose_name = 'Pickup Address'
        verbose_name_plural = 'Pickup Addresses'

    def __str__(self):
        return f"Pickup address for '{self.product.title}'"


class ProductImage(models.Model):
    """
    Additional images for a Product. The first image (lowest `order`)
    is treated as the primary thumbnail. Existing single `image` field
    on Product remains untouched for backward compatibility.
    """
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='images'
    )
    image = models.ImageField(upload_to='product_images/')
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_images'
        ordering = ['order', 'id']
        verbose_name = 'Product Image'
        verbose_name_plural = 'Product Images'

    def __str__(self):
        return f"Image {self.order} for {self.product.title}"
