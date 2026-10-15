import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { mealName } from '../utils/taskDisplay';
import ExpandIcon from './icons/expandIcon';
import MemberAvatar from './MemberAvatar';
import EmptyState from './EmptyState';
import TaskIcon from './icons/taskIcons';
import TitleIcon from './TitleIcon';
import { CookingMenuIcon } from './icons/navIcons';

// Today's planned meals with a one-click "mark cooked" action. task_instance
// is only present once the week's plan is finalized, which also naturally
// excludes leftovers/free entries that never get one -- so its presence is
// the reliable guard for whether this entry can be marked cooked here.
export default function TodaysMealsPanel({ meals, members = [], onMarkCooked }) {
  const { t, i18n } = useTranslation();
  // Leftovers have no cook task -- they belong to whoever cooks the original dish.
  const cookOf = (entry) => {
    const userId = entry.kind === 'leftovers' ? entry.source_assigned_to : entry.assigned_to;
    return members.find((m) => m.user.id === userId) || null;
  };
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold mb-4"><TitleIcon><CookingMenuIcon /></TitleIcon>{t('dashboard.todaysMeals.title')}</h2>
      {meals.length === 0 ? (
        <EmptyState
          compact
          icon={<TaskIcon icon="cooking" />}
          text={t('dashboard.todaysMeals.none')}
          action={{ to: '/cooking-plan', label: `+ ${t('dashboard.todaysMeals.planMeal')}` }}
        />
      ) : (
        <ul className="space-y-2">
          {meals.map((entry) => {
            const cook = cookOf(entry);
            return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-2 border-l-4 rounded-r pl-2 pr-2 py-1.5"
              style={{ borderColor: cook?.color_hex || '#9ca3af' }}
            >
              <MemberAvatar member={cook} sizeClass="h-5 w-5" />
              <span className="flex-1 min-w-[10rem] text-sm text-gray-700">
                <span className="text-gray-400">{mealName(entry, i18n)}: </span>
                {entry.kind === 'leftovers' ? t('cookingPlan.leftoversOf', { title: entry.recipe_title }) : entry.recipe_title}
              </span>
              {entry.kind === 'cook' && entry.recipe && (
                <Link
                  to={`/recipes/${entry.recipe}/highlight?servings=${entry.servings}`}
                  className="text-xs px-2 py-0.5 rounded-lg bg-gray-100 text-gray-600 hover:btn-secondary"
                  aria-label={t('recipes.highlightMode')}
                  title={t('recipes.highlightMode')}
                >
                  <ExpandIcon />
                </Link>
              )}
              {entry.task_instance && !entry.is_cooked && (
                <button
                  onClick={() => onMarkCooked(entry.task_instance)}
                  className="text-xs px-2 py-0.5 rounded-lg btn-primary text-green-700 hover:bg-green-200"
                >
                  {t('dashboard.todaysMeals.markCooked')}
                </button>
              )}
              {entry.is_cooked && (
                <span className="text-xs text-gray-400">{t('dashboard.todaysMeals.cooked')}</span>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
