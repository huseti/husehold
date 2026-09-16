from django.contrib import admin
from .models import HouseholdMember, ShoppingListItem, Recipe, CookingPlan, HouseholdTask

@admin.register(HouseholdMember)
class HouseholdMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'joined_date')
    list_filter = ('role', 'joined_date')

@admin.register(ShoppingListItem)
class ShoppingListItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'is_completed', 'created_by', 'created_at')
    list_filter = ('is_completed', 'created_at')
    search_fields = ('title',)

@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_by', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('title',)

@admin.register(CookingPlan)
class CookingPlanAdmin(admin.ModelAdmin):
    list_display = ('date', 'meal_type', 'recipe', 'created_by')
    list_filter = ('date', 'meal_type')

@admin.register(HouseholdTask)
class HouseholdTaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'priority', 'is_completed', 'assigned_to', 'due_date')
    list_filter = ('priority', 'is_completed', 'due_date')
    search_fields = ('title',)
