// A "slot" is one meal on one day. Slots sort in time order -- day first, then
// the meal's own order within the day (breakfast < lunch < dinner) -- which is
// what the "leftovers must come after their dish" rule is built on (the API
// enforces the same order, see cooking_tasks.slot()).
export function slotKey(date, meal) {
  return `${date}|${String(meal.sort_order).padStart(6, '0')}|${String(meal.id).padStart(8, '0')}`;
}

// Every slot from the given days x meals that comes strictly after `after`
// ({ date, meal }), in time order -- where leftovers of a dish may be planned.
export function slotsAfter(after, weekDays, meals) {
  const limit = slotKey(after.date, after.meal);
  return weekDays
    .flatMap((date) => meals.map((meal) => ({ date, meal })))
    .filter((slot) => slotKey(slot.date, slot.meal) > limit);
}
