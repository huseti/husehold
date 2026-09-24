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
        standalone_title=entry.display_title,
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
    # Free dishes (ready meals, takeaway...) get a task too -- someone still
    # has to make them -- they just have no recipe to log.
    entries = CookingPlanEntry.objects.filter(
        kind__in=('cook', 'free'), task_instance__isnull=True, date__gte=start, date__lte=end,
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
    task.standalone_title = entry.display_title
    if task.scheduled_date != entry.date or task.is_in_backlog:
        task.scheduled_date = entry.date
        task.is_in_backlog = False
    task.save()


def log_cooked(instance, user, today=None):
    """Ticking a cook task off: log what was cooked. Dated the planned day
    (or today, if that's still ahead) so a tick-off the next morning still
    counts for the right evening."""
    entry = get_cooking_entry(instance)
    # A free dish has no recipe, so there's nothing to put in the cooking log.
    if entry is None or entry.recipe_id is None or entry.meal_event_id is not None:
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
    shift_entry_and_leftovers(entry, copy.scheduled_date)
    entry.task_instance = copy
    entry.save(update_fields=['task_instance'])


def restore_after_unsnooze(instance):
    """Undoing a snooze deletes the copy -- hand the dish back to the original
    first, or the delete would cascade into the meal plan."""
    for copy in instance.snoozed_copies.filter(status='pending', is_in_backlog=True):
        entry = get_cooking_entry(copy)
        if entry is not None:
            shift_entry_and_leftovers(entry, instance.scheduled_date)
            entry.task_instance = instance
            entry.save(update_fields=['task_instance'])


def sync_entry_date(instance):
    """A cook task dragged to another day (household plan) moves the dish with
    it. Dragging it into the backlog lane leaves the planned day as it was."""
    entry = get_cooking_entry(instance)
    if entry is None or instance.is_in_backlog or entry.date == instance.scheduled_date:
        return
    entry.date = instance.scheduled_date
    entry.save(update_fields=['date'])


def slot(date, meal_category):
    """Position of a meal in time: day first, then the meal's own order within
    the day (breakfast < lunch < dinner). The id only breaks ties between two
    meal types configured with the same sort_order."""
    return (date, meal_category.sort_order, meal_category.id)


def leftovers_out_of_order(entry, new_date, new_meal):
    """Leftovers only make sense *after* the dish they come from: a later day,
    or the same day at a later meal. Returns True if putting `entry` at
    (new_date, new_meal) would break that -- for a leftovers entry against its
    dish, for a dish against any of its leftovers."""
    new_slot = slot(new_date, new_meal)
    if entry.kind == 'leftovers':
        source = entry.source_entry
        return source is not None and new_slot <= slot(source.date, source.meal_category)
    return any(
        new_slot >= slot(leftover.date, leftover.meal_category)
        for leftover in entry.leftover_entries.select_related('meal_category')
    )


def shift_entry_and_leftovers(entry, new_date):
    """Moves a dish to another day and takes its leftovers along by the same
    number of days, so their order to each other never changes (used when a
    snooze carries the dish into next week)."""
    delta = new_date - entry.date
    entry.date = new_date
    entry.save(update_fields=['date'])
    for leftover in entry.leftover_entries.all():
        leftover.date = leftover.date + delta
        leftover.save(update_fields=['date'])
