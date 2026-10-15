import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingCart } from '@phosphor-icons/react/dist/csr/ShoppingCart';
import { BookOpen } from '@phosphor-icons/react/dist/csr/BookOpen';
import { ForkKnife } from '@phosphor-icons/react/dist/csr/ForkKnife';
import { Alarm } from '@phosphor-icons/react/dist/csr/Alarm';
import { Ticket } from '@phosphor-icons/react/dist/csr/Ticket';
import { Suitcase } from '@phosphor-icons/react/dist/csr/Suitcase';

// KPI tile grid for the dashboard -- each tile is one domain's current count
// with a shortcut to its details page, laid out 2-3 per row on wider screens.
export default function OverviewPanel({
  shoppingCount, recipeCount, mealCount, overdueCount, expiringVoucherCount, upcomingPackingListCount,
}) {
  const { t } = useTranslation();

  const tiles = [
    { Icon: ShoppingCart, count: shoppingCount, label: t('dashboard.overview.shoppingLabel'), desc: t('dashboard.overview.shoppingDesc'), to: '/shopping' },
    { Icon: BookOpen, count: recipeCount, label: t('dashboard.overview.recipesLabel'), desc: t('dashboard.overview.recipesDesc'), to: '/recipes' },
    { Icon: ForkKnife, count: mealCount, label: t('dashboard.overview.mealsLabel'), desc: t('dashboard.overview.mealsDesc'), to: '/cooking-plan' },
    { Icon: Alarm, count: overdueCount, label: t('dashboard.overview.overdueTasksLabel'), desc: t('dashboard.overview.overdueTasksDesc'), to: '/tasks' },
    { Icon: Ticket, count: expiringVoucherCount, label: t('dashboard.overview.expiringVouchersLabel'), desc: t('dashboard.overview.expiringVouchersDesc'), to: '/vouchers' },
    { Icon: Suitcase, count: upcomingPackingListCount, label: t('dashboard.overview.upcomingPackingListsLabel'), desc: t('dashboard.overview.upcomingPackingListsDesc'), to: '/packing-lists' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {tiles.map((tile) => (
        <Link
          key={tile.to}
          to={tile.to}
          className="block bg-white dark:bg-gray-800 rounded-xl shadow p-3 sm:p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-2">
            <tile.Icon weight="fill" size="1em" aria-hidden="true" className="text-2xl text-eucalyptus-600 dark:text-eucalyptus-400" />
            <span className="hidden sm:inline text-eucalyptus-600 dark:text-eucalyptus-400 text-xs font-medium">
              {t('dashboard.viewAll')}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-bold tabular-nums text-eucalyptus-700 dark:text-eucalyptus-300">{tile.count}</span>
            <span className="text-sm font-semibold text-eucalyptus-800 dark:text-eucalyptus-200">{tile.label}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{tile.desc}</p>
        </Link>
      ))}
    </div>
  );
}
