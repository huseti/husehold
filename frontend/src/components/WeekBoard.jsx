import { DndContext } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import BacklogLane from './BacklogLane';
import TaskDayColumn from './TaskDayColumn';
import { toISODate, getWeekStart, parseISODate } from '../utils/weekDates';

// The interactive weekly board (backlog lane(s) + 7 day columns) shared by
// the Household Plan page's calendar mode and its weekly-planning mode.
// In planning mode (planningWeekStart set), the backlog splits into two
// buckets -- carried-over/unfinalized vs. new for the week being planned --
// and unassigned tasks get a visual "needs attention" highlight.
export default function WeekBoard({
  weekDays, instances, members, onComplete, onSkip, onSnooze, onReassign, onReopen, onDelete, onDragEnd,
  planningWeekStart,
}) {
  const { t } = useTranslation();
  const backlogInstances = instances.filter((i) => i.is_in_backlog);

  const planningWeekStartISO = planningWeekStart ? toISODate(planningWeekStart) : null;

  // Carried over = anything snoozed (regardless of which week it's now
  // dated for), or any backlog item whose *own* recurrence week is before
  // the week being planned -- i.e. still-unresolved leftovers. Everything
  // else in the backlog was genuinely generated fresh for this week's own
  // batch (a has_preferred_day=false occurrence for this exact week).
  const wasCarriedOver = (instance) => {
    const wasSnoozed = instance.events?.some((e) => e.event_type === 'snoozed');
    if (wasSnoozed) return true;
    const occurrenceWeekStartISO = toISODate(getWeekStart(parseISODate(instance.occurrence_date)));
    return occurrenceWeekStartISO < planningWeekStartISO;
  };

  // Also pull in still-open (pending) day-pinned tasks left over from an
  // earlier week -- e.g. a normal task due this Wednesday that never got
  // done before you start planning next week. These never touch the
  // backlog flag at all, so they'd otherwise be invisible during planning.
  const stillOpenFromPastWeek = planningWeekStartISO
    ? instances.filter((i) => {
        if (i.is_in_backlog || i.status !== 'pending') return false;
        const scheduledWeekStartISO = toISODate(getWeekStart(parseISODate(i.scheduled_date)));
        return scheduledWeekStartISO < planningWeekStartISO;
      })
    : [];

  const carriedOver = planningWeekStartISO
    ? [...backlogInstances.filter(wasCarriedOver), ...stillOpenFromPastWeek]
    : [];
  const newThisWeek = planningWeekStartISO ? backlogInstances.filter((i) => !wasCarriedOver(i)) : backlogInstances;

  return (
    <DndContext onDragEnd={onDragEnd}>
      {planningWeekStartISO ? (
        <>
          <BacklogLane
            droppableId="backlog-a"
            title={t('weeklyPlanning.carriedOver')}
            instances={carriedOver}
            members={members}
            onComplete={onComplete}
            onSkip={onSkip}
            onSnooze={onSnooze}
            onReassign={onReassign}
            onReopen={onReopen}
            onDelete={onDelete}
            planningWeekStartISO={planningWeekStartISO}
            attentionHighlight
          />
          <BacklogLane
            droppableId="backlog-b"
            title={t('weeklyPlanning.newThisWeek')}
            instances={newThisWeek}
            members={members}
            onComplete={onComplete}
            onSkip={onSkip}
            onSnooze={onSnooze}
            onReassign={onReassign}
            onReopen={onReopen}
            onDelete={onDelete}
            attentionHighlight
          />
        </>
      ) : (
        <BacklogLane
          instances={backlogInstances}
          members={members}
          onComplete={onComplete}
          onSkip={onSkip}
          onSnooze={onSnooze}
          onReassign={onReassign}
          onReopen={onReopen}
          onDelete={onDelete}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const iso = toISODate(day);
          const dayInstances = instances.filter((i) => !i.is_in_backlog && i.scheduled_date === iso);
          return (
            <TaskDayColumn
              key={iso}
              date={day}
              dateISO={iso}
              instances={dayInstances}
              members={members}
              onComplete={onComplete}
              onSkip={onSkip}
              onSnooze={onSnooze}
              onReassign={onReassign}
              onReopen={onReopen}
              onDelete={onDelete}
              attentionHighlight={!!planningWeekStartISO}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
