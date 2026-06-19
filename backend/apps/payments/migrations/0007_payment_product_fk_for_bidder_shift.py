# Winner Payment Expiry / Bidder Shift Logic fix.
#
# Payment.product was a OneToOneField, which puts a DB-level UNIQUE
# constraint on the product_id column — at most one Payment row could
# ever exist per product. That silently made it impossible to give a
# 2nd/3rd/4th-highest bidder their own 24h payment countdown row once the
# original winner's payment expired: creating that row would raise an
# IntegrityError. This migration relaxes the column to a regular (non-
# unique) foreign key so multiple sequential winner-payment rows can
# exist for the same product, which is exactly what the bidder-shift
# feature requires.
#
# This is purely a constraint relaxation: no column type change, no data
# loss, and every existing one-payment-per-product row remains perfectly
# valid. No code anywhere in the project reads the OneToOne reverse
# accessor (`product.payment` as a single object) that this removes —
# only `Payment.objects.filter(product=...)` style lookups are used,
# which behave identically for ForeignKey and OneToOneField.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0006_payment_countdown_start'),
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='product',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='payment',
                to='products.product',
            ),
        ),
    ]
