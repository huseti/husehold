import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import TaskCard from './TaskCard';

// A droppable "no day yet" lane, rendered above the weekday grid. Tasks
// without a preferred weekday (recurring or one-off) land here until
// dragged onto an actual day. droppableId/title let planning mode render
// two separate buckets (carried-over vs. new) instead of one generic lane.
export default function BacklogLane({
  instances, members, onComplete, onSkip, onSnooze, onReassign, onReopen, onDelete,
  droppableId = 'backlog', title, attentionHighlight = false, planningWeekStartISO,
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 mb-3 ${isOver ? 'bg-blue-50 border-blue-300' : 'bg-amber-50 border-amber-200'}`}
    >
      <div className="text-sm font-semibold mb-2 text-amber-800">{title || t('tasks.backlog')}</div>
      {instances.length === 0 ? (
        <p className="text-xs text-amber-700/70">{t('tasks.backlogEmpty')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {instances.map((instance) => (
            <TaskCard
              key={instance.id}
              instance={instance}
              members={members}
              onComplete={onComplete}
              onSkip={onSkip}
              onSnooze={onSnooze}
              onReassign={onReassign}
              onReopen={onReopen}
              onDelete={onDelete}
              attentionHighlight={attentionHighlight}
              planningWeekStartISO={planningWeekStartISO}
            />
          ))}
        </div>
      )}
    </div>
  );
}
