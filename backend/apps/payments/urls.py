"""Payments App - URL Configuration"""

from django.urls import path
from .views import (
    # Wallet
    MyWalletView,
    # Listing fee
    PayListingFeeView,
    MyListingFeesView,
    AdminListingFeeListView,
    RefundUnsoldListingFeeView,
    # Winner payment
    InitiatePaymentView,
    CompletePaymentView,
    CheckDeadlineView,
    MyPaymentsView,
    PaymentDetailView,
    AdminPaymentListView,
    # Withdrawal
    RequestWithdrawalView,
    MyWithdrawalsView,
    AdminWithdrawalListView,
    AdminProcessWithdrawalView,
    # Admin wallets
    AdminWalletListView,
    AdminCompanyWalletView,
)

urlpatterns = [
    # ── Wallet ─────────────────────────────────────────
    path('wallet/',                              MyWalletView.as_view(),                name='my-wallet'),

    # ── Listing Fee ────────────────────────────────────
    path('listing-fee/pay/',                     PayListingFeeView.as_view(),            name='pay-listing-fee'),
    path('listing-fee/my/',                      MyListingFeesView.as_view(),            name='my-listing-fees'),

    # ── Winner Payment ─────────────────────────────────
    path('initiate/',                            InitiatePaymentView.as_view(),          name='initiate-payment'),
    path('complete/',                            CompletePaymentView.as_view(),          name='complete-payment'),
    path('check-deadline/<int:product_id>/',     CheckDeadlineView.as_view(),            name='check-deadline'),
    path('my-payments/',                         MyPaymentsView.as_view(),               name='my-payments'),
    path('<int:pk>/',                            PaymentDetailView.as_view(),            name='payment-detail'),

    # ── Withdrawal ─────────────────────────────────────
    path('withdraw/',                            RequestWithdrawalView.as_view(),        name='request-withdrawal'),
    path('my-withdrawals/',                      MyWithdrawalsView.as_view(),            name='my-withdrawals'),

    # ── Admin ──────────────────────────────────────────
    path('admin/all/',                           AdminPaymentListView.as_view(),         name='admin-payment-list'),
    path('admin/listing-fees/',                  AdminListingFeeListView.as_view(),      name='admin-listing-fees'),
    path('admin/listing-fee/<int:product_id>/refund/', RefundUnsoldListingFeeView.as_view(), name='admin-refund-listing-fee'),
    path('admin/withdrawals/',                   AdminWithdrawalListView.as_view(),      name='admin-withdrawals'),
    path('admin/withdrawals/<int:pk>/process/',  AdminProcessWithdrawalView.as_view(),   name='admin-process-withdrawal'),
    path('admin/wallets/',                       AdminWalletListView.as_view(),          name='admin-wallets'),
    path('admin/company-wallet/',                AdminCompanyWalletView.as_view(),       name='admin-company-wallet'),
]
