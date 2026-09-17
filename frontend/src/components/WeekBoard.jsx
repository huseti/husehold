import { DndContext } from '@dnd-kit/core';
import BacklogLane from './BacklogLane';
import TaskDayColumn from './TaskDayColumn';
import { toISODate } from '../utils/weekDates';

// The interactive weekly board (backlog lane + 7 day columns) shared by the
// Household Plan page's calendar mode and its weekly-planning mode -- the
// only real difference between those two is which week is shown and what
// surrounds this board, not the board itself.
export default function WeekBoard({ weekDays, instances, members, onComplete, onSkip, onSnooze, onReassign, onDragEnd }) {
  const backlogInstances = instances.filter((i) => i.is_in_backlog);

  return (
    <DndContext onDragEnd={onDragEnd}>
      <BacklogLane
        instances={backlogInstances}
        members={members}
        onComplete={onComplete}
        onSkip={onSkip}
        onSnooze={onSnooze}
        onReassign={onReassign}
      />
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
            />
          );
        })}
      </div>
    </DndContext>
  );
}
