import tempfile
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone as dj_timezone
from rest_framework.test import APIClient

from .models import (
    HouseholdMember, HouseholdSettings, HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent,
    CookingPlanConfig, CookingPlanEntry, Ingredient, Label, MealEvent, MealTimeCategory, NotificationPreference,
    PurchaseRecord, Recipe, RecipeRating, ShoppingList, ShoppingListItem, UnitOfMeasure,
    PackingList, PackingListParticipant, PackingListItem, PackingBucket, PackingBucketItem,
)
from .services.task_generation import generate_instances_for_range


class HouseholdSettingsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_get_creates_default_on_first_access(self):
        response = self.client.get('/api/household-settings/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['household_name'], 'Our Household')
        self.assertEqual(HouseholdSettings.objects.count(), 1)

    def test_patch_updates_name_and_reuses_singleton(self):
        self.client.get('/api/household-settings/')
        response = self.client.patch('/api/household-settings/', {'household_name': 'The Smiths'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['household_name'], 'The Smiths')
        self.assertEqual(HouseholdSettings.objects.count(), 1)

    def test_patch_rejects_unknown_timezone(self):
        response = self.client.patch('/api/household-settings/', {'timezone': 'Not/A_Real_Zone'})

        self.assertEqual(response.status_code, 400)

    def test_patch_accepts_valid_timezone(self):
        response = self.client.patch('/api/household-settings/', {'timezone': 'America/New_York'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['timezone'], 'America/New_York')


class HouseholdTimezoneMiddlewareTests(TestCase):
    def test_activates_configured_household_timezone_during_the_request(self):
        from django.utils import timezone as dj_timezone
        from .middleware import HouseholdTimezoneMiddleware

        HouseholdSettings.objects.create(pk=1, timezone='America/New_York')

        seen = {}

        def get_response(request):
            seen['tz'] = str(dj_timezone.get_current_timezone())
            return 'ok'

        middleware = HouseholdTimezoneMiddleware(get_response)
        middleware(request=object())

        self.assertEqual(seen['tz'], 'America/New_York')
        # Deactivated again afterwards, back to the settings.py default.
        self.assertEqual(str(dj_timezone.get_current_timezone()), 'Europe/Berlin')

    def test_falls_back_to_default_when_unconfigured(self):
        from django.utils import timezone as dj_timezone
        from .middleware import HouseholdTimezoneMiddleware

        seen = {}

        def get_response(request):
            seen['tz'] = str(dj_timezone.get_current_timezone())
            return 'ok'

        middleware = HouseholdTimezoneMiddleware(get_response)
        middleware(request=object())

        self.assertEqual(seen['tz'], 'Europe/Berlin')


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class HouseholdMemberAvatarTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.member = HouseholdMember.objects.create(user=self.user, role='member')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _tiny_png(self):
        import io
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        buffer = io.BytesIO()
        Image.new('RGB', (2, 2), color='red').save(buffer, format='PNG')
        return SimpleUploadedFile('avatar.png', buffer.getvalue(), content_type='image/png')

    def test_upload_avatar_via_patch(self):
        response = self.client.patch(f'/api/members/{self.member.id}/', {'avatar': self._tiny_png()}, format='multipart')

        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertTrue(self.member.avatar)

    def test_delete_avatar_clears_it_back_to_default(self):
        self.client.patch(f'/api/members/{self.member.id}/', {'avatar': self._tiny_png()}, format='multipart')
        self.member.refresh_from_db()
        self.assertTrue(self.member.avatar)

        response = self.client.delete(f'/api/members/{self.member.id}/avatar/')

        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertFalse(self.member.avatar)

    def test_me_endpoint_returns_own_member_record(self):
        response = self.client.get('/api/members/me/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], self.member.id)

    def test_me_endpoint_404_without_member_record(self):
        other = User.objects.create_user(username='ghost', password='pw')
        client = APIClient()
        client.force_authenticate(user=other)

        response = client.get('/api/members/me/')

        self.assertEqual(response.status_code, 404)


class TaskGenerationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')

    def test_weekly_recurrence_generates_one_instance_per_week(self):
        definition = HouseholdTaskDefinition.objects.create(
            title='Take out trash',
            starts_on=date(2026, 1, 5),  # a Monday
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
            assignment_mode='fixed',
            default_assignee=self.user,
        )

        created = generate_instances_for_range(date(2026, 9, 14), date(2026, 9, 28))

        self.assertEqual(len(created), 3)
        dates = sorted(i.scheduled_date for i in created)
        self.assertEqual(dates, [date(2026, 9, 14), date(2026, 9, 21), date(2026, 9, 28)])
        self.assertTrue(all(i.assigned_to == self.user for i in created))
        self.assertTrue(all(not i.is_in_backlog for i in created))

    def test_created_at_is_monday_of_the_occurrences_week_not_real_time(self):
        HouseholdTaskDefinition.objects.create(
            title='Water plants',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY;BYDAY=WE',  # Wednesday, not Monday
        )

        created = generate_instances_for_range(date(2026, 9, 16), date(2026, 9, 16))

        instance = created[0]
        self.assertEqual(instance.scheduled_date, date(2026, 9, 16))  # the Wednesday
        self.assertEqual(dj_timezone.localtime(instance.created_at).date(), date(2026, 9, 14))  # Monday of that week

    def test_first_monday_of_month_recurrence(self):
        HouseholdTaskDefinition.objects.create(
            title='Deep clean bathroom',
            starts_on=date(2026, 1, 1),
            recurrence_rule='FREQ=MONTHLY;BYDAY=1MO',
        )

        created = generate_instances_for_range(date(2026, 9, 1), date(2026, 12, 31))

        dates = sorted(i.scheduled_date for i in created)
        self.assertEqual(dates, [date(2026, 9, 7), date(2026, 10, 5), date(2026, 11, 2), date(2026, 12, 7)])

    def test_none_assignment_mode_leaves_instances_unassigned(self):
        HouseholdTaskDefinition.objects.create(
            title='Water plants',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
            assignment_mode='none',
        )

        created = generate_instances_for_range(date(2026, 9, 14), date(2026, 9, 14))

        self.assertIsNone(created[0].assigned_to)

    def test_has_preferred_day_false_lands_in_backlog(self):
        HouseholdTaskDefinition.objects.create(
            title='Whenever chore',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY',
            has_preferred_day=False,
        )

        created = generate_instances_for_range(date(2026, 9, 14), date(2026, 9, 14))

        self.assertTrue(created[0].is_in_backlog)

    def test_alternating_assignment_mode_rotates_between_members(self):
        other = User.objects.create_user(username='partner', password='pw')
        HouseholdMember.objects.create(user=self.user, role='member')
        HouseholdMember.objects.create(user=other, role='member')

        HouseholdTaskDefinition.objects.create(
            title='Take out trash',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
            assignment_mode='alternating',
        )

        created = generate_instances_for_range(date(2026, 9, 14), date(2026, 10, 5))

        assignees = [i.assigned_to for i in sorted(created, key=lambda i: i.scheduled_date)]
        self.assertEqual(assignees, [self.user, other, self.user, other])

    def test_alternating_skips_dont_advance_rotation(self):
        """If an occurrence is skipped, the same person keeps it next time
        instead of the rotation moving on to the other member."""
        other = User.objects.create_user(username='partner', password='pw')
        HouseholdMember.objects.create(user=self.user, role='member')
        HouseholdMember.objects.create(user=other, role='member')

        definition = HouseholdTaskDefinition.objects.create(
            title='Take out trash',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
            assignment_mode='alternating',
        )

        # Week 1 generates for self.user (first member).
        generate_instances_for_range(date(2026, 9, 14), date(2026, 9, 14))
        week1 = HouseholdTaskInstance.objects.get(occurrence_date=date(2026, 9, 14))
        self.assertEqual(week1.assigned_to, self.user)

        # Skip week 1's occurrence, then generate week 2.
        week1.status = 'skipped'
        week1.save()
        generate_instances_for_range(date(2026, 9, 21), date(2026, 9, 21))
        week2 = HouseholdTaskInstance.objects.get(occurrence_date=date(2026, 9, 21))

        self.assertEqual(week2.assigned_to, self.user)  # not other -- rotation didn't advance

    def test_alternating_skip_retroactively_fixes_an_already_generated_next_occurrence(self):
        """Weekly planning mode can generate several weeks in one request,
        before a skip happens -- the next occurrence would already be
        resolved under the old rotation by then. skip() must correct it,
        not just affect occurrences generated afterwards."""
        other = User.objects.create_user(username='partner', password='pw')
        HouseholdMember.objects.create(user=self.user, role='member')
        HouseholdMember.objects.create(user=other, role='member')

        HouseholdTaskDefinition.objects.create(
            title='Take out trash',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
            assignment_mode='alternating',
        )

        # Both weeks generated in one go, as planning mode would -- week 2
        # gets resolved to `other` under the normal rotation, before any skip.
        generate_instances_for_range(date(2026, 9, 14), date(2026, 9, 21))
        week1 = HouseholdTaskInstance.objects.get(occurrence_date=date(2026, 9, 14))
        week2 = HouseholdTaskInstance.objects.get(occurrence_date=date(2026, 9, 21))
        self.assertEqual(week1.assigned_to, self.user)
        self.assertEqual(week2.assigned_to, other)

        client = APIClient()
        client.force_authenticate(user=self.user)
        response = client.post(f'/api/task-instances/{week1.id}/skip/')

        self.assertEqual(response.status_code, 200)
        week2.refresh_from_db()
        self.assertEqual(week2.assigned_to, self.user)  # corrected retroactively

    def test_generation_is_idempotent(self):
        HouseholdTaskDefinition.objects.create(
            title='Water plants',
            starts_on=date(2026, 1, 1),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
        )

        generate_instances_for_range(date(2026, 9, 1), date(2026, 9, 30))
        second_run = generate_instances_for_range(date(2026, 9, 1), date(2026, 9, 30))

        self.assertEqual(len(second_run), 0)
        self.assertEqual(HouseholdTaskInstance.objects.count(), 4)  # Sep 7, 14, 21, 28

    def test_postponing_an_instance_does_not_cause_a_duplicate_on_regeneration(self):
        """Regression test for the drag-and-drop duplication bug: moving an
        instance's scheduled_date away from its natural occurrence_date must
        not make the generator think that slot is unfulfilled again."""
        definition = HouseholdTaskDefinition.objects.create(
            title='Take out trash',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
        )

        generate_instances_for_range(date(2026, 9, 14), date(2026, 9, 20))
        instance = HouseholdTaskInstance.objects.get(definition=definition)
        instance.scheduled_date = date(2026, 9, 16)  # drag Monday's task to Wednesday
        instance.save()

        # Re-fetching the same week (as the frontend does on every load)
        # must not regenerate a fresh instance for the original Monday slot.
        generate_instances_for_range(date(2026, 9, 14), date(2026, 9, 20))

        self.assertEqual(HouseholdTaskInstance.objects.filter(definition=definition).count(), 1)

    def test_creating_an_instance_logs_a_created_event(self):
        HouseholdTaskDefinition.objects.create(
            title='Water plants',
            starts_on=date(2026, 1, 1),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
        )

        generate_instances_for_range(date(2026, 9, 14), date(2026, 9, 14))

        instance = HouseholdTaskInstance.objects.get(scheduled_date=date(2026, 9, 14))
        self.assertEqual(instance.events.count(), 1)
        self.assertEqual(instance.events.first().event_type, 'created')


class TaskInstanceListEndpointTests(TestCase):
    """Regression test: the list endpoint receives start/end as query-string
    text, not date objects -- generate_instances_for_range() requires real
    date objects, so this exercises the actual HTTP path instead of calling
    the service function directly (which is how the other tests missed this)."""

    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        HouseholdTaskDefinition.objects.create(
            title='Take out trash',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
        )

    def test_list_with_start_end_query_params_generates_and_returns_instances(self):
        response = self.client.get('/api/task-instances/', {'start': '2026-09-14', 'end': '2026-09-20'})

        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['scheduled_date'], '2026-09-14')

    def test_instance_exposes_definition_system_action(self):
        """The frontend needs this to override a system task's displayed
        title/icon with a translated label instead of the raw stored text."""
        HouseholdTaskDefinition.objects.create(
            title='Weekly Household Planning',
            starts_on=date(2026, 9, 13),
            recurrence_rule='FREQ=WEEKLY;BYDAY=SU',
            system_action='weekly_household_planning',
        )

        response = self.client.get('/api/task-instances/', {'start': '2026-09-13', 'end': '2026-09-20'})

        results = response.data.get('results', response.data)
        planning_row = next(r for r in results if r['system_action'] == 'weekly_household_planning')
        self.assertIsNotNone(planning_row)


class TaskInstanceActionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.other = User.objects.create_user(username='partner', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.definition = HouseholdTaskDefinition.objects.create(
            title='Take out trash',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
            default_assignee=self.user,
        )
        self.instance = HouseholdTaskInstance.objects.create(
            definition=self.definition, occurrence_date=date(2026, 9, 14),
            scheduled_date=date(2026, 9, 14), assigned_to=self.user,
        )

    def test_snooze_freezes_original_in_place_and_creates_open_copy_in_backlog(self):
        response = self.client.post(f'/api/task-instances/{self.instance.id}/snooze/')

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        # Original stays exactly where it was, just marked snoozed.
        self.assertEqual(self.instance.status, 'snoozed')
        self.assertFalse(self.instance.is_in_backlog)
        self.assertEqual(self.instance.scheduled_date, date(2026, 9, 14))
        self.assertEqual(self.instance.occurrence_date, date(2026, 9, 14))
        self.assertEqual(self.instance.events.filter(event_type='snoozed', actor=self.user).count(), 1)

        # A separate, fully-open copy lands in next week's backlog.
        copy = HouseholdTaskInstance.objects.exclude(id=self.instance.id).get()
        self.assertIsNone(copy.definition)
        self.assertEqual(copy.standalone_title, 'Take out trash')
        self.assertEqual(copy.status, 'pending')
        self.assertTrue(copy.is_in_backlog)
        self.assertEqual(copy.scheduled_date, date(2026, 9, 21))
        self.assertEqual(copy.assigned_to, self.instance.assigned_to)
        self.assertEqual(copy.events.filter(event_type='snoozed').count(), 1)
        # localtime() first: a freshly-queried aware datetime comes back
        # from the DB normalized to UTC, so .date() alone would reflect the
        # UTC calendar day, not the day it was actually set to.
        self.assertEqual(dj_timezone.localtime(copy.created_at).date(), date(2026, 9, 21))
        self.assertEqual(copy.system_action, self.instance.system_action)
        self.assertEqual(copy.origin_instance, self.instance)

    def test_snooze_copy_of_a_system_task_carries_its_system_action(self):
        """Regression test: a snoozed system task (e.g. weekly planning)
        must still be recognized as that system task after being snoozed,
        so the frontend translates its title instead of showing the raw
        stored (English) text -- system_action lives on the copy itself
        now, since the copy has no definition to look it up through."""
        definition = HouseholdTaskDefinition.objects.create(
            title='Weekly Household Planning',
            starts_on=date(2026, 9, 13),
            recurrence_rule='FREQ=WEEKLY;BYDAY=SU',
            system_action='weekly_household_planning',
        )
        instance = HouseholdTaskInstance.objects.create(
            definition=definition, occurrence_date=date(2026, 9, 13), scheduled_date=date(2026, 9, 13),
            system_action=definition.system_action,
        )

        self.client.post(f'/api/task-instances/{instance.id}/snooze/')

        copy = HouseholdTaskInstance.objects.get(origin_instance=instance)
        self.assertEqual(copy.system_action, 'weekly_household_planning')

    def test_reopen_after_snooze_deletes_the_untouched_copy(self):
        self.client.post(f'/api/task-instances/{self.instance.id}/snooze/')
        copy = HouseholdTaskInstance.objects.get(origin_instance=self.instance)

        self.client.post(f'/api/task-instances/{self.instance.id}/reopen/')

        self.assertFalse(HouseholdTaskInstance.objects.filter(id=copy.id).exists())

    def test_reopen_after_snooze_keeps_a_copy_thats_already_been_acted_on(self):
        self.client.post(f'/api/task-instances/{self.instance.id}/snooze/')
        copy = HouseholdTaskInstance.objects.get(origin_instance=self.instance)
        copy.status = 'done'
        copy.save()

        self.client.post(f'/api/task-instances/{self.instance.id}/reopen/')

        self.assertTrue(HouseholdTaskInstance.objects.filter(id=copy.id).exists())

    def test_skip_sets_status_and_logs_event(self):
        response = self.client.post(f'/api/task-instances/{self.instance.id}/skip/')

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.status, 'skipped')
        self.assertEqual(self.instance.events.filter(event_type='skipped', actor=self.user).count(), 1)

    def test_reopen_undoes_skip(self):
        self.client.post(f'/api/task-instances/{self.instance.id}/skip/')

        response = self.client.post(f'/api/task-instances/{self.instance.id}/reopen/')

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.status, 'pending')
        self.assertEqual(self.instance.events.filter(event_type='reopened').count(), 1)

    def test_reopen_undoes_complete(self):
        self.client.post(f'/api/task-instances/{self.instance.id}/complete/')

        response = self.client.post(f'/api/task-instances/{self.instance.id}/reopen/')

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.status, 'pending')
        self.assertIsNone(self.instance.completed_at)

    def test_reopen_undoes_snooze_on_the_frozen_original(self):
        self.client.post(f'/api/task-instances/{self.instance.id}/snooze/')

        response = self.client.post(f'/api/task-instances/{self.instance.id}/reopen/')

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.status, 'pending')
        self.assertFalse(self.instance.is_in_backlog)
        self.assertEqual(self.instance.scheduled_date, date(2026, 9, 14))

    def test_reassign_changes_assignee_and_logs_event(self):
        response = self.client.post(
            f'/api/task-instances/{self.instance.id}/reassign/', {'assigned_to': self.other.id},
        )

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.assigned_to, self.other)
        self.assertEqual(self.instance.events.filter(event_type='reassigned').count(), 1)

    def test_delete_instance(self):
        response = self.client.delete(f'/api/task-instances/{self.instance.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(HouseholdTaskInstance.objects.filter(id=self.instance.id).exists())

    def test_postpone_changes_scheduled_date_but_not_occurrence_date(self):
        response = self.client.post(
            f'/api/task-instances/{self.instance.id}/postpone/', {'scheduled_date': '2026-09-16'},
        )

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.scheduled_date, date(2026, 9, 16))
        self.assertEqual(self.instance.occurrence_date, date(2026, 9, 14))
        self.assertFalse(self.instance.is_in_backlog)
        self.assertEqual(self.instance.events.filter(event_type='postponed').count(), 1)

    def test_postpone_with_is_in_backlog_moves_to_backlog_without_changing_date(self):
        response = self.client.post(
            f'/api/task-instances/{self.instance.id}/postpone/', {'is_in_backlog': True},
        )

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertTrue(self.instance.is_in_backlog)
        self.assertEqual(self.instance.scheduled_date, date(2026, 9, 14))  # unchanged

    def test_complete_sets_status_and_timestamp(self):
        response = self.client.post(f'/api/task-instances/{self.instance.id}/complete/')

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.status, 'done')
        self.assertIsNotNone(self.instance.completed_at)
        self.assertEqual(self.instance.events.filter(event_type='completed').count(), 1)

    def test_unauthenticated_request_is_rejected(self):
        anonymous_client = APIClient()
        response = anonymous_client.post(f'/api/task-instances/{self.instance.id}/complete/')

        self.assertEqual(response.status_code, 401)


class StandaloneTaskTests(TestCase):
    """One-off tasks created directly via the '+' button, not tied to any
    recurring HouseholdTaskDefinition."""

    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_standalone_task_with_a_day(self):
        response = self.client.post('/api/task-instances/', {
            'standalone_title': 'Pick up package',
            'standalone_icon': 'other',
            'scheduled_date': '2026-09-16',
            'assigned_to': self.user.id,
        })

        self.assertEqual(response.status_code, 201, response.data)
        instance = HouseholdTaskInstance.objects.get(id=response.data['id'])
        self.assertIsNone(instance.definition)
        self.assertEqual(instance.occurrence_date, date(2026, 9, 16))
        self.assertEqual(response.data['title'], 'Pick up package')
        self.assertEqual(instance.created_by, self.user)
        self.assertEqual(response.data['created_by_username'], 'tim')
        # Manually created tasks get the real creation moment, unlike
        # auto-generated ones (which get Monday-of-the-occurrence's-week).
        self.assertEqual(dj_timezone.localtime(instance.created_at).date(), dj_timezone.localdate())

    def test_create_standalone_task_without_a_day_goes_to_backlog(self):
        response = self.client.post('/api/task-instances/', {
            'standalone_title': 'Fix the shelf',
            'standalone_icon': 'tool',
            'scheduled_date': '2026-09-14',
            'is_in_backlog': True,
            'assigned_to': '',
        })

        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data['is_in_backlog'])
        self.assertIsNone(response.data['assigned_to'])


class TaskDefinitionDeletionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.definition = HouseholdTaskDefinition.objects.create(
            title='Take out trash',
            starts_on=date(2026, 9, 14),
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
        )

    def test_delete_without_instances_succeeds_immediately(self):
        response = self.client.delete(f'/api/task-definitions/{self.definition.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(HouseholdTaskDefinition.objects.filter(id=self.definition.id).exists())

    def test_delete_with_instances_requires_confirmation(self):
        HouseholdTaskInstance.objects.create(
            definition=self.definition, occurrence_date=date(2026, 9, 14), scheduled_date=date(2026, 9, 14),
        )

        response = self.client.delete(f'/api/task-definitions/{self.definition.id}/')

        self.assertEqual(response.status_code, 409)
        self.assertTrue(response.data['requires_confirmation'])
        self.assertEqual(response.data['instance_count'], 1)
        self.assertTrue(HouseholdTaskDefinition.objects.filter(id=self.definition.id).exists())

    def test_delete_with_confirm_flag_removes_definition_and_instances(self):
        instance = HouseholdTaskInstance.objects.create(
            definition=self.definition, occurrence_date=date(2026, 9, 14), scheduled_date=date(2026, 9, 14),
        )

        response = self.client.delete(f'/api/task-definitions/{self.definition.id}/?confirm=true')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(HouseholdTaskDefinition.objects.filter(id=self.definition.id).exists())
        self.assertFalse(HouseholdTaskInstance.objects.filter(id=instance.id).exists())


class RecipeApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.other = User.objects.create_user(username='anna', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.gram = UnitOfMeasure.objects.get(abbreviation_de='g')

    def _create(self, **extra):
        payload = {
            'title': 'Spaghetti', 'servings': 2,
            'ingredients': [
                {'ingredient_name': 'Spaghetti', 'quantity': '200', 'unit': self.gram.id},
                {'ingredient_name': 'Salz'},
            ],
            **extra,
        }
        return self.client.post('/api/recipes/', payload, format='json')

    def test_seed_data_present(self):
        self.assertTrue(Label.objects.filter(name_de='Schnell').exists())
        self.assertEqual(MealTimeCategory.objects.count(), 4)
        self.assertTrue(ShoppingList.objects.filter(is_favorite_for_cooking_plan=True).exists())

    def test_create_builds_ingredients_and_reuses_case_insensitively(self):
        first = self._create()
        second = self.client.post('/api/recipes/', {
            'title': 'Salat', 'ingredients': [{'ingredient_name': 'salz'}],
        }, format='json')

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(Ingredient.objects.filter(name__iexact='salz').count(), 1)
        self.assertEqual(first.data['ingredients'][0]['unit_name'], 'g')
        self.assertIsNone(first.data['ingredients'][1]['quantity'])

    def test_patch_without_ingredients_keeps_them_but_with_replaces(self):
        recipe_id = self._create().data['id']

        self.client.patch(f'/api/recipes/{recipe_id}/', {'title': 'Nudeln'}, format='json')
        self.assertEqual(Recipe.objects.get(pk=recipe_id).ingredients.count(), 2)

        self.client.patch(f'/api/recipes/{recipe_id}/', {
            'ingredients': [{'ingredient_name': 'Pfeffer'}],
        }, format='json')
        lines = Recipe.objects.get(pk=recipe_id).ingredients.all()
        self.assertEqual([line.ingredient.name for line in lines], ['Pfeffer'])

    def test_filters_by_query_label_and_category(self):
        label = Label.objects.get(name_de='Schnell')
        category = MealTimeCategory.objects.get(name_de='Abendessen')
        self._create(labels=[label.id], categories=[category.id])
        self.client.post('/api/recipes/', {'title': 'Kuchen'}, format='json')

        def titles(query):
            return [r['title'] for r in self.client.get(f'/api/recipes/?{query}').data['results']]

        self.assertEqual(titles(f'label={label.id}'), ['Spaghetti'])
        self.assertEqual(titles(f'category={category.id}'), ['Spaghetti'])
        self.assertEqual(titles('q=kuch'), ['Kuchen'])
        self.assertEqual(titles('q=salz'), ['Spaghetti'])

    def test_rating_average_my_rating_and_clear(self):
        recipe_id = self._create().data['id']
        self.client.post(f'/api/recipes/{recipe_id}/rate/', {'score': 5})
        other = APIClient()
        other.force_authenticate(user=self.other)
        response = other.post(f'/api/recipes/{recipe_id}/rate/', {'score': 2})

        self.assertEqual(response.data['average_rating'], 3.5)
        self.assertEqual(response.data['my_rating'], 2)
        self.assertEqual(len(response.data['ratings']), 2)

        # Re-rating changes the caller's own row rather than adding one.
        self.client.post(f'/api/recipes/{recipe_id}/rate/', {'score': 3})
        self.assertEqual(RecipeRating.objects.filter(recipe_id=recipe_id).count(), 2)

        cleared = self.client.delete(f'/api/recipes/{recipe_id}/rate/')
        self.assertIsNone(cleared.data['my_rating'])
        self.assertEqual(cleared.data['average_rating'], 2.0)

    def test_rating_rejects_out_of_range(self):
        recipe_id = self._create().data['id']

        self.assertEqual(self.client.post(f'/api/recipes/{recipe_id}/rate/', {'score': 6}).status_code, 400)
        self.assertEqual(self.client.post(f'/api/recipes/{recipe_id}/rate/', {'score': 'x'}).status_code, 400)

    def test_deleting_unit_or_ingredient_in_use_is_409(self):
        self._create()
        ingredient = Ingredient.objects.get(name='Spaghetti')

        self.assertEqual(self.client.delete(f'/api/units/{self.gram.id}/').status_code, 409)
        self.assertEqual(self.client.delete(f'/api/ingredients/{ingredient.id}/').status_code, 409)

    def test_duplicate_label_name_rejected_case_insensitively(self):
        response = self.client.post('/api/labels/', {'name_de': 'schnell', 'color_hex': '#111111'})

        self.assertEqual(response.status_code, 400)


class ShoppingApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.other = User.objects.create_user(username='anna', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.other_client = APIClient()
        self.other_client.force_authenticate(user=self.other)

    def test_only_one_favorite_list(self):
        new_id = self.client.post('/api/shopping-lists/', {
            'name': 'Baumarkt', 'is_favorite_for_cooking_plan': True,
        }, format='json').data['id']

        favorites = ShoppingList.objects.filter(is_favorite_for_cooking_plan=True)
        self.assertEqual([f.id for f in favorites], [new_id])

    def test_restricted_list_hidden_from_others_and_includes_creator(self):
        response = self.client.post('/api/shopping-lists/', {
            'name': 'Geschenke', 'visible_to': [self.user.id],
        }, format='json')
        list_id = response.data['id']

        mine = [item['id'] for item in self.client.get('/api/shopping-lists/').data['results']]
        theirs = [item['id'] for item in self.other_client.get('/api/shopping-lists/').data['results']]
        self.assertIn(list_id, mine)
        self.assertNotIn(list_id, theirs)
        self.assertEqual(self.other_client.get(f'/api/shopping-lists/{list_id}/').status_code, 404)

    def test_creator_is_added_when_they_forget_themselves(self):
        response = self.client.post('/api/shopping-lists/', {
            'name': 'Geheim', 'visible_to': [self.other.id],
        }, format='json')

        self.assertCountEqual(response.data['visible_to'], [self.user.id, self.other.id])

    def test_cannot_add_item_to_hidden_list_or_toggle_its_items(self):
        hidden = ShoppingList.objects.create(name='Privat')
        hidden.visible_to.add(self.user)
        item = ShoppingListItem.objects.create(shopping_list=hidden, title='Geheim', created_by=self.user)

        add = self.other_client.post('/api/shopping/', {'shopping_list': hidden.id, 'title': 'x'}, format='json')
        toggle = self.other_client.post('/api/shopping/toggle_completed/', {'id': item.id}, format='json')

        self.assertEqual(add.status_code, 400)
        self.assertEqual(toggle.status_code, 404)

    def test_item_with_quantity_unit_and_ingredient_autolink(self):
        shopping_list = ShoppingList.objects.first()
        milk = Ingredient.objects.create(name='Milch')
        litre = UnitOfMeasure.objects.get(abbreviation_de='l')

        response = self.client.post('/api/shopping/', {
            'shopping_list': shopping_list.id, 'title': 'milch', 'quantity': '2', 'unit': litre.id,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['ingredient'], milk.id)
        self.assertEqual(response.data['unit_name'], 'l')
        self.assertEqual(response.data['source'], 'manual')

    def test_filter_by_list_and_clear_completed(self):
        first = ShoppingList.objects.first()
        second = ShoppingList.objects.create(name='Drogerie')
        ShoppingListItem.objects.create(shopping_list=first, title='a', is_completed=True)
        ShoppingListItem.objects.create(shopping_list=first, title='b')
        ShoppingListItem.objects.create(shopping_list=second, title='c', is_completed=True)

        listed = self.client.get(f'/api/shopping/?list={first.id}').data['results']
        cleared = self.client.post(f'/api/shopping-lists/{first.id}/clear-completed/')

        self.assertEqual(len(listed), 2)
        self.assertEqual(cleared.data['deleted'], 1)
        self.assertEqual(second.items.count(), 1)

    def test_item_quantity_unit_and_title_are_editable(self):
        shopping_list = ShoppingList.objects.first()
        litre = UnitOfMeasure.objects.get(abbreviation_de='l')
        item = ShoppingListItem.objects.create(
            shopping_list=shopping_list, title='Milch', quantity='1', unit=litre, created_by=self.user,
        )

        response = self.client.patch(f'/api/shopping/{item.id}/', {
            'title': 'Hafermilch', 'quantity': '2', 'unit': litre.id,
        }, format='json')

        self.assertEqual(response.status_code, 200)
        item.refresh_from_db()
        self.assertEqual((item.title, item.quantity, item.unit), ('Hafermilch', Decimal('2'), litre))


class BilingualNamesTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_seeded_rows_have_both_languages(self):
        label = Label.objects.get(name_de='Schnell')
        unit = UnitOfMeasure.objects.get(name_de='Esslöffel')
        category = MealTimeCategory.objects.get(name_de='Frühstück')

        self.assertEqual(label.name_en, 'Quick')
        self.assertEqual((unit.abbreviation_de, unit.abbreviation_en), ('EL', 'tbsp'))
        self.assertEqual(category.name_en, 'Breakfast')

    def test_api_exposes_both_names_and_english_is_optional(self):
        response = self.client.post('/api/labels/', {'name_de': 'Herzhaft', 'color_hex': '#111111'})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['name_de'], 'Herzhaft')
        self.assertEqual(response.data['name_en'], '')

        updated = self.client.patch(f"/api/labels/{response.data['id']}/", {'name_en': 'Savory'})
        self.assertEqual(updated.data['name_en'], 'Savory')

    def test_german_name_is_required(self):
        response = self.client.post('/api/labels/', {'name_en': 'Only English', 'color_hex': '#111111'})

        self.assertEqual(response.status_code, 400)

    def test_unit_carries_both_abbreviations(self):
        response = self.client.post('/api/units/', {
            'name_de': 'Tasse', 'name_en': 'Cup', 'abbreviation_de': 'Tas.', 'abbreviation_en': 'cup',
        })

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['abbreviation_en'], 'cup')


class MealEventTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.recipe = Recipe.objects.create(title='Spaghetti', servings=2, created_by=self.user)
        self.other_recipe = Recipe.objects.create(title='Salat', servings=2, created_by=self.user)

    def _log(self, recipe, day, servings=2):
        return self.client.post('/api/meal-events/', {
            'recipe': recipe.id, 'date_cooked': day, 'servings_made': servings,
        }, format='json')

    def test_log_defaults_and_records_who(self):
        response = self.client.post('/api/meal-events/', {'recipe': self.recipe.id}, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['date_cooked'], str(dj_timezone.localdate()))
        self.assertEqual(response.data['logged_by_username'], 'tim')

    def test_future_date_rejected(self):
        tomorrow = dj_timezone.localdate() + timedelta(days=1)

        self.assertEqual(self._log(self.recipe, str(tomorrow)).status_code, 400)

    def test_recipe_shows_last_cooked_count_and_history(self):
        self._log(self.recipe, '2026-01-05')
        self._log(self.recipe, '2026-03-10')
        self._log(self.recipe, '2026-02-01')

        data = self.client.get(f'/api/recipes/{self.recipe.id}/').data

        self.assertEqual(data['last_cooked_date'], '2026-03-10')
        self.assertEqual(data['times_cooked'], 3)
        self.assertEqual([e['date_cooked'] for e in data['recent_meal_events']],
                         ['2026-03-10', '2026-02-01', '2026-01-05'])
        untouched = self.client.get(f'/api/recipes/{self.other_recipe.id}/').data
        self.assertIsNone(untouched['last_cooked_date'])
        self.assertEqual(untouched['times_cooked'], 0)

    def test_what_was_cooked_on_a_day_and_range(self):
        self._log(self.recipe, '2026-03-10')
        self._log(self.other_recipe, '2026-03-10')
        self._log(self.recipe, '2026-03-12')

        on_day = self.client.get('/api/meal-events/?date=2026-03-10').data['results']
        in_range = self.client.get('/api/meal-events/?start=2026-03-11&end=2026-03-31').data['results']
        for_recipe = self.client.get(f'/api/meal-events/?recipe={self.other_recipe.id}').data['results']

        self.assertCountEqual([e['recipe_title'] for e in on_day], ['Spaghetti', 'Salat'])
        self.assertEqual([e['date_cooked'] for e in in_range], ['2026-03-12'])
        self.assertEqual(len(for_recipe), 1)

    def test_deleting_an_entry_restores_last_cooked(self):
        self._log(self.recipe, '2026-01-05')
        mistake = self._log(self.recipe, '2026-03-10').data['id']

        self.assertEqual(self.client.delete(f'/api/meal-events/{mistake}/').status_code, 204)

        self.assertEqual(self.client.get(f'/api/recipes/{self.recipe.id}/').data['last_cooked_date'], '2026-01-05')

    def test_entries_are_not_editable(self):
        event_id = self._log(self.recipe, '2026-01-05').data['id']

        self.assertEqual(self.client.patch(f'/api/meal-events/{event_id}/', {'servings_made': 9}).status_code, 405)


class PurchaseHistoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.shopping_list = ShoppingList.objects.first()

    def _item(self, title='Milch', **extra):
        return ShoppingListItem.objects.create(shopping_list=self.shopping_list, title=title, created_by=self.user, **extra)

    def _toggle(self, item):
        return self.client.post('/api/shopping/toggle_completed/', {'id': item.id}, format='json')

    def test_ticking_logs_a_snapshot_and_unticking_removes_it(self):
        litre = UnitOfMeasure.objects.get(abbreviation_de='l')
        item = self._item(quantity='2', unit=litre)

        self._toggle(item)
        record = PurchaseRecord.objects.get()
        self.assertEqual((record.title, str(record.quantity), record.unit, record.list_name, record.purchased_by),
                         ('Milch', '2.00', litre, self.shopping_list.name, self.user))
        self.assertEqual(record.purchased_on, dj_timezone.localdate())

        self._toggle(item)
        self.assertEqual(PurchaseRecord.objects.count(), 0)

    def test_history_survives_deleting_item_and_clearing_completed(self):
        deleted = self._item('Brot')
        cleared = self._item('Butter')
        self._toggle(deleted)
        self._toggle(cleared)

        self.client.delete(f'/api/shopping/{deleted.id}/')
        self.client.post(f'/api/shopping-lists/{self.shopping_list.id}/clear-completed/')

        self.assertEqual(ShoppingListItem.objects.count(), 0)
        self.assertCountEqual(PurchaseRecord.objects.values_list('title', flat=True), ['Brot', 'Butter'])

    def test_completing_via_patch_also_logs_once(self):
        item = self._item()

        self.client.patch(f'/api/shopping/{item.id}/', {'is_completed': True}, format='json')
        self.client.patch(f'/api/shopping/{item.id}/', {'title': 'Vollmilch'}, format='json')

        self.assertEqual(PurchaseRecord.objects.count(), 1)

    def test_summary_groups_case_insensitively_and_ranks_by_count(self):
        for title in ('Milch', 'milch', 'Eier'):
            self._toggle(self._item(title))
        self._toggle(self._item('Milch', quantity='3'))

        data = self.client.get('/api/purchases/summary/').data

        self.assertEqual([(e['title'].lower(), e['count']) for e in data], [('milch', 3), ('eier', 1)])
        self.assertEqual(data[0]['quantity'], Decimal('3.00'))  # latest purchase's quantity

    def test_list_filters_by_range_and_name(self):
        PurchaseRecord.objects.create(title='Alt', purchased_on='2026-01-01')
        PurchaseRecord.objects.create(title='Neu', purchased_on='2026-06-01')

        by_range = self.client.get('/api/purchases/?start=2026-03-01').data['results']
        by_name = self.client.get('/api/purchases/?q=alt').data['results']

        self.assertEqual([r['title'] for r in by_range], ['Neu'])
        self.assertEqual([r['title'] for r in by_name], ['Alt'])

    def test_history_is_read_only(self):
        response = self.client.post('/api/purchases/', {'title': 'x'}, format='json')

        self.assertEqual(response.status_code, 405)


class PurchaseHistoryPerListTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.groceries = ShoppingList.objects.first()
        self.hardware = ShoppingList.objects.create(name='Baumarkt')

    def _buy(self, shopping_list, title):
        item = ShoppingListItem.objects.create(shopping_list=shopping_list, title=title, created_by=self.user)
        self.client.post('/api/shopping/toggle_completed/', {'id': item.id}, format='json')

    def test_records_carry_their_list_and_can_be_filtered(self):
        self._buy(self.groceries, 'Milch')
        self._buy(self.hardware, 'Schrauben')
        self._buy(self.groceries, 'Milch')

        groceries = self.client.get(f'/api/purchases/?list={self.groceries.id}').data['results']
        hardware = self.client.get(f'/api/purchases/?list={self.hardware.id}').data['results']
        summary = self.client.get(f'/api/purchases/summary/?list={self.groceries.id}').data

        self.assertEqual([r['title'] for r in groceries], ['Milch', 'Milch'])
        self.assertEqual([r['title'] for r in hardware], ['Schrauben'])
        self.assertEqual([(e['title'], e['count']) for e in summary], [('Milch', 2)])

    def test_history_outlives_the_list_but_is_no_longer_reachable_by_it(self):
        self._buy(self.hardware, 'Schrauben')
        list_id = self.hardware.id

        self.hardware.delete()

        record = PurchaseRecord.objects.get()
        self.assertIsNone(record.shopping_list)
        self.assertEqual(record.list_name, 'Baumarkt')
        self.assertEqual(self.client.get(f'/api/purchases/?list={list_id}').data['results'], [])


class CookingFixtureMixin:
    """Shared setup: two members, the seeded meal types, and small helpers."""

    def setUpCooking(self):
        self.tim = User.objects.create_user(username='tim', password='pw', email='tim@example.com')
        self.anna = User.objects.create_user(username='anna', password='pw', email='anna@example.com')
        HouseholdMember.objects.create(user=self.tim)
        HouseholdMember.objects.create(user=self.anna)
        self.client = APIClient()
        self.client.force_authenticate(user=self.tim)
        self.dinner = MealTimeCategory.objects.get(name_de='Abendessen')
        self.lunch = MealTimeCategory.objects.get(name_de='Mittagessen')
        self.today = dj_timezone.localdate()

    def recipe(self, title, categories=(), rating=None, cooked_days_ago=None, servings=2):
        recipe = Recipe.objects.create(title=title, servings=servings, created_by=self.tim)
        recipe.categories.set(categories)
        if rating is not None:
            RecipeRating.objects.create(recipe=recipe, rated_by=self.tim, score=rating)
        if cooked_days_ago is not None:
            MealEvent.objects.create(recipe=recipe, date_cooked=self.today - timedelta(days=cooked_days_ago))
        return recipe

    def add_entry(self, recipe, day, meal=None, **extra):
        payload = {'date': str(day), 'meal_category': (meal or self.dinner).id, 'recipe': recipe.id, **extra}
        return self.client.post('/api/cooking-plan-entries/', payload, format='json')


class CookingSuggestionsTests(CookingFixtureMixin, TestCase):
    def setUp(self):
        self.setUpCooking()
        config = CookingPlanConfig.load()
        config.craving_count, config.top_rating_percentile = 1, 50
        config.uncooked_threshold_days, config.random_count = 21, 1
        config.save()

    def _suggest(self, meal=None, **params):
        query = '&'.join(f'{k}={v}' for k, v in params.items())
        return self.client.get(f'/api/cooking-suggestions/?meal={(meal or self.dinner).id}&{query}')

    def _titles(self, data):
        return {bucket: [r['title'] for r in data[bucket]] for bucket in ('craving', 'top_rated', 'long_ago', 'random', 'rest')}

    def test_buckets_are_evaluated_top_down_and_exclusive(self):
        self.recipe('Top', [self.dinner], rating=5, cooked_days_ago=2)
        self.recipe('Lang', [self.dinner], rating=3, cooked_days_ago=60)
        self.recipe('Neu', [self.dinner])
        self.recipe('Mittel', [self.dinner], rating=4, cooked_days_ago=5)
        self.recipe('Schlecht', [self.dinner], rating=1, cooked_days_ago=3)
        self.recipe('Ohne', [])
        self.recipe('NurMittag', [self.lunch], rating=5)

        titles = self._titles(self._suggest().data)

        self.assertEqual(titles['craving'], ['Top'])
        self.assertEqual(titles['top_rated'], ['Mittel'])
        self.assertEqual(titles['long_ago'], ['Neu', 'Ohne', 'Lang'])  # never cooked first, then longest ago
        self.assertEqual(titles['random'], ['Schlecht'])
        self.assertEqual(titles['rest'], [])
        everything = [t for bucket in titles.values() for t in bucket]
        self.assertEqual(len(everything), len(set(everything)))
        self.assertNotIn('NurMittag', everything)  # other meal type is not offered
        self.assertIn('Ohne', everything)  # uncategorized recipes are offered for every meal

    def test_items_carry_rating_and_last_cooked(self):
        self.recipe('Top', [self.dinner], rating=5, cooked_days_ago=2)

        item = self._suggest().data['craving'][0]

        self.assertEqual(item['average_rating'], 5.0)
        self.assertEqual(item['last_cooked_date'], str(self.today - timedelta(days=2)))
        self.assertEqual(item['times_cooked'], 1)

    def test_exclude_hides_recipes_and_random_is_seedable(self):
        config = CookingPlanConfig.load()
        config.craving_count, config.random_count = 0, 3
        config.save()
        recipes = [self.recipe(f'R{i}', [self.dinner], rating=3, cooked_days_ago=1) for i in range(8)]

        first = self._titles(self._suggest(seed=7).data)['random']
        again = self._titles(self._suggest(seed=7).data)['random']
        excluded = self._titles(self._suggest(exclude=f'{recipes[0].id},{recipes[1].id}').data)

        self.assertEqual(first, again)
        self.assertEqual(len(first), 3)
        self.assertNotIn('R0', [t for bucket in excluded.values() for t in bucket])
        self.assertNotIn('R1', [t for bucket in excluded.values() for t in bucket])

    def test_requires_a_valid_meal(self):
        self.assertEqual(self.client.get('/api/cooking-suggestions/').status_code, 400)
        self.assertEqual(self.client.get('/api/cooking-suggestions/?meal=99999').status_code, 400)


class CookingPlanConfigTests(CookingFixtureMixin, TestCase):
    def setUp(self):
        self.setUpCooking()

    def test_defaults_plan_lunch_and_dinner(self):
        data = self.client.get('/api/cooking-plan-config/').data

        self.assertCountEqual(data['planned_meal_categories'], [self.lunch.id, self.dinner.id])
        self.assertEqual((data['top_rating_percentile'], data['uncooked_threshold_days']), (30, 21))
        self.assertEqual((data['rating_weight'], data['neglect_weight']), (0.7, 0.3))

    def test_patch_updates_and_rejects_bad_values(self):
        ok = self.client.patch('/api/cooking-plan-config/', {
            'random_count': 5, 'planned_meal_categories': [self.dinner.id],
        }, format='json')
        bad = self.client.patch('/api/cooking-plan-config/', {'top_rating_percentile': 0}, format='json')

        self.assertEqual(ok.data['random_count'], 5)
        self.assertEqual(ok.data['planned_meal_categories'], [self.dinner.id])
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(CookingPlanConfig.objects.count(), 1)


class CookingPlanEntryTests(CookingFixtureMixin, TestCase):
    def setUp(self):
        self.setUpCooking()
        self.pasta = self.recipe('Pasta', [self.dinner], servings=4)
        self.monday = self.today - timedelta(days=self.today.weekday())

    def test_cook_entry_defaults_servings_and_needs_a_recipe(self):
        ok = self.add_entry(self.pasta, self.monday)
        missing = self.client.post('/api/cooking-plan-entries/', {
            'date': str(self.monday), 'meal_category': self.dinner.id,
        }, format='json')

        self.assertEqual(ok.status_code, 201)
        self.assertEqual((ok.data['servings'], ok.data['recipe_title'], ok.data['kind']), (4, 'Pasta', 'cook'))
        self.assertIsNone(ok.data['task_instance'])
        self.assertEqual(missing.status_code, 400)

    def test_leftovers_need_a_cook_entry_and_copy_its_dish(self):
        cook = self.add_entry(self.pasta, self.monday, servings=3).data
        leftovers = self.client.post('/api/cooking-plan-entries/', {
            'date': str(self.monday + timedelta(days=1)), 'meal_category': self.lunch.id,
            'kind': 'leftovers', 'source_entry': cook['id'],
        }, format='json')
        orphan = self.client.post('/api/cooking-plan-entries/', {
            'date': str(self.monday), 'meal_category': self.lunch.id, 'kind': 'leftovers',
        }, format='json')
        chained = self.client.post('/api/cooking-plan-entries/', {
            'date': str(self.monday), 'meal_category': self.lunch.id, 'kind': 'leftovers',
            'source_entry': leftovers.data['id'],
        }, format='json')

        self.assertEqual(leftovers.status_code, 201)
        self.assertEqual((leftovers.data['recipe'], leftovers.data['servings']), (self.pasta.id, 3))
        self.assertEqual(leftovers.data['source_recipe_title'], 'Pasta')
        self.assertEqual(orphan.status_code, 400)
        self.assertEqual(chained.status_code, 400)  # leftovers of leftovers make no sense

    def test_list_filters_by_range(self):
        self.add_entry(self.pasta, self.monday)
        self.add_entry(self.pasta, self.monday + timedelta(days=10))

        week = self.client.get(f'/api/cooking-plan-entries/?start={self.monday}&end={self.monday + timedelta(days=6)}')

        self.assertEqual(len(week.data['results']), 1)

    def test_finalize_creates_one_open_task_per_cook_entry_only(self):
        cook = self.add_entry(self.pasta, self.monday).data
        self.client.post('/api/cooking-plan-entries/', {
            'date': str(self.monday + timedelta(days=1)), 'meal_category': self.lunch.id,
            'kind': 'leftovers', 'source_entry': cook['id'],
        }, format='json')
        body = {'start': str(self.monday), 'end': str(self.monday + timedelta(days=6))}

        first = self.client.post('/api/cooking-plan-entries/finalize/', body, format='json')
        second = self.client.post('/api/cooking-plan-entries/finalize/', body, format='json')

        self.assertEqual((first.data['created'], second.data['created']), (1, 0))
        task = HouseholdTaskInstance.objects.get()
        self.assertEqual(
            (task.standalone_title, task.system_action, task.standalone_icon, task.scheduled_date, task.assigned_to),
            ('Pasta', 'cook_meal', 'cooking', self.monday, None),
        )
        self.assertEqual(CookingPlanEntry.objects.get(pk=cook['id']).task_instance, task)
        self.assertEqual(self.client.post('/api/cooking-plan-entries/finalize/', {}, format='json').status_code, 400)

    def _finalized(self, day=None):
        entry = self.add_entry(self.pasta, day or self.monday).data
        self.client.post('/api/cooking-plan-entries/finalize/', {
            'start': str(self.monday - timedelta(days=7)), 'end': str(self.monday + timedelta(days=13)),
        }, format='json')
        return CookingPlanEntry.objects.get(pk=entry['id'])

    def test_editing_an_entry_moves_its_task_and_follows_recipe_changes(self):
        entry = self._finalized()
        leftovers = self.client.post('/api/cooking-plan-entries/', {
            'date': str(self.monday + timedelta(days=3)), 'meal_category': self.lunch.id,
            'kind': 'leftovers', 'source_entry': entry.id,
        }, format='json').data
        salad = self.recipe('Salat', [self.dinner])
        new_day = self.monday + timedelta(days=2)

        self.client.patch(f'/api/cooking-plan-entries/{entry.id}/', {'date': str(new_day), 'recipe': salad.id}, format='json')

        task = HouseholdTaskInstance.objects.get()
        self.assertEqual((task.scheduled_date, task.standalone_title), (new_day, 'Salat'))
        self.assertEqual(CookingPlanEntry.objects.get(pk=leftovers['id']).recipe, salad)

    def test_deleting_an_entry_removes_its_open_task_but_keeps_a_done_one(self):
        open_entry = self._finalized()
        self.client.delete(f'/api/cooking-plan-entries/{open_entry.id}/')
        self.assertEqual(HouseholdTaskInstance.objects.count(), 0)

        done_entry = self._finalized(self.monday + timedelta(days=1))
        self.client.post(f'/api/task-instances/{done_entry.task_instance_id}/complete/')
        self.client.delete(f'/api/cooking-plan-entries/{done_entry.id}/')
        self.assertEqual(HouseholdTaskInstance.objects.filter(status='done').count(), 1)

    def test_dragging_the_task_moves_the_dish_but_the_backlog_keeps_its_day(self):
        entry = self._finalized()
        task_id = entry.task_instance_id
        new_day = self.monday + timedelta(days=3)

        self.client.post(f'/api/task-instances/{task_id}/postpone/', {'scheduled_date': str(new_day)}, format='json')
        self.assertEqual(CookingPlanEntry.objects.get(pk=entry.id).date, new_day)

        self.client.post(f'/api/task-instances/{task_id}/postpone/', {'is_in_backlog': True}, format='json')
        self.assertEqual(CookingPlanEntry.objects.get(pk=entry.id).date, new_day)

    def test_completing_logs_the_meal_once_and_undo_removes_it(self):
        yesterday = self.today - timedelta(days=1)
        entry = self._finalized(yesterday)
        self.client.patch(f'/api/cooking-plan-entries/{entry.id}/', {'servings': 6}, format='json')

        done = self.client.post(f'/api/task-instances/{entry.task_instance_id}/complete/')
        self.client.post(f'/api/task-instances/{entry.task_instance_id}/complete/')

        event = MealEvent.objects.get()
        self.assertEqual((event.recipe, event.date_cooked, event.servings_made, event.logged_by),
                         (self.pasta, yesterday, 6, self.tim))
        self.assertTrue(done.data['cooking_entry']['is_cooked'])
        self.assertIsNone(done.data['cooking_entry']['my_rating'])  # the UI asks for one

        self.client.post(f'/api/task-instances/{entry.task_instance_id}/reopen/')
        self.assertEqual(MealEvent.objects.count(), 0)
        self.assertFalse(CookingPlanEntry.objects.get(pk=entry.id).meal_event_id)

    def test_future_dish_ticked_early_is_logged_for_today(self):
        entry = self._finalized(self.today + timedelta(days=3))

        self.client.post(f'/api/task-instances/{entry.task_instance_id}/complete/')

        self.assertEqual(MealEvent.objects.get().date_cooked, self.today)

    def test_task_reports_my_rating_after_cooking(self):
        entry = self._finalized()
        RecipeRating.objects.create(recipe=self.pasta, rated_by=self.tim, score=4)

        task = self.client.get(f'/api/task-instances/{entry.task_instance_id}/').data

        self.assertEqual(task['cooking_entry']['my_rating'], 4)
        self.assertEqual(task['cooking_entry']['meal_category_name_de'], 'Abendessen')

    def test_skipping_the_task_takes_the_dish_out_of_the_plan_and_undo_brings_it_back(self):
        entry = self._finalized()
        unplanned = self.add_entry(self.pasta, self.monday + timedelta(days=1)).data  # no task yet -> stays visible

        self.client.post(f'/api/task-instances/{entry.task_instance_id}/skip/')
        listed = [e['id'] for e in self.client.get('/api/cooking-plan-entries/').data['results']]
        self.assertEqual(listed, [unplanned['id']])

        self.client.post(f'/api/task-instances/{entry.task_instance_id}/reopen/')
        listed = [e['id'] for e in self.client.get('/api/cooking-plan-entries/').data['results']]
        self.assertCountEqual(listed, [entry.id, unplanned['id']])

    def test_snoozing_moves_the_dish_to_the_copy_and_undo_hands_it_back(self):
        entry = self._finalized()
        original_id = entry.task_instance_id

        self.client.post(f'/api/task-instances/{original_id}/snooze/')
        entry.refresh_from_db()
        copy = HouseholdTaskInstance.objects.get(origin_instance_id=original_id)
        self.assertEqual(entry.task_instance_id, copy.id)
        self.assertEqual(entry.date, self.monday + timedelta(days=7))

        self.client.post(f'/api/task-instances/{original_id}/reopen/')
        entry.refresh_from_db()
        self.assertEqual(entry.task_instance_id, original_id)
        self.assertEqual(entry.date, self.monday)
        self.assertFalse(HouseholdTaskInstance.objects.filter(pk=copy.id).exists())

    def test_deleting_the_task_or_the_recipe_cleans_up_the_plan(self):
        entry = self._finalized()
        self.client.delete(f'/api/task-instances/{entry.task_instance_id}/')
        self.assertEqual(CookingPlanEntry.objects.count(), 0)

        self._finalized(self.monday + timedelta(days=1))
        self.client.delete(f'/api/recipes/{self.pasta.id}/')
        self.assertEqual((CookingPlanEntry.objects.count(), HouseholdTaskInstance.objects.count()), (0, 0))

    def test_meal_type_in_the_plan_cannot_be_deleted(self):
        self.add_entry(self.pasta, self.monday)

        self.assertEqual(self.client.delete(f'/api/meal-categories/{self.dinner.id}/').status_code, 409)


class CookingShoppingTests(CookingFixtureMixin, TestCase):
    def setUp(self):
        self.setUpCooking()
        self.gram = UnitOfMeasure.objects.get(abbreviation_de='g')
        self.spoon = UnitOfMeasure.objects.get(abbreviation_de='EL')
        self.monday = self.today - timedelta(days=self.today.weekday())
        self.list = ShoppingList.objects.first()

    def _dish(self, title, lines, servings=2):
        recipe = self.recipe(title, [self.dinner], servings=servings)
        self.client.patch(f'/api/recipes/{recipe.id}/', {'ingredients': lines}, format='json')
        return Recipe.objects.get(pk=recipe.id)

    def test_recipe_shopping_lines_scale_and_flag_staples(self):
        Ingredient.objects.create(name='Salz', default_excluded_from_shopping_list=True)
        recipe = self._dish('Pasta', [
            {'ingredient_name': 'Spaghetti', 'quantity': '200', 'unit': self.gram.id},
            {'ingredient_name': 'Salz'},
        ])

        data = self.client.get(f'/api/recipes/{recipe.id}/shopping-lines/?servings=6').data

        spaghetti, salt = data['lines']
        self.assertEqual((data['recipe_title'], data['servings']), ('Pasta', 6))
        self.assertEqual((spaghetti['quantity'], spaghetti['unit'], spaghetti['excluded_by_default']), (600.0, self.gram.id, False))
        self.assertEqual((salt['quantity'], salt['excluded_by_default']), (None, True))

    def test_plan_preview_lists_open_cook_dishes_only(self):
        pasta = self._dish('Pasta', [{'ingredient_name': 'Spaghetti', 'quantity': '200', 'unit': self.gram.id}])
        cook = self.add_entry(pasta, self.monday, servings=4).data
        self.client.post('/api/cooking-plan-entries/', {
            'date': str(self.monday + timedelta(days=1)), 'meal_category': self.lunch.id,
            'kind': 'leftovers', 'source_entry': cook['id'],
        }, format='json')
        cooked = self.add_entry(pasta, self.monday + timedelta(days=2)).data
        CookingPlanEntry.objects.filter(pk=cooked['id']).update(
            meal_event=MealEvent.objects.create(recipe=pasta, date_cooked=self.monday),
        )

        preview = self.client.get(f'/api/cooking-plan-entries/shopping-preview/?start={self.monday}&end={self.monday + timedelta(days=6)}').data

        self.assertEqual(len(preview), 1)  # not the leftovers, not the already-cooked one
        self.assertEqual((preview[0]['entry'], preview[0]['servings'], preview[0]['lines'][0]['quantity']), (cook['id'], 4, 400.0))
        self.assertFalse(preview[0]['already_added'])

    def test_adding_ingredients_with_entries_flags_them_as_already_added(self):
        pasta = self._dish('Pasta', [{'ingredient_name': 'Spaghetti', 'quantity': '200', 'unit': self.gram.id}])
        cook = self.add_entry(pasta, self.monday, servings=4).data

        self.client.post(f'/api/shopping-lists/{self.list.id}/add-ingredients/', {
            'lines': [{'ingredient': None, 'title': 'Spaghetti', 'quantity': 800, 'unit': self.gram.id}],
            'entries': [cook['id']],
        }, format='json')
        preview = self.client.get(
            f'/api/cooking-plan-entries/shopping-preview/?start={self.monday}&end={self.monday + timedelta(days=6)}',
        ).data

        self.assertTrue(preview[0]['already_added'])
        self.assertIsNotNone(CookingPlanEntry.objects.get(pk=cook['id']).shopping_added_at)

    def test_adding_without_entries_does_not_flag_anything(self):
        pasta = self._dish('Pasta', [{'ingredient_name': 'Spaghetti', 'quantity': '200', 'unit': self.gram.id}])
        cook = self.add_entry(pasta, self.monday, servings=4).data

        self.client.post(f'/api/shopping-lists/{self.list.id}/add-ingredients/', {
            'lines': [{'ingredient': None, 'title': 'Spaghetti', 'quantity': 800, 'unit': self.gram.id}],
        }, format='json')

        self.assertIsNone(CookingPlanEntry.objects.get(pk=cook['id']).shopping_added_at)

    def test_adding_merges_same_ingredient_and_unit_and_tops_up_open_items(self):
        flour = Ingredient.objects.create(name='Mehl')
        ShoppingListItem.objects.create(shopping_list=self.list, title='Mehl', ingredient=flour, unit=self.gram, quantity=100)

        result = self.client.post(f'/api/shopping-lists/{self.list.id}/add-ingredients/', {'lines': [
            {'ingredient': flour.id, 'title': 'Mehl', 'quantity': 250, 'unit': self.gram.id},
            {'ingredient': flour.id, 'title': 'Mehl', 'quantity': 50, 'unit': self.gram.id},
            {'ingredient': flour.id, 'title': 'Mehl', 'quantity': 2, 'unit': self.spoon.id},  # other unit: separate line
            {'ingredient': None, 'title': 'Servietten', 'quantity': None, 'unit': None},
            {'ingredient': None, 'title': 'servietten', 'quantity': None, 'unit': None},
        ]}, format='json')

        self.assertEqual(result.data, {'created': 2, 'merged': 1})
        grams = ShoppingListItem.objects.get(ingredient=flour, unit=self.gram)
        self.assertEqual(grams.quantity, 400)
        self.assertEqual(ShoppingListItem.objects.get(ingredient=flour, unit=self.spoon).source, 'cooking_plan')
        self.assertEqual(ShoppingListItem.objects.filter(title__iexact='servietten').count(), 1)

    def test_a_completed_item_is_not_topped_up_but_bought_again(self):
        flour = Ingredient.objects.create(name='Mehl')
        ShoppingListItem.objects.create(
            shopping_list=self.list, title='Mehl', ingredient=flour, unit=self.gram, quantity=100, is_completed=True,
        )

        result = self.client.post(f'/api/shopping-lists/{self.list.id}/add-ingredients/', {'lines': [
            {'ingredient': flour.id, 'title': 'Mehl', 'quantity': 250, 'unit': self.gram.id},
        ]}, format='json')

        self.assertEqual(result.data, {'created': 1, 'merged': 0})

    def test_lines_must_be_a_list(self):
        response = self.client.post(f'/api/shopping-lists/{self.list.id}/add-ingredients/', {'lines': 'x'}, format='json')

        self.assertEqual(response.status_code, 400)


class CookingNotificationTests(CookingFixtureMixin, TestCase):
    def setUp(self):
        self.setUpCooking()
        self.task = HouseholdTaskInstance.objects.create(
            standalone_title='Pasta', system_action='cook_meal', occurrence_date=self.today, scheduled_date=self.today,
        )

    def test_an_unclaimed_cook_task_tells_the_whole_household_once(self):
        from django.core import mail
        from .services.notifications import notify_task_due

        notify_task_due(self.task)
        notify_task_due(self.task)

        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ['anna@example.com', 'tim@example.com'])
        self.assertEqual(mail.outbox[0].subject, 'Heute kochen wir: Pasta')
        self.assertTrue(NotificationPreference.objects.filter(notification_type='cooking_today').exists())

    def test_an_assigned_cook_task_only_tells_the_cook(self):
        from django.core import mail
        from .services.notifications import notify_task_due
        self.task.assigned_to = self.anna
        self.task.save()

        notify_task_due(self.task)

        self.assertEqual([m.to[0] for m in mail.outbox], ['anna@example.com'])

    def test_respects_the_users_preference(self):
        from django.core import mail
        from .services.notifications import notify_task_due
        NotificationPreference.objects.create(user=self.tim, notification_type='cooking_today', email_enabled=False)

        notify_task_due(self.task)

        self.assertEqual([m.to[0] for m in mail.outbox], ['anna@example.com'])

    def test_meal_planning_reminder_has_its_own_type(self):
        from django.core import mail
        from .services.notifications import notify_task_due
        reminder = HouseholdTaskInstance.objects.create(
            standalone_title='Weekly Meal Planning', system_action='weekly_meal_planning',
            occurrence_date=self.today, scheduled_date=self.today, assigned_to=self.tim,
        )

        notify_task_due(reminder)

        self.assertEqual(mail.outbox[0].subject, 'Kochplanung für nächste Woche ist fällig')

    def test_preferences_endpoint_lists_the_new_types(self):
        types = [p['notification_type'] for p in self.client.get('/api/notification-preferences/').data]

        self.assertIn('cooking_today', types)
        self.assertIn('meal_planning_due', types)


class LeftoversOrderTests(CookingFixtureMixin, TestCase):
    """Leftovers must come after the dish: a later day, or a later meal the same day."""

    def setUp(self):
        self.setUpCooking()
        self.pasta = self.recipe('Pasta', [self.dinner, self.lunch])
        self.monday = self.today - timedelta(days=self.today.weekday())

    def _leftovers(self, source, day, meal):
        return self.client.post('/api/cooking-plan-entries/', {
            'date': str(day), 'meal_category': meal.id, 'kind': 'leftovers', 'source_entry': source['id'],
        }, format='json')

    def test_same_meal_same_day_is_rejected(self):
        dish = self.add_entry(self.pasta, self.monday, meal=self.lunch).data

        response = self._leftovers(dish, self.monday, self.lunch)

        self.assertEqual(response.status_code, 400)
        self.assertIn('leftovers', response.data)

    def test_earlier_meal_on_the_same_day_is_rejected_but_a_later_one_is_fine(self):
        dish = self.add_entry(self.pasta, self.monday, meal=self.dinner).data
        cooked_at_lunch = self.add_entry(self.pasta, self.monday + timedelta(days=1), meal=self.lunch).data

        before = self._leftovers(dish, self.monday, self.lunch)
        cook_lunch_eat_dinner = self._leftovers(cooked_at_lunch, self.monday + timedelta(days=1), self.dinner)
        next_day = self._leftovers(dish, self.monday + timedelta(days=1), self.lunch)

        self.assertEqual(before.status_code, 400)
        self.assertEqual(cook_lunch_eat_dinner.status_code, 201)  # cook at lunch, leftovers in the evening
        self.assertEqual(next_day.status_code, 201)

    def test_an_earlier_day_is_rejected(self):
        dish = self.add_entry(self.pasta, self.monday + timedelta(days=2)).data

        self.assertEqual(self._leftovers(dish, self.monday + timedelta(days=1), self.dinner).status_code, 400)

    def test_moving_leftovers_before_or_onto_their_dish_is_rejected(self):
        dish = self.add_entry(self.pasta, self.monday + timedelta(days=1), meal=self.lunch).data
        leftovers = self._leftovers(dish, self.monday + timedelta(days=1), self.dinner).data

        onto = self.client.patch(f"/api/cooking-plan-entries/{leftovers['id']}/", {'meal_category': self.lunch.id}, format='json')
        before = self.client.patch(f"/api/cooking-plan-entries/{leftovers['id']}/", {'date': str(self.monday)}, format='json')
        later = self.client.patch(f"/api/cooking-plan-entries/{leftovers['id']}/", {'date': str(self.monday + timedelta(days=3))}, format='json')

        self.assertEqual((onto.status_code, before.status_code, later.status_code), (400, 400, 200))

    def test_moving_the_dish_past_or_onto_its_leftovers_is_rejected(self):
        dish = self.add_entry(self.pasta, self.monday, meal=self.lunch).data
        self._leftovers(dish, self.monday, self.dinner)  # same day, later meal

        onto = self.client.patch(f"/api/cooking-plan-entries/{dish['id']}/", {'meal_category': self.dinner.id}, format='json')
        past = self.client.patch(f"/api/cooking-plan-entries/{dish['id']}/", {'date': str(self.monday + timedelta(days=1))}, format='json')
        earlier = self.client.patch(f"/api/cooking-plan-entries/{dish['id']}/", {'notes': 'ok'}, format='json')

        self.assertEqual((onto.status_code, past.status_code, earlier.status_code), (400, 400, 200))

    def test_dragging_the_cook_task_past_the_leftovers_is_refused(self):
        dish = self.add_entry(self.pasta, self.monday).data
        self._leftovers(dish, self.monday + timedelta(days=2), self.lunch)
        self.client.post('/api/cooking-plan-entries/finalize/', {
            'start': str(self.monday), 'end': str(self.monday + timedelta(days=6)),
        }, format='json')
        entry = CookingPlanEntry.objects.get(pk=dish['id'])

        refused = self.client.post(f'/api/task-instances/{entry.task_instance_id}/postpone/',
                                   {'scheduled_date': str(self.monday + timedelta(days=3))}, format='json')
        fine = self.client.post(f'/api/task-instances/{entry.task_instance_id}/postpone/',
                                {'scheduled_date': str(self.monday + timedelta(days=1))}, format='json')

        self.assertEqual(refused.status_code, 400)
        self.assertIn('leftovers', refused.data)
        self.assertEqual(fine.status_code, 200)
        self.assertEqual(CookingPlanEntry.objects.get(pk=dish['id']).date, self.monday + timedelta(days=1))

    def test_snoozing_the_dish_takes_its_leftovers_along_and_undo_brings_them_back(self):
        dish = self.add_entry(self.pasta, self.monday).data
        leftovers = self._leftovers(dish, self.monday + timedelta(days=1), self.lunch).data
        self.client.post('/api/cooking-plan-entries/finalize/', {
            'start': str(self.monday), 'end': str(self.monday + timedelta(days=6)),
        }, format='json')
        task_id = CookingPlanEntry.objects.get(pk=dish['id']).task_instance_id

        self.client.post(f'/api/task-instances/{task_id}/snooze/')
        self.assertEqual(CookingPlanEntry.objects.get(pk=dish['id']).date, self.monday + timedelta(days=7))
        self.assertEqual(CookingPlanEntry.objects.get(pk=leftovers['id']).date, self.monday + timedelta(days=8))

        self.client.post(f'/api/task-instances/{task_id}/reopen/')
        self.assertEqual(CookingPlanEntry.objects.get(pk=dish['id']).date, self.monday)
        self.assertEqual(CookingPlanEntry.objects.get(pk=leftovers['id']).date, self.monday + timedelta(days=1))


class FreeDishTests(CookingFixtureMixin, TestCase):
    def setUp(self):
        self.setUpCooking()
        self.monday = self.today - timedelta(days=self.today.weekday())
        self.range = {'start': str(self.monday), 'end': str(self.monday + timedelta(days=6))}

    def _free(self, title='Tiefkühlpizza', day=None, **extra):
        return self.client.post('/api/cooking-plan-entries/', {
            'date': str(day or self.monday), 'meal_category': self.dinner.id, 'kind': 'free', 'title': title, **extra,
        }, format='json')

    def test_a_free_dish_needs_a_name_and_no_recipe(self):
        recipe = self.recipe('Pasta', [self.dinner])

        ok = self._free()
        nameless = self._free(title='  ')
        with_recipe = self._free(recipe=recipe.id)

        self.assertEqual(ok.status_code, 201)
        self.assertEqual((ok.data['recipe_title'], ok.data['recipe'], ok.data['servings']), ('Tiefkühlpizza', None, 2))
        self.assertEqual(nameless.status_code, 400)
        self.assertEqual(with_recipe.status_code, 400)

    def test_finalizing_gives_it_a_task_and_ticking_it_off_needs_no_recipe(self):
        entry = self._free().data
        self.client.post('/api/cooking-plan-entries/finalize/', self.range, format='json')
        task = HouseholdTaskInstance.objects.get()
        self.assertEqual((task.standalone_title, task.system_action), ('Tiefkühlpizza', 'cook_meal'))

        done = self.client.post(f'/api/task-instances/{task.id}/complete/')

        self.assertEqual(done.status_code, 200)
        self.assertIsNone(done.data['cooking_entry']['recipe'])
        self.assertIsNone(done.data['cooking_entry']['my_rating'])  # nothing to rate
        self.assertTrue(done.data['cooking_entry']['is_cooked'])
        self.assertEqual(MealEvent.objects.count(), 0)
        listed = self.client.get(f"/api/cooking-plan-entries/{entry['id']}/").data
        self.assertTrue(listed['is_cooked'])

    def test_its_name_goes_on_the_shopping_list_until_it_is_cooked(self):
        entry = self._free().data

        preview = self.client.get('/api/cooking-plan-entries/shopping-preview/', self.range).data

        self.assertEqual(len(preview), 1)
        self.assertEqual(preview[0]['recipe_title'], 'Tiefkühlpizza')
        self.assertEqual([(l['ingredient_name'], l['quantity'], l['excluded_by_default']) for l in preview[0]['lines']],
                         [('Tiefkühlpizza', None, False)])

        shopping_list = ShoppingList.objects.first()
        added = self.client.post(f'/api/shopping-lists/{shopping_list.id}/add-ingredients/', {'lines': [
            {'ingredient': None, 'title': 'Tiefkühlpizza', 'quantity': None, 'unit': None},
        ]}, format='json')
        self.assertEqual(added.data, {'created': 1, 'merged': 0})

        self.client.post('/api/cooking-plan-entries/finalize/', self.range, format='json')
        self.client.post(f"/api/task-instances/{CookingPlanEntry.objects.get(pk=entry['id']).task_instance_id}/complete/")
        self.assertEqual(self.client.get('/api/cooking-plan-entries/shopping-preview/', self.range).data, [])

    def test_renaming_follows_into_task_and_leftovers(self):
        entry = self._free().data
        leftovers = self.client.post('/api/cooking-plan-entries/', {
            'date': str(self.monday + timedelta(days=1)), 'meal_category': self.lunch.id,
            'kind': 'leftovers', 'source_entry': entry['id'],
        }, format='json').data
        self.client.post('/api/cooking-plan-entries/finalize/', self.range, format='json')

        self.client.patch(f"/api/cooking-plan-entries/{entry['id']}/", {'title': 'Pizza Margherita'}, format='json')
        blank = self.client.patch(f"/api/cooking-plan-entries/{entry['id']}/", {'title': ''}, format='json')

        self.assertEqual(leftovers['recipe_title'], 'Tiefkühlpizza')
        self.assertEqual(CookingPlanEntry.objects.get(pk=leftovers['id']).display_title, 'Pizza Margherita')
        self.assertEqual(HouseholdTaskInstance.objects.get().standalone_title, 'Pizza Margherita')
        self.assertEqual(blank.status_code, 400)

    def test_a_recipe_cannot_be_attached_later(self):
        entry = self._free().data
        recipe = self.recipe('Pasta', [self.dinner])

        self.client.patch(f"/api/cooking-plan-entries/{entry['id']}/", {'recipe': recipe.id}, format='json')

        self.assertIsNone(CookingPlanEntry.objects.get(pk=entry['id']).recipe)


class NotificationLanguageTests(CookingFixtureMixin, TestCase):
    def setUp(self):
        self.setUpCooking()
        self.task = HouseholdTaskInstance.objects.create(
            standalone_title='Pasta', system_action='cook_meal', occurrence_date=self.today, scheduled_date=self.today,
        )

    def _subjects_by_recipient(self):
        from django.core import mail
        return {m.to[0]: m.subject for m in mail.outbox}

    def test_default_is_german_and_each_member_gets_their_own_language(self):
        from .services.notifications import notify_task_due
        HouseholdMember.objects.filter(user=self.anna).update(notification_language='en')

        notify_task_due(self.task)

        self.assertEqual(self._subjects_by_recipient(), {
            'tim@example.com': 'Heute kochen wir: Pasta',
            'anna@example.com': 'Cooking today: Pasta',
        })

    def test_every_type_exists_in_every_language(self):
        from .models import NotificationPreference
        from .services.notifications import NOTIFICATION_MESSAGES
        types = {code for code, _ in NotificationPreference.NOTIFICATION_TYPE_CHOICES}

        for language, messages in NOTIFICATION_MESSAGES.items():
            self.assertEqual(set(messages), types, language)
            for text in messages.values():
                self.assertIn('subject', text)
                self.assertIn('body', text)

    def test_an_account_without_a_member_profile_gets_german(self):
        from .services.notifications import notification_language
        admin = User.objects.create_user(username='admin', password='pw')

        self.assertEqual(notification_language(admin), 'de')

    def test_ordinary_tasks_are_translated_too(self):
        from django.core import mail
        from .services.notifications import notify_task_due
        HouseholdMember.objects.filter(user=self.tim).update(notification_language='en')
        task = HouseholdTaskInstance.objects.create(
            standalone_title='Müll rausbringen', occurrence_date=self.today, scheduled_date=self.today, assigned_to=self.tim,
        )

        notify_task_due(task)

        self.assertEqual(mail.outbox[0].subject, 'Task due today: Müll rausbringen')

    def test_test_email_uses_the_users_language(self):
        from django.core import mail
        from .services.notifications import send_test_email
        HouseholdMember.objects.filter(user=self.anna).update(notification_language='en')

        send_test_email(self.tim)
        send_test_email(self.anna)

        self.assertEqual([m.subject for m in mail.outbox], ['HUSEHOLD Test-Benachrichtigung', 'HUSEHOLD test notification'])

    def test_language_is_a_member_setting_with_validated_choices(self):
        member = HouseholdMember.objects.get(user=self.tim)

        ok = self.client.patch(f'/api/members/{member.id}/', {'notification_language': 'en'}, format='json')
        bad = self.client.patch(f'/api/members/{member.id}/', {'notification_language': 'fr'}, format='json')

        self.assertEqual(ok.data['notification_language'], 'en')
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(self.client.get('/api/members/me/').data['notification_language'], 'en')


class StayLoggedInTests(TestCase):
    def setUp(self):
        User.objects.create_user(username='tim', password='pw')

    def test_refreshing_issues_a_new_refresh_token_and_the_session_lasts_half_a_year(self):
        from datetime import datetime, timezone as dt_timezone
        from rest_framework_simplejwt.tokens import RefreshToken
        client = APIClient()
        pair = client.post('/api/auth/token/', {'username': 'tim', 'password': 'pw'}, format='json').data

        refreshed = client.post('/api/auth/token/refresh/', {'refresh': pair['refresh']}, format='json')

        self.assertEqual(refreshed.status_code, 200)
        self.assertIn('access', refreshed.data)
        self.assertIn('refresh', refreshed.data)  # rotation: store this one from now on
        self.assertNotEqual(refreshed.data['refresh'], pair['refresh'])
        lifetime = datetime.fromtimestamp(RefreshToken(pair['refresh'])['exp'], dt_timezone.utc) - datetime.now(dt_timezone.utc)
        self.assertGreater(lifetime.days, 170)


class PackingListTests(TestCase):
    def setUp(self):
        self.tim = User.objects.create_user(username='tim', password='pw')
        self.anna = User.objects.create_user(username='anna', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.tim)
        self.today = dj_timezone.localdate()

    def test_creating_a_list_requires_at_least_one_participant(self):
        response = self.client.post('/api/packing-lists/', {
            'name': 'Beach week', 'start_date': self.today, 'end_date': self.today + timedelta(days=7),
            'participant_ids': [],
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(PackingList.objects.exists())

    def test_creating_a_list_adds_the_given_participants(self):
        response = self.client.post('/api/packing-lists/', {
            'name': 'Beach week', 'start_date': self.today, 'end_date': self.today + timedelta(days=7),
            'participant_ids': [self.tim.id, self.anna.id],
        }, format='json')

        self.assertEqual(response.status_code, 201)
        packing_list = PackingList.objects.get(pk=response.data['id'])
        self.assertEqual(
            set(packing_list.participants.values_list('user_id', flat=True)), {self.tim.id, self.anna.id},
        )

    def test_add_and_remove_participant(self):
        packing_list = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)
        PackingListParticipant.objects.create(packing_list=packing_list, user=self.tim)

        added = self.client.post(f'/api/packing-lists/{packing_list.id}/add-participant/', {'user_id': self.anna.id}, format='json')
        self.assertEqual(added.status_code, 200)
        self.assertTrue(PackingListParticipant.objects.filter(packing_list=packing_list, user=self.anna).exists())

        removed = self.client.post(f'/api/packing-lists/{packing_list.id}/remove-participant/', {'user_id': self.anna.id}, format='json')
        self.assertEqual(removed.status_code, 200)
        self.assertFalse(PackingListParticipant.objects.filter(packing_list=packing_list, user=self.anna).exists())

    def test_items_are_a_single_flat_list_not_split_per_participant(self):
        packing_list = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)
        PackingListParticipant.objects.create(packing_list=packing_list, user=self.tim)
        PackingListParticipant.objects.create(packing_list=packing_list, user=self.anna)

        response = self.client.post('/api/packing-items/', {'packing_list': packing_list.id, 'text': 'Sunscreen'}, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(list(PackingList.objects.get(pk=packing_list.id).items.values_list('text', flat=True)), ['Sunscreen'])

    def test_packing_items_are_filtered_by_list_query_param(self):
        list_a = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)
        list_b = PackingList.objects.create(name='Ski trip', start_date=self.today, end_date=self.today)
        PackingListItem.objects.create(packing_list=list_a, text='Towel')
        PackingListItem.objects.create(packing_list=list_b, text='Skis')

        response = self.client.get(f'/api/packing-items/?list={list_a.id}')

        self.assertEqual([i['text'] for i in response.data['results']], ['Towel'])

    def test_toggling_is_packed_via_patch(self):
        packing_list = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)
        item = PackingListItem.objects.create(packing_list=packing_list, text='Towel')

        response = self.client.patch(f'/api/packing-items/{item.id}/', {'is_packed': True}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_packed'])

    def test_add_bucket_copies_its_items_onto_the_list(self):
        bucket = PackingBucket.objects.create(name='Sommerurlaub', color_hex='#ffcc00')
        PackingBucketItem.objects.create(bucket=bucket, text='Sonnencreme')
        PackingBucketItem.objects.create(bucket=bucket, text='Badehose')
        packing_list = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)

        response = self.client.post(f'/api/packing-lists/{packing_list.id}/add-bucket/', {'bucket_id': bucket.id}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(PackingList.objects.get(pk=packing_list.id).items.values_list('text', flat=True)),
            {'Sonnencreme', 'Badehose'},
        )

    def test_a_bucket_cannot_be_added_twice_to_the_same_list(self):
        bucket = PackingBucket.objects.create(name='Sommerurlaub')
        PackingBucketItem.objects.create(bucket=bucket, text='Sonnencreme')
        packing_list = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)
        self.client.post(f'/api/packing-lists/{packing_list.id}/add-bucket/', {'bucket_id': bucket.id}, format='json')

        response = self.client.post(f'/api/packing-lists/{packing_list.id}/add-bucket/', {'bucket_id': bucket.id}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(packing_list.items.count(), 1)

    def test_add_bucket_skips_items_that_duplicate_an_existing_item_by_name(self):
        bucket = PackingBucket.objects.create(name='Sommerurlaub')
        PackingBucketItem.objects.create(bucket=bucket, text='sonnencreme')
        PackingBucketItem.objects.create(bucket=bucket, text='Badehose')
        packing_list = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)
        PackingListItem.objects.create(packing_list=packing_list, text='Sonnencreme')

        response = self.client.post(f'/api/packing-lists/{packing_list.id}/add-bucket/', {'bucket_id': bucket.id}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            sorted(packing_list.items.values_list('text', flat=True)), ['Badehose', 'Sonnencreme'],
        )

    def test_cannot_add_two_items_with_the_same_name_case_insensitive(self):
        packing_list = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)
        PackingListItem.objects.create(packing_list=packing_list, text='Sonnencreme')

        response = self.client.post('/api/packing-items/', {'packing_list': packing_list.id, 'text': 'sonnencreme '}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(packing_list.items.count(), 1)

    def test_cannot_rename_an_item_to_duplicate_another_items_name(self):
        packing_list = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)
        PackingListItem.objects.create(packing_list=packing_list, text='Sonnencreme')
        towel = PackingListItem.objects.create(packing_list=packing_list, text='Towel')

        response = self.client.patch(f'/api/packing-items/{towel.id}/', {'text': 'Sonnencreme'}, format='json')

        self.assertEqual(response.status_code, 400)

    def test_editing_a_bucket_afterward_does_not_change_lists_it_was_already_added_to(self):
        bucket = PackingBucket.objects.create(name='Sommerurlaub')
        PackingBucketItem.objects.create(bucket=bucket, text='Sonnencreme')
        packing_list = PackingList.objects.create(name='Beach week', start_date=self.today, end_date=self.today)
        self.client.post(f'/api/packing-lists/{packing_list.id}/add-bucket/', {'bucket_id': bucket.id}, format='json')

        PackingBucketItem.objects.create(bucket=bucket, text='Badehose')

        self.assertEqual(list(packing_list.items.values_list('text', flat=True)), ['Sonnencreme'])

    def test_bucket_items_are_shared_household_config_not_scoped_to_a_user(self):
        bucket = PackingBucket.objects.create(name='Übernachten')
        PackingBucketItem.objects.create(bucket=bucket, text='Kulturbeutel')
        self.client.force_authenticate(user=self.anna)

        response = self.client.get('/api/packing-buckets/')

        self.assertEqual([b['name'] for b in response.data['results']], ['Übernachten'])

    def test_bucket_item_create_and_delete(self):
        bucket = PackingBucket.objects.create(name='Sommerurlaub')

        created = self.client.post('/api/packing-bucket-items/', {'bucket': bucket.id, 'text': 'Sonnencreme'}, format='json')
        self.assertEqual(created.status_code, 201)

        deleted = self.client.delete(f"/api/packing-bucket-items/{created.data['id']}/")
        self.assertEqual(deleted.status_code, 204)
        self.assertFalse(bucket.items.exists())
