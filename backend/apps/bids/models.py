"""
Bids App - Models
Handles bid placements, bid history, and winner tracking
"""

from django.db import models
from apps.users.models import User
from apps.products.models import Product


class Bid(models.Model):
    """
    Represents a single bid placed by a Buyer on an active auction.
    Bid history is preserved - each new bid creates a new record.
    """

    # Who placed the bid
    bidder = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='bids',
        limit_choices_to={'role': 'BUYER'}
    )

    # Which product
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='bids'
    )

    # Bid amount
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Bid amount must be higher than current highest bid"
    )

    # Whether this is the current highest bid
    is_winning_bid = models.BooleanField(
        default=False,
        help_text="True if this is currently the highest bid"
    )

    # Timestamps
    placed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bids'
        ordering = ['-placed_at']
        verbose_name = 'Bid'
        verbose_name_plural = 'Bids'

    def __str__(self):
        return f"{self.bidder.username} bid ₹{self.amount} on {self.product.title}"
