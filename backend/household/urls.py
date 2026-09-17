from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, HouseholdMemberViewSet, HouseholdSettingsView, ShoppingListItemViewSet,
    RecipeViewSet, CookingPlanViewSet,
    HouseholdTaskDefinitionViewSet, HouseholdTaskInstanceViewSet,
    NotificationPreferencesView, PushSubscriptionViewSet, VapidPublicKeyView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'members', HouseholdMemberViewSet)
router.register(r'shopping', ShoppingListItemViewSet, basename='shopping')
router.register(r'recipes', RecipeViewSet, basename='recipe')
router.register(r'cooking-plans', CookingPlanViewSet, basename='cooking-plan')
router.register(r'task-definitions', HouseholdTaskDefinitionViewSet, basename='task-definition')
router.register(r'task-instances', HouseholdTaskInstanceViewSet, basename='task-instance')
router.register(r'push-subscriptions', PushSubscriptionViewSet, basename='push-subscription')

urlpatterns = [
    path('household-settings/', HouseholdSettingsView.as_view(), name='household-settings'),
    path('notification-preferences/', NotificationPreferencesView.as_view(), name='notification-preferences'),
    path('vapid-public-key/', VapidPublicKeyView.as_view(), name='vapid-public-key'),
    path('', include(router.urls)),
]
