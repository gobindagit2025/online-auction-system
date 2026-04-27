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
        CLOSED = 'CLOSED', 'Closed'          # Auction ended
        CANCELLED = 'CANCELLED', 'Cancelled' # Cancelled by seller/admin

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
