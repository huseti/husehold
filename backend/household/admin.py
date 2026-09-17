from django.contrib import admin
from .models import (
    HouseholdMember, ShoppingListItem, Recipe, CookingPlan,
    HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent,
)

@admin.register(HouseholdMember)
class HouseholdMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'color_hex', 'joined_date')
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

class HouseholdTaskEventInline(admin.TabularInline):
    model = HouseholdTaskEvent
    extra = 0
    readonly_fields = ('event_type', 'actor', 'timestamp', 'note')
    can_delete = False

@admin.register(HouseholdTaskDefinition)
class HouseholdTaskDefinitionAdmin(admin.ModelAdmin):
    list_display = ('title', 'icon', 'recurrence_rule', 'default_assignee', 'system_action', 'updated_by', 'updated_at')
    list_filter = ('system_action', 'icon')
    search_fields = ('title',)

@admin.register(HouseholdTaskInstance)
class HouseholdTaskInstanceAdmin(admin.ModelAdmin):
    list_display = ('definition', 'scheduled_date', 'assigned_to', 'status', 'completed_at')
    list_filter = ('status', 'scheduled_date')
    inlines = [HouseholdTaskEventInline]
