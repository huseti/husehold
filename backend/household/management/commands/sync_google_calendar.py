from django.core.management.base import BaseCommand

from household.services import google_calendar


class Command(BaseCommand):
    help = (
        "Pulls events from the linked Google Calendar into the read-only "
        "overlay cache. Meant to run periodically via cron (every 15 "
        "minutes) -- a no-op if nothing is connected or sync is turned off."
    )

    def handle(self, *args, **options):
        count = google_calendar.sync()
        if count is None:
            self.stdout.write('No Google Calendar connected (or sync disabled) -- nothing to do.')
        else:
            self.stdout.write(self.style.SUCCESS(f'Synced {count} event(s).'))
