from django.db import migrations


def backfill(apps, schema_editor):
    HouseholdTaskInstance = apps.get_model('household', 'HouseholdTaskInstance')
    HouseholdTaskInstance.objects.filter(occurrence_date__isnull=True).update(occurrence_date=None)
    for instance in HouseholdTaskInstance.objects.all():
        instance.occurrence_date = instance.scheduled_date
        if instance.status == 'snoozed':
            instance.status = 'pending'
            instance.is_in_backlog = True
        instance.save(update_fields=['occurrence_date', 'status', 'is_in_backlog'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('household', '0005_add_backlog_and_standalone_task_fields'),
    ]

    operations = [
        migrations.RunPython(backfill, noop_reverse),
    ]
