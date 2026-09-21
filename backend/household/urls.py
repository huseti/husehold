from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, HouseholdMemberViewSet, HouseholdSettingsView, ShoppingListItemViewSet,
    RecipeViewSet, VoucherViewSet, ShoppingListViewSet,
    UnitOfMeasureViewSet, IngredientViewSet, LabelViewSet, MealTimeCategoryViewSet, MealEventViewSet, PurchaseRecordViewSet, CookingPlanEntryViewSet, CookingPlanConfigView, CookingSuggestionsView,
    HouseholdTaskDefinitionViewSet, HouseholdTaskInstanceViewSet,
    NotificationPreferencesView, PushSubscriptionViewSet, VapidPublicKeyView,
    TestEmailNotificationView, TestPushNotificationView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'members', HouseholdMemberViewSet)
router.register(r'shopping', ShoppingListItemViewSet, basename='shopping')
router.register(r'cooking-plan-entries', CookingPlanEntryViewSet, basename='cooking-plan-entry')
router.register(r'purchases', PurchaseRecordViewSet, basename='purchase')
router.register(r'shopping-lists', ShoppingListViewSet, basename='shopping-list')
router.register(r'recipes', RecipeViewSet, basename='recipe')
router.register(r'meal-events', MealEventViewSet, basename='meal-event')
router.register(r'units', UnitOfMeasureViewSet, basename='unit')
router.register(r'ingredients', IngredientViewSet, basename='ingredient')
router.register(r'labels', LabelViewSet, basename='label')
router.register(r'meal-categories', MealTimeCategoryViewSet, basename='meal-category')
router.register(r'vouchers', VoucherViewSet, basename='voucher')
router.register(r'task-definitions', HouseholdTaskDefinitionViewSet, basename='task-definition')
router.register(r'task-instances', HouseholdTaskInstanceViewSet, basename='task-instance')
router.register(r'push-subscriptions', PushSubscriptionViewSet, basename='push-subscription')

urlpatterns = [
    path('cooking-plan-config/', CookingPlanConfigView.as_view(), name='cooking-plan-config'),
    path('cooking-suggestions/', CookingSuggestionsView.as_view(), name='cooking-suggestions'),
    path('household-settings/', HouseholdSettingsView.as_view(), name='household-settings'),
    path('notification-preferences/', NotificationPreferencesView.as_view(), name='notification-preferences'),
    path('vapid-public-key/', VapidPublicKeyView.as_view(), name='vapid-public-key'),
    path('notifications/test-email/', TestEmailNotificationView.as_view(), name='test-email-notification'),
    path('notifications/test-push/', TestPushNotificationView.as_view(), name='test-push-notification'),
    path('', include(router.urls)),
]
