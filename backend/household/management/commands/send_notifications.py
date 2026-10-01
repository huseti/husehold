from datetime import time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from household.models import HouseholdSettings, HouseholdTaskInstance, Voucher, PackingList
from household.services.notifications import notify_task_due, notify_voucher_expiring, notify_trip_tomorrow


# "Heute kochen wir ..." goes out in the morning, not at midnight -- cook
# tasks have no reminder_time of their own.
COOKING_TODAY_FROM = time(8, 0)

# How far ahead a voucher's valid_until triggers the "expiring soon" heads-up.
VOUCHER_EXPIRING_WINDOW_DAYS = 30


class Command(BaseCommand):
    help = (
        "Sends email/push notifications for household task instances due today, "
        "vouchers expiring within 30 days, and packing trips starting tomorrow. "
        "Meant to run periodically via cron (e.g. every 15-30 minutes) -- it's "
        "idempotent, so running it more often just costs a few extra queries."
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
        now_time = timezone.localtime().time()

        due_instances = HouseholdTaskInstance.objects.filter(
            Q(assigned_to__isnull=False) | Q(system_action='cook_meal'),
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

        timezone.deactivate()
        self.stdout.write(self.style.SUCCESS(
            f'{due_instances.count()} task(s) due today, {processed} checked for notifications, '
            f'{expiring_vouchers.count()} voucher(s) expiring soon, {starting_trips.count()} trip(s) starting tomorrow.'
        ))
