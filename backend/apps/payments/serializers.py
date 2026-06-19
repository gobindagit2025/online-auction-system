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
import logging
from decimal import Decimal
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Payment, Wallet, WalletTransaction,
    ListingFeePayment, CompanyWallet, WithdrawalRequest,
    DeliveryAddress,
)
from apps.bids.models import Bid
from apps.products.models import Product
from apps.users.models import User

logger = logging.getLogger(__name__)


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

def sweep_closed_auctions_and_start_countdowns():
    """
    Find any ACTIVE auctions whose end time has passed, flip them to
    CLOSED, and immediately start the winner's 24h payment countdown for
    each one via ensure_payment_countdown(). Then process any winner
    payment deadlines that have already expired (see
    process_expired_winner_payments()) so the auto-shift-to-next-bidder
    logic runs on every request that touches this lazy sweep — not just
    when a buyer/admin happens to open the specific expired product.

    This mirrors the existing lazy status-update pattern already used by
    ProductListView.get_queryset() (Product.update_status / bulk update),
    so calling it from a payments view does not introduce a new auction
    "closing" mechanism — it only ensures the countdown is started (and now
    also auto-expired/shifted) as soon as any request touches the
    relevant endpoints, regardless of which page the buyer/admin/seller
    happens to load first.
    """
    now = timezone.now()
    newly_closing_ids = list(
        Product.objects.filter(
            status=Product.Status.ACTIVE,
            auction_end_time__lt=now
        ).values_list('id', flat=True)
    )
    if newly_closing_ids:
        Product.objects.filter(id__in=newly_closing_ids).update(status=Product.Status.CLOSED)
        for closed_product in Product.objects.filter(id__in=newly_closing_ids):
            ensure_payment_countdown(closed_product)

    # Also cover auctions that were already CLOSED earlier (e.g. by
    # ProductListView) but never got a countdown started for some reason —
    # restricted to products with no Payment row yet, so this stays cheap.
    for closed_product in Product.objects.filter(status=Product.Status.CLOSED, payment__isnull=True):
        ensure_payment_countdown(closed_product)

    # Winner Payment Expiry / Bidder Shift Logic fix: actually run the
    # auto-expire-and-shift sweep here too, so it happens automatically on
    # every request that hits any of these common endpoints (product
    # list, buyer "my payments", payment detail, admin payment list) —
    # not only when someone happens to open the exact expired product's
    # payment page. See process_expired_winner_payments() for the
    # cron/management-command-friendly version of the same sweep.
    process_expired_winner_payments()


def ensure_payment_countdown(product):
    """
    Ensure a PENDING Payment row (with countdown_start / payment_deadline)
    exists for a CLOSED product's current winning bidder.

    This is the single source of truth for *starting* the 24-hour winner
    payment countdown. It is intentionally idempotent and safe to call from
    multiple places (auction-close detection, payment initiation, dashboard
    refreshes) without ever creating duplicate countdowns:
      - Does nothing if the product isn't CLOSED yet (no countdown before close).
      - Does nothing if there's no winning bid (unsold auction).
      - Does nothing if a Payment already exists for the current winning bid
        (covers PENDING/COMPLETED/EXPIRED — never creates a second countdown
        for the same winner).
    Returns the Payment row (existing or newly created), or None.
    """
    if product.status != Product.Status.CLOSED:
        return None  # Countdown must never start before the auction actually closes

    winning_bid = Bid.objects.filter(product=product, is_winning_bid=True).first()
    if not winning_bid:
        return None  # No bids / no winner — nothing to count down for

    # Already has a countdown/payment for this exact winning bid — don't duplicate it
    existing = Payment.objects.filter(winning_bid=winning_bid).first()
    if existing:
        return existing

    # Also guard against a stray non-expired Payment for this product/buyer pair
    # (e.g. created via a different path) before creating a fresh one.
    existing_for_product = Payment.objects.filter(
        product=product, buyer=winning_bid.bidder
    ).exclude(status=Payment.Status.EXPIRED).first()
    if existing_for_product:
        return existing_for_product

    countdown_start = product.auction_end_time  # countdown begins exactly at auction close, not "now"
    payment_deadline = countdown_start + timezone.timedelta(hours=24)

    return Payment.objects.create(
        buyer            = winning_bid.bidder,
        product          = product,
        winning_bid      = winning_bid,
        amount           = winning_bid.amount,
        status           = Payment.Status.PENDING,
        transaction_id   = f"TXN-AUTO-{uuid.uuid4().hex[:10].upper()}",
        countdown_start  = countdown_start,
        payment_deadline = payment_deadline,
    )


def _admin_emails():
    return list(
        User.objects.filter(role=User.Role.ADMIN)
        .exclude(email='')
        .values_list('email', flat=True)
    )


def _safe_send_mail(subject, message, recipient_list):
    """Never let a notification failure break the winner-shift transaction."""
    recipient_list = [r for r in recipient_list if r]
    if not recipient_list:
        return
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            fail_silently=True,
        )
    except Exception:
        logger.exception("Winner-shift notification email failed to send.")


def _notify_winner_shift(product, disqualified_user, new_payment):
    """
    Notify: New winner, Seller, Admin — after the win has shifted to the
    next highest bidder. Scheduled to fire only after the DB transaction
    actually commits, so nobody is notified about a shift that gets
    rolled back.
    """
    from django.db import transaction as db_transaction

    new_winner = new_payment.buyer
    seller = product.seller

    def _send():
        _safe_send_mail(
            subject=f"BidZone – You're now the winning bidder for '{product.title}'",
            message=(
                f"Hello {new_winner.first_name or new_winner.username},\n\n"
                f"The previous winning bidder for '{product.title}' missed their "
                f"24-hour payment deadline and has been disqualified.\n\n"
                f"You are now the winning bidder at ₹{new_payment.amount}.\n"
                f"Please complete payment before "
                f"{new_payment.payment_deadline.strftime('%d %b %Y, %I:%M %p')} "
                f"or the win will shift to the next highest bidder.\n\n"
                f"– BidZone Team"
            ),
            recipient_list=[new_winner.email],
        )
        _safe_send_mail(
            subject=f"BidZone – Winning bidder changed for '{product.title}'",
            message=(
                f"Hello {seller.first_name or seller.username},\n\n"
                f"The previous winning bidder for '{product.title}' "
                f"({disqualified_user.username if disqualified_user else 'previous winner'}) missed the "
                f"24-hour payment deadline and was disqualified.\n\n"
                f"The win has shifted to {new_winner.username} for ₹{new_payment.amount}. "
                f"A new 24-hour payment countdown has started for them.\n\n"
                f"– BidZone Team"
            ),
            recipient_list=[seller.email],
        )
        _safe_send_mail(
            subject=f"BidZone Admin – Winner shifted for '{product.title}'",
            message=(
                f"Auction: {product.title} (ID {product.id})\n"
                f"Previous winner disqualified: {disqualified_user.username if disqualified_user else 'N/A'} "
                f"(payment expired)\n"
                f"New winner: {new_winner.username} — ₹{new_payment.amount}\n"
                f"Shift time: {timezone.now().strftime('%d %b %Y, %I:%M %p')}\n"
                f"New payment deadline: {new_payment.payment_deadline.strftime('%d %b %Y, %I:%M %p')}\n"
            ),
            recipient_list=_admin_emails(),
        )

    db_transaction.on_commit(_send)


def _notify_unsold(product, last_disqualified_user):
    """Notify: Seller (and Admin) — every eligible bidder has expired, auction is UNSOLD."""
    from django.db import transaction as db_transaction

    seller = product.seller

    def _send():
        _safe_send_mail(
            subject=f"BidZone – '{product.title}' could not be sold",
            message=(
                f"Hello {seller.first_name or seller.username},\n\n"
                f"Every bidder on '{product.title}' missed their 24-hour payment "
                f"deadline, so the auction has been marked UNSOLD and all "
                f"countdowns have been stopped.\n\n"
                f"– BidZone Team"
            ),
            recipient_list=[seller.email],
        )
        _safe_send_mail(
            subject=f"BidZone Admin – '{product.title}' marked UNSOLD",
            message=(
                f"Auction: {product.title} (ID {product.id})\n"
                f"Last disqualified bidder: "
                f"{last_disqualified_user.username if last_disqualified_user else 'N/A'}\n"
                f"No eligible bidders remain — auction marked UNSOLD at "
                f"{timezone.now().strftime('%d %b %Y, %I:%M %p')}.\n"
            ),
            recipient_list=_admin_emails(),
        )

    db_transaction.on_commit(_send)


def _expire_and_shift(product):
    """
    Core Winner Payment Expiry / Bidder Shift Logic.

    Whatever the *current* PENDING winner payment for `product` is (re-resolved
    fresh from the DB under a row lock — any payment object a caller already
    holds is ignored on purpose, since it may be stale), if its 24-hour
    deadline has passed:
      1. Mark it EXPIRED ("Payment Expired / Disqualified / Not Eligible").
      2. Drop that bidder's bid from is_winning_bid.
      3. Pick the next highest bidder, excluding the bidder just disqualified
         and every bidder who has ever expired a payment on this product
         (so a bidder can never be restarted or win twice).
      4. Promote them and open a brand-new 24-hour countdown
         (current_winner / payment_deadline / countdown_start / payment_status
         all updated together on the new Payment row).
      5. Notify the new winner, the seller, and admins.
    If no eligible bidder remains, the product is marked UNSOLD, the seller
    is notified, and no new countdown is created (all countdowns stop).

    Race-condition safety: the Product row is locked with select_for_update()
    for the whole operation, so two concurrent calls for the same product
    (e.g. the cron sweep firing at the same moment a buyer's page polls
    check-deadline/winner-countdown) can never both process the same
    expiry — the second call simply finds the payment already shifted (no
    longer PENDING, or deadline no longer "passed") and is a safe no-op.
    Never creates a duplicate winner; never skips a higher bidder, since the
    next bidder is always chosen by ordering every still-eligible bid by
    amount, highest first.

    Returns the newly-created Payment for the promoted bidder, or None if
    nothing was shifted (already handled / nothing pending / no eligible
    bidder left).
    """
    from django.db import transaction as db_transaction

    with db_transaction.atomic():
        # Lock the product row so only one process can ever shift the
        # winner for this auction at the same time.
        locked_product = Product.objects.select_for_update().get(pk=product.pk)

        # Always re-resolve the *current* pending payment under the lock —
        # never trust a Payment object a caller fetched before the lock,
        # since a concurrent request may have already expired/shifted it.
        current_payment = (
            Payment.objects
            .select_for_update()
            .filter(product=locked_product, status=Payment.Status.PENDING)
            .order_by('-created_at')
            .first()
        )

        if current_payment is None:
            return None  # Already shifted/paid by someone else, or no winner yet

        if not current_payment.is_deadline_passed:
            return None  # Deadline genuinely hasn't passed — nothing to do yet

        # ── 1. Mark current winner: Payment Expired / Disqualified / Not Eligible ──
        disqualified_user = current_payment.buyer
        current_payment.status = Payment.Status.EXPIRED
        current_payment.save(update_fields=['status'])

        current_winner_bid = Bid.objects.select_for_update().filter(
            product=locked_product, is_winning_bid=True
        ).first()
        if current_winner_bid:
            current_winner_bid.is_winning_bid = False
            current_winner_bid.save(update_fields=['is_winning_bid'])

        # ── 2. Find next highest valid bidder ──
        # Exclude the bidder just disqualified *and* every bidder who has
        # ever expired a payment on this product — never restart a
        # countdown for an already-expired bidder, and never let them win
        # a second time via a later, lower bid.
        excluded_bidder_ids = set(
            Payment.objects.filter(
                product=locked_product, status=Payment.Status.EXPIRED
            ).values_list('buyer_id', flat=True)
        )
        excluded_bidder_ids.add(disqualified_user.id)

        next_bid = (
            Bid.objects.filter(product=locked_product)
            .exclude(bidder_id__in=excluded_bidder_ids)
            .order_by('-amount', 'placed_at')
            .first()
        )

        if next_bid:
            # ── 3. Transfer winning status to the next highest bidder ──
            next_bid.is_winning_bid = True
            next_bid.save(update_fields=['is_winning_bid'])

            locked_product.current_highest_bid = next_bid.amount
            locked_product.save(update_fields=['current_highest_bid'])

            # ── 4. New 24-hour countdown for the new winner ──
            now = timezone.now()
            new_payment = Payment.objects.create(
                buyer            = next_bid.bidder,
                product          = locked_product,
                winning_bid      = next_bid,
                amount           = next_bid.amount,
                status           = Payment.Status.PENDING,
                transaction_id   = f"TXN-SHIFT-{uuid.uuid4().hex[:10].upper()}",
                countdown_start  = now,
                payment_deadline = now + timezone.timedelta(hours=24),
            )

            # ── 5. Notify new winner, seller, admin ──
            _notify_winner_shift(locked_product, disqualified_user, new_payment)
            return new_payment
        else:
            # No eligible bidders remain — auction is genuinely UNSOLD.
            # Stop all countdowns (no new Payment row is created).
            locked_product.current_highest_bid = None
            locked_product.status = Product.Status.UNSOLD
            locked_product.save(update_fields=['current_highest_bid', 'status'])
            _notify_unsold(locked_product, disqualified_user)
            return None


def process_expired_winner_payments():
    """
    Background-processing entry point for the Winner Payment Expiry /
    Bidder Shift Logic. Sweeps EVERY product with a PENDING winner payment
    whose deadline has passed and shifts to the next eligible bidder,
    cascading through as many levels as needed in one pass (2nd bidder
    fails -> 3rd, 3rd fails -> 4th, …) until a still-active countdown is
    found or no eligible bidders remain (UNSOLD).

    This is intentionally a plain, idempotent, DB-driven function (no
    in-memory state) so it behaves correctly:
      - Called from sweep_closed_auctions_and_start_countdowns(), which
        already runs on nearly every common request (product list, buyer
        "my payments", payment detail, admin payment list) — so the shift
        happens automatically without requiring the affected buyer/seller
        to take any action.
      - Called from the `process_payment_expiry` management command (see
        apps/payments/management/commands/process_payment_expiry.py),
        which can be wired into an OS cron job / Celery beat schedule for
        true background processing.
      - Safe to run again immediately after a server restart: it only
        ever reads/writes the database, never relies on anything held in
        memory, so a multi-day outage is simply caught up in one pass the
        next time it runs (each cascade level is processed in the same
        sweep since the "while" loop below keeps shifting while the new
        current payment is *also* already past its deadline).
    """
    expired_product_ids = list(
        Payment.objects.filter(
            status=Payment.Status.PENDING,
            payment_deadline__lt=timezone.now(),
        ).values_list('product_id', flat=True).distinct()
    )

    shifted_count = 0
    unsold_count = 0

    for product_id in expired_product_ids:
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            continue

        # Cascade through multiple levels in one pass, in case several
        # 24h windows have already elapsed back-to-back (e.g. the server
        # was down for a while). Capped only as a sanity safety net.
        for _ in range(100):
            result = _expire_and_shift(product)
            if result is None:
                break
            shifted_count += 1
            if not result.is_deadline_passed:
                break

        if Product.objects.filter(pk=product_id, status=Product.Status.UNSOLD).exists():
            unsold_count += 1

    return {'shifted': shifted_count, 'unsold': unsold_count}


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

        # Always trust the real Payment row's own countdown/deadline if one
        # already exists — it may have been (re)started at shift time by
        # _expire_and_shift, which is later than auction_end_time once a
        # winner shift has happened. Only fall back to computing a fresh
        # auction_end_time + 24h deadline when no countdown exists yet.
        if existing and existing.payment_deadline:
            countdown_start = existing.countdown_start or product.auction_end_time
            deadline = existing.payment_deadline
        else:
            countdown_start = product.auction_end_time
            deadline = countdown_start + timezone.timedelta(hours=24)

        if timezone.now() > deadline:
            _expire_and_shift(product)
            raise serializers.ValidationError(
                "24-hour payment window has passed. Auction shifted to next highest bidder."
            )

        if method == 'UPI' and not upi_id:
            raise serializers.ValidationError({"upi_id": "UPI ID is required for UPI payment."})

        attrs['product']         = product
        attrs['winning_bid']     = winning_bid
        attrs['deadline']        = deadline
        attrs['countdown_start'] = countdown_start
        return attrs

    def create(self, validated_data):
        buyer       = self.context['request'].user
        product     = validated_data['product']
        winning_bid = validated_data['winning_bid']

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
            countdown_start  = validated_data['countdown_start'],
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
            # Delegate the EXPIRED transition + bidder shift entirely to
            # _expire_and_shift (single source of truth, run under a DB
            # lock) instead of mutating status here and risking a second,
            # inconsistent expiry path.
            _expire_and_shift(payment.product)
            raise serializers.ValidationError("Payment deadline passed. Auction shifted to next bidder.")
        return value


class PaymentDetailSerializer(serializers.ModelSerializer):
    buyer_name            = serializers.CharField(source='buyer.username', read_only=True)
    product_title         = serializers.CharField(source='product.title', read_only=True)
    auction_end_time      = serializers.DateTimeField(source='product.auction_end_time', read_only=True)
    deadline_remaining    = serializers.SerializerMethodField()
    deadline_seconds      = serializers.SerializerMethodField()
    winner_position       = serializers.ReadOnlyField()
    previous_winner_name  = serializers.SerializerMethodField()

    class Meta:
        model  = Payment
        fields = [
            'id', 'buyer_name', 'product_title', 'amount',
            'status', 'payment_method', 'transaction_id',
            'upi_id', 'card_last4', 'qr_ref',
            'countdown_start', 'payment_deadline',
            'auction_end_time',
            'deadline_remaining', 'deadline_seconds',
            'winner_position', 'previous_winner_name',
            'created_at', 'paid_at',
            'buyer', 'product', 'winning_bid'
        ]

    def get_previous_winner_name(self, obj):
        """
        For a Payment created by the Winner Payment Expiry / Bidder Shift
        Logic (winner_position > 1), surface who held the win immediately
        before this buyer — gives the Admin Dashboard "Previous winner /
        New winner" visibility purely through existing list endpoints,
        with no new UI required.
        """
        if obj.winner_position <= 1:
            return None
        prev = Payment.objects.filter(
            product=obj.product,
            status=Payment.Status.EXPIRED,
            created_at__lt=obj.created_at,
        ).order_by('-created_at').first()
        return prev.buyer.username if prev else None

    def get_deadline_remaining(self, obj):
        if obj.payment_deadline and obj.status == Payment.Status.PENDING:
            remaining = obj.payment_deadline - timezone.now()
            total = int(remaining.total_seconds())
            if total > 0:
                days, rem = divmod(total, 86400)
                hours, rem = divmod(rem, 3600)
                minutes, secs = divmod(rem, 60)
                return f"{days} Days {hours} Hours {minutes} Minutes {secs} Seconds Remaining"
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
