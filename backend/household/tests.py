from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import HouseholdTaskDefinition, HouseholdTaskInstance, HouseholdTaskEvent
from .services.task_generation import generate_instances_for_range


class TaskGenerationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tim', password='pw')

    def test_weekly_recurrence_generates_one_instance_per_week(self):
        definition = HouseholdTaskDefinition.objects.create(
            title='Take out trash',
            starts_on=date(2026, 1, 5),  # a Monday
            recurrence_rule='FREQ=WEEKLY;BYDAY=MO',
            default_assignee=self.user,
        )

        created = generate_instances_for_range(date(2026, 9, 14), date(2026, 9, 28))

        self.assertEqual(len(created), 3)
        dates = sorted(i.scheduled_date for i in created)
        self.assertEqual(dates, [date(2026, 9, 14), date(2026, 9, 21), date(2026, 9, 28)])
        self.assertTrue(all(i.assigned_to == self.user for i in created))

    def test_first_monday_of_month_recurrence(self):
        HouseholdTaskDefinition.objects.create(
            title='Deep clean bathroom',
            starts_on=date(2026, 1, 1),
            recurrence_rule='FREQ=MONTHLY;BYDAY=1MO',
        )

        created = generate_instances_for_range(date(2026, 9, 1), date(2026, 12, 31))

        dates = sorted(i.scheduled_date for i in created)
        self.assertEqual(dates, [date(2026, 9, 7), date(2026, 10, 5), date(2026, 11, 2), date(2026, 12, 7)])

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
            definition=self.definition, scheduled_date=date(2026, 9, 14), assigned_to=self.user,
        )

    def test_snooze_sets_status_and_logs_event(self):
        response = self.client.post(f'/api/task-instances/{self.instance.id}/snooze/')

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.status, 'snoozed')
        self.assertEqual(self.instance.events.filter(event_type='snoozed', actor=self.user).count(), 1)

    def test_reassign_changes_assignee_and_logs_event(self):
        response = self.client.post(
            f'/api/task-instances/{self.instance.id}/reassign/', {'assigned_to': self.other.id},
        )

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.assigned_to, self.other)
        self.assertEqual(self.instance.events.filter(event_type='reassigned').count(), 1)

    def test_postpone_changes_scheduled_date(self):
        response = self.client.post(
            f'/api/task-instances/{self.instance.id}/postpone/', {'scheduled_date': '2026-09-16'},
        )

        self.assertEqual(response.status_code, 200)
        self.instance.refresh_from_db()
        self.assertEqual(self.instance.scheduled_date, date(2026, 9, 16))
        self.assertEqual(self.instance.events.filter(event_type='postponed').count(), 1)

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
        HouseholdTaskInstance.objects.create(definition=self.definition, scheduled_date=date(2026, 9, 14))

        response = self.client.delete(f'/api/task-definitions/{self.definition.id}/')

        self.assertEqual(response.status_code, 409)
        self.assertTrue(response.data['requires_confirmation'])
        self.assertEqual(response.data['instance_count'], 1)
        self.assertTrue(HouseholdTaskDefinition.objects.filter(id=self.definition.id).exists())

    def test_delete_with_confirm_flag_removes_definition_and_instances(self):
        instance = HouseholdTaskInstance.objects.create(definition=self.definition, scheduled_date=date(2026, 9, 14))

        response = self.client.delete(f'/api/task-definitions/{self.definition.id}/?confirm=true')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(HouseholdTaskDefinition.objects.filter(id=self.definition.id).exists())
        self.assertFalse(HouseholdTaskInstance.objects.filter(id=instance.id).exists())
