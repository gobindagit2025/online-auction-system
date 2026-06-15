"""
Migration: Add refund audit fields to ListingFeePayment
- refunded_by: FK to admin user who processed the refund
- refund_reason: Optional reason text provided by admin
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0004_deliveryaddress'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='listingfeepayment',
            name='refunded_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Admin user who processed the refund',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='listing_fee_refunds',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='listingfeepayment',
            name='refund_reason',
            field=models.TextField(
                blank=True,
                null=True,
                help_text='Reason provided by admin for the refund',
            ),
        ),
    ]
