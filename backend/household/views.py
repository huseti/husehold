from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import HouseholdMember, ShoppingListItem, Recipe, CookingPlan, HouseholdTask
from .serializers import (
    UserSerializer, HouseholdMemberSerializer, ShoppingListItemSerializer,
    RecipeSerializer, CookingPlanSerializer, HouseholdTaskSerializer
)

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

class HouseholdMemberViewSet(viewsets.ModelViewSet):
    queryset = HouseholdMember.objects.all()
    serializer_class = HouseholdMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

class ShoppingListItemViewSet(viewsets.ModelViewSet):
    queryset = ShoppingListItem.objects.all()
    serializer_class = ShoppingListItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def toggle_completed(self, request):
        item_id = request.data.get('id')
        try:
            item = ShoppingListItem.objects.get(id=item_id)
            item.is_completed = not item.is_completed
            item.save()
            return Response(ShoppingListItemSerializer(item).data)
        except ShoppingListItem.DoesNotExist:
            return Response({'error': 'Item not found'}, status=status.HTTP_404_NOT_FOUND)

class RecipeViewSet(viewsets.ModelViewSet):
    queryset = Recipe.objects.all()
    serializer_class = RecipeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class CookingPlanViewSet(viewsets.ModelViewSet):
    queryset = CookingPlan.objects.all()
    serializer_class = CookingPlanSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class HouseholdTaskViewSet(viewsets.ModelViewSet):
    queryset = HouseholdTask.objects.all()
    serializer_class = HouseholdTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def toggle_completed(self, request):
        task_id = request.data.get('id')
        try:
            task = HouseholdTask.objects.get(id=task_id)
            task.is_completed = not task.is_completed
            task.save()
            return Response(HouseholdTaskSerializer(task).data)
        except HouseholdTask.DoesNotExist:
            return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
