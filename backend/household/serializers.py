from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth.models import User
from .services.cooking_tasks import get_cooking_entry, leftovers_out_of_order, slot
from .models import (
    HouseholdMember, HouseholdSettings, ShoppingList, ShoppingListItem, Recipe,
    HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent,
    NotificationPreference, PushSubscription, Voucher, VoucherRedemption,
    UnitOfMeasure, Ingredient, Label, MealTimeCategory, RecipeIngredient, RecipeRating, MealEvent, PurchaseRecord, CookingPlanConfig, CookingPlanEntry,
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')

class HouseholdMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = HouseholdMember
        fields = ('id', 'user', 'role', 'color_hex', 'avatar', 'notification_language', 'joined_date')

class HouseholdSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = HouseholdSettings
        fields = ('id', 'household_name', 'timezone', 'updated_at')
        read_only_fields = ('updated_at',)

    def validate_timezone(self, value):
        from zoneinfo import available_timezones
        if value not in available_timezones():
            raise serializers.ValidationError('Not a recognized IANA timezone name.')
        return value

class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = ('id', 'name_de', 'name_en', 'abbreviation_de', 'abbreviation_en', 'sort_order')

    def validate_name_de(self, value):
        value = value.strip()
        clash = UnitOfMeasure.objects.filter(name_de__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError('A unit with this name already exists.')
        return value

class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = ('id', 'name', 'default_excluded_from_shopping_list')

    def validate_name(self, value):
        value = value.strip()
        clash = Ingredient.objects.filter(name__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError('An ingredient with this name already exists.')
        return value

class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ('id', 'name_de', 'name_en', 'color_hex')

    def validate_name_de(self, value):
        value = value.strip()
        clash = Label.objects.filter(name_de__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError('A label with this name already exists.')
        return value

class MealTimeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MealTimeCategory
        fields = ('id', 'name_de', 'name_en', 'sort_order')

    def validate_name_de(self, value):
        value = value.strip()
        clash = MealTimeCategory.objects.filter(name_de__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError('A category with this name already exists.')
        return value

def get_or_create_ingredient(name, user):
    """Case-insensitive match on the shared catalogue, creating the
    ingredient on the fly if it's new -- this is what lets recipe entry be
    free-text without ending up with "Zwiebel" and "zwiebel" as two rows."""
    name = name.strip()
    existing = Ingredient.objects.filter(name__iexact=name).first()
    if existing:
        return existing
    return Ingredient.objects.create(name=name, created_by=user, updated_by=user)

class ShoppingListSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()
    open_item_count = serializers.SerializerMethodField()

    class Meta:
        model = ShoppingList
        fields = ('id', 'name', 'is_favorite_for_cooking_plan', 'visible_to', 'item_count', 'open_item_count')

    def get_item_count(self, obj):
        return obj.items.count()

    def get_open_item_count(self, obj):
        return obj.items.filter(is_completed=False).count()

class ShoppingListItemSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    unit_name = serializers.SerializerMethodField()

    class Meta:
        model = ShoppingListItem
        fields = (
            'id', 'shopping_list', 'title', 'description', 'quantity', 'unit', 'unit_name',
            'ingredient', 'source', 'is_completed', 'created_by', 'created_by_username',
            'created_at', 'updated_at',
        )
        read_only_fields = ('source', 'created_by')

    def get_unit_name(self, obj):
        return str(obj.unit) if obj.unit else None

    def validate_shopping_list(self, value):
        user = self.context['request'].user
        if value.visible_to.exists() and not value.visible_to.filter(pk=user.pk).exists():
            raise serializers.ValidationError('You cannot access this shopping list.')
        return value

class PurchaseRecordSerializer(serializers.ModelSerializer):
    purchased_by_username = serializers.CharField(source='purchased_by.username', read_only=True, default=None)

    class Meta:
        model = PurchaseRecord
        fields = (
            'id', 'title', 'quantity', 'unit', 'ingredient', 'shopping_list', 'list_name',
            'purchased_on', 'purchased_by', 'purchased_by_username',
        )
        read_only_fields = fields

class RecipeIngredientSerializer(serializers.ModelSerializer):
    # Written as a plain name (auto-created if new) rather than an id, so the
    # recipe form can be free-text -- see get_or_create_ingredient().
    ingredient_name = serializers.CharField(source='ingredient.name', max_length=100)
    unit_name = serializers.SerializerMethodField()

    class Meta:
        model = RecipeIngredient
        fields = ('id', 'ingredient', 'ingredient_name', 'quantity', 'unit', 'unit_name', 'note', 'sort_order')
        read_only_fields = ('ingredient',)

    def get_unit_name(self, obj):
        return str(obj.unit) if obj.unit else None

class RecipeRatingSerializer(serializers.ModelSerializer):
    rated_by_username = serializers.CharField(source='rated_by.username', read_only=True)

    class Meta:
        model = RecipeRating
        fields = ('id', 'rated_by', 'rated_by_username', 'score')

class MealEventSerializer(serializers.ModelSerializer):
    logged_by_username = serializers.CharField(source='logged_by.username', read_only=True, default=None)
    recipe_title = serializers.CharField(source='recipe.title', read_only=True)

    class Meta:
        model = MealEvent
        fields = ('id', 'recipe', 'recipe_title', 'date_cooked', 'servings_made', 'logged_by', 'logged_by_username')
        read_only_fields = ('logged_by',)

    def validate_date_cooked(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError('A meal cannot be logged for a future date.')
        return value

class RecipeSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    ingredients = RecipeIngredientSerializer(many=True, required=False)
    categories = serializers.PrimaryKeyRelatedField(many=True, queryset=MealTimeCategory.objects.all(), required=False)
    labels = serializers.PrimaryKeyRelatedField(many=True, queryset=Label.objects.all(), required=False)
    ratings = RecipeRatingSerializer(many=True, read_only=True)
    average_rating = serializers.SerializerMethodField()
    my_rating = serializers.SerializerMethodField()
    last_cooked_date = serializers.SerializerMethodField()
    times_cooked = serializers.SerializerMethodField()
    recent_meal_events = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = (
            'id', 'title', 'description', 'instructions', 'prep_time', 'cook_time', 'servings',
            'source_url', 'notes', 'categories', 'labels', 'ingredients',
            'ratings', 'average_rating', 'my_rating',
            'last_cooked_date', 'times_cooked', 'recent_meal_events',
            'created_by', 'created_by_username', 'created_at', 'updated_at',
        )
        read_only_fields = ('created_by',)

    def get_average_rating(self, obj):
        # Iterates .all() (not an aggregate query) so the viewset's
        # prefetch_related('ratings') is what gets used.
        scores = [r.score for r in obj.ratings.all()]
        return round(sum(scores) / len(scores), 1) if scores else None

    def get_my_rating(self, obj):
        request = self.context.get('request')
        if request is None:
            return None
        return next((r.score for r in obj.ratings.all() if r.rated_by_id == request.user.id), None)

    # Derived from the prefetched meal_events rather than a stored column, so
    # deleting a mistaken log entry can never leave a stale "last cooked".
    def get_last_cooked_date(self, obj):
        dates = [e.date_cooked for e in obj.meal_events.all()]
        return max(dates).isoformat() if dates else None

    def get_times_cooked(self, obj):
        return len(obj.meal_events.all())

    def get_recent_meal_events(self, obj):
        return MealEventSerializer(obj.meal_events.all()[:10], many=True, context=self.context).data

    def _replace_ingredients(self, recipe, lines):
        user = self.context['request'].user
        recipe.ingredients.all().delete()
        for order, line in enumerate(lines):
            ingredient = get_or_create_ingredient(line['ingredient']['name'], user)
            RecipeIngredient.objects.create(
                recipe=recipe, ingredient=ingredient, quantity=line.get('quantity'),
                unit=line.get('unit'), note=line.get('note', ''), sort_order=order,
            )

    def create(self, validated_data):
        lines = validated_data.pop('ingredients', [])
        categories = validated_data.pop('categories', [])
        labels = validated_data.pop('labels', [])
        recipe = Recipe.objects.create(**validated_data)
        recipe.categories.set(categories)
        recipe.labels.set(labels)
        self._replace_ingredients(recipe, lines)
        return recipe

    def update(self, instance, validated_data):
        lines = validated_data.pop('ingredients', None)
        categories = validated_data.pop('categories', None)
        labels = validated_data.pop('labels', None)
        instance = super().update(instance, validated_data)
        if categories is not None:
            instance.categories.set(categories)
        if labels is not None:
            instance.labels.set(labels)
        # Only when the key was sent: a PATCH that omits ingredients must
        # leave them alone rather than wiping the list.
        if lines is not None:
            self._replace_ingredients(instance, lines)
        return instance

class VoucherRedemptionSerializer(serializers.ModelSerializer):
    logged_by_username = serializers.CharField(source='logged_by.username', read_only=True, default=None)

    class Meta:
        model = VoucherRedemption
        fields = ('id', 'redeemed_on', 'amount_used', 'remaining_after', 'logged_by', 'logged_by_username')
        read_only_fields = ('logged_by', 'remaining_after')

class VoucherSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True, default=None)
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True, default=None)
    is_expired = serializers.SerializerMethodField()
    redemptions = VoucherRedemptionSerializer(many=True, read_only=True)

    class Meta:
        model = Voucher
        fields = (
            'id', 'title', 'received_from', 'location', 'currency',
            'total_value', 'remaining_balance', 'valid_until', 'is_archived', 'is_expired',
            'redemptions',
            'created_by', 'created_by_username', 'created_at',
            'updated_by', 'updated_by_username', 'updated_at',
        )
        read_only_fields = ('remaining_balance', 'is_archived', 'created_by', 'updated_by')

    def get_is_expired(self, obj):
        return bool(obj.valid_until and obj.valid_until < timezone.localdate())

class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ('id', 'notification_type', 'email_enabled', 'push_enabled')
        read_only_fields = ('id', 'notification_type')

class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushSubscription
        fields = ('id', 'device_label', 'endpoint', 'p256dh_key', 'auth_key', 'created_at')
        read_only_fields = ('id', 'created_at')

class HouseholdTaskEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = HouseholdTaskEvent
        fields = ('id', 'event_type', 'actor', 'actor_username', 'timestamp', 'note')

class HouseholdTaskDefinitionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True)
    default_assignee_username = serializers.CharField(source='default_assignee.username', read_only=True, default=None)

    instance_count = serializers.IntegerField(source='instances.count', read_only=True)

    class Meta:
        model = HouseholdTaskDefinition
        fields = (
            'id', 'title', 'description', 'icon', 'starts_on', 'recurrence_rule', 'has_preferred_day',
            'assignment_mode', 'default_assignee', 'default_assignee_username',
            'system_action', 'reminder_time', 'instance_count',
            'created_by', 'created_by_username', 'created_at',
            'updated_by', 'updated_by_username', 'updated_at',
        )
        read_only_fields = ('created_by', 'updated_by')

class HouseholdTaskInstanceSerializer(serializers.ModelSerializer):
    # Explicit (not auto-generated) because 'definition' participates in the
    # model's unique_together with occurrence_date -- DRF's ModelSerializer
    # otherwise forces fields in a unique_together constraint to be
    # "required", even though the model itself allows it to be blank/null
    # for standalone (one-off) tasks.
    definition = serializers.PrimaryKeyRelatedField(
        queryset=HouseholdTaskDefinition.objects.all(), required=False, allow_null=True,
    )
    title = serializers.SerializerMethodField()
    icon = serializers.SerializerMethodField()
    definition_title = serializers.CharField(source='definition.title', read_only=True, default=None)
    definition_icon = serializers.CharField(source='definition.icon', read_only=True, default=None)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True, default=None)
    assigned_to_color = serializers.CharField(source='assigned_to.householdmember.color_hex', read_only=True, default=None)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True, default=None)
    events = HouseholdTaskEventSerializer(many=True, read_only=True)
    cooking_entry = serializers.SerializerMethodField()

    class Meta:
        model = HouseholdTaskInstance
        fields = (
            'id', 'definition', 'definition_title', 'definition_icon', 'system_action',
            'standalone_title', 'standalone_icon', 'title', 'icon',
            'scheduled_date', 'occurrence_date', 'is_in_backlog', 'assigned_to',
            'assigned_to_username', 'assigned_to_color', 'status', 'completed_at',
            'created_by', 'created_by_username', 'created_at', 'origin_instance', 'events', 'cooking_entry',
        )
        read_only_fields = ('occurrence_date', 'created_by', 'system_action', 'origin_instance')

    def get_title(self, obj):
        return obj.definition.title if obj.definition else obj.standalone_title

    def get_cooking_entry(self, obj):
        entry = get_cooking_entry(obj)
        return TaskCookingEntrySerializer(entry, context=self.context).data if entry else None

    def get_icon(self, obj):
        return obj.definition.icon if obj.definition else obj.standalone_icon


class CookingPlanConfigSerializer(serializers.ModelSerializer):
    planned_meal_categories = serializers.PrimaryKeyRelatedField(
        many=True, queryset=MealTimeCategory.objects.all(), required=False,
    )

    class Meta:
        model = CookingPlanConfig
        fields = (
            'id', 'top_rating_percentile', 'uncooked_threshold_days', 'rating_weight', 'neglect_weight',
            'craving_count', 'random_count', 'planned_meal_categories', 'updated_at',
        )
        read_only_fields = ('updated_at',)

def _entry_is_cooked(entry):
    """Cooked = its meal was logged, or (for a free dish, which has nothing to
    log) its cook task was ticked off."""
    if entry.meal_event_id is not None:
        return True
    return entry.task_instance_id is not None and entry.task_instance.status == 'done'

class CookingPlanEntrySerializer(serializers.ModelSerializer):
    recipe_title = serializers.CharField(source='display_title', read_only=True)
    meal_category_name_de = serializers.CharField(source='meal_category.name_de', read_only=True)
    meal_category_name_en = serializers.CharField(source='meal_category.name_en', read_only=True)
    source_recipe_title = serializers.CharField(source='source_entry.display_title', read_only=True, default=None)
    task_status = serializers.CharField(source='task_instance.status', read_only=True, default=None)
    assigned_to = serializers.IntegerField(source='task_instance.assigned_to_id', read_only=True, default=None)
    assigned_to_username = serializers.CharField(source='task_instance.assigned_to.username', read_only=True, default=None)
    assigned_to_color = serializers.CharField(
        source='task_instance.assigned_to.householdmember.color_hex', read_only=True, default=None,
    )
    is_cooked = serializers.SerializerMethodField()
    # Declared without a default so an omitted value can fall back to the
    # dish's own servings in validate() (the model's default of 2 would
    # otherwise always be filled in first).
    servings = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = CookingPlanEntry
        fields = (
            'id', 'date', 'meal_category', 'meal_category_name_de', 'meal_category_name_en',
            'kind', 'recipe', 'title', 'recipe_title', 'source_entry', 'source_recipe_title',
            'servings', 'notes', 'task_instance', 'task_status',
            'assigned_to', 'assigned_to_username', 'assigned_to_color', 'is_cooked',
        )
        # Leftovers copy their dish from source_entry, so recipe is optional
        # on input; the task link is managed by finalize/the task actions.
        read_only_fields = ('task_instance',)
        extra_kwargs = {'recipe': {'required': False, 'allow_null': True}, 'title': {'required': False}}

    def get_is_cooked(self, obj):
        return _entry_is_cooked(obj)

    def _order_error(self):
        # A named key (not just a message) so the UI can show its own
        # translated explanation.
        return serializers.ValidationError({
            'leftovers': 'Leftovers must come after the dish they come from '
                         '(a later day, or a later meal on the same day).',
        })

    def validate(self, attrs):
        instance = self.instance
        if instance:
            # What a row *is* doesn't change; move/re-plan it or delete and re-add.
            attrs.pop('kind', None)
            attrs.pop('source_entry', None)
            if instance.kind != 'free':
                attrs.pop('title', None)
            if 'recipe' in attrs:
                if instance.kind != 'cook':
                    attrs.pop('recipe')  # leftovers follow their dish; free dishes have none
                elif attrs['recipe'] is None:
                    raise serializers.ValidationError({'recipe': 'A recipe is required.'})
                elif attrs['recipe'] != instance.recipe and _entry_is_cooked(instance):
                    raise serializers.ValidationError({'recipe': 'This dish was already cooked.'})
            if instance.kind == 'free' and not (attrs.get('title', instance.title) or '').strip():
                raise serializers.ValidationError({'title': 'A free dish needs a name.'})
            if 'date' in attrs or 'meal_category' in attrs:
                if leftovers_out_of_order(
                    instance, attrs.get('date', instance.date), attrs.get('meal_category', instance.meal_category),
                ):
                    raise self._order_error()
            return attrs

        kind = attrs.get('kind', 'cook')
        if kind == 'leftovers':
            source = attrs.get('source_entry')
            if source is None or source.kind not in ('cook', 'free'):
                raise serializers.ValidationError({'source_entry': 'Leftovers need the dish they come from.'})
            if slot(attrs['date'], attrs['meal_category']) <= slot(source.date, source.meal_category):
                raise self._order_error()
            attrs['recipe'] = source.recipe
            attrs['title'] = source.title
            attrs.setdefault('servings', source.servings)
        elif kind == 'free':
            attrs['title'] = (attrs.get('title') or '').strip()
            if not attrs['title']:
                raise serializers.ValidationError({'title': 'A free dish needs a name.'})
            if attrs.get('recipe') is not None or attrs.get('source_entry') is not None:
                raise serializers.ValidationError({'recipe': 'A free dish has no recipe.'})
            attrs['recipe'] = None
        else:
            if attrs.get('recipe') is None:
                raise serializers.ValidationError({'recipe': 'A recipe is required.'})
            if attrs.get('source_entry') is not None:
                raise serializers.ValidationError({'source_entry': 'Only leftovers have a source dish.'})
            attrs['title'] = ''
            attrs.setdefault('servings', attrs['recipe'].servings)
        return attrs

class TaskCookingEntrySerializer(serializers.ModelSerializer):
    """The slice of a cook entry a task card needs (dish, meal, servings, and
    whether the current user still owes a rating after cooking it)."""
    recipe_title = serializers.CharField(source='display_title', read_only=True)
    meal_category_name_de = serializers.CharField(source='meal_category.name_de', read_only=True)
    meal_category_name_en = serializers.CharField(source='meal_category.name_en', read_only=True)
    is_cooked = serializers.SerializerMethodField()
    my_rating = serializers.SerializerMethodField()

    class Meta:
        model = CookingPlanEntry
        fields = (
            'id', 'kind', 'recipe', 'recipe_title', 'meal_category', 'meal_category_name_de',
            'meal_category_name_en', 'servings', 'is_cooked', 'my_rating',
        )

    def get_is_cooked(self, obj):
        return _entry_is_cooked(obj)

    def get_my_rating(self, obj):
        request = self.context.get('request')
        if request is None or obj.recipe_id is None:
            return None
        return RecipeRating.objects.filter(
            recipe_id=obj.recipe_id, rated_by=request.user,
        ).values_list('score', flat=True).first()
