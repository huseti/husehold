"""Auto-categorizing shopping items/ingredients into an IngredientCategory
(Gemüse, Milchprodukte, ...) for the shopping list's thematic clustering --
see PLANNING.md item E.

Two-tier, cheapest-first: a curated offline dictionary handles the common
~150 German grocery words instantly and for free; a Claude API call is the
fallback for anything not in the dictionary (a new/unusual ingredient, or a
non-food item like "Batterien"). Results are stored on the Ingredient/
ShoppingListItem row, so the API is only ever called once per distinct new
name, not once per shopping list item.
"""
import requests
from django.conf import settings

from ..models import IngredientCategory

CLAUDE_MODEL = 'claude-haiku-4-5-20251001'

# keyword (lowercase, matched as a substring of the item/ingredient name) ->
# IngredientCategory.name_de. Order matters where one keyword could be a
# substring of another category's word -- more specific entries are listed
# first and the dictionary is scanned in insertion order.
_DICTIONARY = {
    # Obst & Gemüse
    'tomate': 'Obst & Gemüse', 'gurke': 'Obst & Gemüse', 'paprika': 'Obst & Gemüse',
    'zwiebel': 'Obst & Gemüse', 'knoblauch': 'Obst & Gemüse', 'karotte': 'Obst & Gemüse',
    'möhre': 'Obst & Gemüse', 'kartoffel': 'Obst & Gemüse', 'salat': 'Obst & Gemüse',
    'spinat': 'Obst & Gemüse', 'brokkoli': 'Obst & Gemüse', 'blumenkohl': 'Obst & Gemüse',
    'zucchini': 'Obst & Gemüse', 'aubergine': 'Obst & Gemüse', 'pilz': 'Obst & Gemüse',
    'champignon': 'Obst & Gemüse', 'lauch': 'Obst & Gemüse', 'sellerie': 'Obst & Gemüse',
    'kohl': 'Obst & Gemüse', 'radieschen': 'Obst & Gemüse', 'apfel': 'Obst & Gemüse',
    'birne': 'Obst & Gemüse', 'banane': 'Obst & Gemüse', 'orange': 'Obst & Gemüse',
    'zitrone': 'Obst & Gemüse', 'limette': 'Obst & Gemüse', 'traube': 'Obst & Gemüse',
    'beere': 'Obst & Gemüse', 'erdbeere': 'Obst & Gemüse', 'himbeere': 'Obst & Gemüse',
    'kiwi': 'Obst & Gemüse', 'melone': 'Obst & Gemüse', 'pfirsich': 'Obst & Gemüse',
    'avocado': 'Obst & Gemüse', 'kräuter': 'Obst & Gemüse', 'petersilie': 'Obst & Gemüse',
    'basilikum': 'Obst & Gemüse', 'ingwer': 'Obst & Gemüse',
    # Brot & Backwaren
    'brot': 'Brot & Backwaren', 'brötchen': 'Brot & Backwaren', 'toast': 'Brot & Backwaren',
    'baguette': 'Brot & Backwaren', 'croissant': 'Brot & Backwaren', 'kuchen': 'Brot & Backwaren',
    'brezel': 'Brot & Backwaren', 'waffel': 'Brot & Backwaren',
    # Milchprodukte & Eier
    'milch': 'Milchprodukte & Eier', 'käse': 'Milchprodukte & Eier', 'joghurt': 'Milchprodukte & Eier',
    'butter': 'Milchprodukte & Eier', 'quark': 'Milchprodukte & Eier', 'sahne': 'Milchprodukte & Eier',
    'ei ': 'Milchprodukte & Eier', 'eier': 'Milchprodukte & Eier', 'creme fraiche': 'Milchprodukte & Eier',
    'schmand': 'Milchprodukte & Eier', 'mozzarella': 'Milchprodukte & Eier', 'feta': 'Milchprodukte & Eier',
    'parmesan': 'Milchprodukte & Eier', 'frischkäse': 'Milchprodukte & Eier',
    # Fleisch & Fisch
    'hähnchen': 'Fleisch & Fisch', 'huhn': 'Fleisch & Fisch', 'pute': 'Fleisch & Fisch',
    'rind': 'Fleisch & Fisch', 'schwein': 'Fleisch & Fisch', 'hack': 'Fleisch & Fisch',
    'wurst': 'Fleisch & Fisch', 'schinken': 'Fleisch & Fisch', 'salami': 'Fleisch & Fisch',
    'speck': 'Fleisch & Fisch', 'lachs': 'Fleisch & Fisch', 'thunfisch': 'Fleisch & Fisch',
    'fisch': 'Fleisch & Fisch', 'garnele': 'Fleisch & Fisch', 'steak': 'Fleisch & Fisch',
    'tofu': 'Fleisch & Fisch',
    # Tiefkühl
    'tiefkühl': 'Tiefkühl', 'tiefgefroren': 'Tiefkühl', 'pizza': 'Tiefkühl',
    'eis ': 'Tiefkühl', 'eiscreme': 'Tiefkühl', 'pommes': 'Tiefkühl',
    # Konserven & Trockenwaren
    'nudel': 'Konserven & Trockenwaren', 'pasta': 'Konserven & Trockenwaren',
    'spaghetti': 'Konserven & Trockenwaren', 'reis': 'Konserven & Trockenwaren',
    'mehl': 'Konserven & Trockenwaren', 'linsen': 'Konserven & Trockenwaren',
    'bohnen': 'Konserven & Trockenwaren', 'kichererbsen': 'Konserven & Trockenwaren',
    'passata': 'Konserven & Trockenwaren', 'dosentomate': 'Konserven & Trockenwaren',
    'brühe': 'Konserven & Trockenwaren', 'müsli': 'Konserven & Trockenwaren',
    'haferflocken': 'Konserven & Trockenwaren', 'cornflakes': 'Konserven & Trockenwaren',
    'honig': 'Konserven & Trockenwaren', 'marmelade': 'Konserven & Trockenwaren',
    'nussmus': 'Konserven & Trockenwaren', 'öl': 'Konserven & Trockenwaren',
    'essig': 'Konserven & Trockenwaren',
    # Gewürze & Backzutaten
    'salz': 'Gewürze & Backzutaten', 'pfeffer': 'Gewürze & Backzutaten', 'zucker': 'Gewürze & Backzutaten',
    'vanille': 'Gewürze & Backzutaten', 'backpulver': 'Gewürze & Backzutaten', 'hefe': 'Gewürze & Backzutaten',
    'paprikapulver': 'Gewürze & Backzutaten', 'currypulver': 'Gewürze & Backzutaten',
    'zimt': 'Gewürze & Backzutaten', 'gewürz': 'Gewürze & Backzutaten',
    # Getränke
    'wasser': 'Getränke', 'saft': 'Getränke', 'limonade': 'Getränke', 'cola': 'Getränke',
    'bier': 'Getränke', 'wein': 'Getränke', 'sekt': 'Getränke', 'kaffee': 'Getränke',
    'tee': 'Getränke',
    # Süßes & Snacks
    'schokolade': 'Süßes & Snacks', 'keks': 'Süßes & Snacks', 'gummibär': 'Süßes & Snacks',
    'chips': 'Süßes & Snacks', 'nüsse': 'Süßes & Snacks', 'popcorn': 'Süßes & Snacks',
    'bonbon': 'Süßes & Snacks',
    # Drogerie & Haushalt
    'toilettenpapier': 'Drogerie & Haushalt', 'küchenrolle': 'Drogerie & Haushalt',
    'spülmittel': 'Drogerie & Haushalt', 'waschmittel': 'Drogerie & Haushalt',
    'müllbeutel': 'Drogerie & Haushalt', 'batterie': 'Drogerie & Haushalt',
    'zahnpasta': 'Drogerie & Haushalt', 'shampoo': 'Drogerie & Haushalt',
    'duschgel': 'Drogerie & Haushalt', 'seife': 'Drogerie & Haushalt',
    'windel': 'Drogerie & Haushalt',
}


def _dictionary_lookup(name):
    lowered = f' {name.lower()} '
    for keyword, category_name in _DICTIONARY.items():
        if keyword in lowered:
            return category_name
    return None


def _llm_lookup(name, category_names):
    if not settings.ANTHROPIC_API_KEY:
        return None
    try:
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': settings.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            json={
                'model': CLAUDE_MODEL,
                'max_tokens': 20,
                # Deterministic classification into a fixed category list --
                # no reason to let sampling vary the answer.
                'temperature': 0,
                'system': (
                    'You sort German grocery/household shopping list items into exactly '
                    f'one of these categories: {", ".join(category_names)}. '
                    'Reply with only the category name, exactly as given, nothing else.'
                ),
                'messages': [{'role': 'user', 'content': name}],
            },
            timeout=10,
        )
        response.raise_for_status()
        text = response.json()['content'][0]['text'].strip()
        return text if text in category_names else None
    except Exception:
        return None


def categorize_text(name):
    """Returns the best-matching IngredientCategory for a raw name, or None
    if nothing is configured/matched. Dictionary first, LLM fallback."""
    categories = list(IngredientCategory.objects.values_list('name_de', flat=True))
    if not categories:
        return None
    category_name = _dictionary_lookup(name)
    if category_name is None:
        category_name = _llm_lookup(name, categories)
    if category_name is None:
        return None
    return IngredientCategory.objects.filter(name_de=category_name).first()


def categorize_ingredient(ingredient):
    """Sets ingredient.category if it isn't already set. No-op otherwise --
    never overwrites a category someone (or a previous run) already chose."""
    if ingredient.category_id is not None:
        return
    category = categorize_text(ingredient.name)
    if category:
        ingredient.category = category
        ingredient.save(update_fields=['category'])


def categorize_shopping_item(item):
    """Sets item.category if it isn't already set -- copied from the linked
    ingredient's category when there is one (free, no API call), else
    categorized directly from the item's own title (covers non-food items
    that never get an Ingredient row, e.g. "Batterien")."""
    if item.category_id is not None:
        return
    if item.ingredient_id and item.ingredient.category_id:
        item.category = item.ingredient.category
        item.save(update_fields=['category'])
        return
    category = categorize_text(item.title)
    if category:
        item.category = category
        item.save(update_fields=['category'])
