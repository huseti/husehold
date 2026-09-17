// A recurring task's title/icon are plain stored text, not i18n keys, so a
// system task (e.g. the weekly planning reminder) would otherwise always
// show whatever language it was created in, regardless of the current UI
// language. For known system_action tasks, override with a live-translated
// label instead of the stored one.
export function getDisplayTitle(instance, t) {
  if (instance.system_action === 'weekly_household_planning') {
    return t('weeklyPlanning.title');
  }
  return instance.title;
}
