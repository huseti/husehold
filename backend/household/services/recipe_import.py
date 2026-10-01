"""Importing a recipe from a photo, pasted text, or a URL -- see PLANNING.md
item D and the follow-up discussion on 2026-09-30.

All three paths return the same draft shape and never save anything --
the caller (RecipeImportView) hands the draft straight back to the
frontend, which pre-fills the existing RecipeForm for review. Ingredient
lines are returned as plain text ("200 g Mehl"), not structured
quantity/unit/name -- the frontend already has a parser for exactly that
shape (used by the "paste ingredient list" importer), so the backend
doesn't need to guess unit IDs.

Deliberately no video download / Instagram API integration (see the
2026-09-30 discussion) -- paste-text covers the caption-has-the-recipe
case, which is the common one; video transcription is a documented
future upgrade, not built here.
"""
import base64
import json
import re

import requests
from bs4 import BeautifulSoup
from django.conf import settings

from ..models import MealTimeCategory

CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

DRAFT_FIELDS = (
    'title', 'description', 'servings', 'prep_time', 'cook_time',
    'instructions', 'notes', 'ingredient_lines', 'category_guess',
)


class RecipeImportError(Exception):
    """A user-facing extraction failure (bad URL, no API key, malformed
    response, ...) -- message is safe to show directly in the UI."""


def _empty_draft(**overrides):
    draft = {
        'title': '', 'description': '', 'servings': None, 'prep_time': None, 'cook_time': None,
        'instructions': '', 'notes': '', 'ingredient_lines': [], 'category_guess': None,
    }
    draft.update(overrides)
    return draft


def _require_api_key():
    if not settings.ANTHROPIC_API_KEY:
        raise RecipeImportError('AI extraction is not configured (no ANTHROPIC_API_KEY set). Try pasting the recipe text directly, or ask for this to be set up.')


def _category_names():
    return list(MealTimeCategory.objects.values_list('name_de', flat=True))


def _extraction_system_prompt():
    categories = _category_names()
    category_hint = (
        f' If the meal type is clear, set "category_guess" to exactly one of: {", ".join(categories)} -- otherwise null.'
        if categories else ' Set "category_guess" to null.'
    )
    return (
        'You extract recipes into structured JSON. Respond with ONLY a JSON object (no markdown, no commentary), '
        'with exactly these keys: title (string), description (short string or ""), servings (integer or null), '
        'prep_time (integer minutes or null), cook_time (integer minutes or null), '
        'instructions (string, steps separated by newlines), notes (string or ""), '
        'ingredient_lines (array of strings, one ingredient per line, formatted like "200 g Mehl" or "2 Zwiebeln" -- '
        'quantity and unit first when known, then the ingredient name), '
        'category_guess (string or null).' + category_hint
    )


def _parse_claude_json(text):
    text = text.strip()
    # Strip a markdown code fence if the model added one despite instructions.
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    try:
        data = json.loads(text)
    except (ValueError, TypeError) as exc:
        raise RecipeImportError('Could not understand the extracted recipe. Please try again or enter it manually.') from exc
    return _empty_draft(**{k: data.get(k) for k in DRAFT_FIELDS if k in data})


def _call_claude(content_blocks):
    _require_api_key()
    response = requests.post(
        MESSAGES_URL,
        headers={
            'x-api-key': settings.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        json={
            'model': CLAUDE_MODEL,
            'max_tokens': 2000,
            # Structured extraction into a fixed schema -- no reason to let
            # sampling vary the output shape or category choice.
            'temperature': 0,
            'system': _extraction_system_prompt(),
            'messages': [{'role': 'user', 'content': content_blocks}],
        },
        timeout=60,
    )
    if response.status_code >= 400:
        raise RecipeImportError('The AI extraction request failed. Please try again.')
    text = response.json()['content'][0]['text']
    return _parse_claude_json(text)


def extract_from_images(images):
    """images: [{media_type: 'image/jpeg'|'image/png'|..., data: base64-str}, ...],
    multiple for a multi-page recipe -- Claude correlates them into one."""
    if not images:
        raise RecipeImportError('No images provided.')
    blocks = [
        {'type': 'image', 'source': {'type': 'base64', 'media_type': img['media_type'], 'data': img['data']}}
        for img in images
    ]
    blocks.append({
        'type': 'text',
        'text': 'Extract the recipe shown in the image(s) above (they may be multiple pages of the same recipe).',
    })
    draft = _call_claude(blocks)
    draft['source_type'] = 'photo'
    return draft


def extract_from_text(text):
    text = (text or '').strip()
    if not text:
        raise RecipeImportError('No text provided.')
    draft = _call_claude([{'type': 'text', 'text': f'Extract the recipe from this text:\n\n{text}'}])
    draft['source_type'] = 'instagram'
    return draft


def _find_recipe_jsonld(soup):
    """A schema.org Recipe embedded as JSON-LD -- present on most recipe
    blogs, free and instant to read, no AI needed."""
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string or '')
        except (ValueError, TypeError):
            continue
        candidates = data if isinstance(data, list) else data.get('@graph', [data]) if isinstance(data, dict) else [data]
        for item in candidates:
            if isinstance(item, dict) and _is_recipe_type(item.get('@type')):
                return item
    return None


def _is_recipe_type(type_value):
    if isinstance(type_value, list):
        return any(isinstance(t, str) and t.lower() == 'recipe' for t in type_value)
    return isinstance(type_value, str) and type_value.lower() == 'recipe'


def _iso8601_duration_to_minutes(value):
    if not value or not isinstance(value, str):
        return None
    match = re.match(r'P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?', value)
    if not match:
        return None
    hours, minutes = match.groups()
    total = (int(hours) * 60 if hours else 0) + (int(minutes) if minutes else 0)
    return total or None


def _text_of(value):
    if isinstance(value, list):
        return '\n'.join(_text_of(v) for v in value if v)
    if isinstance(value, dict):
        return value.get('text', '') or value.get('name', '')
    return str(value) if value else ''


def _draft_from_jsonld(data):
    servings = data.get('recipeYield')
    if isinstance(servings, list):
        servings = servings[0] if servings else None
    if isinstance(servings, str):
        match = re.search(r'\d+', servings)
        servings = int(match.group()) if match else None

    ingredients = data.get('recipeIngredient') or data.get('ingredients') or []
    if isinstance(ingredients, str):
        ingredients = [ingredients]

    instructions_raw = data.get('recipeInstructions') or []
    if isinstance(instructions_raw, str):
        instructions = instructions_raw
    else:
        steps = []
        for step in instructions_raw:
            if isinstance(step, dict) and _is_recipe_type(step.get('@type')) is False and step.get('itemListElement'):
                steps.extend(_text_of(s) for s in step['itemListElement'])
            else:
                steps.append(_text_of(step))
        instructions = '\n'.join(s for s in steps if s)

    return _empty_draft(
        title=data.get('name', ''),
        description=_text_of(data.get('description', '')),
        servings=servings,
        prep_time=_iso8601_duration_to_minutes(data.get('prepTime')),
        cook_time=_iso8601_duration_to_minutes(data.get('cookTime')),
        instructions=instructions,
        ingredient_lines=[str(i).strip() for i in ingredients if str(i).strip()],
    )


def extract_from_url(url):
    try:
        response = requests.get(
            url, timeout=15,
            headers={'User-Agent': 'Mozilla/5.0 (compatible; HuseholdRecipeImport/1.0)'},
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RecipeImportError('Could not reach that page. Double-check the link, or paste the recipe text instead.') from exc

    soup = BeautifulSoup(response.text, 'html.parser')
    recipe_data = _find_recipe_jsonld(soup)
    if recipe_data:
        draft = _draft_from_jsonld(recipe_data)
        draft['source_type'] = 'website'
        return draft

    # No structured data -- fall back to the page's visible text, sent to Claude.
    for tag in soup(['script', 'style', 'nav', 'header', 'footer']):
        tag.decompose()
    page_text = re.sub(r'\n{3,}', '\n\n', soup.get_text('\n')).strip()[:15000]
    if not page_text:
        raise RecipeImportError('Could not find a recipe on that page. Try pasting the text instead.')
    draft = _call_claude([{'type': 'text', 'text': f'Extract the recipe from this web page content:\n\n{page_text}'}])
    draft['source_type'] = 'website'
    return draft
