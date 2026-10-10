import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// KPI tile grid for the dashboard -- each tile is one domain's current count
// with a shortcut to its details page, laid out 2-3 per row on wider screens.
export default function OverviewPanel({
  shoppingCount, recipeCount, mealCount, overdueCount, expiringVoucherCount, upcomingPackingListCount,
}) {
  const { t } = useTranslation();

  const tiles = [
    { emoji: '🛒', count: shoppingCount, label: t('dashboard.overview.shoppingLabel'), desc: t('dashboard.overview.shoppingDesc'), to: '/shopping' },
    { emoji: '📖', count: recipeCount, label: t('dashboard.overview.recipesLabel'), desc: t('dashboard.overview.recipesDesc'), to: '/recipes' },
    { emoji: '🍽️', count: mealCount, label: t('dashboard.overview.mealsLabel'), desc: t('dashboard.overview.mealsDesc'), to: '/cooking-plan' },
    { emoji: '⏰', count: overdueCount, label: t('dashboard.overview.overdueTasksLabel'), desc: t('dashboard.overview.overdueTasksDesc'), to: '/tasks' },
    { emoji: '🎫', count: expiringVoucherCount, label: t('dashboard.overview.expiringVouchersLabel'), desc: t('dashboard.overview.expiringVouchersDesc'), to: '/vouchers' },
    { emoji: '🧳', count: upcomingPackingListCount, label: t('dashboard.overview.upcomingPackingListsLabel'), desc: t('dashboard.overview.upcomingPackingListsDesc'), to: '/packing-lists' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {tiles.map((tile) => (
        <div key={tile.to} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-start justify-between mb-2">
            <span className="text-2xl text-eucalyptus-600 dark:text-eucalyptus-400">{tile.emoji}</span>
            <Link
              to={tile.to}
              className="text-eucalyptus-600 dark:text-eucalyptus-400 hover:text-eucalyptus-700 dark:hover:text-eucalyptus-300 text-xs font-medium"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-eucalyptus-700 dark:text-eucalyptus-300">{tile.count}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">{tile.label}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{tile.desc}</p>
        </div>
      ))}
    </div>
  );
}
