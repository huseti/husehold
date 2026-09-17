from datetime import datetime, timedelta

from dateutil.rrule import rrulestr
from django.contrib.auth.models import User
from django.utils import timezone as dj_timezone

from ..models import HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent


def monday_of_week_as_datetime(a_date):
    """The Monday of a_date's week, as a timezone-aware datetime at
    midnight -- used as the "created" timestamp for auto-generated
    instances (recurring occurrences, snooze copies), so it reflects which
    week's batch a task belongs to rather than the real moment a request
    happened to trigger its generation."""
    monday = a_date - timedelta(days=a_date.weekday())
    return dj_timezone.make_aware(datetime.combine(monday, datetime.min.time()))


def _resolve_assignee(definition):
    """Who a newly generated instance should default to, based on the
    definition's assignment_mode:
      - fixed: always the same configured member
      - alternating: rotates through household members, based on who the
        most recent instance of this definition was assigned to. If that
        most recent instance was *skipped* rather than completed, the
        rotation does not advance -- the same person keeps it next time.
      - none: left unassigned -- decided during weekly planning
    """
    if definition.assignment_mode == 'fixed':
        return definition.default_assignee
    if definition.assignment_mode == 'alternating':
        members = list(User.objects.filter(householdmember__isnull=False).order_by('householdmember__id'))
        if not members:
            return None
        last_instance = definition.instances.order_by('-occurrence_date', '-id').first()
        if last_instance is None:
            return members[0]
        if last_instance.status == 'skipped':
            return last_instance.assigned_to or members[0]
        try:
            index = members.index(last_instance.assigned_to)
        except ValueError:
            index = -1
        return members[(index + 1) % len(members)]
    return None


def generate_instances_for_range(start_date, end_date):
    """Ensure a HouseholdTaskInstance exists for every occurrence of every
    HouseholdTaskDefinition's recurrence rule within [start_date, end_date].
    Idempotent -- safe to call repeatedly for overlapping ranges. Keys on
    occurrence_date (the rule's natural, immutable date), not the mutable
    scheduled_date, so postponing/snoozing an instance elsewhere doesn't
    make its original slot look unfulfilled and get regenerated.
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
            occurrence_date = occurrence.date()
            instance, was_created = HouseholdTaskInstance.objects.get_or_create(
                definition=definition,
                occurrence_date=occurrence_date,
                defaults={
                    'scheduled_date': occurrence_date,
                    'assigned_to': _resolve_assignee(definition),
                    'is_in_backlog': not definition.has_preferred_day,
                    'created_at': monday_of_week_as_datetime(occurrence_date),
                    'system_action': definition.system_action,
                },
            )
            if was_created:
                HouseholdTaskEvent.objects.create(task_instance=instance, event_type='created')
                created.append(instance)
    return created
