import { toISODate } from './weekDates';

// All-day events use Google's convention of an exclusive end date (a 3-day
// trip is start=day1, end=day4), so a multi-day event spans every day in
// [start, end). Timed events span every local day they touch; an end at
// exactly midnight doesn't reach into that next day.
export function eventsOnDay(events, dayISO) {
  return events.filter((event) => {
    const start = new Date(event.start_datetime);
    const startISO = toISODate(start);
    if (event.is_all_day) {
      const endISO = toISODate(new Date(event.end_datetime));
      return dayISO >= startISO && dayISO < endISO;
    }
    const end = new Date(event.end_datetime);
    const lastISO = end > start ? toISODate(new Date(end.getTime() - 1)) : startISO;
    return dayISO >= startISO && dayISO <= lastISO;
  });
}
