from rest_framework import serializers
from django.contrib.auth.models import User
from .models import HouseholdMember, ShoppingListItem, Recipe, CookingPlan, HouseholdTask

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')

class HouseholdMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = HouseholdMember
        fields = ('id', 'user', 'role', 'joined_date')

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

class HouseholdTaskSerializer(serializers.ModelSerializer):
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = HouseholdTask
        fields = ('id', 'title', 'description', 'priority', 'is_completed', 'assigned_to', 'assigned_to_username', 'created_by', 'created_by_username', 'due_date', 'created_at', 'updated_at')
