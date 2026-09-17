from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.management.base import BaseCommand
from django.utils import timezone

from household.models import HouseholdSettings, HouseholdTaskInstance
from household.services.notifications import notify_task_due


class Command(BaseCommand):
    help = (
        "Sends email/push notifications for household task instances due today. "
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
            scheduled_date=today, status='pending', assigned_to__isnull=False,
        ).select_related('definition', 'assigned_to')

        processed = 0
        for instance in due_instances:
            reminder_time = instance.definition.reminder_time if instance.definition else None
            if reminder_time and now_time < reminder_time:
                continue
            notify_task_due(instance)
            processed += 1

        timezone.deactivate()
        self.stdout.write(self.style.SUCCESS(
            f'{due_instances.count()} task(s) due today, {processed} checked for notifications.'
        ))
