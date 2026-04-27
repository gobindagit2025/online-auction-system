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
    CompanyWallet, WithdrawalRequest
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
    Admin triggers 2.5% refund to seller wallet for unsold products.
    """
    permission_classes = [IsAdminRole]

    def post(self, request, product_id):
        try:
            product = Product.objects.get(pk=product_id, status=Product.Status.CLOSED)
        except Product.DoesNotExist:
            return Response({'error': 'Closed product not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check no winning payment
        if Payment.objects.filter(product=product, status=Payment.Status.COMPLETED).exists():
            return Response({'error': 'Product was sold — no refund applicable.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lf = product.listing_fee
        except ListingFeePayment.DoesNotExist:
            return Response({'error': 'No listing fee record found.'}, status=status.HTTP_404_NOT_FOUND)

        if lf.status == ListingFeePayment.Status.REFUNDED:
            return Response({'error': 'Already refunded.'}, status=status.HTTP_400_BAD_REQUEST)

        refund_amt = round(Decimal('0.025') * product.starting_price, 2)
        seller_wallet, _ = Wallet.objects.get_or_create(user=lf.seller)
        seller_wallet.credit(
            refund_amt,
            description=f"Partial refund (2.5%) for unsold: {product.title}",
            ref_id=f"REFUND-{uuid.uuid4().hex[:10].upper()}"
        )
        lf.status        = ListingFeePayment.Status.REFUNDED
        lf.refund_amount = refund_amt
        lf.refunded_at   = timezone.now()
        lf.save()

        return Response({
            'message': f'₹{refund_amt} (2.5%) refunded to seller BidZone wallet.',
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
