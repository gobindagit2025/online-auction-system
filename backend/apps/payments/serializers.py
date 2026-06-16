"""
Payments App - Serializers
Full real payment system:
  - Seller pays 5% listing fee (QR / UPI / Card) when creating product
  - Winner pays winning bid within 24hrs, or shifts to 2nd highest bidder
  - Seller receives funds into BidZone Wallet
  - Seller can request withdrawal via UPI
"""

import re
import uuid
from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Payment, Wallet, WalletTransaction,
    ListingFeePayment, CompanyWallet, WithdrawalRequest,
    DeliveryAddress,
)
from apps.bids.models import Bid
from apps.products.models import Product


# ─────────────────────────────────────────────────────────
# Wallet serializers
# ─────────────────────────────────────────────────────────

class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ['id', 'transaction_type', 'amount', 'description', 'ref_id', 'created_at']


class WalletSerializer(serializers.ModelSerializer):
    transactions = WalletTransactionSerializer(many=True, read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Wallet
        fields = ['id', 'username', 'balance', 'transactions', 'created_at', 'updated_at']


# ─────────────────────────────────────────────────────────
# Listing Fee Payment serializers
# ─────────────────────────────────────────────────────────

class InitiateListingFeeSerializer(serializers.Serializer):
    product_id     = serializers.IntegerField()
    payment_method = serializers.ChoiceField(choices=ListingFeePayment.Method.choices)
    upi_id         = serializers.CharField(required=False, allow_blank=True)
    card_last4     = serializers.CharField(required=False, allow_blank=True, max_length=4)

    def validate_product_id(self, value):
        seller = self.context['request'].user
        try:
            product = Product.objects.get(pk=value, seller=seller)
        except Product.DoesNotExist:
            raise serializers.ValidationError("Product not found or not yours.")
        if hasattr(product, 'listing_fee') and product.listing_fee.status == ListingFeePayment.Status.PAID:
            raise serializers.ValidationError("Listing fee already paid for this product.")
        return value

    def validate(self, attrs):
        method = attrs.get('payment_method')
        upi_id = attrs.get('upi_id', '')
        if method == 'UPI' and not upi_id:
            raise serializers.ValidationError({"upi_id": "UPI ID is required for UPI payment."})
        return attrs

    def create(self, validated_data):
        seller  = self.context['request'].user
        product = Product.objects.get(pk=validated_data['product_id'])
        fee     = round(Decimal('0.05') * product.starting_price, 2)

        listing_fee, _ = ListingFeePayment.objects.get_or_create(
            product=product,
            defaults={'seller': seller, 'fee_amount': fee, 'status': ListingFeePayment.Status.PENDING}
        )
        listing_fee.payment_method = validated_data['payment_method']
        listing_fee.upi_id         = validated_data.get('upi_id', '')
        listing_fee.transaction_id = f"LF-{uuid.uuid4().hex[:12].upper()}"
        listing_fee.status         = ListingFeePayment.Status.PAID
        listing_fee.paid_at        = timezone.now()
        if validated_data['payment_method'] == 'QR_CODE':
            listing_fee.qr_ref = f"QR-{uuid.uuid4().hex[:16].upper()}"
        listing_fee.save()
        CompanyWallet.get().credit(fee)
        return listing_fee


class ListingFeeSerializer(serializers.ModelSerializer):
    product_title    = serializers.CharField(source='product.title', read_only=True)
    seller_name      = serializers.CharField(source='seller.username', read_only=True)
    refunded_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ListingFeePayment
        fields = [
            'id', 'seller_name', 'product_title', 'fee_amount',
            'status', 'payment_method', 'transaction_id',
            'upi_id', 'qr_ref', 'paid_at', 'refunded_at',
            'refund_amount', 'refunded_by_name', 'refund_reason', 'created_at'
        ]

    def get_refunded_by_name(self, obj):
        return obj.refunded_by.username if obj.refunded_by else None


# ─────────────────────────────────────────────────────────
# Winner Payment serializers
# ─────────────────────────────────────────────────────────

def _expire_and_shift(product, payment=None):
    """
    Mark current winning bid/payment as expired, shift win to next highest bidder.
    Creates a fresh PENDING Payment record for the next bidder with a new 24h countdown.
    If no bidders remain, marks product as unsold (status stays CLOSED, no new payment).
    """
    from django.db import transaction as db_transaction

    with db_transaction.atomic():
        # Expire current payment
        if payment:
            payment.status = Payment.Status.EXPIRED
            payment.save(update_fields=['status'])

        # Disqualify current winner bid
        current_winner_bid = Bid.objects.filter(product=product, is_winning_bid=True).first()
        if not current_winner_bid:
            return  # Nothing to shift

        disqualified_bidder = current_winner_bid.bidder
        current_winner_bid.is_winning_bid = False
        current_winner_bid.save(update_fields=['is_winning_bid'])

        # Find next highest bidder (exclude all bidders who already have an EXPIRED payment)
        expired_bidder_ids = Payment.objects.filter(
            product=product, status=Payment.Status.EXPIRED
        ).values_list('buyer_id', flat=True)

        next_bid = Bid.objects.filter(
            product=product,
            is_winning_bid=False,
        ).exclude(
            bidder_id__in=expired_bidder_ids
        ).exclude(
            bidder=disqualified_bidder
        ).order_by('-amount').first()

        if next_bid:
            # Promote next bidder to winner
            next_bid.is_winning_bid = True
            next_bid.save(update_fields=['is_winning_bid'])
            product.current_highest_bid = next_bid.amount
            product.save(update_fields=['current_highest_bid'])

            # Create a fresh 24-hour Payment record for next winner
            now = timezone.now()
            Payment.objects.create(
                buyer            = next_bid.bidder,
                product          = product,
                winning_bid      = next_bid,
                amount           = next_bid.amount,
                status           = Payment.Status.PENDING,
                transaction_id   = f"TXN-SHIFT-{uuid.uuid4().hex[:10].upper()}",
                countdown_start  = now,
                payment_deadline = now + timezone.timedelta(hours=24),
            )
        else:
            # No more valid bidders — auction is truly unsold
            # Leave product as CLOSED with no active winner
            product.current_highest_bid = None
            product.save(update_fields=['current_highest_bid'])


class InitiatePaymentSerializer(serializers.Serializer):
    product_id     = serializers.IntegerField()
    payment_method = serializers.ChoiceField(choices=Payment.Method.choices)
    upi_id         = serializers.CharField(required=False, allow_blank=True)
    card_last4     = serializers.CharField(required=False, allow_blank=True, max_length=4)

    def validate_product_id(self, value):
        try:
            product = Product.objects.get(pk=value)
        except Product.DoesNotExist:
            raise serializers.ValidationError("Product not found.")
        if product.status != Product.Status.CLOSED:
            raise serializers.ValidationError("Payment only available for closed auctions.")
        return value

    def validate(self, attrs):
        product_id = attrs['product_id']
        buyer      = self.context['request'].user
        method     = attrs.get('payment_method')
        upi_id     = attrs.get('upi_id', '')
        product    = Product.objects.get(pk=product_id)

        try:
            winning_bid = Bid.objects.get(product=product, is_winning_bid=True)
        except Bid.DoesNotExist:
            raise serializers.ValidationError("No active winning bid for this product.")

        if winning_bid.bidder != buyer:
            raise serializers.ValidationError("You are not the current winning bidder.")

        existing = Payment.objects.filter(product=product).exclude(status=Payment.Status.EXPIRED).first()
        if existing and existing.status == Payment.Status.COMPLETED:
            raise serializers.ValidationError("Payment already completed for this product.")

        deadline = product.auction_end_time + timezone.timedelta(hours=24)
        if timezone.now() > deadline:
            _expire_and_shift(product, existing)
            raise serializers.ValidationError(
                "24-hour payment window has passed. Auction shifted to next highest bidder."
            )

        if method == 'UPI' and not upi_id:
            raise serializers.ValidationError({"upi_id": "UPI ID is required for UPI payment."})

        attrs['product']     = product
        attrs['winning_bid'] = winning_bid
        attrs['deadline']    = deadline
        return attrs

    def create(self, validated_data):
        buyer       = self.context['request'].user
        product     = validated_data['product']
        winning_bid = validated_data['winning_bid']
        now         = timezone.now()

        # Re-use existing PENDING payment if already created (e.g. page refresh)
        existing = Payment.objects.filter(
            product=product, buyer=buyer, status=Payment.Status.PENDING
        ).first()
        if existing:
            # Update payment method details on re-initiation
            existing.payment_method = validated_data['payment_method']
            existing.upi_id         = validated_data.get('upi_id', '')
            existing.card_last4     = validated_data.get('card_last4', '')
            if validated_data['payment_method'] == 'QR_CODE' and not existing.qr_ref:
                existing.qr_ref = f"QR-{uuid.uuid4().hex[:16].upper()}"
            existing.save()
            return existing

        payment = Payment.objects.create(
            buyer            = buyer,
            product          = product,
            winning_bid      = winning_bid,
            amount           = winning_bid.amount,
            payment_method   = validated_data['payment_method'],
            upi_id           = validated_data.get('upi_id', ''),
            card_last4       = validated_data.get('card_last4', ''),
            status           = Payment.Status.PENDING,
            transaction_id   = f"TXN-{uuid.uuid4().hex[:12].upper()}",
            countdown_start  = product.auction_end_time,  # countdown begins at auction close
            payment_deadline = validated_data['deadline'],
        )
        if validated_data['payment_method'] == 'QR_CODE':
            payment.qr_ref = f"QR-{uuid.uuid4().hex[:16].upper()}"
            payment.save(update_fields=['qr_ref'])
        return payment


class CompletePaymentSerializer(serializers.Serializer):
    payment_id = serializers.IntegerField()

    def validate_payment_id(self, value):
        buyer = self.context['request'].user
        try:
            payment = Payment.objects.get(pk=value, buyer=buyer)
        except Payment.DoesNotExist:
            raise serializers.ValidationError("Payment not found.")
        if payment.status != Payment.Status.PENDING:
            raise serializers.ValidationError(f"Payment is already {payment.status}.")
        if payment.is_deadline_passed:
            payment.status = Payment.Status.EXPIRED
            payment.save(update_fields=['status'])
            _expire_and_shift(payment.product, payment)
            raise serializers.ValidationError("Payment deadline passed. Auction shifted to next bidder.")
        return value


class PaymentDetailSerializer(serializers.ModelSerializer):
    buyer_name         = serializers.CharField(source='buyer.username', read_only=True)
    product_title      = serializers.CharField(source='product.title', read_only=True)
    auction_end_time   = serializers.DateTimeField(source='product.auction_end_time', read_only=True)
    deadline_remaining = serializers.SerializerMethodField()
    deadline_seconds   = serializers.SerializerMethodField()

    class Meta:
        model  = Payment
        fields = [
            'id', 'buyer_name', 'product_title', 'amount',
            'status', 'payment_method', 'transaction_id',
            'upi_id', 'card_last4', 'qr_ref',
            'countdown_start', 'payment_deadline',
            'auction_end_time',
            'deadline_remaining', 'deadline_seconds',
            'created_at', 'paid_at',
            'buyer', 'product', 'winning_bid'
        ]

    def get_deadline_remaining(self, obj):
        if obj.payment_deadline and obj.status == Payment.Status.PENDING:
            remaining = obj.payment_deadline - timezone.now()
            total = int(remaining.total_seconds())
            if total > 0:
                hours, rem = divmod(total, 3600)
                minutes, secs = divmod(rem, 60)
                return f"{hours} Hours {minutes} Minutes {secs} Seconds Remaining"
            return "Deadline Passed"
        return None

    def get_deadline_seconds(self, obj):
        """Total seconds remaining — used by frontend countdown timer."""
        if obj.payment_deadline and obj.status == Payment.Status.PENDING:
            remaining = obj.payment_deadline - timezone.now()
            return max(0, int(remaining.total_seconds()))
        return None


# ─────────────────────────────────────────────────────────
# Withdrawal serializers
# ─────────────────────────────────────────────────────────

class WithdrawalRequestSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model  = WithdrawalRequest
        fields = [
            'id', 'username', 'amount', 'upi_id', 'status',
            'transaction_id', 'admin_note', 'created_at', 'processed_at'
        ]
        read_only_fields = ['status', 'transaction_id', 'admin_note', 'processed_at']

    def validate_amount(self, value):
        user   = self.context['request'].user
        wallet, _ = Wallet.objects.get_or_create(user=user)
        if value <= 0:
            raise serializers.ValidationError("Withdrawal amount must be positive.")
        if value > wallet.balance:
            raise serializers.ValidationError(
                f"Insufficient wallet balance. Available: Rs.{wallet.balance}"
            )
        return value

    def create(self, validated_data):
        user   = self.context['request'].user
        amount = validated_data['amount']
        wallet, _ = Wallet.objects.get_or_create(user=user)
        wallet.debit(amount,
                     description=f"Withdrawal request to {validated_data['upi_id']}",
                     ref_id=f"WD-HOLD-{uuid.uuid4().hex[:8].upper()}")
        return WithdrawalRequest.objects.create(user=user, **validated_data)


class AdminWithdrawalSerializer(serializers.ModelSerializer):
    class Meta:
        model  = WithdrawalRequest
        fields = ['status', 'admin_note']


# ─────────────────────────────────────────────────────────
# Buyer Delivery Address (Feature: Buyer Delivery Address Collection)
# ─────────────────────────────────────────────────────────

PHONE_REGEX = re.compile(r'^[0-9+\-\s()]{7,15}$')


class DeliveryAddressSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating the buyer's delivery address for a
    completed auction order. `payment` is assigned by the view based on
    the URL, so it is not accepted from the request body.
    """

    class Meta:
        model = DeliveryAddress
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


class AdminDeliveryAddressSerializer(serializers.ModelSerializer):
    """
    Admin-facing serializer that surfaces delivery address details
    alongside the related order/payment and winner information
    (Feature: Admin Visibility - Buyer Delivery Information).
    """

    order_id = serializers.IntegerField(source='payment.id', read_only=True)
    auction_title = serializers.CharField(source='payment.product.title', read_only=True)
    winner_name = serializers.CharField(source='payment.buyer.username', read_only=True)
    delivery_address = serializers.SerializerMethodField()
    contact_info = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryAddress
        fields = [
            'id', 'order_id', 'auction_title', 'winner_name',
            'full_name', 'phone_number', 'email',
            'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country',
            'delivery_address', 'contact_info', 'created_at',
        ]

    def get_delivery_address(self, obj):
        parts = [
            obj.address_line1, obj.address_line2,
            obj.city, obj.state, obj.postal_code, obj.country,
        ]
        return ', '.join([p for p in parts if p])

    def get_contact_info(self, obj):
        return f"{obj.full_name} | {obj.phone_number} | {obj.email}"
