"""Merging duplicate ingredients ("Zwiebel", "Zwiebel(n)", "Zwiebel, fein
gehackt") into one, and cleaning up names that carry units or preparation
notes. Used by the config page's duplicate finder (suggestions come from
services/ingredient_dedup.py, the user reviews/edits them, then this runs).

Recipes already reference ingredients by id, so a rename in the config
shows up in every recipe on its own -- what a merge adds is moving every
reference over to the kept ingredient before the others are deleted:
recipe lines, shopping list items and purchase history. Whatever extra
information a merged name carried moves into the recipe line itself
(note "in Ringe geschnitten", unit "Zehe"), so nothing is lost, and the
old names become aliases of the kept ingredient. A quantity that was part
of a name ("250-300 ml Mandelmilch") moves into lines that have none: a
single number becomes the line's quantity, a range is kept as a note.
Unit words with no matching unit yet ("Tasse") can be created on the way.
"""
import re
from decimal import Decimal, InvalidOperation

from django.db import transaction

from ..models import Ingredient, IngredientAlias, PurchaseRecord, RecipeIngredient, ShoppingListItem, UnitOfMeasure

NOTE_MAX_LENGTH = RecipeIngredient._meta.get_field('note').max_length


class MergeError(Exception):
    """A user-facing merge failure -- message is safe to show in the UI."""


def _combined_note(moved_note, existing_note):
    """The note a recipe line gets when its ingredient's old name carried
    `moved_note` -- prepended to what the line already says, unless that
    already mentions it."""
    moved_note = (moved_note or '').strip()
    existing_note = (existing_note or '').strip()
    if not moved_note or moved_note.lower() in existing_note.lower():
        return existing_note
    combined = f'{moved_note}, {existing_note}' if existing_note else moved_note
    return combined[:NOTE_MAX_LENGTH]


def _parse_quantity(text):
    """'2' / '1,5' / '0.5' -> Decimal; ranges ('250-300'), words -> None."""
    text = (text or '').strip().replace(',', '.')
    if not re.fullmatch(r'\d+(?:\.\d+)?', text):
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def resolve_unit(unit=None, new_unit_name=''):
    """An existing unit, or one created (or found, case-insensitively) by
    name -- for unit words the catalogue didn't have yet ("Tasse")."""
    if unit is not None:
        return unit
    name = (new_unit_name or '').strip()
    if not name:
        return None
    existing = (
        UnitOfMeasure.objects.filter(name_de__iexact=name).first()
        or UnitOfMeasure.objects.filter(abbreviation_de__iexact=name).first()
    )
    return existing or UnitOfMeasure.objects.create(name_de=name)


def _add_alias(ingredient, name):
    name = (name or '').strip()
    if not name or name.lower() == ingredient.name.lower():
        return
    IngredientAlias.objects.filter(name__iexact=name).exclude(ingredient=ingredient).delete()
    if not ingredient.aliases.filter(name__iexact=name).exists():
        IngredientAlias.objects.create(ingredient=ingredient, name=name)


@transaction.atomic
def merge_ingredients(keep, members, name=None, preferred_unit=..., preferred_new_unit='', user=None):
    """keep: the Ingredient that survives (its id stays, so nothing else
    pointing at it changes).
    members: [{'ingredient': Ingredient, 'note': str, 'unit': UnitOfMeasure|None,
               'new_unit': str, 'quantity': str}, ...]
      -- every ingredient to fold into `keep`, `keep` itself included when
      its own recipe lines should get a note/unit (a pure rename/cleanup of
      one ingredient is a merge with just that one member).
    name: new name for `keep` (None = leave as is).
    preferred_unit: new preferred unit (left alone when not passed); with
      preferred_new_unit, a unit created by that name instead.
    Returns the updated `keep`. All or nothing."""
    keep = Ingredient.objects.select_for_update().get(pk=keep.pk)
    others = [m for m in members if m['ingredient'].pk != keep.pk]
    old_names = [keep.name] + [m['ingredient'].name for m in others]

    for member in members:
        ingredient = member['ingredient']
        note = member.get('note') or ''
        unit = resolve_unit(member.get('unit'), member.get('new_unit'))
        quantity_text = (member.get('quantity') or '').strip()
        quantity = _parse_quantity(quantity_text)
        for line in RecipeIngredient.objects.filter(ingredient=ingredient):
            line.ingredient = keep
            line_note = note
            if quantity_text and line.quantity is None:
                if quantity is not None:
                    line.quantity = quantity
                else:
                    # A range can't be a quantity -- keep it readable as a note.
                    unit_text = str(unit) if unit is not None and line.unit_id is None else ''
                    line_note = ', '.join(p for p in [f'{quantity_text} {unit_text}'.strip(), note] if p)
            line.note = _combined_note(line_note, line.note)
            if unit is not None and line.unit_id is None:
                line.unit = unit
            line.save(update_fields=['ingredient', 'note', 'unit', 'quantity'])

    other_ids = [m['ingredient'].pk for m in others]
    if other_ids:
        ShoppingListItem.objects.filter(ingredient_id__in=other_ids).update(ingredient=keep)
        PurchaseRecord.objects.filter(ingredient_id__in=other_ids).update(ingredient=keep)
        IngredientAlias.objects.filter(ingredient_id__in=other_ids).update(ingredient=keep)
        if keep.category_id is None:
            keep.category = next((m['ingredient'].category for m in others if m['ingredient'].category_id), None)
        if keep.preferred_unit_id is None:
            keep.preferred_unit = next((m['ingredient'].preferred_unit for m in others if m['ingredient'].preferred_unit_id), None)
        Ingredient.objects.filter(pk__in=other_ids).delete()

    if name is not None:
        name = name.strip()
        if not name:
            raise MergeError('The name must not be empty.')
        if Ingredient.objects.filter(name__iexact=name).exclude(pk=keep.pk).exists():
            raise MergeError(f'Another ingredient is already called "{name}".')
        keep.name = name
    if preferred_new_unit:
        keep.preferred_unit = resolve_unit(None, preferred_new_unit)
    elif preferred_unit is not ...:
        keep.preferred_unit = preferred_unit
    if user is not None:
        keep.updated_by = user
    keep.save()

    # The kept name can't also be an alias; every old name now is one.
    keep.aliases.filter(name__iexact=keep.name).delete()
    IngredientAlias.objects.filter(name__iexact=keep.name).delete()
    for old_name in old_names:
        _add_alias(keep, old_name)
    return keep
