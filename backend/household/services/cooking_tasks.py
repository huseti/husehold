"""Glue between the meal plan and the task engine ("one entry = one task").

A cook entry owns one HouseholdTaskInstance (system_action='cook_meal',
standalone -- no recurring definition). These helpers create it, keep it in
step with the entry, and turn ticking it off into a MealEvent.
"""
from django.utils import timezone

from ..models import (
    CookingPlanEntry, HouseholdTaskEvent, HouseholdTaskInstance, MealEvent,
)
from .task_generation import monday_of_week_as_datetime


def get_cooking_entry(instance):
    """The cook entry a task belongs to, or None for every other kind of task."""
    try:
        return instance.cooking_entry
    except CookingPlanEntry.DoesNotExist:
        return None


def create_cook_task(entry, user):
    instance = HouseholdTaskInstance.objects.create(
        standalone_title=entry.recipe.title,
        standalone_icon='cooking',
        system_action='cook_meal',
        occurrence_date=entry.date,
        scheduled_date=entry.date,
        created_by=user,
        created_at=monday_of_week_as_datetime(entry.date),
    )
    HouseholdTaskEvent.objects.create(task_instance=instance, event_type='created', actor=user)
    entry.task_instance = instance
    entry.save(update_fields=['task_instance'])
    return instance


def finalize_range(start, end, user):
    """Creates the cook task for every cook entry in [start, end] that has
    none yet. Idempotent -- safe to run again after adding a dish."""
    entries = CookingPlanEntry.objects.filter(
        kind='cook', task_instance__isnull=True, date__gte=start, date__lte=end,
    ).select_related('recipe')
    count = 0
    for entry in entries:
        create_cook_task(entry, user)
        count += 1
    return count


def sync_task_from_entry(entry):
    """After an entry was edited: mirror title/day onto its still-open task.
    occurrence_date is left alone on purpose, as everywhere in the task engine."""
    task = entry.task_instance
    if task is None or task.status != 'pending':
        return
    task.standalone_title = entry.recipe.title
    if task.scheduled_date != entry.date or task.is_in_backlog:
        task.scheduled_date = entry.date
        task.is_in_backlog = False
    task.save()


def log_cooked(instance, user, today=None):
    """Ticking a cook task off: log what was cooked. Dated the planned day
    (or today, if that's still ahead) so a tick-off the next morning still
    counts for the right evening."""
    entry = get_cooking_entry(instance)
    if entry is None or entry.meal_event_id is not None:
        return
    today = today or timezone.localdate()
    event = MealEvent.objects.create(
        recipe=entry.recipe, date_cooked=min(entry.date, today),
        servings_made=entry.servings, logged_by=user,
    )
    entry.meal_event = event
    entry.save(update_fields=['meal_event'])


def undo_cooked(instance):
    entry = get_cooking_entry(instance)
    if entry is None or entry.meal_event_id is None:
        return
    entry.meal_event.delete()
    entry.meal_event = None


def follow_snooze(instance, copy):
    """Snoozing a cook task moves the dish along with it to the open copy in
    next week's backlog (the frozen original stays behind as a marker)."""
    entry = get_cooking_entry(instance)
    if entry is None:
        return
    entry.task_instance = copy
    entry.date = copy.scheduled_date
    entry.save(update_fields=['task_instance', 'date'])


def restore_after_unsnooze(instance):
    """Undoing a snooze deletes the copy -- hand the dish back to the original
    first, or the delete would cascade into the meal plan."""
    for copy in instance.snoozed_copies.filter(status='pending', is_in_backlog=True):
        entry = get_cooking_entry(copy)
        if entry is not None:
            entry.task_instance = instance
            entry.date = instance.scheduled_date
            entry.save(update_fields=['task_instance', 'date'])


def sync_entry_date(instance):
    """A cook task dragged to another day (household plan) moves the dish with
    it. Dragging it into the backlog lane leaves the planned day as it was."""
    entry = get_cooking_entry(instance)
    if entry is None or instance.is_in_backlog or entry.date == instance.scheduled_date:
        return
    entry.date = instance.scheduled_date
    entry.save(update_fields=['date'])
