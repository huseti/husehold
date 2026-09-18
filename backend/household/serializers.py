from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    HouseholdMember, HouseholdSettings, ShoppingListItem, Recipe, CookingPlan,
    HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent,
    NotificationPreference, PushSubscription, Voucher, VoucherRedemption,
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')

class HouseholdMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = HouseholdMember
        fields = ('id', 'user', 'role', 'color_hex', 'avatar', 'joined_date')

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

class ShoppingListItemSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = ShoppingListItem
        fields = ('id', 'title', 'description', 'is_completed', 'created_by', 'created_by_username', 'created_at', 'updated_at')

class RecipeSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Recipe
        fields = ('id', 'title', 'description', 'ingredients', 'instructions', 'prep_time', 'cook_time', 'servings', 'created_by', 'created_by_username', 'created_at', 'updated_at')

class CookingPlanSerializer(serializers.ModelSerializer):
    recipe_title = serializers.CharField(source='recipe.title', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = CookingPlan
        fields = ('id', 'date', 'meal_type', 'recipe', 'recipe_title', 'notes', 'created_by', 'created_by_username', 'created_at')

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

    class Meta:
        model = HouseholdTaskInstance
        fields = (
            'id', 'definition', 'definition_title', 'definition_icon', 'system_action',
            'standalone_title', 'standalone_icon', 'title', 'icon',
            'scheduled_date', 'occurrence_date', 'is_in_backlog', 'assigned_to',
            'assigned_to_username', 'assigned_to_color', 'status', 'completed_at',
            'created_by', 'created_by_username', 'created_at', 'origin_instance', 'events',
        )
        read_only_fields = ('occurrence_date', 'created_by', 'system_action', 'origin_instance')

    def get_title(self, obj):
        return obj.definition.title if obj.definition else obj.standalone_title

    def get_icon(self, obj):
        return obj.definition.icon if obj.definition else obj.standalone_icon
