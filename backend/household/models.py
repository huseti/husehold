from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.functions import Lower
from django.contrib.auth.models import User
from django.utils import timezone

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
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    joined_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"

class HouseholdSettings(AuditableMixin):
    """Singleton (always pk=1) -- household-wide settings like its display
    name and timezone, editable from Settings by any member. The timezone
    is activated per-request by household.middleware.HouseholdTimezoneMiddleware
    rather than being a static Django setting, since the household -- not
    the server -- is what a "today"/"overdue" comparison should follow."""
    household_name = models.CharField(max_length=100, default='Our Household')
    timezone = models.CharField(max_length=50, default='Europe/Berlin')

    def __str__(self):
        return self.household_name

class UnitOfMeasure(AuditableMixin):
    """A plain label (g, EL, Stk, ...) -- deliberately no conversion between
    units, see PLANNING.md 2b. Seeded by migration 0018, editable in config."""
    # German is the primary (required) language; English is an optional
    # translation and the UI falls back to German when it's blank.
    name_de = models.CharField(max_length=50, unique=True)
    name_en = models.CharField(max_length=50, blank=True)
    abbreviation_de = models.CharField(max_length=20, blank=True)
    abbreviation_en = models.CharField(max_length=20, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name_de']

    def __str__(self):
        return self.abbreviation_de or self.name_de


class Ingredient(AuditableMixin):
    """Shared ingredient catalogue. Created on the fly when a recipe (or
    shopping list item) names an ingredient that doesn't exist yet -- matched
    case-insensitively so "Zwiebel" and "zwiebel" don't become two rows."""
    name = models.CharField(max_length=100)
    # For staples like water or salt that shouldn't clutter a generated
    # shopping list. Consumed by the Cooking Plan's send-to-shopping-list step.
    default_excluded_from_shopping_list = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(Lower('name'), name='unique_ingredient_name_ci'),
        ]

    def __str__(self):
        return self.name


class Label(AuditableMixin):
    name_de = models.CharField(max_length=50)
    name_en = models.CharField(max_length=50, blank=True)
    color_hex = models.CharField(max_length=7, default='#5b7a5e')

    class Meta:
        ordering = ['name_de']
        constraints = [
            models.UniqueConstraint(Lower('name_de'), name='unique_label_name_ci'),
        ]

    def __str__(self):
        return self.name_de


class MealTimeCategory(AuditableMixin):
    """Breakfast / lunch / dinner / dessert... A recipe can belong to several.
    The Cooking Plan will rank recipes independently per category."""
    name_de = models.CharField(max_length=50)
    name_en = models.CharField(max_length=50, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name_de']
        verbose_name_plural = 'meal time categories'
        constraints = [
            models.UniqueConstraint(Lower('name_de'), name='unique_meal_category_name_ci'),
        ]

    def __str__(self):
        return self.name_de


class Recipe(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    prep_time = models.IntegerField(help_text="Preparation time in minutes", null=True, blank=True)
    cook_time = models.IntegerField(help_text="Cooking time in minutes", null=True, blank=True)
    servings = models.PositiveIntegerField(default=1)
    source_url = models.URLField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    categories = models.ManyToManyField(MealTimeCategory, blank=True, related_name='recipes')
    labels = models.ManyToManyField(Label, blank=True, related_name='recipes')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class RecipeIngredient(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ingredients')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name='recipe_lines')
    # Blank for "to taste" / "a pinch" style lines with no amount.
    quantity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    unit = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    note = models.CharField(max_length=200, blank=True, help_text='e.g. "finely chopped"')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"{self.quantity or ''} {self.unit or ''} {self.ingredient}".strip()


class RecipeRating(models.Model):
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='ratings')
    rated_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='+')
    score = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['recipe', 'rated_by'], name='one_rating_per_user_per_recipe'),
        ]

    def __str__(self):
        return f"{self.recipe.title}: {self.score}/5 by {self.rated_by.username}"


class MealEvent(models.Model):
    """One time a recipe was actually cooked. The Cooking Plan will derive
    "not cooked in a while" and its ranking from these rows, and a plan entry
    will later be marked fulfilled by one."""
    recipe = models.ForeignKey(Recipe, on_delete=models.CASCADE, related_name='meal_events')
    date_cooked = models.DateField(default=timezone.localdate)
    servings_made = models.PositiveIntegerField(default=1)
    logged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_cooked', '-id']

    def __str__(self):
        return f"{self.recipe.title} on {self.date_cooked}"


class ShoppingList(AuditableMixin):
    name = models.CharField(max_length=100)
    # The list the Cooking Plan writes into by default. At most one is the
    # favorite -- enforced in save() rather than a DB constraint so flipping
    # the flag on a new list atomically un-flags the old one.
    is_favorite_for_cooking_plan = models.BooleanField(default=False)
    # Empty means "visible to every member" -- with 2 users, restricting is
    # the exception (e.g. a private gift-ideas list), not the default.
    visible_to = models.ManyToManyField(User, blank=True, related_name='visible_shopping_lists')

    class Meta:
        ordering = ['-is_favorite_for_cooking_plan', 'name']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_favorite_for_cooking_plan:
            ShoppingList.objects.exclude(pk=self.pk).filter(
                is_favorite_for_cooking_plan=True,
            ).update(is_favorite_for_cooking_plan=False)

    def __str__(self):
        return self.name


class ShoppingListItem(models.Model):
    SOURCE_CHOICES = [
        ('manual', 'Manual'),
        ('cooking_plan', 'Cooking plan'),
    ]

    shopping_list = models.ForeignKey(ShoppingList, on_delete=models.CASCADE, related_name='items')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    unit = models.ForeignKey(UnitOfMeasure, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
    is_completed = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['is_completed', '-created_at']

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

class PurchaseRecord(models.Model):
    """One purchase, logged when a shopping list item is ticked off. A
    snapshot (title/quantity/list name are copied) so the history survives the
    item being deleted or the completed items being cleared; `item` only
    exists to undo the record if the tick is taken back."""
    title = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    unit = models.ForeignKey(UnitOfMeasure, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    # The list is what history is browsed by; list_name is a snapshot for
    # display if the list is later renamed or deleted (shopping_list -> NULL).
    shopping_list = models.ForeignKey(ShoppingList, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_records')
    list_name = models.CharField(max_length=100, blank=True)
    purchased_on = models.DateField(default=timezone.localdate)
    purchased_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    item = models.ForeignKey(ShoppingListItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_records')

    class Meta:
        ordering = ['-purchased_on', '-id']

    def __str__(self):
        return f"{self.title} on {self.purchased_on}"


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
    has_preferred_day = models.BooleanField(
        default=True,
        help_text="If false, occurrences land in the backlog (no day) until dragged onto one during planning.",
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
        ('skipped', 'Skipped'),
        ('snoozed', 'Snoozed'),
    ]

    # Nullable so a one-off task (created via the "+" button, not from any
    # recurring definition) can be a plain HouseholdTaskInstance too --
    # standalone_title/standalone_icon carry its identity in that case.
    definition = models.ForeignKey(
        HouseholdTaskDefinition, on_delete=models.CASCADE, null=True, blank=True, related_name='instances',
    )
    standalone_title = models.CharField(max_length=200, blank=True)
    standalone_icon = models.CharField(max_length=20, choices=HouseholdTaskDefinition.ICON_CHOICES, blank=True)
    # Copied from definition.system_action at creation time (by generation
    # or by the snooze copy below) rather than looked up live through
    # definition -- a snooze copy has definition=None, so without its own
    # copy of this the frontend couldn't tell a snoozed "weekly planning"
    # task apart from a plain standalone one, and would show its raw stored
    # (English) title instead of translating it.
    system_action = models.CharField(
        max_length=30, choices=HouseholdTaskDefinition.SYSTEM_ACTION_CHOICES, default='none',
    )
    # Set only on a snooze copy, pointing back at the instance it was
    # snoozed from -- lets reopen() clean up the copy if the original
    # snooze gets undone, instead of leaving an orphaned copy behind.
    origin_instance = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='snoozed_copies',
    )

    # occurrence_date is the date the recurrence rule actually computed for
    # this occurrence, and never changes -- it's what get_or_create() in
    # task_generation keys on, so that dragging an instance to a different
    # scheduled_date (postpone) doesn't leave its "natural" slot looking
    # unfulfilled and get a fresh duplicate generated into it later.
    # scheduled_date is the mutable, displayed date and is what postpone/
    # snooze actually change.
    occurrence_date = models.DateField()
    scheduled_date = models.DateField()
    is_in_backlog = models.BooleanField(
        default=False,
        help_text="Shown in the backlog lane (no day yet) instead of under scheduled_date's weekday.",
    )

    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='task_instances')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    completed_at = models.DateTimeField(null=True, blank=True)
    # Only set for standalone (one-off) tasks, via perform_create -- instances
    # generated from a recurring definition are created by the recurrence
    # engine itself (task_generation.generate_instances_for_range), not a
    # specific user action, so this is left blank for those.
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_task_instances',
    )
    # Not auto_now_add: for auto-generated instances (recurring occurrences,
    # snooze copies), task_generation/views explicitly set this to the
    # Monday of the instance's own week rather than the real moment the row
    # was inserted -- "created" should reflect which week's batch a task
    # belongs to, not when someone happened to load the calendar. Manually
    # created (standalone, via the "+" button) instances just get the
    # real current moment, which is what the default gives them.
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['scheduled_date']
        unique_together = ('definition', 'occurrence_date')

    def __str__(self):
        title = self.definition.title if self.definition else self.standalone_title
        return f"{title} - {self.scheduled_date}"


class Voucher(AuditableMixin):
    """A gift/store voucher -- monetary (total_value set, redeemed down to 0
    over time via VoucherRedemption) or non-monetary (total_value left blank,
    e.g. a dinner invitation -- just used once and archived). Independent of
    every other domain, see PLANNING.md 2e."""
    title = models.CharField(max_length=200)
    received_from = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=200, blank=True)
    currency = models.CharField(max_length=3, default='EUR')
    total_value = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    # Kept in sync by VoucherViewSet.redeem() as redemptions are logged, so
    # the UI can show a current balance without replaying the redemption log.
    remaining_balance = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)
    # Set automatically once remaining_balance hits 0 (or immediately, for a
    # non-monetary voucher's single redemption) -- see VoucherViewSet.redeem().
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ['valid_until']

    def __str__(self):
        return self.title


class VoucherRedemption(models.Model):
    voucher = models.ForeignKey(Voucher, on_delete=models.CASCADE, related_name='redemptions')
    redeemed_on = models.DateField(default=timezone.localdate)
    # Both blank for a non-monetary voucher's single "mark used" entry --
    # there's no balance to log a before/after snapshot of.
    amount_used = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    remaining_after = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    logged_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-redeemed_on', '-id']

    def __str__(self):
        return f"{self.voucher.title} - {self.redeemed_on}"


class NotificationPreference(models.Model):
    """Per-user, per-type opt-in for each delivery channel. Rows are created
    on demand (get_or_create) the first time a type is looked up for a user,
    defaulting both channels to on, rather than seeding them eagerly -- see
    household.services.notifications."""
    NOTIFICATION_TYPE_CHOICES = [
        ('task_due_today', 'Task due today'),
        ('household_planning_due', 'Weekly household planning due'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notification_preferences')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    email_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)

    class Meta:
        unique_together = ('user', 'notification_type')
        ordering = ['notification_type']

    def __str__(self):
        return f"{self.user.username} - {self.notification_type}"


class PushSubscription(models.Model):
    """One row per browser/device that has granted push permission and
    registered via the Web Push API (see frontend public/sw.js). endpoint is
    unique per browser install, so re-subscribing the same device just
    updates its keys instead of creating a duplicate."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    device_label = models.CharField(max_length=100, blank=True)
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh_key = models.CharField(max_length=200)
    auth_key = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.device_label or self.endpoint[:40]}"


class NotificationLog(models.Model):
    """Records that a specific (task_instance, user, type, channel)
    notification has already gone out, so the periodic cron command
    (send_notifications) never double-sends across runs."""
    CHANNEL_CHOICES = [('email', 'Email'), ('push', 'Push')]

    task_instance = models.ForeignKey(
        'HouseholdTaskInstance', on_delete=models.CASCADE, related_name='notification_logs',
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notification_logs')
    notification_type = models.CharField(max_length=30, choices=NotificationPreference.NOTIFICATION_TYPE_CHOICES)
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('task_instance', 'user', 'notification_type', 'channel')

    def __str__(self):
        return f"{self.notification_type}/{self.channel} -> {self.user.username} for instance {self.task_instance_id}"


class HouseholdTaskEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ('created', 'Created'),
        ('reassigned', 'Reassigned'),
        ('snoozed', 'Snoozed to backlog'),
        ('skipped', 'Skipped this occurrence'),
        ('postponed', 'Postponed'),
        ('completed', 'Completed'),
        ('reopened', 'Reopened (undo)'),
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
