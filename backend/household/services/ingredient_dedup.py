"""AI suggestions for the config page's duplicate finder: which ingredients
are the same thing written differently ("Hokkaidokürbis", "Hokkaido-
Kürbis(se), geputzt gewogen"), and which names carry units or preparation
notes that belong in the recipe line instead ("Zehe(n) Knoblauch").

One Claude call over the whole catalogue (a few hundred short names is a
few thousand tokens in, around a cent all in on Haiku) with a JSON schema
so the answer is always parseable. The answer is only a suggestion: it is
validated against the database here, shown to the user, and nothing changes
until they confirm a group (services/ingredient_merge.py).
"""
import json
import logging

import requests
from django.conf import settings
from django.db.models import Count

from ..models import DismissedDuplicateSuggestion, Ingredient, UnitOfMeasure
from .api_usage import record_claude_call
from .claude import response_text

logger = logging.getLogger(__name__)

CLAUDE_MODEL = 'claude-haiku-5-5'
MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

SYSTEM_PROMPT = """You clean up the ingredient catalogue of a German household recipe app.
You get every ingredient as "id | name | number of recipes using it", and the list of units.

An ingredient name is ONLY the product as written on a shopping list. It never
contains: quantities or ranges ("250-300 ml", "2", "ca. 125 g"), unit words ("Zehe",
"Pck.", "Msp.", "Stück", "Kugel", "Stange", "Tasse", "Schuss", "Spritzer", "Dose"),
preparation ("fein gehackt", "geputzt gewogen", "gewürfelt"), usage hints ("zum
Abschmecken", "als Topping", "optional", "nach Bedarf"), sizes ("große", "m.-große"),
brands or examples ("z. B. von Milkana", "Exquisa") or variant notes in parentheses
("(ungesüßt)", "(light)", "(Gr. M)"). Keep only qualifiers that make it a different
product: "rote Linsen", "Mehl Type 405", "griechischer Joghurt", "passierte Tomaten".

Return groups of ingredient ids that should become ONE ingredient:
1. Duplicates: the same product written differently -- singular/plural, "(n)"/"(s)",
   hyphenation, typos, word order, or any of the extras above in the name
   ("Zwiebel", "Zwiebeln", "Zwiebel(n), in Ringe geschnitten", "große Zwiebel(n)";
   "Knoblauchzehe" belongs with "Knoblauch", unit Zehe). Do NOT group different
   products: "Knoblauch" vs "Knoblauchgewürz", "Tomaten" vs "passierte Tomaten" vs
   "getrocknete Tomaten", "Zwiebeln" vs "rote Zwiebeln" vs "Frühlingszwiebeln",
   "Milch" vs "Mandelmilch". When unsure, leave it out.
2. Cleanup: a single ingredient whose name contains any of the extras above, even
   without a duplicate -- a group with that one id.

For each group:
- keep_id: the member whose id survives -- prefer the one used by most recipes.
- name: the clean name. Prefer an existing spelling when one is already clean.
- preferred_unit: the unit this ingredient is usually measured in, or null if there
  is no obvious one.
- members: every id of the group (keep_id included) with
  - note: what THAT member's name said beyond the product -- preparation, usage
    hint, size, variant, brand ("in Ringe geschnitten", "ungesüßt", "groß",
    "z. B. von Milkana") -- or "".
  - quantity: the amount from THAT member's name, digits only ("2", "1,5",
    "250-300"), or "".
  - unit: the unit word from THAT member's name ("Zehe(n) Knoblauch" ->
    "Zehe", "Knoblauchzehen" -> "Zehe", "250-300 ml Mandelmilch" -> "Milliliter"),
    or null.
Write units (unit, preferred_unit) exactly as in the unit list when it has one; if
it has none, give the plain German singular ("Tasse", "Schuss", "Spritzer", "Stange")
-- the user can add it.

Only return groups where something actually changes. Every id at most once."""

RESPONSE_SCHEMA = {
    'type': 'object',
    'properties': {
        'groups': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'keep_id': {'type': 'integer'},
                    'name': {'type': 'string'},
                    'preferred_unit': {'anyOf': [{'type': 'string'}, {'type': 'null'}]},
                    'members': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'id': {'type': 'integer'},
                                'note': {'type': 'string'},
                                'quantity': {'type': 'string'},
                                'unit': {'anyOf': [{'type': 'string'}, {'type': 'null'}]},
                            },
                            'required': ['id', 'note', 'quantity', 'unit'],
                            'additionalProperties': False,
                        },
                    },
                },
                'required': ['keep_id', 'name', 'preferred_unit', 'members'],
                'additionalProperties': False,
            },
        },
    },
    'required': ['groups'],
    'additionalProperties': False,
}


class DedupError(Exception):
    """A user-facing failure -- message is safe to show in the UI."""


def _unit_lookup(units):
    lookup = {}
    for unit in units:
        for spelling in (unit.name_de, unit.abbreviation_de, unit.name_en, unit.abbreviation_en):
            if spelling:
                lookup.setdefault(spelling.strip().lower().rstrip('.'), unit)
    return lookup


def _ask_claude(ingredients, units):
    catalogue = '\n'.join(f'{i.id} | {i.name} | {i.recipe_count}' for i in ingredients)
    unit_list = ', '.join(u.name_de for u in units)
    response = requests.post(
        MESSAGES_URL,
        headers={
            'x-api-key': settings.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        json={
            'model': CLAUDE_MODEL,
            # ~400 ingredients came to ~7K input / ~17K output tokens (10K of
            # them thinking, even at low effort) and ~1 minute -- under a cent.
            # Low effort: the medium default thought past 16K without answering.
            'max_tokens': 32000,
            'system': SYSTEM_PROMPT,
            'output_config': {
                'effort': 'low',
                'format': {'type': 'json_schema', 'schema': RESPONSE_SCHEMA},
            },
            'messages': [{
                'role': 'user',
                'content': f'Units: {unit_list}\n\nIngredients:\n{catalogue}',
            }],
        },
        timeout=180,
    )
    if response.status_code >= 400:
        logger.warning('Ingredient dedup: Claude request failed (%s): %s', response.status_code, response.text[:500])
        raise DedupError('The AI request failed. Please try again.')
    data = response.json()
    record_claude_call('ingredient_dedup', CLAUDE_MODEL, data)
    if data.get('stop_reason') == 'max_tokens':
        logger.warning('Ingredient dedup: answer cut off at max_tokens')
        raise DedupError('The AI answer was cut off. Please try again.')
    try:
        return json.loads(response_text(data)).get('groups') or []
    except (ValueError, AttributeError) as exc:
        raise DedupError('Could not understand the AI answer. Please try again.') from exc


def _unit_fields(value, unit_by_name):
    """A unit word from Claude -> (existing unit id, None) or, when the
    catalogue has no such unit yet, (None, the word as a new-unit name)."""
    word = (value or '').strip()
    if not word:
        return None, None
    unit = unit_by_name.get(word.lower().rstrip('.'))
    return (unit.id, None) if unit else (None, word)


def suggest_duplicates():
    """Returns validated suggestion groups, each:
    {key, kind, keep_id, name, preferred_unit (id|None), preferred_new_unit (str|None),
     members: [{id, name, recipe_count, category, note, quantity, unit (id|None), new_unit (str|None)}]}
    kind: 'duplicate' (several ingredients become one), 'unit' (one ingredient
    whose name carries a unit or amount) or 'name' (one ingredient, only the
    name is cleaned up)."""
    if not settings.ANTHROPIC_API_KEY:
        raise DedupError('AI suggestions are not configured (no ANTHROPIC_API_KEY set).')
    ingredients = list(Ingredient.objects.annotate(recipe_count=Count('recipe_lines')).order_by('name', 'id'))
    if len(ingredients) < 2:
        return []
    units = list(UnitOfMeasure.objects.all())
    by_id = {i.id: i for i in ingredients}
    unit_by_name = _unit_lookup(units)
    dismissed = set(DismissedDuplicateSuggestion.objects.values_list('member_ids', flat=True))

    def member_entry(ingredient, note='', quantity='', unit=None):
        unit_id, new_unit = _unit_fields(unit, unit_by_name)
        return {
            'id': ingredient.id, 'name': ingredient.name, 'recipe_count': ingredient.recipe_count,
            'category': ingredient.category_id, 'note': (note or '').strip(),
            'quantity': (quantity or '').strip(), 'unit': unit_id, 'new_unit': new_unit,
        }

    suggestions, used = [], set()
    for group in _ask_claude(ingredients, units):
        members = []
        for member in group.get('members') or []:
            ingredient = by_id.get(member.get('id'))
            if ingredient is None or ingredient.id in used or any(m['id'] == ingredient.id for m in members):
                continue
            members.append(member_entry(ingredient, member.get('note'), member.get('quantity'), member.get('unit')))
        if not members:
            continue
        name = (group.get('name') or '').strip() or members[0]['name']
        # An ingredient outside the group already carrying the clean name is
        # itself a duplicate the model missed -- fold it in (or drop the
        # group if another suggestion already claimed it).
        clash = next((i for i in ingredients if i.name.lower() == name.lower()
                      and i.id not in [m['id'] for m in members]), None)
        if clash is not None:
            if clash.id in used:
                continue
            members.append(member_entry(clash))
        member_ids = [m['id'] for m in members]
        keep_id = group.get('keep_id') if group.get('keep_id') in member_ids else \
            max(members, key=lambda m: m['recipe_count'])['id']
        if len(members) > 1:
            kind = 'duplicate'
        else:
            only = members[0]
            if only['unit'] or only['new_unit'] or only['quantity']:
                kind = 'unit'
            elif name != only['name'] or only['note']:
                kind = 'name'
            else:
                continue  # nothing would change
        key = DismissedDuplicateSuggestion.key_for(member_ids)
        if key in dismissed:
            continue
        used.update(member_ids)
        preferred_unit, preferred_new_unit = _unit_fields(group.get('preferred_unit'), unit_by_name)
        suggestions.append({
            'key': key, 'kind': kind, 'keep_id': keep_id, 'name': name,
            'preferred_unit': preferred_unit, 'preferred_new_unit': preferred_new_unit, 'members': members,
        })
    order = {'duplicate': 0, 'name': 1, 'unit': 2}
    suggestions.sort(key=lambda s: (order[s['kind']], s['name'].lower()))
    return suggestions
