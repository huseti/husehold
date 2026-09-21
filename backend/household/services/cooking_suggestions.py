"""Recipe suggestions for the Cooking Plan (PLANNING.md 2b).

For one meal type, every candidate recipe lands in exactly one bucket,
evaluated top-down:

  1. craving    -- highest combined score of rating percentile * rating_weight
                   + neglect percentile * neglect_weight
  2. top_rated  -- the best-rated top_rating_percentile% of the rest
  3. long_ago   -- never cooked, or not cooked for uncooked_threshold_days
  4. random     -- a few random picks from what is left (random_count)
  5. rest       -- everything else, alphabetical

Buckets are a ranking query, not stored fields, so they always reflect the
current ratings and cooking log.
"""
import math
import random
from bisect import bisect_left, bisect_right

from django.utils import timezone

from ..models import CookingPlanConfig, Recipe

# A recipe nobody rated yet sits in the middle rather than at either end, and
# one that was never cooked counts as the most neglected of all.
NEUTRAL_RATING = 3.0
NEVER_COOKED_DAYS = 100_000


def _percentiles(values):
    """Each value's percentile rank in [0, 1] among all values (ties share
    the middle of their range). A single value is 0.5."""
    if len(values) < 2:
        return [0.5] * len(values)
    ordered = sorted(values)
    result = []
    for value in values:
        below = bisect_left(ordered, value)
        equal = bisect_right(ordered, value) - below
        result.append((below + (equal - 1) / 2) / (len(values) - 1))
    return result


def _stats(recipe, today):
    scores = [r.score for r in recipe.ratings.all()]
    dates = [e.date_cooked for e in recipe.meal_events.all()]
    last_cooked = max(dates) if dates else None
    return {
        'recipe': recipe,
        'average_rating': sum(scores) / len(scores) if scores else None,
        'last_cooked': last_cooked,
        'times_cooked': len(dates),
        'days_since': (today - last_cooked).days if last_cooked else NEVER_COOKED_DAYS,
    }


def _brief(stats):
    recipe = stats['recipe']
    average = stats['average_rating']
    return {
        'id': recipe.id,
        'title': recipe.title,
        'servings': recipe.servings,
        'prep_time': recipe.prep_time,
        'cook_time': recipe.cook_time,
        'labels': [label.id for label in recipe.labels.all()],
        'average_rating': round(average, 1) if average is not None else None,
        'last_cooked_date': stats['last_cooked'].isoformat() if stats['last_cooked'] else None,
        'times_cooked': stats['times_cooked'],
    }


def build_suggestions(meal_category_id, exclude_ids=(), seed=None, today=None, config=None):
    config = config or CookingPlanConfig.load()
    today = today or timezone.localdate()
    exclude = set(exclude_ids)

    recipes = Recipe.objects.prefetch_related('ratings', 'meal_events', 'labels', 'categories')
    candidates = []
    for recipe in recipes:
        if recipe.id in exclude:
            continue
        category_ids = {c.id for c in recipe.categories.all()}
        # A recipe never assigned to a meal type is still plannable -- it just
        # isn't tied to one, so it shows up under every meal.
        if not category_ids or meal_category_id in category_ids:
            candidates.append(_stats(recipe, today))

    by_title = lambda s: s['recipe'].title.lower()  # noqa: E731

    rating_pct = _percentiles([
        s['average_rating'] if s['average_rating'] is not None else NEUTRAL_RATING for s in candidates
    ])
    neglect_pct = _percentiles([s['days_since'] for s in candidates])
    for stats, r, n in zip(candidates, rating_pct, neglect_pct):
        stats['craving_score'] = config.rating_weight * r + config.neglect_weight * n

    ranked = sorted(candidates, key=lambda s: (-s['craving_score'], by_title(s)))
    craving = ranked[:config.craving_count]
    taken = {s['recipe'].id for s in craving}

    rated = sorted(
        (s for s in candidates if s['average_rating'] is not None),
        key=lambda s: (-s['average_rating'], by_title(s)),
    )
    top_size = math.ceil(len(rated) * config.top_rating_percentile / 100)
    top_rated = [s for s in rated[:top_size] if s['recipe'].id not in taken]
    taken |= {s['recipe'].id for s in top_rated}

    long_ago = sorted(
        (s for s in candidates
         if s['recipe'].id not in taken and s['days_since'] >= config.uncooked_threshold_days),
        key=lambda s: (-s['days_since'], by_title(s)),
    )
    taken |= {s['recipe'].id for s in long_ago}

    remaining = sorted((s for s in candidates if s['recipe'].id not in taken), key=by_title)
    picks = random.Random(seed).sample(remaining, min(config.random_count, len(remaining)))
    picked_ids = {s['recipe'].id for s in picks}
    rest = [s for s in remaining if s['recipe'].id not in picked_ids]

    return {
        'meal_category': meal_category_id,
        'craving': [_brief(s) for s in craving],
        'top_rated': [_brief(s) for s in top_rated],
        'long_ago': [_brief(s) for s in long_ago],
        'random': [_brief(s) for s in picks],
        'rest': [_brief(s) for s in rest],
    }
