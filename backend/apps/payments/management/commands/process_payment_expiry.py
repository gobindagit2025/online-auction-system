"""
Winner Payment Expiry / Bidder Shift Logic — background job entry point.

This management command is the "existing scheduled task / background job /
cron process" hook requested by the fix: it lets the auto-expire-and-shift
sweep (process_expired_winner_payments) run completely independently of any
buyer/admin opening a page, including after a server restart, since it does
nothing but read/write the database — no in-memory state to lose.

It does NOT touch the payment gateway, bidding logic, countdown UI, wallet
logic, or auction workflow — it only calls the existing
process_expired_winner_payments() helper used elsewhere in the payments app.

Usage
-----
Run once (safe to call repeatedly / idempotent):

    python manage.py process_payment_expiry

Schedule it to run automatically every minute via OS cron (Linux/macOS):

    * * * * * cd /path/to/backend && /path/to/venv/bin/python manage.py process_payment_expiry >> /var/log/bidzone_payment_expiry.log 2>&1

Or via Windows Task Scheduler running the same command on a 1-minute trigger.

Or, if/when Celery beat is wired up in this project (celery is already in
requirements.txt), call process_expired_winner_payments() from a
@shared_task on the same schedule — the command and the task would both
simply delegate to the same underlying function, so nothing here needs to
change either way.
"""

from django.core.management.base import BaseCommand

from apps.payments.serializers import process_expired_winner_payments


class Command(BaseCommand):
    help = (
        "Finds every auction whose winner-payment 24h deadline has passed, "
        "auto-disqualifies that winner, and shifts the win to the next "
        "highest eligible bidder (cascading through multiple bidders if "
        "needed), or marks the auction UNSOLD if no eligible bidder "
        "remains. Intended to be run on a schedule (cron / Celery beat / "
        "Task Scheduler) so this happens automatically without any admin "
        "action and survives server restarts."
    )

    def handle(self, *args, **options):
        result = process_expired_winner_payments()
        shifted = result.get('shifted', 0)
        unsold = result.get('unsold', 0)

        if shifted == 0 and unsold == 0:
            self.stdout.write(self.style.SUCCESS(
                "No expired winner payments found. Nothing to shift."
            ))
            return

        self.stdout.write(self.style.SUCCESS(
            f"Processed winner payment expiry: {shifted} bidder shift(s) "
            f"performed, {unsold} auction(s) newly marked UNSOLD."
        ))
