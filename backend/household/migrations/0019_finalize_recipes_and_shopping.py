import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('household', '0018_seed_recipe_data_and_backfill'),
    ]

    operations = [
        migrations.RemoveField(model_name='recipe', name='legacy_ingredients'),
        migrations.AlterField(
            model_name='shoppinglistitem',
            name='shopping_list',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='household.shoppinglist'),
        ),
    ]
