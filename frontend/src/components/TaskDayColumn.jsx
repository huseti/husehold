import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import TaskCard from './TaskCard';

export default function TaskDayColumn({ date, dateISO, instances, members, onComplete, onSkip, onSnooze, onReassign, onReopen, onDelete, attentionHighlight = false }) {
  const { t, i18n } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: dateISO });

  const weekdayLabel = date.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short' });
  const dayLabel = date.toLocaleDateString(i18n.resolvedLanguage, { day: 'numeric', month: 'short' });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-2 min-h-[200px] ${isOver ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}
    >
      <div className="text-sm font-semibold mb-2">
        {weekdayLabel} <span className="text-gray-400 font-normal">{dayLabel}</span>
      </div>
      <div className="space-y-2">
        {instances.length === 0 && (
          <p className="text-xs text-gray-400">{t('tasks.noTasks')}</p>
        )}
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
          />
        ))}
      </div>
    </div>
  );
}
