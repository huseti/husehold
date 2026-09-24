import { useTranslation } from 'react-i18next';
import { mealName } from '../utils/taskDisplay';

// Today's planned meals with a one-click "mark cooked" action. task_instance
// is only present once the week's plan is finalized, which also naturally
// excludes leftovers/free entries that never get one -- so its presence is
// the reliable guard for whether this entry can be marked cooked here.
export default function TodaysMealsPanel({ meals, onMarkCooked }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">{t('dashboard.todaysMeals.title')}</h2>
      {meals.length === 0 ? (
        <p className="text-gray-400 text-sm">{t('dashboard.todaysMeals.none')}</p>
      ) : (
        <ul className="space-y-2">
          {meals.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 border-l-4 pl-2 py-1"
              style={{ borderColor: entry.assigned_to_color || '#9ca3af' }}
            >
              <span className="flex-1 text-sm text-gray-700">
                <span className="text-gray-400">{mealName(entry, i18n)}: </span>
                {entry.kind === 'leftovers' ? t('cookingPlan.leftoversOf', { title: entry.recipe_title }) : entry.recipe_title}
                {entry.assigned_to_username && (
                  <span className="ml-2 text-xs text-gray-400">({entry.assigned_to_username})</span>
                )}
              </span>
              {entry.task_instance && !entry.is_cooked && (
                <button
                  onClick={() => onMarkCooked(entry.task_instance)}
                  className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
                >
                  {t('dashboard.todaysMeals.markCooked')}
                </button>
              )}
              {entry.is_cooked && (
                <span className="text-xs text-gray-400">{t('dashboard.todaysMeals.cooked')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
