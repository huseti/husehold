import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import TaskIcon from './icons/taskIcons';
import ExpandIcon from './icons/expandIcon';
import { toISODate } from '../utils/weekDates';
import { getDisplayTitle, mealName } from '../utils/taskDisplay';
import { eventsOnDay } from '../utils/calendarEvents';

// Read-only weekly overview for the Dashboard: each day is one column
// (tasks, then meals, then calendar events stacked inside it) so a 7-column
// grid on desktop groups everything by day, and collapsing to a single
// column on mobile shows day 1's tasks/meals/calendar, then day 2's, etc.
// -- not all 7 days of tasks, then all 7 days of meals, then all 7 of
// calendar, which is what three separate grids would collapse into.
export default function WeekPreview({ weekDays, instances, meals = [], calendarEvents = [] }) {
  const { t, i18n } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-semibold mb-3">{t('dashboard.weekOverview')}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const iso = toISODate(day);
          const dayInstances = instances.filter((i) => !i.is_in_backlog && i.scheduled_date === iso);
          const dayMeals = meals.filter((entry) => entry.date === iso);
          const dayEvents = eventsOnDay(calendarEvents, iso);
          return (
            <div key={iso} className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500">
                {day.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short', day: 'numeric' })}
              </div>

              <div className="border rounded p-2 h-[90px] overflow-y-auto">
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

              <div className="border rounded p-2 h-[90px] bg-gray-50 flex flex-col">
                <p className="text-[10px] uppercase text-gray-400 mb-1 flex-shrink-0">{t('dashboard.mealsRow')}</p>
                <div className="space-y-1 overflow-y-auto flex-1">
                  {dayMeals.map((entry) => (
                    <div key={entry.id} className="text-xs flex items-center justify-between gap-1">
                      <span>
                        <span className="text-gray-400">{mealName(entry, i18n)}: </span>
                        <span className={entry.is_cooked ? 'line-through text-gray-400' : 'text-gray-700'}>
                          {entry.kind === 'leftovers' ? t('cookingPlan.leftoversOf', { title: entry.recipe_title }) : entry.recipe_title}
                        </span>
                      </span>
                      {entry.kind === 'cook' && entry.recipe && (
                        <Link
                          to={`/recipes/${entry.recipe}/highlight?servings=${entry.servings}`}
                          className="text-gray-400 hover:text-gray-700 flex-shrink-0"
                          aria-label={t('recipes.highlightMode')}
                          title={t('recipes.highlightMode')}
                        >
                          <ExpandIcon />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border rounded p-2 h-[90px] bg-gray-50 flex flex-col">
                <p className="text-[10px] uppercase text-gray-400 mb-1 flex-shrink-0">{t('dashboard.calendarRow')}</p>
                <div className="space-y-1 overflow-y-auto flex-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="text-xs text-amber-800 truncate border-l-2 pl-1"
                      style={{ borderColor: event.color_hex || '#d97706' }}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
