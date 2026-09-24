import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import TaskRow from './TaskRow';

// Combined tasks card: the current user's own open tasks (overdue/today/this
// week), followed by the rest of the household's overdue tasks -- so the
// dashboard doesn't need a separate panel just for other members' overdue work.
export default function TasksPanel({
  overdueTasks, todayTasks, thisWeekTasks, otherOverdueTasks, onComplete, onSkip, onSnooze, navigate,
}) {
  const { t } = useTranslation();
  const hasOwnTasks = overdueTasks.length + todayTasks.length + thisWeekTasks.length > 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">{t('dashboard.myOpenTasks')}</h2>
      {hasOwnTasks ? (
        <ul className="space-y-2">
          {overdueTasks.map((task) => (
            <TaskRow key={task.id} task={task} overdue onComplete={onComplete} onSkip={onSkip} onSnooze={onSnooze} navigate={navigate} />
          ))}
          {todayTasks.map((task) => (
            <TaskRow key={task.id} task={task} today onComplete={onComplete} onSkip={onSkip} onSnooze={onSnooze} navigate={navigate} />
          ))}
          {thisWeekTasks.map((task) => (
            <TaskRow key={task.id} task={task} onComplete={onComplete} onSkip={onSkip} onSnooze={onSnooze} navigate={navigate} />
          ))}
        </ul>
      ) : (
        <p className="text-gray-400 text-sm">{t('dashboard.noOpenTasks')}</p>
      )}
      <Link to="/tasks" className="mt-4 inline-block text-blue-500 hover:text-blue-700 font-medium">
        {t('dashboard.viewAll')}
      </Link>

      {otherOverdueTasks.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">{t('dashboard.householdOverdue.title')}</h3>
          <ul className="space-y-2">
            {otherOverdueTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                overdue
                showAssigneeName
                onComplete={onComplete}
                onSkip={onSkip}
                onSnooze={onSnooze}
                navigate={navigate}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
