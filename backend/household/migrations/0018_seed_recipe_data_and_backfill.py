from django.db import migrations

UNITS = [
    ('Gramm', 'g'), ('Kilogramm', 'kg'), ('Milliliter', 'ml'), ('Liter', 'l'),
    ('Esslöffel', 'EL'), ('Teelöffel', 'TL'), ('Stück', 'Stk'), ('Packung', 'Pkg'),
    ('Prise', ''), ('Bund', ''), ('Dose', ''), ('Glas', ''), ('Zehe', ''), ('Scheibe', ''),
]

LABELS = [
    ('Schnell', '#d98c2b'), ('Vegetarisch', '#5b7a5e'), ('Vegan', '#3f8f6b'),
    ('Soulfood', '#a8613f'), ('Leicht', '#5a94b8'), ('Gäste', '#8a6bb0'),
    ('Festlich', '#b8506e'), ('Pasta', '#c9a227'), ('Reis', '#7a8a99'),
]

CATEGORIES = ['Frühstück', 'Mittagessen', 'Abendessen', 'Dessert & Snacks']


def seed_and_backfill(apps, schema_editor):
    UnitOfMeasure = apps.get_model('household', 'UnitOfMeasure')
    Label = apps.get_model('household', 'Label')
    MealTimeCategory = apps.get_model('household', 'MealTimeCategory')
    Recipe = apps.get_model('household', 'Recipe')
    ShoppingList = apps.get_model('household', 'ShoppingList')
    ShoppingListItem = apps.get_model('household', 'ShoppingListItem')

    # Names are seeded in German (the app's default UI language); they're
    # ordinary editable rows afterwards, not translation keys.
    for order, (name, abbreviation) in enumerate(UNITS):
        UnitOfMeasure.objects.get_or_create(name=name, defaults={'abbreviation': abbreviation, 'sort_order': order})
    for name, color in LABELS:
        Label.objects.get_or_create(name=name, defaults={'color_hex': color})
    for order, name in enumerate(CATEGORIES):
        MealTimeCategory.objects.get_or_create(name=name, defaults={'sort_order': order})

    # Old free-text ingredients had nowhere structured to go; park them in
    # notes so nothing is lost and they can be re-entered properly.
    for recipe in Recipe.objects.exclude(legacy_ingredients=''):
        header = 'Zutaten (aus altem Format):\n'
        recipe.notes = header + recipe.legacy_ingredients + ('\n\n' + recipe.notes if recipe.notes else '')
        recipe.save(update_fields=['notes'])

    default_list = ShoppingList.objects.filter(name='Einkaufsliste').first() or ShoppingList.objects.create(
        name='Einkaufsliste', is_favorite_for_cooking_plan=True,
    )
    ShoppingListItem.objects.filter(shopping_list__isnull=True).update(shopping_list=default_list)


class Migration(migrations.Migration):

    dependencies = [
        ('household', '0017_recipes_and_shopping_structure'),
    ]

    operations = [
        migrations.RunPython(seed_and_backfill, migrations.RunPython.noop),
    ]
