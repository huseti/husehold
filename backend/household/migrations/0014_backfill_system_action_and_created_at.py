from datetime import datetime, timedelta

from django.db import migrations
from django.utils import timezone as dj_timezone


def monday_of_week_as_datetime(a_date):
    monday = a_date - timedelta(days=a_date.weekday())
    return dj_timezone.make_aware(datetime.combine(monday, datetime.min.time()))


def backfill(apps, schema_editor):
    HouseholdTaskInstance = apps.get_model('household', 'HouseholdTaskInstance')

    # system_action: 0013 added the column with default='none' for every
    # existing row -- rows generated from a recurring definition need it
    # copied from that definition instead (this is what makes the frontend
    # recognize/translate a snoozed weekly-planning task correctly).
    for instance in HouseholdTaskInstance.objects.filter(definition__isnull=False):
        correct_value = instance.definition.system_action
        if instance.system_action != correct_value:
            instance.system_action = correct_value
            instance.save(update_fields=['system_action'])

    # A snooze copy (origin_instance set, definition null) should carry the
    # same system_action as the instance it was snoozed from.
    for instance in HouseholdTaskInstance.objects.filter(definition__isnull=True, origin_instance__isnull=False):
        correct_value = instance.origin_instance.system_action
        if instance.system_action != correct_value:
            instance.system_action = correct_value
            instance.save(update_fields=['system_action'])

    # created_at: before this field stopped being auto_now_add, every
    # auto-generated instance (has a definition, or is a snooze copy) got
    # the real moment a request happened to trigger its generation, instead
    # of the Monday of its own week. Recompute those; leave standalone
    # (manually created, no definition and no origin_instance) tasks alone
    # -- their real creation timestamp is already correct.
    auto_generated = HouseholdTaskInstance.objects.filter(definition__isnull=False) | \
        HouseholdTaskInstance.objects.filter(origin_instance__isnull=False)
    for instance in auto_generated.distinct():
        instance.created_at = monday_of_week_as_datetime(instance.occurrence_date)
        instance.save(update_fields=['created_at'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('household', '0013_householdtaskinstance_origin_instance_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
