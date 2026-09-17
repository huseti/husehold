import tempfile
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import HouseholdMember, HouseholdSettings, HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent
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
