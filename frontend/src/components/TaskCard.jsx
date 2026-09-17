import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import TaskIcon from './icons/taskIcons';
import { getDisplayTitle } from '../utils/taskDisplay';

export default function TaskCard({ instance, members, onComplete, onSkip, onSnooze, onReassign, interactive = true, attentionHighlight = false }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: instance.id,
    disabled: !interactive,
  });

  const color = instance.assigned_to_color || '#9ca3af';
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
    : undefined;

  const isDone = instance.status === 'done';
  const isSkipped = instance.status === 'skipped';
  const needsAttention = attentionHighlight && !isDone && !instance.assigned_to;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: color, opacity: isDragging ? 0.5 : 1 }}
      className={`border-l-4 rounded shadow-sm p-2 bg-gray-50 text-sm ${isDone ? 'opacity-60' : ''} ${isSkipped ? 'opacity-50' : ''} ${needsAttention ? 'ring-2 ring-red-400' : ''}`}
    >
      <div
        {...(interactive ? { ...listeners, ...attributes } : {})}
        className={`font-medium flex items-center gap-1.5 ${interactive ? 'cursor-grab' : ''}`}
      >
        <TaskIcon icon={instance.icon} className="text-gray-500 flex-shrink-0" />
        {getDisplayTitle(instance, t)}
        {isSkipped && <span className="text-xs text-gray-400 ml-1">({t('tasks.skipped')})</span>}
        {needsAttention && <span className="text-xs text-red-500 ml-1" title={t('weeklyPlanning.needsAttention')}>⚠</span>}
      </div>
      <div className="text-xs text-gray-500 mb-1">{instance.assigned_to_username || t('tasks.unassigned')}</div>

      {interactive && !isDone && (
        <div className="flex items-center gap-1 flex-wrap mt-1">
          <button
            onClick={() => onComplete(instance.id)}
            className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
          >
            {t('tasks.complete')}
          </button>
          {onSkip && (
            <button
              onClick={() => onSkip(instance.id)}
              className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
            >
              {t('tasks.skip')}
            </button>
          )}
          {onSnooze && (
            <button
              onClick={() => onSnooze(instance.id)}
              className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            >
              {t('tasks.snooze')}
            </button>
          )}
          {members && onReassign && (
            <select
              value={instance.assigned_to || ''}
              onChange={(e) => onReassign(instance.id, e.target.value || null)}
              className="text-xs border rounded px-1 py-0.5"
            >
              <option value="">{t('tasks.unassigned')}</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.username}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
