import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// KPI summary for each tab, each with a shortcut to its details page. New
// tabs (e.g. a future packing-list "X planned trips") slot in as another
// row here.
export default function OverviewPanel({ shoppingCount, recipeCount, mealCount, overdueCount, expiringVoucherCount }) {
  const { t } = useTranslation();

  const rows = [
    { label: t('dashboard.overview.shopping', { count: shoppingCount }), to: '/shopping' },
    { label: t('dashboard.overview.recipes', { count: recipeCount }), to: '/recipes' },
    { label: t('dashboard.overview.meals', { count: mealCount }), to: '/cooking-plan' },
    { label: t('dashboard.overview.overdueTasks', { count: overdueCount }), to: '/tasks' },
    { label: t('dashboard.overview.expiringVouchers', { count: expiringVoucherCount }), to: '/vouchers' },
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">{t('dashboard.overview.title')}</h2>
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.to} className="flex items-center justify-between py-2">
            <span className="text-gray-700 text-sm">{row.label}</span>
            <Link to={row.to} className="text-blue-500 hover:text-blue-700 text-sm font-medium">
              {t('dashboard.viewAll')}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
