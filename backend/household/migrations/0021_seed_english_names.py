from django.db import migrations

# German name -> English translation for the rows seeded by 0018. Rows the
# household has renamed or added since are left untouched.
UNITS = {
    'Gramm': ('Gram', 'g'), 'Kilogramm': ('Kilogram', 'kg'), 'Milliliter': ('Milliliter', 'ml'),
    'Liter': ('Liter', 'l'), 'Esslöffel': ('Tablespoon', 'tbsp'), 'Teelöffel': ('Teaspoon', 'tsp'),
    'Stück': ('Piece', 'pc'), 'Packung': ('Package', 'pkg'), 'Prise': ('Pinch', ''),
    'Bund': ('Bunch', ''), 'Dose': ('Can', ''), 'Glas': ('Jar', ''), 'Zehe': ('Clove', ''),
    'Scheibe': ('Slice', ''),
}

LABELS = {
    'Schnell': 'Quick', 'Vegetarisch': 'Vegetarian', 'Vegan': 'Vegan', 'Soulfood': 'Comfort food',
    'Leicht': 'Light', 'Gäste': 'Guests', 'Festlich': 'Festive', 'Pasta': 'Pasta', 'Reis': 'Rice',
}

CATEGORIES = {
    'Frühstück': 'Breakfast', 'Mittagessen': 'Lunch', 'Abendessen': 'Dinner', 'Dessert & Snacks': 'Dessert & snacks',
}


def seed_english(apps, schema_editor):
    UnitOfMeasure = apps.get_model('household', 'UnitOfMeasure')
    Label = apps.get_model('household', 'Label')
    MealTimeCategory = apps.get_model('household', 'MealTimeCategory')

    for name_de, (name_en, abbreviation_en) in UNITS.items():
        UnitOfMeasure.objects.filter(name_de=name_de, name_en='').update(
            name_en=name_en, abbreviation_en=abbreviation_en,
        )
    for name_de, name_en in LABELS.items():
        Label.objects.filter(name_de=name_de, name_en='').update(name_en=name_en)
    for name_de, name_en in CATEGORIES.items():
        MealTimeCategory.objects.filter(name_de=name_de, name_en='').update(name_en=name_en)


class Migration(migrations.Migration):

    dependencies = [
        ('household', '0020_bilingual_names_and_meal_events'),
    ]

    operations = [
        migrations.RunPython(seed_english, migrations.RunPython.noop),
    ]
