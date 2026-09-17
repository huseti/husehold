import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import TaskIcon from './icons/taskIcons';
import { getDisplayTitle } from '../utils/taskDisplay';

export default function TaskCard({
  instance, members, onComplete, onSkip, onSnooze, onReassign, onReopen, onDelete,
  interactive = true, attentionHighlight = false,
}) {
  const { t } = useTranslation();

  const handleDelete = () => {
    if (window.confirm(t('tasks.confirmDeleteInstance', { title: getDisplayTitle(instance, t) }))) {
      onDelete(instance.id);
    }
  };

  const isDone = instance.status === 'done';
  const isSkipped = instance.status === 'skipped';
  const isSnoozedFrozen = instance.status === 'snoozed'; // the original -- stays on its day, greyed out
  const isResolved = isDone || isSkipped || isSnoozedFrozen;

  // The open copy snooze creates in next week's backlog -- a normal,
  // fully-interactive item, just tagged with where it came from.
  const isSnoozedCopy = instance.is_in_backlog && instance.status === 'pending'
    && instance.events?.some((e) => e.event_type === 'snoozed');

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: instance.id,
    disabled: !interactive || isResolved,
  });

  const color = instance.assigned_to_color || '#9ca3af';
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
    : undefined;

  const needsAttention = attentionHighlight && !isResolved && !instance.assigned_to;

  const stateLabel = isDone ? t('tasks.done') : isSkipped ? t('tasks.skipped') : isSnoozedFrozen ? t('tasks.snoozed') : null;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: color, opacity: isDragging ? 0.5 : isResolved ? 0.6 : 1 }}
      className={`border-l-4 rounded shadow-sm bg-gray-50 ${isResolved ? 'p-1.5 text-xs' : 'p-2 text-sm'} ${needsAttention ? 'ring-2 ring-red-400' : ''}`}
    >
      <div
        {...(interactive && !isResolved ? { ...listeners, ...attributes } : {})}
        className={`font-medium flex items-center gap-1.5 ${interactive && !isResolved ? 'cursor-grab' : ''} ${isResolved ? 'text-gray-500' : ''}`}
      >
        <TaskIcon icon={instance.icon} className={`flex-shrink-0 ${isResolved ? 'text-gray-400' : 'text-gray-500'}`} />
        <span className={isDone ? 'line-through' : ''}>{getDisplayTitle(instance, t)}</span>
        {stateLabel && <span className="text-gray-400 ml-1">({stateLabel})</span>}
        {isSnoozedCopy && <span className="text-gray-400 font-normal ml-1">({t('tasks.snoozed')})</span>}
        {needsAttention && <span className="text-xs text-red-500 ml-1" title={t('weeklyPlanning.needsAttention')}>⚠</span>}
      </div>
      <div className={`text-gray-500 ${isResolved ? 'text-[11px]' : 'text-xs'}`}>
        {instance.assigned_to_username || t('tasks.unassigned')}
      </div>
      <div className="text-[10px] text-gray-400 mb-1">
        {instance.created_by_username
          ? t('tasks.instanceCreatedBy', { date: new Date(instance.created_at).toLocaleDateString(), name: instance.created_by_username })
          : t('tasks.instanceCreatedOn', { date: new Date(instance.created_at).toLocaleDateString() })}
      </div>

      {interactive && isResolved && (onReopen || onDelete) && (
        <div className="flex items-center gap-1 flex-wrap">
          {onReopen && (
            <button
              onClick={() => onReopen(instance.id)}
              className="text-[11px] px-2 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
              title={t('tasks.undo')}
            >
              ↺ {t('tasks.undo')}
            </button>
          )}
          {onDelete && (
            <button onClick={handleDelete} title={t('tasks.deleteInstance')} className="text-red-500 hover:text-red-700">
              <TaskIcon icon="trash" />
            </button>
          )}
        </div>
      )}

      {interactive && !isResolved && (
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
          {onDelete && (
            <button onClick={handleDelete} title={t('tasks.deleteInstance')} className="text-red-500 hover:text-red-700 ml-auto">
              <TaskIcon icon="trash" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
