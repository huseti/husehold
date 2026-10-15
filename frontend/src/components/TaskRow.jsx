import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TaskIcon from './icons/taskIcons';
import MemberAvatar from './MemberAvatar';
import { getDisplayTitle, canSnoozeInstance, getPlanNowPath } from '../utils/taskDisplay';
import { parseISODate } from '../utils/weekDates';
import SwipeActions from './SwipeActions';
import {
  CheckGlyph, SnoozeGlyph, MoreGlyph, OverdueGlyph, DueTodayGlyph, DueDayGlyph,
} from './icons/uiIcons';

// Shared inline-action row for a HouseholdTaskInstance: used by "My Open
// Household Tasks" and the household-wide overdue panel on the Dashboard.
export default function TaskRow({
  task, members = [], overdue = false, today = false, onComplete, onSkip, onSnooze, navigate, showAssigneeName = false,
}) {
  const { t, i18n } = useTranslation();
  const planNowPath = getPlanNowPath(task);
  const assignee = members.find((m) => m.user.id === task.assigned_to) || null;
  // Phones: "Done" plus a ⋯ toggle; skip/snooze fold out (or swipe left to snooze).
  const [expanded, setExpanded] = useState(false);
  const foldClass = expanded ? 'fade-in' : 'hidden md:inline-flex';
  return (
    <li className="rounded-r">
      <SwipeActions
        className="rounded-r"
        right={{ label: t('tasks.complete'), icon: <CheckGlyph />, className: 'bg-eucalyptus-500 text-white', onAction: () => onComplete(task.id) }}
        left={canSnoozeInstance(task)
          ? { label: t('tasks.snooze'), icon: <SnoozeGlyph />, className: 'bg-amber-400 text-gray-900', onAction: () => onSnooze(task.id) }
          : undefined}
        contentClassName={`flex flex-wrap items-center gap-x-2 gap-y-1 border-l-4 rounded-r pl-2 pr-2 py-1.5 ${overdue ? 'bg-red-50' : 'bg-white dark:bg-gray-800'}`}
        contentStyle={{ borderColor: task.assigned_to_color || '#9ca3af' }}
      >
        <MemberAvatar member={assignee} sizeClass="h-5 w-5" />
        <TaskIcon
          icon={task.icon}
          className={`flex-shrink-0 ${assignee ? '' : 'text-gray-400'}`}
          style={assignee ? { color: assignee.color_hex } : undefined}
        />
        <span className={`flex-1 min-w-[10rem] text-sm ${overdue ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
          {getDisplayTitle(task, t, i18n)}
          {task.cooking_entry && <span className="ml-1 text-xs text-gray-500">· {task.cooking_entry.recipe_title}</span>}
          {showAssigneeName && task.assigned_to_username && (
            <span className="ml-2 text-xs text-gray-400">({task.assigned_to_username})</span>
          )}
          {/* Status as a small icon + word, not shouty capitals; the red tint of the row does the rest */}
          {overdue && (
            <span className="ml-2 inline-flex items-center gap-1 align-[-0.1em] text-xs font-medium text-red-600 whitespace-nowrap">
              <OverdueGlyph className="text-sm" />{t('dashboard.overdue')}
            </span>
          )}
          {today && (
            <span className="ml-2 inline-flex items-center gap-1 align-[-0.1em] text-xs font-medium text-eucalyptus-700 whitespace-nowrap">
              <DueTodayGlyph className="text-sm" />{t('dashboard.dueToday')}
            </span>
          )}
          {/* Later this week: the day it's due, e.g. "Fr., 17.10." */}
          {!overdue && !today && task.scheduled_date && (
            <span className="ml-2 inline-flex items-center gap-1 align-[-0.1em] text-xs text-gray-500 whitespace-nowrap">
              <DueDayGlyph className="text-sm" />
              {parseISODate(task.scheduled_date).toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short', day: 'numeric', month: 'numeric' })}
            </span>
          )}
        </span>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {planNowPath && (
            <button
              onClick={() => navigate(planNowPath)}
              className="btn btn-sm md:text-xs md:px-2 md:py-0.5 btn-secondary text-purple-700 hover:btn-secondary"
            >
              {t('weeklyPlanning.planNow')}
            </button>
          )}
          <button
            onClick={() => onComplete(task.id)}
            className="btn btn-sm md:text-xs md:px-2 md:py-0.5 btn-primary text-green-700 hover:bg-green-200"
          >
            {t('tasks.complete')}
          </button>
          <button
            onClick={() => onSkip(task.id)}
            className={`btn btn-sm md:text-xs md:px-2 md:py-0.5 btn-secondary text-orange-700 hover:bg-orange-200 ${foldClass}`}
          >
            {t('tasks.skip')}
          </button>
          {canSnoozeInstance(task) && (
            <button
              onClick={() => onSnooze(task.id)}
              className={`btn btn-sm md:text-xs md:px-2 md:py-0.5 btn-secondary text-yellow-700 hover:bg-yellow-200 ${foldClass}`}
            >
              {t('tasks.snooze')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? t('tasks.lessActions') : t('tasks.moreActions')}
            title={expanded ? t('tasks.lessActions') : t('tasks.moreActions')}
            className={`icon-btn md:!hidden text-xl ${expanded ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
          >
            <MoreGlyph />
          </button>
        </div>
      </SwipeActions>
    </li>
  );
}
