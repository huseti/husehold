import json
import logging

from django.conf import settings
from django.core.mail import send_mail

from pywebpush import webpush, WebPushException

from ..models import NotificationPreference, PushSubscription, NotificationLog

logger = logging.getLogger(__name__)

# Keyed by NotificationPreference.NOTIFICATION_TYPE_CHOICES -- add an entry
# here whenever a new notification type is introduced.
NOTIFICATION_MESSAGES = {
    'task_due_today': {
        'subject': 'Task due today: {title}',
        'body': '"{title}" is due today.',
    },
    'household_planning_due': {
        'subject': "Weekly household planning is due",
        'body': "It's time to plan next week's household tasks.",
    },
}


def notify_task_due(instance):
    """Sends email/push for a due HouseholdTaskInstance to its assignee,
    according to that user's NotificationPreference for the matching type.
    Safe to call repeatedly -- NotificationLog rows make each (instance,
    user, type, channel) combination a one-time send."""
    if not instance.assigned_to_id:
        return

    notification_type = (
        'household_planning_due' if instance.system_action == 'weekly_household_planning'
        else 'task_due_today'
    )
    user = instance.assigned_to
    title = instance.definition.title if instance.definition else instance.standalone_title
    messages = NOTIFICATION_MESSAGES[notification_type]
    subject = messages['subject'].format(title=title)
    body = messages['body'].format(title=title)

    pref, _ = NotificationPreference.objects.get_or_create(user=user, notification_type=notification_type)

    if pref.email_enabled and user.email:
        _send_once(instance, user, notification_type, 'email', lambda: _send_email(user, subject, body))

    if pref.push_enabled:
        subscriptions = list(PushSubscription.objects.filter(user=user))
        if subscriptions:
            _send_once(instance, user, notification_type, 'push', lambda: _send_push_all(subscriptions, subject, body))


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
