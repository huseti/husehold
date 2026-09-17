import { useTranslation } from 'react-i18next';
import TaskIcon from './icons/taskIcons';
import { toISODate } from '../utils/weekDates';
import { getDisplayTitle } from '../utils/taskDisplay';

// Read-only weekly overview for the Dashboard -- household tasks now, with
// a row reserved for meals and one for synced calendar entries once those
// exist (Cooking Plan / Google Calendar are later phases).
export default function WeekPreview({ weekDays, instances }) {
  const { t, i18n } = useTranslation();
  const backlogCount = instances.filter((i) => i.is_in_backlog).length;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-semibold mb-3">{t('dashboard.weekOverview')}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 mb-2">
        {weekDays.map((day) => {
          const iso = toISODate(day);
          const dayInstances = instances.filter((i) => !i.is_in_backlog && i.scheduled_date === iso);
          return (
            <div key={iso} className="border rounded p-2 min-h-[90px]">
              <div className="text-xs font-semibold text-gray-500 mb-1">
                {day.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short', day: 'numeric' })}
              </div>
              <div className="space-y-1">
                {dayInstances.map((instance) => (
                  <div
                    key={instance.id}
                    className="text-xs flex items-center gap-1 border-l-2 pl-1"
                    style={{ borderColor: instance.assigned_to_color || '#9ca3af' }}
                  >
                    <TaskIcon icon={instance.icon} className="text-gray-400 flex-shrink-0" />
                    <span className={instance.status === 'done' ? 'line-through text-gray-400' : ''}>
                      {getDisplayTitle(instance, t, i18n)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {backlogCount > 0 && (
        <p className="text-xs text-amber-700 mb-2">{t('tasks.backlogCount', { count: backlogCount })}</p>
      )}

      <div className="text-xs text-gray-400 border-t pt-2 space-y-1">
        <p>{t('dashboard.mealsComingSoon')}</p>
        <p>{t('dashboard.calendarComingSoon')}</p>
      </div>
    </div>
  );
}
