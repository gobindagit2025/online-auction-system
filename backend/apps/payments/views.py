"""
Payments App - Views
Full payment system: listing fees, winner payments, wallets, withdrawals
"""

import uuid
from decimal import Decimal
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Payment, Wallet, ListingFeePayment,
    CompanyWallet, WithdrawalRequest, DeliveryAddress
)
from .serializers import (
    InitiatePaymentSerializer,
    CompletePaymentSerializer,
    PaymentDetailSerializer,
    InitiateListingFeeSerializer,
    ListingFeeSerializer,
    WalletSerializer,
    WithdrawalRequestSerializer,
    AdminWithdrawalSerializer,
    DeliveryAddressSerializer,
    AdminDeliveryAddressSerializer,
    _expire_and_shift,
)
from apps.users.permissions import IsBuyerRole, IsAdminRole, IsNotBlocked, IsSellerOrAdmin
from apps.bids.models import Bid
from apps.products.models import Product


# ─────────────────────────────────────────────────────────
# WALLET
# ─────────────────────────────────────────────────────────

class MyWalletView(APIView):
    """GET /api/payments/wallet/  — current user wallet + transactions"""
    permission_classes = [permissions.IsAuthenticated, IsNotBlocked]

    def get(self, request):
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        return Response(WalletSerializer(wallet).data)


# ─────────────────────────────────────────────────────────
# LISTING FEE  (Seller pays 5% when listing product)
# ─────────────────────────────────────────────────────────

class PayListingFeeView(APIView):
    """
    POST /api/payments/listing-fee/pay/
    Seller pays 5% listing fee for a product.
    """
    permission_classes = [IsSellerOrAdmin, IsNotBlocked]

    def post(self, request):
        serializer = InitiateListingFeeSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        listing_fee = serializer.save()
        return Response({
            'message': 'Listing fee paid successfully. Your product is now active.',
            'listing_fee': ListingFeeSerializer(listing_fee).data,
            'fee_details': {
                'total_paid': str(listing_fee.fee_amount),
                'platform_fee': str(listing_fee.fee_amount),
                'note': '5% of starting price credited to BidZone platform.',
                'refund_policy': 'If product is unsold, 2.5% will be refunded to your BidZone wallet.',
            }
        }, status=status.HTTP_201_CREATED)


class MyListingFeesView(generics.ListAPIView):
    """GET /api/payments/listing-fee/my/  — seller's own listing fees"""
    serializer_class   = ListingFeeSerializer
    permission_classes = [IsSellerOrAdmin, IsNotBlocked]

    def get_queryset(self):
        if self.request.user.role == 'ADMIN':
            return ListingFeePayment.objects.all()
        return ListingFeePayment.objects.filter(seller=self.request.user)


class AdminListingFeeListView(generics.ListAPIView):
    """GET /api/payments/admin/listing-fees/  — admin view all listing fees"""
    serializer_class   = ListingFeeSerializer
    permission_classes = [IsAdminRole]
    queryset           = ListingFeePayment.objects.all()


class RefundUnsoldListingFeeView(APIView):
    """
    POST /api/payments/admin/listing-fee/<product_id>/refund/
    Admin refunds the 2.5% listing fee to the seller's wallet.

    Eligibility rules (Admin Listing Fee Refund System):
      - Product must NOT have any bids.
      - Product must be CANCELLED (admin manually cancelled it before auction completed).
      - Product must NOT have a winning bidder / completed payment.
      - Listing fee must NOT have been refunded already.
      - Product status cannot be PENDING or CLOSED (normal end).
    """
    permission_classes = [IsAdminRole]

    def post(self, request, product_id):
        # ── 1. Fetch product ──────────────────────────────────────────────────
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        # ── 2. Status-based eligibility checks ────────────────────────────────
        if product.status == Product.Status.PENDING:
            return Response(
                {'error': 'Refund not allowed: auction is still Pending and has not started yet.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if product.status == Product.Status.CLOSED:
            return Response(
                {'error': 'Refund not allowed: auction closed normally. Listing fee is non-refundable after a completed auction.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if product.status == Product.Status.ACTIVE:
            return Response(
                {'error': 'Refund not allowed: auction is currently Active. Cancel the product first before requesting a refund.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only CANCELLED products may be refunded
        if product.status != Product.Status.CANCELLED:
            return Response(
                {'error': f'Refund not allowed: product status is {product.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── 3. No bids allowed ────────────────────────────────────────────────
        bid_count = product.bids.count()
        if bid_count > 0:
            return Response(
                {'error': f'Refund not allowed: product has received {bid_count} bid(s). Listing fee cannot be refunded once bidding has occurred.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── 4. No completed payment / winning bidder ──────────────────────────
        if Payment.objects.filter(product=product, status=Payment.Status.COMPLETED).exists():
            return Response(
                {'error': 'Refund not allowed: product already has a winning bidder with a completed payment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── 5. Listing fee record must exist ─────────────────────────────────
        try:
            lf = product.listing_fee
        except ListingFeePayment.DoesNotExist:
            return Response({'error': 'No listing fee record found for this product.'}, status=status.HTTP_404_NOT_FOUND)

        # ── 6. Duplicate-refund guard ─────────────────────────────────────────
        if lf.status == ListingFeePayment.Status.REFUNDED:
            return Response(
                {
                    'error': 'Refund already processed for this listing fee.',
                    'refund_details': {
                        'refund_amount': str(lf.refund_amount),
                        'refunded_at': lf.refunded_at.isoformat() if lf.refunded_at else None,
                        'refunded_by': lf.refunded_by.username if lf.refunded_by else None,
                        'refund_reason': lf.refund_reason,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── 7. Accept optional reason from admin ──────────────────────────────
        refund_reason = request.data.get('reason', 'Admin manually cancelled the listing before any bids were placed.').strip() or 'Admin manually cancelled the listing before any bids were placed.'

        # ── 8. Process refund ─────────────────────────────────────────────────
        refund_amt = round(Decimal('0.025') * product.starting_price, 2)
        seller_wallet, _ = Wallet.objects.get_or_create(user=lf.seller)
        seller_wallet.credit(
            refund_amt,
            description=f"Listing fee refund (2.5%) for cancelled product: {product.title}",
            ref_id=f"LFREFUND-{uuid.uuid4().hex[:10].upper()}"
        )

        lf.status        = ListingFeePayment.Status.REFUNDED
        lf.refund_amount = refund_amt
        lf.refunded_at   = timezone.now()
        lf.refunded_by   = request.user
        lf.refund_reason = refund_reason
        lf.save()

        return Response({
            'message': f'₹{refund_amt} (2.5% listing fee) successfully refunded to {lf.seller.username}\'s BidZone wallet.',
            'refund_details': {
                'refund_amount': str(refund_amt),
                'refunded_at': lf.refunded_at.isoformat(),
                'refunded_by': request.user.username,
                'refund_reason': refund_reason,
                'seller': lf.seller.username,
                'product': product.title,
            },
            'listing_fee': ListingFeeSerializer(lf).data
        })


# ─────────────────────────────────────────────────────────
# WINNER PAYMENT
# ─────────────────────────────────────────────────────────

class InitiatePaymentView(APIView):
    """POST /api/payments/initiate/  — winner initiates payment"""
    permission_classes = [IsBuyerRole, IsNotBlocked]

    def post(self, request):
        serializer = InitiatePaymentSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        qr_payload = None
        if payment.payment_method == 'QR_CODE':
            qr_payload = {
                'upi_string': f"upi://pay?pa=bidzone@upi&pn=BidZone&am={payment.amount}&tn={payment.transaction_id}",
                'qr_ref':     payment.qr_ref,
            }

        return Response({
            'message':          'Payment initiated. Complete within the deadline.',
            'payment':          PaymentDetailSerializer(payment).data,
            'qr_payload':       qr_payload,
            'payment_deadline': payment.payment_deadline,
            'note': (
                'You have 24 hours from auction close to complete payment. '
                'Failure will shift the win to the next highest bidder.'
            ),
        }, status=status.HTTP_201_CREATED)


class CompletePaymentView(APIView):
    """POST /api/payments/complete/  — buyer confirms / simulates gateway callback"""
    permission_classes = [IsBuyerRole, IsNotBlocked]

    def post(self, request):
        serializer = CompletePaymentSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        payment_id = serializer.validated_data['payment_id']
        payment    = Payment.objects.get(pk=payment_id)

        # Mark payment completed
        payment.status  = Payment.Status.COMPLETED
        payment.paid_at = timezone.now()
        payment.save()

        # Credit seller BidZone wallet
        seller_wallet, _ = Wallet.objects.get_or_create(user=payment.product.seller)
        seller_wallet.credit(
            payment.amount,
            description=f"Auction sale: {payment.product.title}",
            ref_id=payment.transaction_id
        )

        return Response({
            'message': 'Payment completed! Amount credited to seller BidZone wallet.',
            'payment': PaymentDetailSerializer(payment).data,
            'seller_wallet_credited': str(payment.amount),
        })


class CheckDeadlineView(APIView):
    """
    POST /api/payments/check-deadline/<product_id>/
    Checks if winner's 24h deadline has passed and auto-shifts if needed.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, product_id):
        try:
            product = Product.objects.get(pk=product_id)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        payment = Payment.objects.filter(
            product=product, status=Payment.Status.PENDING
        ).first()

        if payment and payment.is_deadline_passed:
            _expire_and_shift(product, payment)
            return Response({'shifted': True, 'message': 'Winner deadline passed. Shifted to next bidder.'})

        return Response({'shifted': False, 'message': 'Deadline still active or no pending payment.'})


class MyPaymentsView(generics.ListAPIView):
    """GET /api/payments/my-payments/"""
    serializer_class   = PaymentDetailSerializer
    permission_classes = [IsBuyerRole, IsNotBlocked]

    def get_queryset(self):
        return Payment.objects.filter(buyer=self.request.user)


class PaymentDetailView(generics.RetrieveAPIView):
    """GET /api/payments/<id>/"""
    serializer_class   = PaymentDetailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'ADMIN':
            return Payment.objects.all()
        return Payment.objects.filter(buyer=self.request.user)


class AdminPaymentListView(generics.ListAPIView):
    """GET /api/payments/admin/all/"""
    serializer_class   = PaymentDetailSerializer
    permission_classes = [IsAdminRole]
    queryset           = Payment.objects.all()
    filterset_fields   = ['status', 'payment_method']
    search_fields      = ['buyer__username', 'transaction_id', 'product__title']


# ─────────────────────────────────────────────────────────
# WITHDRAWAL  (Seller → Bank via UPI)
# ─────────────────────────────────────────────────────────

class RequestWithdrawalView(generics.CreateAPIView):
    """POST /api/payments/withdraw/  — seller requests wallet withdrawal"""
    serializer_class   = WithdrawalRequestSerializer
    permission_classes = [IsSellerOrAdmin, IsNotBlocked]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        wr = serializer.save()
        return Response({
            'message': f'Withdrawal of ₹{wr.amount} to {wr.upi_id} submitted. Admin will process within 24-48 hrs.',
            'withdrawal': WithdrawalRequestSerializer(wr).data,
        }, status=status.HTTP_201_CREATED)


class MyWithdrawalsView(generics.ListAPIView):
    """GET /api/payments/my-withdrawals/"""
    serializer_class   = WithdrawalRequestSerializer
    permission_classes = [IsSellerOrAdmin, IsNotBlocked]

    def get_queryset(self):
        return WithdrawalRequest.objects.filter(user=self.request.user)


class AdminWithdrawalListView(generics.ListAPIView):
    """GET /api/payments/admin/withdrawals/  — admin sees all withdrawal requests"""
    serializer_class   = WithdrawalRequestSerializer
    permission_classes = [IsAdminRole]
    queryset           = WithdrawalRequest.objects.all()
    filterset_fields   = ['status']
    search_fields      = ['user__username', 'upi_id']


class AdminProcessWithdrawalView(APIView):
    """
    PATCH /api/payments/admin/withdrawals/<id>/process/
    Admin approves or rejects a withdrawal.
    """
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        try:
            wr = WithdrawalRequest.objects.get(pk=pk)
        except WithdrawalRequest.DoesNotExist:
            return Response({'error': 'Withdrawal not found.'}, status=status.HTTP_404_NOT_FOUND)

        if wr.status != WithdrawalRequest.Status.PENDING:
            return Response({'error': f'Already {wr.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        new_status = request.data.get('status')
        if new_status not in ['APPROVED', 'REJECTED']:
            return Response({'error': 'status must be APPROVED or REJECTED.'}, status=status.HTTP_400_BAD_REQUEST)

        wr.status       = new_status
        wr.admin_note   = request.data.get('admin_note', '')
        wr.processed_at = timezone.now()

        if new_status == 'APPROVED':
            wr.transaction_id = f"UPI-OUT-{uuid.uuid4().hex[:10].upper()}"
            # Company wallet records outflow (simulated bank transfer)
            company = CompanyWallet.get()
            # In real flow this triggers actual UPI transfer
        elif new_status == 'REJECTED':
            # Refund amount back to user wallet
            user_wallet, _ = Wallet.objects.get_or_create(user=wr.user)
            user_wallet.credit(
                wr.amount,
                description=f"Withdrawal rejected — refund",
                ref_id=f"WD-REJ-{uuid.uuid4().hex[:8].upper()}"
            )
        wr.save()

        return Response({
            'message': f'Withdrawal {new_status.lower()} successfully.',
            'withdrawal': WithdrawalRequestSerializer(wr).data
        })


class AdminWalletListView(generics.ListAPIView):
    """GET /api/payments/admin/wallets/  — admin sees all user wallets"""
    serializer_class   = WalletSerializer
    permission_classes = [IsAdminRole]
    queryset           = Wallet.objects.all().select_related('user')


class AdminCompanyWalletView(APIView):
    """GET /api/payments/admin/company-wallet/  — platform total earnings"""
    permission_classes = [IsAdminRole]

    def get(self, request):
        cw = CompanyWallet.get()
        return Response({
            'company_balance': str(cw.balance),
            'note': 'Total platform fee earnings (5% per listing, 2.5% retained on unsold)'
        })


# ─────────────────────────────────────────────────────────
# BUYER DELIVERY ADDRESS  (Feature: Buyer Delivery Address Collection)
# ─────────────────────────────────────────────────────────

class DeliveryAddressView(APIView):
    """
    GET  /api/payments/<payment_id>/delivery-address/
        Buyer (or Admin): retrieve the delivery address saved for this order.
    POST /api/payments/<payment_id>/delivery-address/
        Buyer: save/update the delivery address for their own completed
        order, immediately after successful payment.
    """
    permission_classes = [IsBuyerRole, IsNotBlocked]

    def _get_payment(self, pk, user):
        return Payment.objects.filter(
            pk=pk, buyer=user, status=Payment.Status.COMPLETED
        ).first()

    def get(self, request, payment_id):
        payment = self._get_payment(payment_id, request.user)
        if not payment:
            return Response(
                {'error': 'Completed order not found or not yours.'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            delivery_address = payment.delivery_address
        except DeliveryAddress.DoesNotExist:
            return Response(
                {'error': 'No delivery address saved for this order yet.'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(DeliveryAddressSerializer(delivery_address).data)

    def post(self, request, payment_id):
        payment = self._get_payment(payment_id, request.user)
        if not payment:
            return Response(
                {'error': 'Completed order not found or not yours.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = DeliveryAddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # One delivery address per order — create on first save,
        # update in place if the buyer revisits this page.
        delivery_address, created = DeliveryAddress.objects.update_or_create(
            payment=payment,
            defaults=serializer.validated_data
        )

        return Response({
            'message': 'Delivery address saved successfully.',
            'delivery_address': DeliveryAddressSerializer(delivery_address).data,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class AdminDeliveryAddressListView(generics.ListAPIView):
    """
    GET /api/payments/admin/delivery-addresses/
    Admin: view all buyer delivery addresses across all completed orders
    (Feature: Admin Visibility - Buyer Delivery Information).
    """
    serializer_class = AdminDeliveryAddressSerializer
    permission_classes = [IsAdminRole]
    queryset = DeliveryAddress.objects.select_related(
        'payment', 'payment__product', 'payment__buyer'
    ).all()
