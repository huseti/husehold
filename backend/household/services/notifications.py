import json
import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail

from pywebpush import webpush, WebPushException

from ..models import HouseholdMember, NotificationPreference, PushSubscription, NotificationLog

logger = logging.getLogger(__name__)

# Keyed by language, then by NotificationPreference.NOTIFICATION_TYPE_CHOICES --
# add an entry for *every* language whenever a new notification type is
# introduced. Each member picks their language in Settings (German default).
NOTIFICATION_MESSAGES = {
    'de': {
        'task_due_today': {
            'subject': 'Heute fällig: {title}',
            'body': '„{title}“ ist heute fällig.',
        },
        'household_planning_due': {
            'subject': 'Wöchentliche Haushaltsplanung ist fällig',
            'body': 'Zeit, die Haushaltsaufgaben für nächste Woche zu planen.',
        },
        'meal_planning_due': {
            'subject': 'Kochplanung für nächste Woche ist fällig',
            'body': 'Zeit, die Mahlzeiten für nächste Woche zu planen.',
        },
        'cooking_today': {
            'subject': 'Heute kochen wir: {title}',
            'body': 'Heute kochen wir {title}.',
        },
        'voucher_expiring_soon': {
            'subject': 'Gutschein läuft bald ab: {title}',
            'body': '„{title}“ läuft am {date} ab.',
        },
        'packing_trip_tomorrow': {
            'subject': 'Reise startet morgen: {title}',
            'body': '„{title}“ startet morgen.',
        },
    },
    'en': {
        'task_due_today': {
            'subject': 'Task due today: {title}',
            'body': '"{title}" is due today.',
        },
        'household_planning_due': {
            'subject': 'Weekly household planning is due',
            'body': "It's time to plan next week's household tasks.",
        },
        'meal_planning_due': {
            'subject': 'Meal planning for next week is due',
            'body': "It's time to plan next week's meals.",
        },
        'cooking_today': {
            'subject': "Cooking today: {title}",
            'body': "Today we're cooking {title}.",
        },
        'voucher_expiring_soon': {
            'subject': 'Voucher expiring soon: {title}',
            'body': '"{title}" expires on {date}.',
        },
        'packing_trip_tomorrow': {
            'subject': 'Trip starts tomorrow: {title}',
            'body': '"{title}" starts tomorrow.',
        },
    },
}

TEST_MESSAGES = {
    'de': {'subject': 'HUSEHOLD Test-Benachrichtigung', 'email': 'Das ist eine Test-E-Mail aus den HUSEHOLD-Einstellungen.',
           'push': 'Das ist eine Test-Push-Benachrichtigung.'},
    'en': {'subject': 'HUSEHOLD test notification', 'email': 'This is a test email from HUSEHOLD notification settings.',
           'push': 'This is a test push notification.'},
}

DEFAULT_LANGUAGE = 'de'


def notification_language(user):
    """The language this user wants notifications in (their HouseholdMember
    setting); German for accounts without a member profile. Read straight
    from the database rather than through user.householdmember, so a change
    made a moment ago is never masked by a cached relation."""
    language = HouseholdMember.objects.filter(user=user).values_list('notification_language', flat=True).first()
    return language if language in NOTIFICATION_MESSAGES else DEFAULT_LANGUAGE


# Which notification type a task produces, by its system_action; anything not
# listed is an ordinary task ('task_due_today').
NOTIFICATION_TYPE_BY_SYSTEM_ACTION = {
    'weekly_household_planning': 'household_planning_due',
    'weekly_meal_planning': 'meal_planning_due',
    'cook_meal': 'cooking_today',
}


def _recipients(instance):
    """The assignee. A cook task nobody has claimed yet goes to the whole
    household instead -- "we're cooking X today" is news for everyone."""
    if instance.assigned_to_id:
        return [instance.assigned_to]
    if instance.system_action == 'cook_meal':
        return list(User.objects.filter(householdmember__isnull=False))
    return []


def notify_task_due(instance):
    """Sends email/push for a due HouseholdTaskInstance to its recipients,
    according to each user's NotificationPreference for the matching type.
    Safe to call repeatedly -- NotificationLog rows make each (instance,
    user, type, channel) combination a one-time send."""
    notification_type = NOTIFICATION_TYPE_BY_SYSTEM_ACTION.get(instance.system_action, 'task_due_today')
    title = instance.definition.title if instance.definition else instance.standalone_title

    for user in _recipients(instance):
        # Worded per recipient, so a household can read them in two languages.
        messages = NOTIFICATION_MESSAGES[notification_language(user)][notification_type]
        subject = messages['subject'].format(title=title)
        body = messages['body'].format(title=title)
        pref, _ = NotificationPreference.objects.get_or_create(user=user, notification_type=notification_type)

        if pref.email_enabled and user.email:
            _send_once(user, notification_type, 'email', lambda u=user: _send_email(u, subject, body), task_instance=instance)

        if pref.push_enabled:
            subscriptions = list(PushSubscription.objects.filter(user=user))
            if subscriptions:
                _send_once(
                    user, notification_type, 'push',
                    lambda subs=subscriptions: _send_push_all(subs, subject, body),
                    task_instance=instance,
                )


def notify_voucher_expiring(voucher):
    """Sends a one-time heads-up to every household member that `voucher`
    is now within its expiring-soon window (see send_notifications for the
    30-day check) -- vouchers aren't per-user, so unlike a task this goes to
    everyone regardless of who's assigned anything. Safe to call repeatedly;
    NotificationLog's reference_key makes it a one-time send per voucher."""
    notification_type = 'voucher_expiring_soon'
    reference_key = f'voucher:{voucher.id}'
    date_str = voucher.valid_until.strftime('%d.%m.%Y')

    for user in User.objects.filter(householdmember__isnull=False):
        messages = NOTIFICATION_MESSAGES[notification_language(user)][notification_type]
        subject = messages['subject'].format(title=voucher.title)
        body = messages['body'].format(title=voucher.title, date=date_str)
        pref, _ = NotificationPreference.objects.get_or_create(user=user, notification_type=notification_type)

        if pref.email_enabled and user.email:
            _send_once(user, notification_type, 'email', lambda u=user: _send_email(u, subject, body), reference_key=reference_key)
        if pref.push_enabled:
            subscriptions = list(PushSubscription.objects.filter(user=user))
            if subscriptions:
                _send_once(
                    user, notification_type, 'push',
                    lambda subs=subscriptions: _send_push_all(subs, subject, body),
                    reference_key=reference_key,
                )


def notify_trip_tomorrow(packing_list):
    """Sends a one-time "starts tomorrow" heads-up to a packing list's own
    participants (not the whole household -- a trip only involves whoever's
    going). Safe to call repeatedly, same reference_key dedup as above."""
    notification_type = 'packing_trip_tomorrow'
    reference_key = f'packing_list:{packing_list.id}'
    participants = User.objects.filter(packinglistparticipant__packing_list=packing_list)

    for user in participants:
        messages = NOTIFICATION_MESSAGES[notification_language(user)][notification_type]
        subject = messages['subject'].format(title=packing_list.name)
        body = messages['body'].format(title=packing_list.name)
        pref, _ = NotificationPreference.objects.get_or_create(user=user, notification_type=notification_type)

        if pref.email_enabled and user.email:
            _send_once(user, notification_type, 'email', lambda u=user: _send_email(u, subject, body), reference_key=reference_key)
        if pref.push_enabled:
            subscriptions = list(PushSubscription.objects.filter(user=user))
            if subscriptions:
                _send_once(
                    user, notification_type, 'push',
                    lambda subs=subscriptions: _send_push_all(subs, subject, body),
                    reference_key=reference_key,
                )


def send_test_email(user):
    """Used by the Settings 'send test email' button -- a manual one-off
    check, so unlike notify_task_due it doesn't touch NotificationLog."""
    texts = TEST_MESSAGES[notification_language(user)]
    return _send_email(user, texts['subject'], texts['email'])


def send_test_push(user):
    """Used by the Settings 'send test push' button -- see send_test_email."""
    subscriptions = list(PushSubscription.objects.filter(user=user))
    texts = TEST_MESSAGES[notification_language(user)]
    return _send_push_all(subscriptions, texts['subject'], texts['push'])


def _send_once(user, notification_type, channel, send_fn, *, task_instance=None, reference_key=''):
    """Exactly one of task_instance/reference_key identifies what this
    notification is about -- see NotificationLog's docstring for why there
    are two dedup keys instead of one."""
    filters = {'user': user, 'notification_type': notification_type, 'channel': channel}
    filters.update({'task_instance': task_instance} if task_instance is not None else {'reference_key': reference_key})
    if NotificationLog.objects.filter(**filters).exists():
        return
    if send_fn():
        NotificationLog.objects.create(task_instance=task_instance, reference_key=reference_key, **{
            k: v for k, v in filters.items() if k not in ('task_instance', 'reference_key')
        })


def _send_email(user, subject, body):
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
        return True
    except Exception:
        logger.exception('Failed to send notification email to %s', user.email)
        return False


def _send_push_all(subscriptions, title, body):
    sent_any = False
    for subscription in subscriptions:
        if _send_push_one(subscription, title, body):
            sent_any = True
    return sent_any


def _send_push_one(subscription, title, body):
    try:
        webpush(
            subscription_info={
                'endpoint': subscription.endpoint,
                'keys': {'p256dh': subscription.p256dh_key, 'auth': subscription.auth_key},
            },
            data=json.dumps({'title': title, 'body': body}),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={'sub': f'mailto:{settings.VAPID_ADMIN_EMAIL}'},
        )
        return True
    except WebPushException as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        if status_code in (404, 410):
            # Endpoint no longer valid (browser unsubscribed / uninstalled) -- stop trying it.
            subscription.delete()
        else:
            logger.warning('Push failed for subscription %s: %s', subscription.id, exc)
        return False
