import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('household', '0006_backfill_occurrence_date_and_remap_snoozed'),
    ]

    operations = [
        migrations.AlterField(
            model_name='householdtaskinstance',
            name='occurrence_date',
            field=models.DateField(),
        ),
        migrations.AlterUniqueTogether(
            name='householdtaskinstance',
            unique_together={('definition', 'occurrence_date')},
        ),
    ]
