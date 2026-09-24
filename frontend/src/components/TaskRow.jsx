import { useTranslation } from 'react-i18next';
import TaskIcon from './icons/taskIcons';
import { getDisplayTitle, canSnoozeInstance, getPlanNowPath } from '../utils/taskDisplay';

// Shared inline-action row for a HouseholdTaskInstance: used by "My Open
// Household Tasks" and the household-wide overdue panel on the Dashboard.
export default function TaskRow({
  task, overdue = false, today = false, onComplete, onSkip, onSnooze, navigate, showAssigneeName = false,
}) {
  const { t, i18n } = useTranslation();
  const planNowPath = getPlanNowPath(task);
  return (
    <li
      className={`flex items-center gap-2 border-l-4 pl-2 py-1 ${overdue ? 'bg-red-50' : ''}`}
      style={{ borderColor: task.assigned_to_color || '#9ca3af' }}
    >
      <TaskIcon icon={task.icon} className="text-gray-500 flex-shrink-0" />
      <span className={`flex-1 text-sm ${overdue ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
        {getDisplayTitle(task, t, i18n)}
        {showAssigneeName && task.assigned_to_username && (
          <span className="ml-2 text-xs text-gray-400">({task.assigned_to_username})</span>
        )}
        {overdue && <span className="ml-2 text-xs uppercase tracking-wide">{t('dashboard.overdue')}</span>}
        {today && <span className="ml-2 text-xs text-blue-600 uppercase tracking-wide">{t('dashboard.dueToday')}</span>}
      </span>
      {planNowPath && (
        <button
          onClick={() => navigate(planNowPath)}
          className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
        >
          {t('weeklyPlanning.planNow')}
        </button>
      )}
      <button
        onClick={() => onComplete(task.id)}
        className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
      >
        {t('tasks.complete')}
      </button>
      <button
        onClick={() => onSkip(task.id)}
        className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
      >
        {t('tasks.skip')}
      </button>
      {canSnoozeInstance(task) && (
        <button
          onClick={() => onSnooze(task.id)}
          className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
        >
          {t('tasks.snooze')}
        </button>
      )}
    </li>
  );
}
