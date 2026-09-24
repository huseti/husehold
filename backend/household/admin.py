from django.contrib import admin
from .models import (
    HouseholdMember, HouseholdSettings, ShoppingList, ShoppingListItem, Recipe,
    UnitOfMeasure, Ingredient, Label, MealTimeCategory, RecipeIngredient, RecipeRating, MealEvent, PurchaseRecord,
    CookingPlanConfig, CookingPlanEntry,
    HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent,
    NotificationPreference, PushSubscription, NotificationLog, Voucher, VoucherRedemption,
    PackingList, PackingListParticipant, PackingListItem, PackingBucket, PackingBucketItem,
)

@admin.register(HouseholdMember)
class HouseholdMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'color_hex', 'joined_date')
    list_filter = ('role', 'joined_date')

@admin.register(HouseholdSettings)
class HouseholdSettingsAdmin(admin.ModelAdmin):
    list_display = ('household_name', 'updated_by', 'updated_at')

class ShoppingListItemInline(admin.TabularInline):
    model = ShoppingListItem
    extra = 0

@admin.register(ShoppingList)
class ShoppingListAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_favorite_for_cooking_plan', 'updated_by', 'updated_at')
    inlines = [ShoppingListItemInline]

@admin.register(ShoppingListItem)
class ShoppingListItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'shopping_list', 'quantity', 'unit', 'is_completed', 'created_by', 'created_at')
    list_filter = ('shopping_list', 'is_completed', 'created_at')
    search_fields = ('title',)

@admin.register(UnitOfMeasure)
class UnitOfMeasureAdmin(admin.ModelAdmin):
    list_display = ('name_de', 'name_en', 'abbreviation_de', 'abbreviation_en', 'sort_order')

@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ('name', 'default_excluded_from_shopping_list')
    search_fields = ('name',)

@admin.register(Label)
class LabelAdmin(admin.ModelAdmin):
    list_display = ('name_de', 'name_en', 'color_hex')

@admin.register(MealTimeCategory)
class MealTimeCategoryAdmin(admin.ModelAdmin):
    list_display = ('name_de', 'name_en', 'sort_order')

class RecipeIngredientInline(admin.TabularInline):
    model = RecipeIngredient
    extra = 0

class RecipeRatingInline(admin.TabularInline):
    model = RecipeRating
    extra = 0

class MealEventInline(admin.TabularInline):
    model = MealEvent
    extra = 0

@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_by', 'created_at')
    list_filter = ('created_at', 'labels', 'categories')
    search_fields = ('title',)
    inlines = [RecipeIngredientInline, RecipeRatingInline, MealEventInline]

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

class PackingListItemInline(admin.TabularInline):
    model = PackingListItem
    extra = 0

class PackingListParticipantInline(admin.TabularInline):
    model = PackingListParticipant
    extra = 0

@admin.register(PackingList)
class PackingListAdmin(admin.ModelAdmin):
    list_display = ('name', 'start_date', 'end_date')
    list_filter = ('start_date',)
    search_fields = ('name',)
    inlines = [PackingListParticipantInline, PackingListItemInline]

class PackingBucketItemInline(admin.TabularInline):
    model = PackingBucketItem
    extra = 0

@admin.register(PackingBucket)
class PackingBucketAdmin(admin.ModelAdmin):
    list_display = ('name', 'color_hex', 'updated_by', 'updated_at')
    search_fields = ('name',)
    inlines = [PackingBucketItemInline]

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

@admin.register(PurchaseRecord)
class PurchaseRecordAdmin(admin.ModelAdmin):
    list_display = ('title', 'quantity', 'unit', 'list_name', 'purchased_on', 'purchased_by')
    list_filter = ('purchased_on', 'list_name')
    search_fields = ('title',)

@admin.register(CookingPlanEntry)
class CookingPlanEntryAdmin(admin.ModelAdmin):
    list_display = ('date', 'meal_category', 'kind', 'recipe', 'servings', 'task_instance')
    list_filter = ('kind', 'meal_category', 'date')
    search_fields = ('recipe__title',)

@admin.register(CookingPlanConfig)
class CookingPlanConfigAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'top_rating_percentile', 'uncooked_threshold_days', 'rating_weight', 'neglect_weight')
