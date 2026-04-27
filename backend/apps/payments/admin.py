from django.contrib import admin
from .models import Payment, Wallet, WalletTransaction, ListingFeePayment, CompanyWallet, WithdrawalRequest

@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['user', 'balance', 'updated_at']

@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ['wallet', 'transaction_type', 'amount', 'description', 'created_at']

@admin.register(CompanyWallet)
class CompanyWalletAdmin(admin.ModelAdmin):
    list_display = ['balance', 'updated_at']

@admin.register(ListingFeePayment)
class ListingFeePaymentAdmin(admin.ModelAdmin):
    list_display = ['seller', 'product', 'fee_amount', 'status', 'payment_method', 'paid_at']

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['buyer', 'product', 'amount', 'status', 'payment_method', 'payment_deadline', 'paid_at']

@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'upi_id', 'status', 'created_at', 'processed_at']
