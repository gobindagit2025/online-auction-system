"""
Payments App - Models
Full payment system with:
  - BidZone Wallet per user
  - Platform listing fee (5% of starting price) paid by Seller on product creation
  - If unsold: 2.5% refunded to Seller wallet (2.5% retained by BidZone)
  - Winner pays winning bid amount within 24hrs or shifts to 2nd highest bidder
  - Payment via QR/UPI/Card (simulated but realistic flow)
  - Seller receives winning amount into BidZone Wallet → can withdraw via UPI
"""

import uuid
from django.db import models
from django.utils import timezone
from apps.users.models import User
from apps.products.models import Product
from apps.bids.models import Bid


# ─────────────────────────────────────────────────────────
# 1.  BidZone Wallet  (one per user)
# ─────────────────────────────────────────────────────────
class Wallet(models.Model):
    """Each user has exactly one BidZone Wallet."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='wallet'
    )
    balance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0.00,
        help_text="Current wallet balance in ₹"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallets'
        verbose_name = 'Wallet'

    def __str__(self):
        return f"{self.user.username} — ₹{self.balance}"

    def credit(self, amount, description='', ref_id=''):
        """Add amount to wallet and record transaction."""
        self.balance += amount
        self.save(update_fields=['balance', 'updated_at'])
        WalletTransaction.objects.create(
            wallet=self,
            transaction_type=WalletTransaction.Type.CREDIT,
            amount=amount,
            description=description,
            ref_id=ref_id or f"CR-{uuid.uuid4().hex[:10].upper()}"
        )

    def debit(self, amount, description='', ref_id=''):
        """Deduct amount from wallet and record transaction."""
        self.balance -= amount
        self.save(update_fields=['balance', 'updated_at'])
        WalletTransaction.objects.create(
            wallet=self,
            transaction_type=WalletTransaction.Type.DEBIT,
            amount=amount,
            description=description,
            ref_id=ref_id or f"DB-{uuid.uuid4().hex[:10].upper()}"
        )


# ─────────────────────────────────────────────────────────
# 2.  Wallet Transaction ledger
# ─────────────────────────────────────────────────────────
class WalletTransaction(models.Model):
    class Type(models.TextChoices):
        CREDIT = 'CREDIT', 'Credit'
        DEBIT  = 'DEBIT',  'Debit'

    wallet           = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=6, choices=Type.choices)
    amount           = models.DecimalField(max_digits=14, decimal_places=2)
    description      = models.CharField(max_length=255, blank=True)
    ref_id           = models.CharField(max_length=100, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wallet_transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.wallet.user.username} | {self.transaction_type} ₹{self.amount} | {self.description}"


# ─────────────────────────────────────────────────────────
# 3.  Platform / Company Wallet  (singleton)
# ─────────────────────────────────────────────────────────
class CompanyWallet(models.Model):
    """Single company wallet that collects platform fees."""

    balance    = models.DecimalField(max_digits=16, decimal_places=2, default=0.00)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'company_wallet'

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def credit(self, amount):
        self.balance += amount
        self.save(update_fields=['balance', 'updated_at'])


# ─────────────────────────────────────────────────────────
# 4.  Seller Listing Fee  (5% of starting_price)
# ─────────────────────────────────────────────────────────
class ListingFeePayment(models.Model):
    """
    Seller pays 5% of starting_price as listing fee when creating a product.
    If product is unsold (CLOSED with no buyer payment):
      - 2.5% refunded to Seller wallet
      - 2.5% retained by BidZone
    """

    class Status(models.TextChoices):
        PENDING   = 'PENDING',   'Pending'
        PAID      = 'PAID',      'Paid'
        REFUNDED  = 'REFUNDED',  'Partially Refunded'   # 2.5% back to seller

    class Method(models.TextChoices):
        UPI         = 'UPI',         'UPI'
        CREDIT_CARD = 'CREDIT_CARD', 'Credit Card'
        DEBIT_CARD  = 'DEBIT_CARD',  'Debit Card'
        NET_BANKING = 'NET_BANKING',  'Net Banking'
        QR_CODE     = 'QR_CODE',     'QR Code'

    seller         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='listing_fees')
    product        = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='listing_fee')
    fee_amount     = models.DecimalField(max_digits=12, decimal_places=2, help_text="5% of starting price")
    status         = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=15, choices=Method.choices, blank=True, null=True)
    transaction_id = models.CharField(max_length=100, unique=True, blank=True, null=True)
    upi_id         = models.CharField(max_length=100, blank=True, null=True, help_text="UPI ID used for payment")
    qr_ref         = models.CharField(max_length=200, blank=True, null=True, help_text="QR payment reference")
    paid_at        = models.DateTimeField(null=True, blank=True)
    refunded_at    = models.DateTimeField(null=True, blank=True)
    refund_amount  = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'listing_fee_payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"ListingFee {self.seller.username} | {self.product.title} | ₹{self.fee_amount} | {self.status}"


# ─────────────────────────────────────────────────────────
# 5.  Main Payment  (winner pays winning bid amount)
# ─────────────────────────────────────────────────────────
class Payment(models.Model):
    """
    Winner pays winning bid amount within 24 hrs.
    If not paid in 24 hrs → shifts to 2nd highest bidder.
    On success → amount credited to Seller BidZone Wallet.
    """

    class Status(models.TextChoices):
        PENDING   = 'PENDING',   'Pending'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED    = 'FAILED',    'Failed'
        REFUNDED  = 'REFUNDED',  'Refunded'
        EXPIRED   = 'EXPIRED',   'Expired (24h deadline missed)'

    class Method(models.TextChoices):
        CREDIT_CARD = 'CREDIT_CARD', 'Credit Card'
        DEBIT_CARD  = 'DEBIT_CARD',  'Debit Card'
        NET_BANKING = 'NET_BANKING', 'Net Banking'
        UPI         = 'UPI',         'UPI'
        QR_CODE     = 'QR_CODE',     'QR Code'
        WALLET      = 'WALLET',      'BidZone Wallet'

    buyer          = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    product        = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='payment')
    winning_bid    = models.OneToOneField(Bid, on_delete=models.CASCADE, related_name='payment')
    amount         = models.DecimalField(max_digits=12, decimal_places=2)
    status         = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=15, choices=Method.choices, blank=True, null=True)
    transaction_id = models.CharField(max_length=100, unique=True, blank=True, null=True)

    # UPI / Card / QR details (simulated realistic fields)
    upi_id         = models.CharField(max_length=100, blank=True, null=True)
    card_last4     = models.CharField(max_length=4, blank=True, null=True)
    qr_ref         = models.CharField(max_length=200, blank=True, null=True)

    # 24-hour deadline
    payment_deadline = models.DateTimeField(null=True, blank=True, help_text="Winner must pay before this time")

    created_at     = models.DateTimeField(auto_now_add=True)
    paid_at        = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'payments'
        ordering = ['-created_at']
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'

    def __str__(self):
        return f"Payment by {self.buyer.username} for {self.product.title} - {self.status}"

    @property
    def is_deadline_passed(self):
        if self.payment_deadline:
            return timezone.now() > self.payment_deadline
        return False


# ─────────────────────────────────────────────────────────
# 6.  Withdrawal Request  (Seller → Bank via UPI)
# ─────────────────────────────────────────────────────────
class WithdrawalRequest(models.Model):
    """Seller withdraws wallet balance to their bank via UPI."""

    class Status(models.TextChoices):
        PENDING   = 'PENDING',   'Pending'
        APPROVED  = 'APPROVED',  'Approved'
        REJECTED  = 'REJECTED',  'Rejected'

    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='withdrawals')
    amount         = models.DecimalField(max_digits=12, decimal_places=2)
    upi_id         = models.CharField(max_length=100, help_text="Seller UPI ID for bank transfer")
    status         = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    admin_note     = models.TextField(blank=True, null=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    processed_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'withdrawal_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"Withdrawal {self.user.username} ₹{self.amount} → {self.upi_id} [{self.status}]"
