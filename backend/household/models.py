from django.db import models
from django.contrib.auth.models import User

from .mixins import AuditableMixin

class HouseholdMember(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=50, choices=[
        ('admin', 'Admin'),
        ('member', 'Member'),
    ], default='member')
    color_hex = models.CharField(
        max_length=7, default='#5b7a5e',
        help_text="Used to color this member's cards in the weekly household plan view.",
    )
    joined_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"

class ShoppingListItem(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

class Recipe(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    ingredients = models.TextField()
    instructions = models.TextField()
    prep_time = models.IntegerField(help_text="Preparation time in minutes", null=True, blank=True)
    cook_time = models.IntegerField(help_text="Cooking time in minutes", null=True, blank=True)
    servings = models.IntegerField(default=1)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title

class CookingPlan(models.Model):
    date = models.DateField()
    meal_type = models.CharField(max_length=50, choices=[
        ('breakfast', 'Breakfast'),
        ('lunch', 'Lunch'),
        ('dinner', 'Dinner'),
        ('snack', 'Snack'),
    ])
    recipe = models.ForeignKey(Recipe, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'meal_type']

    def __str__(self):
        return f"{self.date} - {self.meal_type}"

class HouseholdTaskDefinition(AuditableMixin):
    """A recurring task template. Expanded into HouseholdTaskInstance rows by
    household.services.task_generation, using recurrence_rule as an RFC 5545
    RRULE string (see dateutil.rrule.rrulestr) rather than bespoke interval
    fields -- this is what makes "first Monday of the month" free to support.
    """
    SYSTEM_ACTION_CHOICES = [
        ('none', 'None'),
        ('weekly_household_planning', 'Weekly household planning'),
        ('weekly_meal_planning', 'Weekly meal planning'),
    ]

    # Flat, single-color icon set for the weekly view -- keep additions in
    # this same style (simple silhouette, no gradients/multi-color) rather
    # than mixing icon styles.
    ICON_CHOICES = [
        ('cleaning', 'Cleaning'),
        ('trash', 'Trash'),
        ('coffee', 'Coffee'),
        ('laundry', 'Laundry'),
        ('dishes', 'Dishes'),
        ('vacuum', 'Vacuum'),
        ('shopping', 'Shopping'),
        ('plant', 'Plant'),
        ('pet', 'Pet'),
        ('tool', 'Repair'),
        ('bed', 'Bed'),
        ('calendar', 'Calendar'),
        ('other', 'Other'),
    ]

    ASSIGNMENT_MODE_CHOICES = [
        ('fixed', 'Fixed member'),
        ('alternating', 'Alternate between members'),
        ('none', 'Decide during planning'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=20, choices=ICON_CHOICES, default='other')
    starts_on = models.DateField(help_text="Anchor date the recurrence rule is expanded from.")
    recurrence_rule = models.CharField(
        max_length=500,
        help_text="RFC 5545 RRULE string, e.g. FREQ=WEEKLY;BYDAY=MO or FREQ=MONTHLY;BYDAY=1MO",
    )
    assignment_mode = models.CharField(max_length=15, choices=ASSIGNMENT_MODE_CHOICES, default='none')
    default_assignee = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='default_assigned_task_definitions',
        help_text="Only used when assignment_mode is 'fixed'.",
    )
    system_action = models.CharField(max_length=30, choices=SYSTEM_ACTION_CHOICES, default='none')
    reminder_time = models.TimeField(
        null=True, blank=True,
        help_text="Time of day this recurs at -- currently only surfaced for the weekly planning reminder; not yet wired to notifications.",
    )

    class Meta:
        ordering = ['title']

    def __str__(self):
        return self.title


class HouseholdTaskInstance(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('done', 'Done'),
        ('snoozed', 'Snoozed'),
    ]

    definition = models.ForeignKey(HouseholdTaskDefinition, on_delete=models.CASCADE, related_name='instances')
    scheduled_date = models.DateField()
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='task_instances')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['scheduled_date']
        unique_together = ('definition', 'scheduled_date')

    def __str__(self):
        return f"{self.definition.title} - {self.scheduled_date}"


class HouseholdTaskEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ('created', 'Created'),
        ('reassigned', 'Reassigned'),
        ('snoozed', 'Snoozed'),
        ('postponed', 'Postponed'),
        ('completed', 'Completed'),
    ]

    task_instance = models.ForeignKey(HouseholdTaskInstance, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=15, choices=EVENT_TYPE_CHOICES)
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.task_instance} - {self.event_type}"
