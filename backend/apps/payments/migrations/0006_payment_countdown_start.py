"""
Migration: Add countdown_start field to Payment model
Tracks when the 24-hour winner payment countdown began (auction close time).
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0005_listingfeepayment_refund_audit'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='countdown_start',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='When the 24h payment countdown started (auction close time)',
            ),
        ),
    ]
