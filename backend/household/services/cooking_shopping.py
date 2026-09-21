"""Turning planned dishes into shopping list items.

Two steps, so the household stays in control: a *preview* (per dish, every
ingredient scaled to the planned servings, staples pre-marked as skipped) and
an *add* that merges the lines the user ticked into one list -- same
ingredient + unit becomes one item with the quantities summed.
"""
from decimal import Decimal

from ..models import ShoppingListItem


def dish_lines(recipe, servings):
    """The recipe's ingredient lines scaled from its own servings to `servings`."""
    factor = Decimal(servings) / Decimal(recipe.servings) if recipe.servings else Decimal(1)
    lines = []
    for line in recipe.ingredients.all():
        quantity = (line.quantity * factor).quantize(Decimal('0.01')) if line.quantity is not None else None
        lines.append({
            'ingredient': line.ingredient_id,
            'ingredient_name': line.ingredient.name,
            'quantity': quantity,
            'unit': line.unit_id,
            'note': line.note,
            # Salt, water... -- offered, but unticked unless the household wants them.
            'excluded_by_default': line.ingredient.default_excluded_from_shopping_list,
        })
    return lines


def dish(key, recipe, servings, **extra):
    return {
        'key': key,
        'recipe': recipe.id,
        'recipe_title': recipe.title,
        'servings': servings,
        'lines': dish_lines(recipe, servings),
        **extra,
    }


def add_lines_to_list(shopping_list, lines, user):
    """lines: [{ingredient (id or None), title, quantity (number or None), unit (id or None)}].
    Same ingredient (or same name, when unlinked) + same unit is summed into
    one line; a matching *open* item already on the list is topped up instead
    of duplicated. Returns {'created': n, 'merged': n}."""
    groups = {}
    for line in lines:
        title = (line.get('title') or '').strip()
        if not title:
            continue
        ingredient_id = line.get('ingredient')
        key = (('i', ingredient_id) if ingredient_id else ('n', title.lower()), line.get('unit'))
        quantity = Decimal(str(line['quantity'])) if line.get('quantity') not in (None, '') else None
        group = groups.setdefault(key, {
            'title': title, 'ingredient': ingredient_id, 'unit': line.get('unit'), 'quantity': None,
        })
        if quantity is not None:
            group['quantity'] = (group['quantity'] or Decimal(0)) + quantity

    created = merged = 0
    for group in groups.values():
        existing = shopping_list.items.filter(is_completed=False, unit_id=group['unit'])
        existing = existing.filter(ingredient_id=group['ingredient']) if group['ingredient'] \
            else existing.filter(ingredient__isnull=True, title__iexact=group['title'])
        item = existing.first()
        if item:
            if group['quantity'] is not None:
                item.quantity = (item.quantity or Decimal(0)) + group['quantity']
                item.save()
            merged += 1
            continue
        ShoppingListItem.objects.create(
            shopping_list=shopping_list, title=group['title'], quantity=group['quantity'],
            unit_id=group['unit'], ingredient_id=group['ingredient'], source='cooking_plan',
            created_by=user,
        )
        created += 1
    return {'created': created, 'merged': merged}
