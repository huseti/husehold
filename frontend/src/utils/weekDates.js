// Monday-first week helpers shared by the Household Plan page (calendar and
// planning modes) and the Dashboard's embedded weekly preview.
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toISODate(date) {
  // NOT date.toISOString() -- that converts through UTC first, which
  // silently shifts the calendar date depending on the browser's offset
  // from UTC (e.g. "today" can come out as tomorrow or yesterday). Use the
  // local date parts directly instead.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
