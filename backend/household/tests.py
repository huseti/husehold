import tempfile
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone as dj_timezone
from rest_framework.test import APIClient

from .models import (
    HouseholdMember, HouseholdSettings, HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent,
    Ingredient, Label, MealEvent, MealTimeCategory, Recipe, RecipeRating, ShoppingList, ShoppingListItem, UnitOfMeasure,
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
