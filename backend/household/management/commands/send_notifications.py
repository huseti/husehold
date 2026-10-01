from datetime import time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.management.base import BaseCommand
from django.utils import timezone

from household.models import HouseholdSettings, HouseholdTaskInstance, Voucher, PackingList, PurchaseRecord, ShoppingList, ShoppingListItem
from household.services.notifications import (
    notify_task_due, notify_task_overdue, notify_voucher_expiring, notify_trip_tomorrow,
    notify_shopping_purchased, notify_shopping_items_added,
)


# "Heute kochen wir ..." goes out in the morning, not at midnight -- cook
# tasks have no reminder_time of their own.
COOKING_TODAY_FROM = time(8, 0)

# How far ahead a voucher's valid_until triggers the "expiring soon" heads-up.
VOUCHER_EXPIRING_WINDOW_DAYS = 30

# How far back to look for newly-completed/newly-added shopping items --
# matches the cron interval (*/15, see DEPLOYMENT.md), and bucketing "now" to
# the same 15-minute mark makes the notification's dedup key stable even if
# the command happens to run twice within one tick.
SHOPPING_DIGEST_WINDOW_MINUTES = 15


class Command(BaseCommand):
    help = (
        "Sends email/push notifications for household task instances due today or "
        "overdue, vouchers expiring within 30 days, packing trips starting tomorrow, "
        "and shopping list activity (items purchased or added) in the last 15 minutes. "
        "Meant to run periodically via cron (e.g. every 15 minutes) -- it's idempotent, "
        "so running it more often just costs a few extra queries."
    )

    def handle(self, *args, **options):
        # Mirrors household.middleware.HouseholdTimezoneMiddleware -- this
        # command runs outside the request cycle, so "today" and reminder
        # times need the same household-configured timezone activated
        # manually here instead of falling back to the static TIME_ZONE.
        tz_name = HouseholdSettings.objects.filter(pk=1).values_list('timezone', flat=True).first()
        if tz_name:
            try:
                timezone.activate(ZoneInfo(tz_name))
            except ZoneInfoNotFoundError:
                timezone.deactivate()
        else:
            timezone.deactivate()

        today = timezone.localdate()
        now = timezone.localtime()
        now_time = now.time()

        # No assigned_to/system_action restriction here (unlike before) --
        # an unassigned task now also notifies the whole household, so every
        # pending task due today is a candidate; _recipients() in
        # notifications.py decides who actually hears about it.
        due_instances = HouseholdTaskInstance.objects.filter(
            scheduled_date=today, status='pending',
        ).select_related('definition', 'assigned_to')

        processed = 0
        for instance in due_instances:
            reminder_time = instance.definition.reminder_time if instance.definition else None
            if instance.system_action == 'cook_meal':
                reminder_time = COOKING_TODAY_FROM
            if reminder_time and now_time < reminder_time:
                continue
            notify_task_due(instance)
            processed += 1

        overdue_instances = HouseholdTaskInstance.objects.filter(
            scheduled_date__lt=today, status='pending',
        ).select_related('definition', 'assigned_to')
        for instance in overdue_instances:
            notify_task_overdue(instance)

        expiring_vouchers = Voucher.objects.filter(
            is_archived=False, valid_until__isnull=False,
            valid_until__gte=today, valid_until__lte=today + timedelta(days=VOUCHER_EXPIRING_WINDOW_DAYS),
        )
        for voucher in expiring_vouchers:
            notify_voucher_expiring(voucher)

        tomorrow = today + timedelta(days=1)
        starting_trips = PackingList.objects.filter(is_archived=False, start_date=tomorrow)
        for packing_list in starting_trips:
            notify_trip_tomorrow(packing_list)

        window_start = now - timedelta(minutes=SHOPPING_DIGEST_WINDOW_MINUTES)
        bucket_minute = (now.minute // SHOPPING_DIGEST_WINDOW_MINUTES) * SHOPPING_DIGEST_WINDOW_MINUTES
        bucket = now.replace(minute=bucket_minute, second=0, microsecond=0).isoformat()

        purchased_list_ids = set(
            PurchaseRecord.objects.filter(created_at__gte=window_start, shopping_list__isnull=False)
            .values_list('shopping_list_id', flat=True).distinct()
        )
        for shopping_list in ShoppingList.objects.filter(id__in=purchased_list_ids):
            notify_shopping_purchased(shopping_list, bucket)

        added_list_ids = set(
            ShoppingListItem.objects.filter(created_at__gte=window_start)
            .values_list('shopping_list_id', flat=True).distinct()
        )
        for shopping_list in ShoppingList.objects.filter(id__in=added_list_ids):
            notify_shopping_items_added(shopping_list, bucket)

        timezone.deactivate()
        self.stdout.write(self.style.SUCCESS(
            f'{due_instances.count()} task(s) due today, {processed} checked for notifications, '
            f'{overdue_instances.count()} overdue, '
            f'{expiring_vouchers.count()} voucher(s) expiring soon, {starting_trips.count()} trip(s) starting tomorrow, '
            f'{len(purchased_list_ids)} list(s) with recent purchases, {len(added_list_ids)} list(s) with new items.'
        ))
