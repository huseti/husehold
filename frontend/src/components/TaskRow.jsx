import { useTranslation } from 'react-i18next';
import TaskIcon from './icons/taskIcons';
import MemberAvatar from './MemberAvatar';
import { getDisplayTitle, canSnoozeInstance, getPlanNowPath } from '../utils/taskDisplay';

// Shared inline-action row for a HouseholdTaskInstance: used by "My Open
// Household Tasks" and the household-wide overdue panel on the Dashboard.
export default function TaskRow({
  task, members = [], overdue = false, today = false, onComplete, onSkip, onSnooze, navigate, showAssigneeName = false,
}) {
  const { t, i18n } = useTranslation();
  const planNowPath = getPlanNowPath(task);
  const assignee = members.find((m) => m.user.id === task.assigned_to) || null;
  return (
    <li
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-l-4 rounded-r pl-2 pr-2 py-1.5 ${overdue ? 'bg-red-50' : ''}`}
      style={{ borderColor: task.assigned_to_color || '#9ca3af' }}
    >
      <MemberAvatar member={assignee} sizeClass="h-5 w-5" />
      <TaskIcon
        icon={task.icon}
        className={`flex-shrink-0 ${assignee ? '' : 'text-gray-400'}`}
        style={assignee ? { color: assignee.color_hex } : undefined}
      />
      <span className={`flex-1 min-w-[10rem] text-sm ${overdue ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
        {getDisplayTitle(task, t, i18n)}
        {task.cooking_entry && <span className="ml-1 text-xs text-gray-500">· {task.cooking_entry.recipe_title}</span>}
        {showAssigneeName && task.assigned_to_username && (
          <span className="ml-2 text-xs text-gray-400">({task.assigned_to_username})</span>
        )}
        {overdue && <span className="ml-2 text-xs uppercase tracking-wide">{t('dashboard.overdue')}</span>}
        {today && <span className="ml-2 text-xs text-eucalyptus-600 uppercase tracking-wide">{t('dashboard.dueToday')}</span>}
      </span>
      <div className="flex items-center gap-2 ml-auto">
        {planNowPath && (
          <button
            onClick={() => navigate(planNowPath)}
            className="text-xs px-2 py-0.5 rounded btn-secondary text-purple-700 hover:btn-secondary"
          >
            {t('weeklyPlanning.planNow')}
          </button>
        )}
        <button
          onClick={() => onComplete(task.id)}
          className="text-xs px-2 py-0.5 rounded btn-primary text-green-700 hover:bg-green-200"
        >
          {t('tasks.complete')}
        </button>
        <button
          onClick={() => onSkip(task.id)}
          className="text-xs px-2 py-0.5 rounded btn-secondary text-orange-700 hover:bg-orange-200"
        >
          {t('tasks.skip')}
        </button>
        {canSnoozeInstance(task) && (
          <button
            onClick={() => onSnooze(task.id)}
            className="text-xs px-2 py-0.5 rounded btn-secondary text-yellow-700 hover:bg-yellow-200"
          >
            {t('tasks.snooze')}
          </button>
        )}
      </div>
    </li>
  );
}
