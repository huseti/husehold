from django.db import migrations

# sort_order roughly mirrors a typical German supermarket walk -- fresh
# produce near the entrance, then bread, chilled, meat/fish, frozen, dry
# goods, spices/baking, drinks, sweets, and household/drugstore items last.
# Tim can freely reorder/rename/add via Settings -- this is just a sane
# starting point, not a fixed taxonomy.
CATEGORIES = [
    ('Obst & Gemüse', 'Fruit & Vegetables', 10),
    ('Brot & Backwaren', 'Bread & Baked Goods', 20),
    ('Milchprodukte & Eier', 'Dairy & Eggs', 30),
    ('Fleisch & Fisch', 'Meat & Fish', 40),
    ('Tiefkühl', 'Frozen', 50),
    ('Konserven & Trockenwaren', 'Canned & Dry Goods', 60),
    ('Gewürze & Backzutaten', 'Spices & Baking', 70),
    ('Getränke', 'Beverages', 80),
    ('Süßes & Snacks', 'Sweets & Snacks', 90),
    ('Drogerie & Haushalt', 'Drugstore & Household', 100),
    ('Sonstiges', 'Other', 999),
]


def seed(apps, schema_editor):
    IngredientCategory = apps.get_model('household', 'IngredientCategory')
    for name_de, name_en, sort_order in CATEGORIES:
        IngredientCategory.objects.get_or_create(
            name_de=name_de, defaults={'name_en': name_en, 'sort_order': sort_order},
        )


def unseed(apps, schema_editor):
    IngredientCategory = apps.get_model('household', 'IngredientCategory')
    IngredientCategory.objects.filter(name_de__in=[c[0] for c in CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('household', '0033_ingredientcategory_ingredient_category_and_more'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
