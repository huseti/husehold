import { useTranslation } from 'react-i18next';
import TaskIcon from './icons/taskIcons';
import { toISODate } from '../utils/weekDates';
import { getDisplayTitle, mealName } from '../utils/taskDisplay';

// Read-only weekly overview for the Dashboard: a row of household tasks and a
// second row of planned meals per day (a row for synced calendar entries
// follows with the Google Calendar phase).
export default function WeekPreview({ weekDays, instances, meals = [] }) {
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

      <h3 className="text-sm font-semibold text-gray-500 mb-1">{t('dashboard.mealsRow')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 mb-2">
        {weekDays.map((day) => {
          const iso = toISODate(day);
          const dayMeals = meals.filter((entry) => entry.date === iso);
          return (
            <div key={iso} className="border rounded p-2 min-h-[60px] bg-gray-50">
              <div className="text-xs font-semibold text-gray-500 mb-1 sm:hidden">
                {day.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short', day: 'numeric' })}
              </div>
              <div className="space-y-1">
                {dayMeals.map((entry) => (
                  <div key={entry.id} className="text-xs">
                    <span className="text-gray-400">{mealName(entry, i18n)}: </span>
                    <span className={entry.is_cooked ? 'line-through text-gray-400' : 'text-gray-700'}>
                      {entry.kind === 'leftovers' ? t('cookingPlan.leftoversOf', { title: entry.recipe_title }) : entry.recipe_title}
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
        <p>{t('dashboard.calendarComingSoon')}</p>
      </div>
    </div>
  );
}
