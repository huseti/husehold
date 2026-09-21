import { getWeekStart, addDays, parseISODate, toISODate } from './weekDates';

// A recurring task's title/icon are plain stored text, not i18n keys, so a
// system task (e.g. the weekly planning reminder) would otherwise always
// show whatever language it was created in, regardless of the current UI
// language. For known system_action tasks, override with a live-translated
// label instead of the stored one.
//
// For the weekly planning reminder specifically, also append the date range
// of the week it's reminding you to plan -- that's always the week *after*
// the reminder's own week, regardless of which weekday the reminder itself
// falls on (a Sunday reminder plans the Monday right after it; a Wednesday
// reminder still plans the following Monday, not the rest of this week).
const PLANNING_TITLE_KEYS = {
  weekly_household_planning: 'weeklyPlanning.title',
  weekly_meal_planning: 'mealPlanning.title',
};

export function getDisplayTitle(instance, t, i18n) {
  if (PLANNING_TITLE_KEYS[instance.system_action]) {
    const reminderWeekStart = getWeekStart(parseISODate(instance.scheduled_date));
    const planWeekStart = addDays(reminderWeekStart, 7);
    const planWeekEnd = addDays(planWeekStart, 6);
    const locale = i18n?.resolvedLanguage;
    const opts = { day: 'numeric', month: 'short' };
    const range = `${planWeekStart.toLocaleDateString(locale, opts)}–${planWeekEnd.toLocaleDateString(locale, opts)}`;
    return `${t(PLANNING_TITLE_KEYS[instance.system_action])} (${range})`;
  }
  return instance.title;
}

// For the weekly planning task only: snooze is allowed once (a copy of the
// original reminder), but that copy itself can't be snoozed again -- it
// already represents "later this same week", pushing it further would run
// past the week it's meant to cover.
export function canSnoozeInstance(instance) {
  if (!PLANNING_TITLE_KEYS[instance.system_action]) return true;
  return !instance.origin_instance;
}

// Where a planning reminder's "Plan now" button leads: the target week is
// always the one after the reminder's own week. Null for every other task.
export function getPlanNowPath(instance) {
  const page = { weekly_household_planning: '/tasks', weekly_meal_planning: '/cooking-plan' }[instance.system_action];
  if (!page) return null;
  const planWeekStart = addDays(getWeekStart(parseISODate(instance.scheduled_date)), 7);
  return `${page}?planWeek=${toISODate(planWeekStart)}&planInstance=${instance.id}`;
}

// A meal type's name in the UI language (German is required, English optional).
export function mealName(entry, i18n) {
  return (i18n?.resolvedLanguage === 'en' && entry.meal_category_name_en) || entry.meal_category_name_de;
}
