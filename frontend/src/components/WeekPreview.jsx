import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import TaskIcon from './icons/taskIcons';
import ExpandIcon from './icons/expandIcon';
import { toISODate } from '../utils/weekDates';
import { getDisplayTitle, mealName } from '../utils/taskDisplay';
import { eventsOnDay } from '../utils/calendarEvents';
import { NextArrow, PrevArrow } from './icons/uiIcons';

// Read-only weekly overview for the Dashboard: each day is one column
// (tasks, then meals, then calendar events stacked inside it) so a 7-column
// grid on desktop groups everything by day, and collapsing to a single
// column on mobile shows day 1's tasks/meals/calendar, then day 2's, etc.
// -- not all 7 days of tasks, then all 7 days of meals, then all 7 of
// calendar, which is what three separate grids would collapse into.
export default function WeekPreview({
  weekDays, instances, meals = [], calendarEvents = [], isCurrentWeek = true, onPrev, onNext, onCurrent,
}) {
  const { t, i18n } = useTranslation();
  const fmt = (day) => day.toLocaleDateString(i18n.resolvedLanguage, { day: 'numeric', month: 'numeric' });
  const navButton = 'px-3 py-1 rounded btn-secondary hover:bg-gray-300';

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-xl font-semibold">
          {isCurrentWeek ? t('dashboard.weekOverview') : `${fmt(weekDays[0])} – ${fmt(weekDays[6])}`}
        </h2>
        {onPrev && (
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <button onClick={onCurrent} className="px-3 py-1 rounded text-sm btn-primary">
                {t('dashboard.backToCurrentWeek')}
              </button>
            )}
            <button onClick={onPrev} className={navButton} aria-label={t('dashboard.prevWeek')} title={t('dashboard.prevWeek')}><PrevArrow /></button>
            <button onClick={onNext} className={navButton} aria-label={t('dashboard.nextWeek')} title={t('dashboard.nextWeek')}><NextArrow /></button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const iso = toISODate(day);
          const dayInstances = instances.filter((i) => !i.is_in_backlog && i.scheduled_date === iso);
          const dayMeals = meals.filter((entry) => entry.date === iso);
          const dayEvents = eventsOnDay(calendarEvents, iso);
          const dayIsEmpty = !dayInstances.length && !dayMeals.length && !dayEvents.length;
          // Below sm the days stack, so empty boxes are hidden and boxes size to
          // their content; the fixed height only keeps the 7 desktop columns aligned.
          return (
            <div key={iso} className="space-y-1.5 border-b last:border-b-0 pb-2 sm:border-b-0 sm:pb-0">
              <div className="text-xs font-semibold text-gray-500 flex items-baseline gap-2">
                {day.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short', day: 'numeric' })}
                {dayIsEmpty && <span className="sm:hidden font-normal text-gray-400">{t('dashboard.dayEmpty')}</span>}
              </div>

              <div className={`${dayInstances.length ? 'block' : 'hidden sm:block'} border rounded p-2 sm:h-[90px] overflow-y-auto`}>
                <div className="space-y-1">
                  {dayInstances.map((instance) => (
                    <div
                      key={instance.id}
                      className="text-xs flex items-center gap-1 border-l-4 pl-1"
                      style={{ borderColor: instance.assigned_to_color || '#9ca3af' }}
                    >
                      <TaskIcon
                        icon={instance.icon}
                        className={`flex-shrink-0 ${instance.assigned_to ? '' : 'text-gray-400'}`}
                        style={instance.assigned_to ? { color: instance.assigned_to_color } : undefined}
                      />
                      <span className={instance.status === 'done' ? 'line-through text-gray-400' : ''}>
                        {getDisplayTitle(instance, t, i18n)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${dayMeals.length ? 'flex' : 'hidden sm:flex'} border rounded p-2 sm:h-[90px] bg-gray-50 flex-col`}>
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

              <div className={`${dayEvents.length ? 'flex' : 'hidden sm:flex'} border rounded p-2 sm:h-[90px] bg-gray-50 flex-col`}>
                <p className="text-[10px] uppercase text-gray-400 mb-1 flex-shrink-0">{t('dashboard.calendarRow')}</p>
                <div className="space-y-1 overflow-y-auto flex-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="text-xs text-amber-800 truncate border-l-4 pl-1"
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
