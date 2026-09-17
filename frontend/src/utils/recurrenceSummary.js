// Turns a stored RRULE string back into a plain-language sentence for
// display. Users never see or edit the raw rule -- only this summary and
// the picker that generated it.
function parseRule(rule) {
  const parts = Object.fromEntries(rule.split(';').map((p) => p.split('=')));
  return {
    freq: parts.FREQ,
    interval: parseInt(parts.INTERVAL || '1', 10),
    byday: parts.BYDAY ? parts.BYDAY.split(',') : [],
    bymonthday: parts.BYMONTHDAY ? parseInt(parts.BYMONTHDAY, 10) : null,
  };
}

export function summarizeRecurrenceRule(rule, t) {
  if (!rule) return '';
  const { freq, interval, byday, bymonthday } = parseRule(rule);

  let everyPhrase;
  if (freq === 'DAILY') everyPhrase = t('tasks.recurrence.summary.daily', { count: interval });
  else if (freq === 'WEEKLY') everyPhrase = t('tasks.recurrence.summary.weekly', { count: interval });
  else if (freq === 'MONTHLY') everyPhrase = t('tasks.recurrence.summary.monthly', { count: interval });
  else return rule;

  let onPhrase = '';
  if (freq === 'WEEKLY' && byday.length > 0) {
    const dayNames = byday.map((d) => t(`tasks.recurrence.weekday.${d.toLowerCase()}`)).join(', ');
    onPhrase = t('tasks.recurrence.summary.onDays', { days: dayNames });
  } else if (freq === 'MONTHLY' && bymonthday) {
    onPhrase = t('tasks.recurrence.summary.onDayOfMonth', { day: bymonthday });
  } else if (freq === 'MONTHLY' && byday.length === 1) {
    const match = byday[0].match(/^(-?\d+)([A-Z]{2})$/);
    if (match) {
      const [, ordinal, weekday] = match;
      onPhrase = t('tasks.recurrence.summary.onOrdinalWeekday', {
        ordinal: t(`tasks.recurrence.ordinal.${ordinal}`),
        weekday: t(`tasks.recurrence.weekday.${weekday.toLowerCase()}`),
      });
    }
  }

  return onPhrase ? `${everyPhrase} ${onPhrase}` : everyPhrase;
}
