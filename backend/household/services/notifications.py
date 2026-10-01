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
        'task_overdue': {
            'subject': 'Aufgabe überfällig: {title}',
            'body': '„{title}“ ist überfällig.',
        },
        'voucher_expiring_soon': {
            'subject': 'Gutschein läuft bald ab: {title}',
            'body': '„{title}“ läuft am {date} ab.',
        },
        'packing_trip_tomorrow': {
            'subject': 'Reise startet morgen: {title}',
            'body': '„{title}“ startet morgen.',
        },
        'shopping_purchased': {
            'subject': 'Einkauf wurde getätigt: {list_name}',
            'body': 'Auf „{list_name}“ wurden gerade Artikel abgehakt.',
        },
        'shopping_items_added': {
            'subject': 'Neue Artikel auf der Einkaufsliste: {list_name}',
            'body': 'Auf „{list_name}“ wurden gerade neue Artikel hinzugefügt.',
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
        'task_overdue': {
            'subject': 'Task overdue: {title}',
            'body': '"{title}" is overdue.',
        },
        'voucher_expiring_soon': {
            'subject': 'Voucher expiring soon: {title}',
            'body': '"{title}" expires on {date}.',
        },
        'packing_trip_tomorrow': {
            'subject': 'Trip starts tomorrow: {title}',
            'body': '"{title}" starts tomorrow.',
        },
        'shopping_purchased': {
            'subject': 'Shopping done: {list_name}',
            'body': 'Items were just checked off on "{list_name}".',
        },
        'shopping_items_added': {
            'subject': 'New items on the shopping list: {list_name}',
            'body': 'New items were just added to "{list_name}".',
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


# System actions whose notifications always go to the whole household, even
# when the instance itself is assigned to one member via the normal rotation
# -- these are shared planning chores, not personal ones. cook_meal is
# deliberately NOT here: an assigned cook task only tells the cook (see
# _recipients below); only an unclaimed one goes to everyone.
ALWAYS_WHOLE_HOUSEHOLD_ACTIONS = {'weekly_household_planning', 'weekly_meal_planning'}


def _household():
    return list(User.objects.filter(householdmember__isnull=False))


def _recipients(instance):
    """The assignee, for an ordinary assigned task. Everyone in the
    household instead for: the shared planning system actions regardless of
    assignment, a cook task nobody has claimed yet ("we're cooking X today"
    is news for everyone), and any other task with nobody assigned (previously
    these got no recipients at all -- an unassigned task is everyone's to
    pick up, so everyone should hear about it)."""
    if instance.assigned_to_id and instance.system_action not in ALWAYS_WHOLE_HOUSEHOLD_ACTIONS:
        return [instance.assigned_to]
    return _household()


def _shopping_list_recipients(shopping_list):
    """Whoever can see the list (visible_to), or the whole household if it's
    not restricted -- same "empty means everyone" rule as the list itself."""
    restricted = list(shopping_list.visible_to.all())
    return restricted if restricted else _household()


def _notify(user, notification_type, subject, body, *, task_instance=None, reference_key=''):
    """Looks up this user's preference for notification_type and sends on
    whichever of email/push they've enabled, via _send_once so repeated
    calls (the cron re-scanning the same tasks/vouchers/etc. every tick)
    never double-send."""
    pref, _ = NotificationPreference.objects.get_or_create(user=user, notification_type=notification_type)
    if pref.email_enabled and user.email:
        _send_once(user, notification_type, 'email', lambda: _send_email(user, subject, body),
                   task_instance=task_instance, reference_key=reference_key)
    if pref.push_enabled:
        subscriptions = list(PushSubscription.objects.filter(user=user))
        if subscriptions:
            _send_once(user, notification_type, 'push', lambda: _send_push_all(subscriptions, subject, body),
                       task_instance=task_instance, reference_key=reference_key)


def notify_task_due(instance):
    """Sends email/push for a due HouseholdTaskInstance to its recipients.
    Safe to call repeatedly -- NotificationLog rows make each (instance,
    user, type, channel) combination a one-time send."""
    notification_type = NOTIFICATION_TYPE_BY_SYSTEM_ACTION.get(instance.system_action, 'task_due_today')
    title = instance.definition.title if instance.definition else instance.standalone_title

    for user in _recipients(instance):
        # Worded per recipient, so a household can read them in two languages.
        messages = NOTIFICATION_MESSAGES[notification_language(user)][notification_type]
        _notify(user, notification_type, messages['subject'].format(title=title), messages['body'].format(title=title),
                task_instance=instance)


def notify_task_overdue(instance):
    """Same recipients/dedup pattern as notify_task_due, but for a task
    whose scheduled_date has already passed -- a separate, one-time "this is
    now overdue" heads-up rather than a repeat of the due-today message."""
    title = instance.definition.title if instance.definition else instance.standalone_title

    for user in _recipients(instance):
        messages = NOTIFICATION_MESSAGES[notification_language(user)]['task_overdue']
        _notify(user, 'task_overdue', messages['subject'].format(title=title), messages['body'].format(title=title),
                task_instance=instance)


def notify_voucher_expiring(voucher):
    """Sends a one-time heads-up to every household member that `voucher`
    is now within its expiring-soon window (see send_notifications for the
    30-day check) -- vouchers aren't per-user, so unlike a task this goes to
    everyone regardless of who's assigned anything. Safe to call repeatedly;
    NotificationLog's reference_key makes it a one-time send per voucher."""
    reference_key = f'voucher:{voucher.id}'
    date_str = voucher.valid_until.strftime('%d.%m.%Y')

    for user in _household():
        messages = NOTIFICATION_MESSAGES[notification_language(user)]['voucher_expiring_soon']
        _notify(
            user, 'voucher_expiring_soon',
            messages['subject'].format(title=voucher.title), messages['body'].format(title=voucher.title, date=date_str),
            reference_key=reference_key,
        )


def notify_trip_tomorrow(packing_list):
    """Sends a one-time "starts tomorrow" heads-up to a packing list's own
    participants (not the whole household -- a trip only involves whoever's
    going). Safe to call repeatedly, same reference_key dedup as above."""
    reference_key = f'packing_list:{packing_list.id}'

    for user in User.objects.filter(packinglistparticipant__packing_list=packing_list):
        messages = NOTIFICATION_MESSAGES[notification_language(user)]['packing_trip_tomorrow']
        _notify(
            user, 'packing_trip_tomorrow',
            messages['subject'].format(title=packing_list.name), messages['body'].format(title=packing_list.name),
            reference_key=reference_key,
        )


def notify_shopping_purchased(shopping_list, bucket):
    """One digest per shopping list per cron tick ("bucket" -- send_notifications
    rounds the current time down to the nearest 15 minutes so a manual re-run
    within the same tick doesn't double-send), for items ticked off somewhere
    in that list recently. Goes to whoever can see the list."""
    reference_key = f'shopping_purchased:{shopping_list.id}:{bucket}'

    for user in _shopping_list_recipients(shopping_list):
        messages = NOTIFICATION_MESSAGES[notification_language(user)]['shopping_purchased']
        _notify(
            user, 'shopping_purchased',
            messages['subject'].format(list_name=shopping_list.name), messages['body'].format(list_name=shopping_list.name),
            reference_key=reference_key,
        )


def notify_shopping_items_added(shopping_list, bucket):
    """Same idea as notify_shopping_purchased, for new items added recently."""
    reference_key = f'shopping_items_added:{shopping_list.id}:{bucket}'

    for user in _shopping_list_recipients(shopping_list):
        messages = NOTIFICATION_MESSAGES[notification_language(user)]['shopping_items_added']
        _notify(
            user, 'shopping_items_added',
            messages['subject'].format(list_name=shopping_list.name), messages['body'].format(list_name=shopping_list.name),
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
