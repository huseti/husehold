import { toISODate } from './weekDates';

// All-day events use Google's convention of an exclusive end date (a 3-day
// trip is start=day1, end=day4), so a multi-day event spans every day in
// [start, end). Timed events are shown on their single start day only.
export function eventsOnDay(events, dayISO) {
  return events.filter((event) => {
    const startISO = toISODate(new Date(event.start_datetime));
    if (event.is_all_day) {
      const endISO = toISODate(new Date(event.end_datetime));
      return dayISO >= startISO && dayISO < endISO;
    }
    return startISO === dayISO;
  });
}
