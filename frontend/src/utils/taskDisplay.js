import { getWeekStart, addDays, parseISODate } from './weekDates';

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
export function getDisplayTitle(instance, t, i18n) {
  if (instance.system_action === 'weekly_household_planning') {
    const reminderWeekStart = getWeekStart(parseISODate(instance.scheduled_date));
    const planWeekStart = addDays(reminderWeekStart, 7);
    const planWeekEnd = addDays(planWeekStart, 6);
    const locale = i18n?.resolvedLanguage;
    const opts = { day: 'numeric', month: 'short' };
    const range = `${planWeekStart.toLocaleDateString(locale, opts)}–${planWeekEnd.toLocaleDateString(locale, opts)}`;
    return `${t('weeklyPlanning.title')} (${range})`;
  }
  return instance.title;
}

// For the weekly planning task only: snooze is allowed once (a copy of the
// original reminder), but that copy itself can't be snoozed again -- it
// already represents "later this same week", pushing it further would run
// past the week it's meant to cover.
export function canSnoozeInstance(instance) {
  if (instance.system_action !== 'weekly_household_planning') return true;
  return !instance.origin_instance;
}
