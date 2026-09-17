from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    HouseholdMember, ShoppingListItem, Recipe, CookingPlan,
    HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent,
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')

class HouseholdMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = HouseholdMember
        fields = ('id', 'user', 'role', 'color_hex', 'joined_date')

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

class HouseholdTaskEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = HouseholdTaskEvent
        fields = ('id', 'event_type', 'actor', 'actor_username', 'timestamp', 'note')

class HouseholdTaskDefinitionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True)

    instance_count = serializers.IntegerField(source='instances.count', read_only=True)

    class Meta:
        model = HouseholdTaskDefinition
        fields = (
            'id', 'title', 'description', 'icon', 'starts_on', 'recurrence_rule',
            'assignment_mode', 'default_assignee', 'system_action', 'reminder_time', 'instance_count',
            'created_by', 'created_by_username', 'created_at',
            'updated_by', 'updated_by_username', 'updated_at',
        )
        read_only_fields = ('created_by', 'updated_by')

class HouseholdTaskInstanceSerializer(serializers.ModelSerializer):
    definition_title = serializers.CharField(source='definition.title', read_only=True)
    definition_icon = serializers.CharField(source='definition.icon', read_only=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)
    assigned_to_color = serializers.CharField(source='assigned_to.householdmember.color_hex', read_only=True, default=None)
    events = HouseholdTaskEventSerializer(many=True, read_only=True)

    class Meta:
        model = HouseholdTaskInstance
        fields = (
            'id', 'definition', 'definition_title', 'definition_icon', 'scheduled_date', 'assigned_to',
            'assigned_to_username', 'assigned_to_color', 'status', 'completed_at',
            'created_at', 'events',
        )
