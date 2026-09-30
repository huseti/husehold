from django.db import migrations

# (name_de, icon, color_hex) for the starter categories seeded in 0034.
ICONS_AND_COLORS = [
    ('Obst & Gemüse', 'produce', '#4caf50'),
    ('Brot & Backwaren', 'bakery', '#c08552'),
    ('Milchprodukte & Eier', 'dairy', '#4fc3f7'),
    ('Fleisch & Fisch', 'meat', '#e53935'),
    ('Tiefkühl', 'frozen', '#29b6f6'),
    ('Konserven & Trockenwaren', 'pantry', '#a1887f'),
    ('Gewürze & Backzutaten', 'spices', '#fb8c00'),
    ('Getränke', 'drinks', '#1e88e5'),
    ('Süßes & Snacks', 'sweets', '#ec407a'),
    ('Drogerie & Haushalt', 'household', '#7e57c2'),
    ('Sonstiges', 'other', '#9e9e9e'),
]


def seed(apps, schema_editor):
    IngredientCategory = apps.get_model('household', 'IngredientCategory')
    for name_de, icon, color_hex in ICONS_AND_COLORS:
        IngredientCategory.objects.filter(name_de=name_de).update(icon=icon, color_hex=color_hex)


def unseed(apps, schema_editor):
    # Fields themselves are removed by the preceding schema migration on
    # reversal; nothing to undo for the values.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('household', '0035_ingredientcategory_color_hex_ingredientcategory_icon'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
