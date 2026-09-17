import { DndContext } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import BacklogLane from './BacklogLane';
import TaskDayColumn from './TaskDayColumn';
import { toISODate } from '../utils/weekDates';

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
  const carriedOver = planningWeekStartISO
    ? backlogInstances.filter((i) => i.scheduled_date < planningWeekStartISO)
    : [];
  const newThisWeek = planningWeekStartISO
    ? backlogInstances.filter((i) => i.scheduled_date >= planningWeekStartISO)
    : backlogInstances;

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
