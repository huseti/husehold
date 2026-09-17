import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';

export default function TaskCard({ instance, members, onComplete, onSnooze, onReassign }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: instance.id });

  const color = instance.assigned_to_color || '#9ca3af';
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
    : undefined;

  const isDone = instance.status === 'done';
  const isSnoozed = instance.status === 'snoozed';

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: color, opacity: isDragging ? 0.5 : 1 }}
      className={`border-l-4 rounded shadow-sm p-2 bg-gray-50 text-sm ${isDone ? 'opacity-60' : ''} ${isSnoozed ? 'opacity-50' : ''}`}
    >
      <div {...listeners} {...attributes} className="cursor-grab font-medium">
        {instance.definition_title}
      </div>
      <div className="text-xs text-gray-500 mb-1">{instance.assigned_to_username || t('tasks.unassigned')}</div>

      {!isDone && (
        <div className="flex items-center gap-1 flex-wrap mt-1">
          <button
            onClick={() => onComplete(instance.id)}
            className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
          >
            {t('tasks.complete')}
          </button>
          <button
            onClick={() => onSnooze(instance.id)}
            className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
          >
            {t('tasks.snooze')}
          </button>
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
        </div>
      )}
    </div>
  );
}
