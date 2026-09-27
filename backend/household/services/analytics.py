"""Household statistics (PLANNING.md step 7, "Analytics") -- pure, read-only
queries over data that already exists elsewhere (tasks, meal log, purchase
history, voucher redemptions). No new tables; everything here is computed on
demand for a given date range.

`start`/`end` are inclusive `date` objects, or `None` for an open end (used
for the "all time" period on the frontend, mirroring PurchaseRecordViewSet's
?start=&end= convention).
"""
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count

from ..models import HouseholdMember, HouseholdTaskInstance, MealEvent, PurchaseRecord, Voucher, VoucherRedemption

# A date range longer than this buckets trends by month instead of by week --
# a year of weekly points is too dense to read as a bar chart.
WEEKLY_BUCKET_MAX_DAYS = 90


def _granularity(start, end):
    if start is None or end is None:
        return 'month'
    return 'week' if (end - start).days <= WEEKLY_BUCKET_MAX_DAYS else 'month'


def _bucket_key(d, granularity):
    if granularity == 'week':
        return (d - timedelta(days=d.weekday())).isoformat()
    return d.replace(day=1).isoformat()


def task_stats(start, end):
    """Completion rate overall and per household member, plus an on-time
    trend, over tasks scheduled in the range. Backlog tasks (no day yet) and
    skipped/snoozed ones are excluded from both sides of every ratio -- same
    convention as the Dashboard's weekly ProgressPanel."""
    queryset = HouseholdTaskInstance.objects.filter(is_in_backlog=False).exclude(status__in=['skipped', 'snoozed'])
    if start:
        queryset = queryset.filter(scheduled_date__gte=start)
    if end:
        queryset = queryset.filter(scheduled_date__lte=end)

    total = queryset.count()
    done = queryset.filter(status='done').count()

    by_member = []
    for member in HouseholdMember.objects.select_related('user'):
        member_qs = queryset.filter(assigned_to=member.user)
        member_total = member_qs.count()
        member_done = member_qs.filter(status='done').count()
        by_member.append({
            'member_id': member.user_id,
            'username': member.user.username,
            'color_hex': member.color_hex,
            'total': member_total,
            'done': member_done,
            'rate': (member_done / member_total) if member_total else 0,
        })

    # Always by calendar week (not the week/month switch used elsewhere) --
    # explicitly requested this way, and a line chart carries a long, dense
    # series far better than the bar charts the other trends use.
    week_buckets = {}
    for scheduled_date, status, completed_at in queryset.values_list('scheduled_date', 'status', 'completed_at'):
        key = _bucket_key(scheduled_date, 'week')
        entry = week_buckets.setdefault(key, {'total': 0, 'on_time': 0})
        entry['total'] += 1
        if status == 'done' and completed_at and completed_at.date() <= scheduled_date:
            entry['on_time'] += 1
    on_time_trend = [
        {'bucket': key, 'rate': (v['on_time'] / v['total']) if v['total'] else 0}
        for key, v in sorted(week_buckets.items())
    ]

    return {
        'overall': {'total': total, 'done': done, 'rate': (done / total) if total else 0},
        'by_member': by_member,
        'on_time_trend': on_time_trend,
    }


def meal_stats(start, end, top_n=10):
    """Most-cooked recipes and a cooked-meals-per-bucket trend, both from the
    MealEvent log (not CookingPlanEntry, which only ever covers the current
    and next week -- see PLANNING.md 4 -- so it can't carry a history)."""
    queryset = MealEvent.objects.all()
    if start:
        queryset = queryset.filter(date_cooked__gte=start)
    if end:
        queryset = queryset.filter(date_cooked__lte=end)

    top = (
        queryset.values('recipe_id', 'recipe__title')
        .annotate(count=Count('id'))
        .order_by('-count', 'recipe__title')[:top_n]
    )
    top_recipes = [{'recipe_id': r['recipe_id'], 'title': r['recipe__title'], 'count': r['count']} for r in top]

    granularity = _granularity(start, end)
    counts = {}
    for date_cooked in queryset.values_list('date_cooked', flat=True):
        key = _bucket_key(date_cooked, granularity)
        counts[key] = counts.get(key, 0) + 1
    trend = [{'bucket': key, 'count': count} for key, count in sorted(counts.items())]

    return {'top_recipes': top_recipes, 'trend': trend, 'granularity': granularity}


def purchase_stats(start, end, top_n=10):
    """Most-bought items (by name, case-insensitive) and a purchases-per-
    bucket trend. No price is tracked anywhere in the app, so this is
    frequency, not spending."""
    queryset = PurchaseRecord.objects.all()
    if start:
        queryset = queryset.filter(purchased_on__gte=start)
    if end:
        queryset = queryset.filter(purchased_on__lte=end)

    groups = {}
    for title, purchased_on in queryset.values_list('title', 'purchased_on'):
        key = title.strip().lower()
        entry = groups.setdefault(key, {'title': title, 'count': 0})
        entry['count'] += 1
    top_items = sorted(groups.values(), key=lambda e: (-e['count'], e['title'].lower()))[:top_n]

    granularity = _granularity(start, end)
    counts = {}
    for purchased_on in queryset.values_list('purchased_on', flat=True):
        key = _bucket_key(purchased_on, granularity)
        counts[key] = counts.get(key, 0) + 1
    trend = [{'bucket': key, 'count': count} for key, count in sorted(counts.items())]

    return {'top_items': top_items, 'trend': trend, 'granularity': granularity}


def voucher_stats(start, end):
    """Current active value (a snapshot, not range-bound -- "what's on hand
    right now") plus redeemed value per bucket over the range. Grouped by
    currency since Voucher.currency isn't fixed to one value; in practice a
    2-person household will usually only ever see one currency in the list."""
    active = Voucher.objects.filter(is_archived=False, total_value__isnull=False)
    active_totals = {}
    for currency, remaining in active.values_list('currency', 'remaining_balance'):
        active_totals[currency] = active_totals.get(currency, Decimal('0')) + (remaining or Decimal('0'))
    active_totals_list = [{'currency': c, 'total': float(v)} for c, v in sorted(active_totals.items())]

    queryset = VoucherRedemption.objects.select_related('voucher').filter(amount_used__isnull=False)
    if start:
        queryset = queryset.filter(redeemed_on__gte=start)
    if end:
        queryset = queryset.filter(redeemed_on__lte=end)

    granularity = _granularity(start, end)
    bucket_totals = {}
    for redeemed_on, currency, amount in queryset.values_list('redeemed_on', 'voucher__currency', 'amount_used'):
        key = _bucket_key(redeemed_on, granularity)
        by_currency = bucket_totals.setdefault(key, {})
        by_currency[currency] = by_currency.get(currency, Decimal('0')) + amount
    trend = [
        {'bucket': key, 'totals': [{'currency': c, 'total': float(v)} for c, v in sorted(by_currency.items())]}
        for key, by_currency in sorted(bucket_totals.items())
    ]

    return {'active_totals': active_totals_list, 'trend': trend, 'granularity': granularity}


def build_analytics(start, end):
    return {
        'tasks': task_stats(start, end),
        'meals': meal_stats(start, end),
        'purchases': purchase_stats(start, end),
        'vouchers': voucher_stats(start, end),
    }
