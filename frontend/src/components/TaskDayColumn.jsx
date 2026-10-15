import { useDroppable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import TaskCard from './TaskCard';
import CalendarEventList from './CalendarEventList';

export default function TaskDayColumn({
  date, dateISO, instances, members, onComplete, onSkip, onSnooze, onReassign, onReopen, onDelete,
  attentionHighlight = false, calendarEvents = [], weekDays, onMove,
}) {
  const { t, i18n } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: dateISO });

  const weekdayLabel = date.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short' });
  const dayLabel = date.toLocaleDateString(i18n.resolvedLanguage, { day: 'numeric', month: 'short' });
  const isEmpty = instances.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border p-2 md:min-h-[200px] ${isOver ? 'bg-eucalyptus-50 border-eucalyptus-300' : 'bg-white border-gray-200'}`}
    >
      {/* Phones: an empty day collapses to its header line ("Mo 12. Okt. · Keine Aufgaben") */}
      <div className={`text-sm font-semibold ${isEmpty && calendarEvents.length === 0 ? 'md:mb-2' : 'mb-2'}`}>
        {weekdayLabel} <span className="text-gray-400 font-normal">{dayLabel}</span>
        {isEmpty && <span className="md:hidden text-xs text-gray-400 font-normal"> · {t('tasks.noTasks')}</span>}
      </div>
      <CalendarEventList events={calendarEvents} className={isEmpty ? 'md:mb-2' : 'mb-2'} />
      <div className="space-y-2">
        {isEmpty && (
          <p className="hidden md:block text-xs text-gray-400">{t('tasks.noTasks')}</p>
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
            weekDays={weekDays}
            onMove={onMove}
            dayPickerMobileOnly
          />
        ))}
      </div>
    </div>
  );
}
