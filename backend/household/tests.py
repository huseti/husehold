from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import HouseholdMember, HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent
from .services.task_generation import generate_instances_for_range


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

    def test_snooze_pushes_to_next_week_backlog_without_changing_status(self):
        response = self.client.post(f'/api/task-instances/{self.instance.id}/snooze/')

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.status, 'pending')
        self.assertTrue(self.instance.is_in_backlog)
        self.assertEqual(self.instance.scheduled_date, date(2026, 9, 21))  # next Monday
        self.assertEqual(self.instance.occurrence_date, date(2026, 9, 14))  # unchanged
        self.assertEqual(self.instance.events.filter(event_type='snoozed', actor=self.user).count(), 1)

    def test_skip_sets_status_and_logs_event(self):
        response = self.client.post(f'/api/task-instances/{self.instance.id}/skip/')

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.status, 'skipped')
        self.assertEqual(self.instance.events.filter(event_type='skipped', actor=self.user).count(), 1)

    def test_reassign_changes_assignee_and_logs_event(self):
        response = self.client.post(
            f'/api/task-instances/{self.instance.id}/reassign/', {'assigned_to': self.other.id},
        )

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.assigned_to, self.other)
        self.assertEqual(self.instance.events.filter(event_type='reassigned').count(), 1)

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
