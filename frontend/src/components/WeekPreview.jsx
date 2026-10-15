import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import TaskIcon from './icons/taskIcons';
import ExpandIcon from './icons/expandIcon';
import { toISODate } from '../utils/weekDates';
import { getDisplayTitle, mealName } from '../utils/taskDisplay';
import { eventsOnDay } from '../utils/calendarEvents';
import { NextArrow, PrevArrow } from './icons/uiIcons';
import TitleIcon from './TitleIcon';
import { WeekIcon } from './icons/sectionIcons';

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
  const inWeek = (iso) => weekDays.some((d) => toISODate(d) === iso);
  const weekHas = {
    tasks: instances.some((i) => !i.is_in_backlog && inWeek(i.scheduled_date)),
    meals: meals.some((entry) => inWeek(entry.date)),
    events: weekDays.some((d) => eventsOnDay(calendarEvents, toISODate(d)).length > 0),
  };

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <TitleIcon><WeekIcon /></TitleIcon>
          {isCurrentWeek ? t('dashboard.weekOverview') : `${fmt(weekDays[0])} – ${fmt(weekDays[6])}`}
        </h2>
        {onPrev && (
          <div className="flex items-center gap-2">
            {!isCurrentWeek && (
              <button onClick={onCurrent} className="btn btn-sm btn-primary">
                {t('dashboard.backToCurrentWeek')}
              </button>
            )}
            <button onClick={onPrev} className={navButton} aria-label={t('dashboard.prevWeek')} title={t('dashboard.prevWeek')}><PrevArrow /></button>
            <button onClick={onNext} className={navButton} aria-label={t('dashboard.nextWeek')} title={t('dashboard.nextWeek')}><NextArrow /></button>
          </div>
        )}
      </div>

      {/* From sm up each day is a subgrid spanning the 4 shared rows (date, tasks,
          meals, calendar): a row grows to its fullest day, so nothing is clipped and
          the columns stay aligned. A row that's empty all week is left out. */}
      <div className="grid grid-cols-1 sm:grid-cols-7 sm:grid-rows-[auto_auto_auto_auto] gap-2">
        {weekDays.map((day) => {
          const iso = toISODate(day);
          const dayInstances = instances.filter((i) => !i.is_in_backlog && i.scheduled_date === iso);
          const dayMeals = meals.filter((entry) => entry.date === iso);
          const dayEvents = eventsOnDay(calendarEvents, iso);
          const dayIsEmpty = !dayInstances.length && !dayMeals.length && !dayEvents.length;
          // Below sm the days stack, so empty boxes are hidden.
          return (
            <div key={iso} className="space-y-1.5 border-b last:border-b-0 pb-2 sm:border-b-0 sm:pb-0 sm:grid sm:grid-rows-subgrid sm:row-span-4 sm:space-y-0">
              <div className="text-xs font-semibold text-gray-500 flex items-baseline gap-2">
                {day.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short', day: 'numeric' })}
                {dayIsEmpty && <span className="sm:hidden font-normal text-gray-400">{t('dashboard.dayEmpty')}</span>}
              </div>

              <div className={`${dayInstances.length ? 'block' : weekHas.tasks ? 'hidden sm:block' : 'hidden'} border rounded-lg p-2 sm:min-h-[2.5rem]`}>
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

              <div className={`${dayMeals.length ? 'flex' : weekHas.meals ? 'hidden sm:flex' : 'hidden'} border rounded-lg p-2 bg-gray-50 flex-col`}>
                <p className="text-xs uppercase text-gray-500 mb-1 flex-shrink-0">{t('dashboard.mealsRow')}</p>
                <div className="space-y-1 flex-1">
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

              <div className={`${dayEvents.length ? 'flex' : weekHas.events ? 'hidden sm:flex' : 'hidden'} border rounded-lg p-2 bg-gray-50 flex-col`}>
                <p className="text-xs uppercase text-gray-500 mb-1 flex-shrink-0">{t('dashboard.calendarRow')}</p>
                <div className="space-y-1 flex-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      title={event.title}
                      className="text-xs text-amber-800 break-words hyphens-auto border-l-4 pl-1"
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
