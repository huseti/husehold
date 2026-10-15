import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import TaskIcon from './icons/taskIcons';
import MemberAvatar from './MemberAvatar';
import { getDisplayTitle, canSnoozeInstance, getPlanNowPath } from '../utils/taskDisplay';
import { getWeekStart, parseISODate, toISODate } from '../utils/weekDates';
import { UndoGlyph, MoreGlyph, CheckGlyph, SnoozeGlyph } from './icons/uiIcons';
import SwipeActions from './SwipeActions';
import DayPicker from './DayPicker';

// Spelled out in full so Tailwind's class scanner sees them. inline-flex is for
// .icon-btn, plain CSS declared after the utilities, so it needs the ! variants.
const MD_ONLY = { block: 'hidden md:block', 'inline-block': 'hidden md:inline-block', 'inline-flex': '!hidden md:!inline-flex' };

export default function TaskCard({
  instance, members, onComplete, onSkip, onSnooze, onReassign, onReopen, onDelete,
  interactive = true, attentionHighlight = false, planningWeekStartISO,
  weekDays, onMove, dayPickerMobileOnly = false,
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Phones: a card shows only "Done" (+ "Plan now") and a ⋯ toggle; the rest
  // (skip, next week, reassign, delete, day chips) folds out on tap. From md
  // up everything stays visible. In planning mode (attentionHighlight) the
  // assignee and day chips are the point of the exercise, so they stay open.
  const [expanded, setExpanded] = useState(false);
  const showPlanning = expanded || attentionHighlight;
  const mobileHidden = (visible, display = 'block') => (visible ? 'fade-in' : MD_ONLY[display]);

  // No "are you sure?": the page removes it with an undo snackbar.
  const handleDelete = () => onDelete(instance.id);

  const planNowPath = getPlanNowPath(instance);
  const assignee = members?.find((m) => m.user.id === instance.assigned_to) || null;

  const isDone = instance.status === 'done';
  const isSkipped = instance.status === 'skipped';
  const isSnoozedFrozen = instance.status === 'snoozed'; // the original -- stays on its day, greyed out
  const isResolved = isDone || isSkipped || isSnoozedFrozen;

  // The open copy snooze creates in next week's backlog -- a normal,
  // fully-interactive item, just tagged with where it came from.
  const isSnoozedCopy = instance.is_in_backlog && instance.status === 'pending'
    && instance.events?.some((e) => e.event_type === 'snoozed');

  // A normal, day-pinned task (never touched the backlog) that's still open
  // from before the week being planned -- e.g. a Wednesday task that never
  // got done. Shown in the "carried over" bucket, but it's not a backlog
  // item at all, so it needs its own distinct tag rather than "(snoozed)".
  const isCarriedOverFromPastWeek = !!planningWeekStartISO && !instance.is_in_backlog
    && instance.status === 'pending'
    && toISODate(getWeekStart(parseISODate(instance.scheduled_date))) < planningWeekStartISO;

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

  const canSwipe = interactive && !isResolved && !isDragging;
  return (
    <SwipeActions
      className="rounded-lg"
      right={canSwipe ? { label: t('tasks.complete'), icon: <CheckGlyph />, className: 'bg-eucalyptus-500 text-white', onAction: () => onComplete(instance.id) } : undefined}
      left={canSwipe && onSnooze && canSnoozeInstance(instance)
        ? { label: t('tasks.snooze'), icon: <SnoozeGlyph />, className: 'bg-amber-400 text-gray-900', onAction: () => onSnooze(instance.id) }
        : undefined}
    >
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: color, opacity: isDragging ? 0.5 : isResolved ? 0.6 : 1 }}
      className={`border-l-4 rounded-lg shadow-sm bg-gray-50 ${isResolved ? 'p-1.5 text-xs' : 'p-2 text-sm'} ${needsAttention ? 'ring-2 ring-red-400' : ''}`}
    >
      <div
        {...(interactive && !isResolved ? { ...listeners, ...attributes } : {})}
        className={`font-medium break-words hyphens-auto ${interactive && !isResolved ? 'cursor-grab' : ''} ${isResolved ? 'text-gray-500' : ''}`}
      >
        {/* Inline text flow, not flex: icon, title and state labels wrap at spaces
            like a sentence instead of squeezing the title mid-word in narrow columns. */}
        <TaskIcon
          icon={instance.icon}
          className={`inline-block align-[-0.125em] mr-1.5 ${assignee ? '' : 'text-gray-400'}`}
          style={assignee ? { color: assignee.color_hex } : undefined}
        />
        <span className={isDone ? 'line-through' : ''}>{getDisplayTitle(instance, t, i18n)}</span>
        {stateLabel && <span className="text-gray-400 ml-1">({stateLabel})</span>}
        {isSnoozedCopy && <span className="text-gray-400 font-normal ml-1">({t('tasks.snoozed')})</span>}
        {isCarriedOverFromPastWeek && <span className="text-gray-400 font-normal ml-1">({t('weeklyPlanning.carriedOverFromLastWeek')})</span>}
        {needsAttention && <span className="text-xs text-red-500 ml-1" title={t('weeklyPlanning.needsAttention')}>⚠</span>}
      </div>
      {instance.cooking_entry && (
        <div className={`text-gray-500 ${isResolved ? 'text-xs' : 'text-xs'}`}>
          {instance.cooking_entry.recipe_title} · {t('cookingPlan.servingsShort', { count: instance.cooking_entry.servings })}
        </div>
      )}
      <div className={`flex items-center gap-1.5 mt-0.5 text-gray-500 ${isResolved ? 'text-xs' : 'text-xs'}`}>
        <MemberAvatar member={assignee} sizeClass={isResolved ? 'h-4 w-4' : 'h-5 w-5'} />
        {instance.assigned_to_username || t('tasks.unassigned')}
      </div>
      <div className={`text-xs text-gray-400 mb-1 ${mobileHidden(expanded)}`}>
        {instance.created_by_username
          ? t('tasks.instanceCreatedBy', { date: new Date(instance.created_at).toLocaleDateString(), name: instance.created_by_username })
          : t('tasks.instanceCreatedOn', { date: new Date(instance.created_at).toLocaleDateString() })}
      </div>

      {interactive && isResolved && (onReopen || onDelete) && (
        <div className="flex items-center gap-1 flex-wrap">
          {onReopen && (
            <button
              onClick={() => onReopen(instance.id)}
              className="text-xs px-2 py-0.5 rounded-lg btn-secondary text-gray-700 hover:bg-gray-300"
              title={t('tasks.undo')}
            >
              <UndoGlyph /> {t('tasks.undo')}
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
        <div className="flex items-center gap-1.5 md:gap-1 flex-wrap mt-1.5 md:mt-1">
          {planNowPath && (
            <button
              onClick={() => navigate(planNowPath)}
              className="btn btn-sm md:text-xs md:px-2 md:py-0.5 btn-secondary text-purple-700 hover:btn-secondary"
            >
              {t('weeklyPlanning.planNow')}
            </button>
          )}
          <button
            onClick={() => onComplete(instance.id)}
            className="btn btn-sm md:text-xs md:px-2 md:py-0.5 btn-primary text-green-700 hover:bg-green-200"
          >
            {t('tasks.complete')}
          </button>
          {onSkip && (
            <button
              onClick={() => onSkip(instance.id)}
              className={`btn btn-sm md:text-xs md:px-2 md:py-0.5 btn-secondary text-orange-700 hover:bg-orange-200 ${mobileHidden(expanded, 'inline-block')}`}
            >
              {t('tasks.skip')}
            </button>
          )}
          {onSnooze && canSnoozeInstance(instance) && (
            <button
              onClick={() => onSnooze(instance.id)}
              className={`btn btn-sm md:text-xs md:px-2 md:py-0.5 btn-secondary text-yellow-700 hover:bg-yellow-200 ${mobileHidden(expanded, 'inline-block')}`}
            >
              {t('tasks.snooze')}
            </button>
          )}
          {members && onReassign && (
            <select
              value={instance.assigned_to || ''}
              onChange={(e) => onReassign(instance.id, e.target.value || null)}
              className={`text-sm md:text-xs border rounded-lg px-1 py-0.5 ${mobileHidden(showPlanning, 'inline-block')}`}
            >
              <option value="">{t('tasks.unassigned')}</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.username}</option>
              ))}
            </select>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              title={t('tasks.deleteInstance')}
              aria-label={t('tasks.deleteInstance')}
              className={`icon-btn !text-red-500 hover:!text-red-700 md:!w-auto md:!h-auto md:ml-auto ${mobileHidden(expanded, 'inline-flex')}`}
            >
              <TaskIcon icon="trash" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? t('tasks.lessActions') : t('tasks.moreActions')}
            title={expanded ? t('tasks.lessActions') : t('tasks.moreActions')}
            className={`icon-btn ml-auto md:!hidden text-xl ${expanded ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          >
            <MoreGlyph />
          </button>
        </div>
      )}

      {interactive && !isResolved && weekDays && onMove && (
        <DayPicker
          weekDays={weekDays}
          selectedISO={instance.is_in_backlog ? null : instance.scheduled_date}
          onPick={(iso) => onMove(instance, iso)}
          showBacklog={!instance.is_in_backlog}
          className={`${showPlanning ? '' : 'hidden'} ${dayPickerMobileOnly ? 'md:hidden' : 'md:flex'}`}
        />
      )}
    </div>
    </SwipeActions>
  );
}
