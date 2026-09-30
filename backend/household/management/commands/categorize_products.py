from django.core.management.base import BaseCommand

from household.models import Ingredient, ShoppingListItem
from household.services.ingredient_categorization import categorize_ingredient, categorize_shopping_item


class Command(BaseCommand):
    help = (
        "One-off bulk pass: categorizes every existing Ingredient and "
        "ShoppingListItem that doesn't have a category yet (dictionary, "
        "then an LLM fallback if ANTHROPIC_API_KEY is set). New items get "
        "categorized automatically on creation -- this is only for "
        "backfilling data that existed before that logic shipped."
    )

    def handle(self, *args, **options):
        # Evaluated into a list up front -- categorizing mutates category,
        # so the filter would otherwise match fewer rows with every save.
        ingredients = list(Ingredient.objects.filter(category__isnull=True))
        for ingredient in ingredients:
            categorize_ingredient(ingredient)
        self.stdout.write(f'Checked {len(ingredients)} ingredient(s).')

        items = list(ShoppingListItem.objects.filter(category__isnull=True))
        for item in items:
            categorize_shopping_item(item)
        self.stdout.write(f'Checked {len(items)} shopping list item(s).')

        self.stdout.write(self.style.SUCCESS('Done.'))
