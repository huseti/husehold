from datetime import datetime

from dateutil.rrule import rrulestr
from django.contrib.auth.models import User

from ..models import HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent


def _resolve_assignee(definition):
    """Who a newly generated instance should default to, based on the
    definition's assignment_mode:
      - fixed: always the same configured member
      - alternating: rotates through household members in order, based on
        how many instances of this definition already exist
      - none: left unassigned -- decided during weekly planning
    """
    if definition.assignment_mode == 'fixed':
        return definition.default_assignee
    if definition.assignment_mode == 'alternating':
        members = list(User.objects.filter(householdmember__isnull=False).order_by('householdmember__id'))
        if not members:
            return None
        index = definition.instances.count() % len(members)
        return members[index]
    return None


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
                defaults={'assigned_to': _resolve_assignee(definition)},
            )
            if was_created:
                HouseholdTaskEvent.objects.create(task_instance=instance, event_type='created')
                created.append(instance)
    return created
