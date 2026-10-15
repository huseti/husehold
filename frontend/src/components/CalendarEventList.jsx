// Google Calendar events of one day, as shown at the top of a day column in
// the household plan and the cooking plan.
export default function CalendarEventList({ events, className = 'mb-2' }) {
  if (events.length === 0) return null;
  return (
    <div className={`space-y-0.5 ${className}`}>
      {events.map((event) => (
        <div
          key={event.id}
          title={event.title}
          className="text-xs text-amber-800 bg-amber-50 rounded-lg px-1.5 py-0.5 truncate border-l-4"
          style={{ borderColor: event.color_hex || '#d97706' }}
        >
          {event.title}
        </div>
      ))}
    </div>
  );
}
