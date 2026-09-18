from django.contrib import admin
from .models import (
    HouseholdMember, HouseholdSettings, ShoppingListItem, Recipe, CookingPlan,
    HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent,
    NotificationPreference, PushSubscription, NotificationLog, Voucher, VoucherRedemption,
)

@admin.register(HouseholdMember)
class HouseholdMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'color_hex', 'joined_date')
    list_filter = ('role', 'joined_date')

@admin.register(HouseholdSettings)
class HouseholdSettingsAdmin(admin.ModelAdmin):
    list_display = ('household_name', 'updated_by', 'updated_at')

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

class VoucherRedemptionInline(admin.TabularInline):
    model = VoucherRedemption
    extra = 0
    readonly_fields = ('redeemed_on', 'amount_used', 'remaining_after', 'logged_by')
    can_delete = False

@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    list_display = ('title', 'received_from', 'location', 'total_value', 'remaining_balance', 'valid_until', 'is_archived')
    list_filter = ('is_archived', 'valid_until')
    search_fields = ('title', 'received_from', 'location')
    inlines = [VoucherRedemptionInline]

class HouseholdTaskEventInline(admin.TabularInline):
    model = HouseholdTaskEvent
    extra = 0
    readonly_fields = ('event_type', 'actor', 'timestamp', 'note')
    can_delete = False

@admin.register(HouseholdTaskDefinition)
class HouseholdTaskDefinitionAdmin(admin.ModelAdmin):
    list_display = ('title', 'icon', 'recurrence_rule', 'has_preferred_day', 'assignment_mode', 'default_assignee', 'system_action', 'updated_by', 'updated_at')
    list_filter = ('system_action', 'icon', 'assignment_mode', 'has_preferred_day')
    search_fields = ('title',)

@admin.register(HouseholdTaskInstance)
class HouseholdTaskInstanceAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'scheduled_date', 'occurrence_date', 'is_in_backlog', 'assigned_to', 'status', 'completed_at', 'created_by', 'created_at')
    list_filter = ('status', 'is_in_backlog', 'scheduled_date')
    inlines = [HouseholdTaskEventInline]

@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'email_enabled', 'push_enabled')
    list_filter = ('notification_type', 'email_enabled', 'push_enabled')

@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'device_label', 'endpoint', 'created_at')
    search_fields = ('device_label', 'endpoint')

@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ('task_instance', 'user', 'notification_type', 'channel', 'sent_at')
    list_filter = ('notification_type', 'channel', 'sent_at')
