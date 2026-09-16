from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, HouseholdMemberViewSet, ShoppingListItemViewSet,
    RecipeViewSet, CookingPlanViewSet, HouseholdTaskViewSet
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'members', HouseholdMemberViewSet)
router.register(r'shopping', ShoppingListItemViewSet, basename='shopping')
router.register(r'recipes', RecipeViewSet, basename='recipe')
router.register(r'cooking-plans', CookingPlanViewSet, basename='cooking-plan')
router.register(r'tasks', HouseholdTaskViewSet, basename='task')

urlpatterns = [
    path('', include(router.urls)),
]
