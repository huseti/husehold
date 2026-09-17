from datetime import datetime

from dateutil.rrule import rrulestr

from ..models import HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent


def generate_instances_for_range(start_date, end_date):
    """Ensure a HouseholdTaskInstance exists for every occurrence of every
    HouseholdTaskDefinition's recurrence rule within [start_date, end_date].
    Idempotent -- safe to call repeatedly for overlapping ranges.
    """
    created = []
    for definition in HouseholdTaskDefinition.objects.all():
        dtstart = datetime.combine(definition.starts_on, datetime.min.time())
        rule = rrulestr(definition.recurrence_rule, dtstart=dtstart)
        occurrences = rule.between(
            datetime.combine(start_date, datetime.min.time()),
            datetime.combine(end_date, datetime.max.time()),
            inc=True,
        )
        for occurrence in occurrences:
            instance, was_created = HouseholdTaskInstance.objects.get_or_create(
                definition=definition,
                scheduled_date=occurrence.date(),
                defaults={'assigned_to': definition.default_assignee},
            )
            if was_created:
                HouseholdTaskEvent.objects.create(task_instance=instance, event_type='created')
                created.append(instance)
    return created
