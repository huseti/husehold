from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone


class HouseholdTimezoneMiddleware:
    """Activates the household's configured timezone (Settings > Household
    name) for the duration of each request, instead of relying on the
    static TIME_ZONE setting. Falls back to that setting if the household
    hasn't been configured yet, or has an invalid zone name saved."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from .models import HouseholdSettings  # avoid AppRegistryNotReady at import time

        tz_name = HouseholdSettings.objects.filter(pk=1).values_list('timezone', flat=True).first()
        if tz_name:
            try:
                timezone.activate(ZoneInfo(tz_name))
            except ZoneInfoNotFoundError:
                timezone.deactivate()
        else:
            timezone.deactivate()
        response = self.get_response(request)
        timezone.deactivate()
        return response
