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
            _send_once(instance, user, notification_type, 'email', lambda u=user: _send_email(u, subject, body))

        if pref.push_enabled:
            subscriptions = list(PushSubscription.objects.filter(user=user))
            if subscriptions:
                _send_once(
                    instance, user, notification_type, 'push',
                    lambda subs=subscriptions: _send_push_all(subs, subject, body),
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


def _send_once(instance, user, notification_type, channel, send_fn):
    already_sent = NotificationLog.objects.filter(
        task_instance=instance, user=user, notification_type=notification_type, channel=channel,
    ).exists()
    if already_sent:
        return
    if send_fn():
        NotificationLog.objects.create(
            task_instance=instance, user=user, notification_type=notification_type, channel=channel,
        )


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
