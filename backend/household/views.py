from datetime import timedelta

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from .models import (
    HouseholdMember, HouseholdSettings, ShoppingListItem, Recipe, CookingPlan,
    HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent,
)
from .serializers import (
    UserSerializer, HouseholdMemberSerializer, HouseholdSettingsSerializer, ShoppingListItemSerializer,
    RecipeSerializer, CookingPlanSerializer,
    HouseholdTaskDefinitionSerializer, HouseholdTaskInstanceSerializer,
)
from .services.task_generation import generate_instances_for_range, monday_of_week_as_datetime


def _monday_of_week(day):
    return day - timedelta(days=day.weekday())


def _next_week_monday(from_date):
    """The Monday of the week *after* from_date's week -- used by snooze to
    push an instance into next week's backlog regardless of which day of
    the current week it's snoozed from."""
    return _monday_of_week(from_date) + timedelta(days=7)

class HouseholdSettingsView(APIView):
    """Singleton (pk=1) -- created on first access. No list/create/delete;
    just get the current settings or patch them."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        settings_obj, _ = HouseholdSettings.objects.get_or_create(pk=1)
        return Response(HouseholdSettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj, _ = HouseholdSettings.objects.get_or_create(pk=1)
        serializer = HouseholdSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)

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

    @action(detail=False, methods=['get'])
    def me(self, request):
        member = HouseholdMember.objects.filter(user=request.user).first()
        if member is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(HouseholdMemberSerializer(member, context={'request': request}).data)

    @action(detail=True, methods=['delete'], url_path='avatar')
    def delete_avatar(self, request, pk=None):
        member = self.get_object()
        member.avatar.delete(save=True)
        return Response(HouseholdMemberSerializer(member, context={'request': request}).data)

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

class HouseholdTaskDefinitionViewSet(viewsets.ModelViewSet):
    queryset = HouseholdTaskDefinition.objects.all()
    serializer_class = HouseholdTaskDefinitionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        definition = self.get_object()
        instance_count = definition.instances.count()
        confirmed = request.query_params.get('confirm') == 'true'
        if instance_count > 0 and not confirmed:
            return Response(
                {
                    'requires_confirmation': True,
                    'instance_count': instance_count,
                    'detail': f'This recurring task has {instance_count} scheduled occurrence(s). '
                              'Pass ?confirm=true to delete it and all of them.',
                },
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

class HouseholdTaskInstanceViewSet(viewsets.ModelViewSet):
    queryset = HouseholdTaskInstance.objects.all()
    serializer_class = HouseholdTaskInstanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        start = parse_date(self.request.query_params.get('start') or '')
        end = parse_date(self.request.query_params.get('end') or '')
        if start and end:
            generate_instances_for_range(start, end)
            queryset = queryset.filter(scheduled_date__gte=start, scheduled_date__lte=end)
        return queryset

    def perform_create(self, serializer):
        # One-off tasks (no definition): occurrence_date has no real
        # recurrence to anchor to, so it's just set equal to scheduled_date.
        scheduled_date = serializer.validated_data.get('scheduled_date')
        serializer.save(occurrence_date=scheduled_date, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        instance = self.get_object()
        instance.assigned_to_id = request.data.get('assigned_to')
        instance.save()
        HouseholdTaskEvent.objects.create(task_instance=instance, event_type='reassigned', actor=request.user)
        return Response(HouseholdTaskInstanceSerializer(instance).data)

    @action(detail=True, methods=['post'])
    def snooze(self, request, pk=None):
        """Freezes this occurrence in place -- status=snoozed, it stays on
        its original day as a greyed-out marker -- and creates a separate,
        fully-open copy in next week's backlog carrying the same title/
        icon/assignee. The copy is detached from any recurring definition
        (definition=None) so it can never collide with that definition's
        own next natural occurrence; a 'snoozed' event on the copy lets the
        frontend show it was carried over without treating it as resolved."""
        instance = self.get_object()
        instance.status = 'snoozed'
        instance.save()
        HouseholdTaskEvent.objects.create(task_instance=instance, event_type='snoozed', actor=request.user)

        title = instance.definition.title if instance.definition else instance.standalone_title
        icon = instance.definition.icon if instance.definition else instance.standalone_icon
        next_date = _next_week_monday(instance.scheduled_date)
        copy = HouseholdTaskInstance.objects.create(
            standalone_title=title,
            standalone_icon=icon,
            occurrence_date=next_date,
            scheduled_date=next_date,
            is_in_backlog=True,
            assigned_to=instance.assigned_to,
            created_at=monday_of_week_as_datetime(next_date),
        )
        HouseholdTaskEvent.objects.create(task_instance=copy, event_type='snoozed', actor=request.user)

        return Response(HouseholdTaskInstanceSerializer(instance).data)

    @action(detail=True, methods=['post'])
    def skip(self, request, pk=None):
        """Skip just this occurrence (status only -- does not move it).
        For alternating tasks, the next occurrence stays with the same
        person instead of rotating (see _resolve_assignee) -- this covers
        that at generation time, but if the next occurrence was *already*
        generated before this skip happened (e.g. weekly planning mode
        generates several weeks in one go), it would have been resolved
        under the old rotation. Correct it retroactively here too."""
        instance = self.get_object()
        instance.status = 'skipped'
        instance.save()
        HouseholdTaskEvent.objects.create(task_instance=instance, event_type='skipped', actor=request.user)

        definition = instance.definition
        if definition and definition.assignment_mode == 'alternating':
            next_instance = definition.instances.filter(
                occurrence_date__gt=instance.occurrence_date, status='pending',
            ).order_by('occurrence_date', 'id').first()
            if next_instance and next_instance.assigned_to_id != instance.assigned_to_id:
                next_instance.assigned_to = instance.assigned_to
                next_instance.save()

        return Response(HouseholdTaskInstanceSerializer(instance).data)

    @action(detail=True, methods=['post'])
    def postpone(self, request, pk=None):
        """Drag-and-drop to a specific day (is_in_backlog defaults to False),
        or drag back into the backlog lane by passing is_in_backlog=true
        with no scheduled_date change. Only scheduled_date/is_in_backlog
        change -- occurrence_date stays put so the original slot doesn't
        get regenerated as a duplicate."""
        instance = self.get_object()
        instance.scheduled_date = request.data.get('scheduled_date', instance.scheduled_date)
        instance.is_in_backlog = bool(request.data.get('is_in_backlog', False))
        instance.save()
        HouseholdTaskEvent.objects.create(task_instance=instance, event_type='postponed', actor=request.user)
        return Response(HouseholdTaskInstanceSerializer(instance).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        instance = self.get_object()
        instance.status = 'done'
        instance.completed_at = timezone.now()
        instance.save()
        HouseholdTaskEvent.objects.create(task_instance=instance, event_type='completed', actor=request.user)
        return Response(HouseholdTaskInstanceSerializer(instance).data)

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        """Undo done/skipped/snoozed -- back to a plain open item. A
        snoozed (backlogged) instance is restored to its natural day
        (occurrence_date) rather than staying in the backlog."""
        instance = self.get_object()
        instance.status = 'pending'
        instance.completed_at = None
        if instance.is_in_backlog:
            instance.is_in_backlog = False
            instance.scheduled_date = instance.occurrence_date
        instance.save()
        HouseholdTaskEvent.objects.create(task_instance=instance, event_type='reopened', actor=request.user)
        return Response(HouseholdTaskInstanceSerializer(instance).data)
