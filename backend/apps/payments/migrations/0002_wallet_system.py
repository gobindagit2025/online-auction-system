"""
Migration: Add Wallet, WalletTransaction, CompanyWallet,
           ListingFeePayment, WithdrawalRequest and update Payment.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0001_initial'),
        ('bids', '0001_initial'),
        ('products', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [

        # ── Wallet ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Wallet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('balance', models.DecimalField(decimal_places=2, default=0.0, max_digits=14)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='wallet',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={'db_table': 'wallets', 'verbose_name': 'Wallet'},
        ),

        # ── WalletTransaction ────────────────────────────────────────────
        migrations.CreateModel(
            name='WalletTransaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('transaction_type', models.CharField(choices=[('CREDIT', 'Credit'), ('DEBIT', 'Debit')], max_length=6)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('ref_id', models.CharField(blank=True, max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('wallet', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='transactions',
                    to='payments.wallet'
                )),
            ],
            options={'db_table': 'wallet_transactions', 'ordering': ['-created_at']},
        ),

        # ── CompanyWallet ─────────────────────────────────────────────────
        migrations.CreateModel(
            name='CompanyWallet',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('balance', models.DecimalField(decimal_places=2, default=0.0, max_digits=16)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'company_wallet'},
        ),

        # ── ListingFeePayment ─────────────────────────────────────────────
        migrations.CreateModel(
            name='ListingFeePayment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fee_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(
                    choices=[('PENDING', 'Pending'), ('PAID', 'Paid'), ('REFUNDED', 'Partially Refunded')],
                    default='PENDING', max_length=10
                )),
                ('payment_method', models.CharField(
                    blank=True,
                    choices=[('UPI', 'UPI'), ('CREDIT_CARD', 'Credit Card'), ('DEBIT_CARD', 'Debit Card'),
                             ('NET_BANKING', 'Net Banking'), ('QR_CODE', 'QR Code')],
                    max_length=15, null=True
                )),
                ('transaction_id', models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ('upi_id', models.CharField(blank=True, max_length=100, null=True)),
                ('qr_ref', models.CharField(blank=True, max_length=200, null=True)),
                ('paid_at', models.DateTimeField(blank=True, null=True)),
                ('refunded_at', models.DateTimeField(blank=True, null=True)),
                ('refund_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('seller', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='listing_fees',
                    to=settings.AUTH_USER_MODEL
                )),
                ('product', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='listing_fee',
                    to='products.product'
                )),
            ],
            options={'db_table': 'listing_fee_payments', 'ordering': ['-created_at']},
        ),

        # ── Update Payment model ──────────────────────────────────────────
        migrations.AddField(
            model_name='payment',
            name='upi_id',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='card_last4',
            field=models.CharField(blank=True, max_length=4, null=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='qr_ref',
            field=models.CharField(blank=True, max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='payment_deadline',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='payment',
            name='status',
            field=models.CharField(
                choices=[('PENDING', 'Pending'), ('COMPLETED', 'Completed'),
                         ('FAILED', 'Failed'), ('REFUNDED', 'Refunded'),
                         ('EXPIRED', 'Expired (24h deadline missed)')],
                default='PENDING', max_length=10
            ),
        ),
        migrations.AlterField(
            model_name='payment',
            name='payment_method',
            field=models.CharField(
                blank=True,
                choices=[('CREDIT_CARD', 'Credit Card'), ('DEBIT_CARD', 'Debit Card'),
                         ('NET_BANKING', 'Net Banking'), ('UPI', 'UPI'),
                         ('QR_CODE', 'QR Code'), ('WALLET', 'BidZone Wallet')],
                max_length=15, null=True
            ),
        ),

        # ── WithdrawalRequest ─────────────────────────────────────────────
        migrations.CreateModel(
            name='WithdrawalRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('upi_id', models.CharField(max_length=100)),
                ('status', models.CharField(
                    choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')],
                    default='PENDING', max_length=10
                )),
                ('transaction_id', models.CharField(blank=True, max_length=100, null=True)),
                ('admin_note', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='withdrawals',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={'db_table': 'withdrawal_requests', 'ordering': ['-created_at']},
        ),
    ]
