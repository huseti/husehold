"""One-way, read-only Google Calendar sync -- see PLANNING.md 2a/6C.

Hand-rolled against Google's plain OAuth2/REST endpoints with `requests`
rather than the google-api-python-client / google-auth-oauthlib libraries:
the household only ever needs three calls (build the consent URL, exchange a
code, list events), so pulling in the full client library -- and its
dependency tree -- isn't worth it on a Pi 3.
"""
from datetime import datetime, date, time, timedelta
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.utils import timezone

from ..models import GoogleCalendarLink, CalendarEvent

AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

# The window kept in sync each run -- a little past history for context, and
# far enough ahead to cover the cooking/household weekly planning views.
SYNC_PAST_DAYS = 7
SYNC_FUTURE_DAYS = 60


def build_authorize_url(redirect_uri, state):
    params = {
        'client_id': settings.GOOGLE_CLIENT_ID,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': SCOPE,
        'access_type': 'offline',
        # Forces Google to hand back a refresh_token even on a reconnect
        # (it's only issued the very first time otherwise).
        'prompt': 'consent',
        'state': state,
    }
    return f'{AUTH_URL}?{urlencode(params)}'


def exchange_code(code, redirect_uri):
    """Returns the token response dict (access_token, refresh_token, ...)."""
    response = requests.post(TOKEN_URL, data={
        'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': redirect_uri,
    }, timeout=10)
    response.raise_for_status()
    return response.json()


def _refresh_access_token(refresh_token):
    response = requests.post(TOKEN_URL, data={
        'client_id': settings.GOOGLE_CLIENT_ID,
        'client_secret': settings.GOOGLE_CLIENT_SECRET,
        'refresh_token': refresh_token,
        'grant_type': 'refresh_token',
    }, timeout=10)
    response.raise_for_status()
    return response.json()['access_token']


def _is_declined(event):
    """The event's own status covers cancellation; a personal decline is
    tracked separately, per-attendee -- only the household's own RSVP
    matters here, not other invitees'."""
    for attendee in event.get('attendees', []):
        if attendee.get('self') and attendee.get('responseStatus') == 'declined':
            return True
    return False


def _parse_event_times(event):
    start, end = event['start'], event['end']
    is_all_day = 'date' in start
    if is_all_day:
        start_dt = timezone.make_aware(datetime.combine(date.fromisoformat(start['date']), time.min))
        end_dt = timezone.make_aware(datetime.combine(date.fromisoformat(end['date']), time.min))
    else:
        start_dt = datetime.fromisoformat(start['dateTime'])
        end_dt = datetime.fromisoformat(end['dateTime'])
    return start_dt, end_dt, is_all_day


def sync():
    """Pulls events for the rolling window into CalendarEvent, replacing the
    previous snapshot for that window (handles edits/cancellations without
    needing incremental sync tokens). Returns the number of events kept, or
    None if nothing is connected or sync is turned off."""
    link = GoogleCalendarLink.load()
    if not link.is_connected or not link.sync_enabled:
        return None

    access_token = _refresh_access_token(link.refresh_token)
    now = timezone.now()
    time_min = now - timedelta(days=SYNC_PAST_DAYS)
    time_max = now + timedelta(days=SYNC_FUTURE_DAYS)

    response = requests.get(
        f'https://www.googleapis.com/calendar/v3/calendars/{link.calendar_id}/events',
        headers={'Authorization': f'Bearer {access_token}'},
        params={
            'timeMin': time_min.isoformat(), 'timeMax': time_max.isoformat(),
            'singleEvents': 'true', 'orderBy': 'startTime', 'maxResults': 250,
        },
        timeout=15,
    )
    response.raise_for_status()
    items = response.json().get('items', [])

    kept_ids = []
    for event in items:
        if event.get('status') == 'cancelled' or _is_declined(event):
            continue
        start_dt, end_dt, is_all_day = _parse_event_times(event)
        CalendarEvent.objects.update_or_create(
            link=link, external_event_id=event['id'],
            defaults={
                'title': event.get('summary', ''), 'start_datetime': start_dt,
                'end_datetime': end_dt, 'is_all_day': is_all_day,
            },
        )
        kept_ids.append(event['id'])

    # Anything in-window that Google no longer returned (deleted, cancelled,
    # or newly declined) drops out of the cache too.
    link.events.filter(start_datetime__gte=time_min, start_datetime__lt=time_max) \
        .exclude(external_event_id__in=kept_ids).delete()

    link.last_synced_at = now
    link.save(update_fields=['last_synced_at'])
    return len(kept_ids)
