import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import StackedBarChart from '../components/charts/StackedBarChart';
import TrendBarChart from '../components/charts/TrendBarChart';
import RankedList from '../components/charts/RankedList';
import { analyticsService } from '../services/api';

// Same period convention as PurchaseHistory (shoppingList.period.* strings) --
// consistent with the rest of the app rather than a bespoke set of labels.
const PERIODS = [
  { key: 'month', days: 30 },
  { key: 'year', days: 365 },
  { key: 'all', days: null },
];

function startDate(days) {
  if (!days) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('sv-SE');
}

function todayISO() {
  return new Date().toLocaleDateString('sv-SE');
}

export default function Analytics() {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const start = startDate(PERIODS.find((p) => p.key === period).days);
    analyticsService.get(start, todayISO())
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => {
        console.error('Error loading analytics:', err);
        if (!cancelled) setError(t('analytics.loadFailed'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatBucket = (bucket) => new Date(`${bucket}T00:00:00`).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' });

  if (loading && !data) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  const voucherCurrencies = data ? [...new Set(data.vouchers.trend.flatMap((pt) => pt.totals.map((tt) => tt.currency)))] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold">{t('analytics.title')}</h2>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{t(`shoppingList.period.${p.key}`)}</option>)}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {data && (
          <>
            <section className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-1">{t('analytics.tasks.title')}</h3>
              <p className="text-sm text-gray-500 mb-4">
                {t('analytics.tasks.overall', {
                  done: data.tasks.overall.done, total: data.tasks.overall.total, rate: Math.round(data.tasks.overall.rate * 100),
                })}
              </p>
              {data.tasks.overall.total > 0 ? (
                <StackedBarChart
                  segments={data.tasks.by_member.map((m) => ({ label: m.username, value: m.done, color: m.color_hex }))}
                  total={data.tasks.overall.total}
                />
              ) : <p className="text-gray-400 text-sm">{t('analytics.noData')}</p>}
            </section>

            <section className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4">{t('analytics.meals.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">{t('analytics.meals.topRecipes')}</p>
                  {data.meals.top_recipes.length > 0 ? (
                    <RankedList
                      items={data.meals.top_recipes.map((r) => ({ label: r.title, value: r.count }))}
                      valueLabel={(v) => t('analytics.meals.timesCooked', { count: v })}
                      color="#f59e0b"
                    />
                  ) : <p className="text-gray-400 text-sm">{t('analytics.noData')}</p>}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">{t('analytics.meals.trend')}</p>
                  {data.meals.trend.length > 0 ? (
                    <TrendBarChart points={data.meals.trend} color="#f59e0b" formatLabel={formatBucket} formatValue={(v) => t('analytics.meals.timesCooked', { count: v })} />
                  ) : <p className="text-gray-400 text-sm">{t('analytics.noData')}</p>}
                </div>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4">{t('analytics.purchases.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">{t('analytics.purchases.topItems')}</p>
                  {data.purchases.top_items.length > 0 ? (
                    <RankedList
                      items={data.purchases.top_items.map((i) => ({ label: i.title, value: i.count }))}
                      valueLabel={(v) => t('analytics.purchases.timesBought', { count: v })}
                      color="#22c55e"
                    />
                  ) : <p className="text-gray-400 text-sm">{t('analytics.noData')}</p>}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">{t('analytics.purchases.trend')}</p>
                  {data.purchases.trend.length > 0 ? (
                    <TrendBarChart points={data.purchases.trend} color="#22c55e" formatLabel={formatBucket} formatValue={(v) => t('analytics.purchases.timesBought', { count: v })} />
                  ) : <p className="text-gray-400 text-sm">{t('analytics.noData')}</p>}
                </div>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-4">{t('analytics.vouchers.title')}</h3>
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-600 mb-2">{t('analytics.vouchers.activeTotal')}</p>
                {data.vouchers.active_totals.length > 0 ? (
                  <div className="flex gap-6">
                    {data.vouchers.active_totals.map((ct) => (
                      <p key={ct.currency} className="text-2xl font-semibold text-amber-600">{ct.total.toFixed(2)} {ct.currency}</p>
                    ))}
                  </div>
                ) : <p className="text-gray-400 text-sm">{t('analytics.noData')}</p>}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">{t('analytics.vouchers.redeemedTrend')}</p>
                {voucherCurrencies.length === 0 && <p className="text-gray-400 text-sm">{t('analytics.noData')}</p>}
                {voucherCurrencies.map((currency) => (
                  <div key={currency} className="mb-4 last:mb-0">
                    {voucherCurrencies.length > 1 && <p className="text-xs text-gray-400 mb-1">{currency}</p>}
                    <TrendBarChart
                      points={data.vouchers.trend.map((pt) => ({
                        bucket: pt.bucket, value: pt.totals.find((tt) => tt.currency === currency)?.total || 0,
                      }))}
                      color="#f59e0b"
                      formatLabel={formatBucket}
                      formatValue={(v) => `${v.toFixed(2)} ${currency}`}
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
