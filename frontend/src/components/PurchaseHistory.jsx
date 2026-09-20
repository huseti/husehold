import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { purchaseService } from '../services/api';
import { unitLabel } from '../utils/localized';

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

// Read-only shopping history: what we buy most, and what was bought when.
// Records are written by ticking items off on the list (see PurchaseRecord).
export default function PurchaseHistory({ units, listId, listName, onReAdd }) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState('month');
  const [search, setSearch] = useState('');
  const [top, setTop] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = setTimeout(async () => {
      const params = {
        list: listId,
        start: startDate(PERIODS.find((p) => p.key === period).days),
        q: search.trim() || undefined,
      };
      try {
        const [summaryRes, recentRes] = await Promise.all([
          purchaseService.summary({ ...params, limit: 15 }),
          purchaseService.getAll(params),
        ]);
        setTop(summaryRes.data);
        setRecent(recentRes.data.results || []);
      } catch (error) {
        console.error('Error loading purchase history:', error);
      } finally {
        setLoading(false);
      }
    }, search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [period, search, listId]);

  const formatDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language);
  const quantityText = (quantity, unitId) => {
    if (quantity === null) return '';
    return `${Number(quantity)} ${unitLabel(units.find((u) => u.id === unitId), i18n.language)}`.trim();
  };

  const handleReAdd = async (entry) => {
    try {
      await onReAdd(entry);
      setNotice(t('shoppingList.reAdded', { title: entry.title, list: listName }));
    } catch (error) {
      console.error('Error re-adding item:', error);
    }
  };

  // Group the chronological list by day, newest first (already sorted server-side).
  const byDay = recent.reduce((groups, record) => {
    const last = groups[groups.length - 1];
    if (last && last.date === record.purchased_on) last.records.push(record);
    else groups.push({ date: record.purchased_on, records: [record] });
    return groups;
  }, []);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('shoppingList.historySearch')}
          className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-lg"
        />
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{t(`shoppingList.period.${p.key}`)}</option>)}
        </select>
      </div>

      <p className="text-sm text-gray-500 mb-4">{t('shoppingList.historyFor', { list: listName })}</p>

      {notice && <p className="text-sm text-green-600 mb-4">{notice}</p>}
      {loading && <p className="text-gray-500">{t('common.loading')}</p>}

      {!loading && recent.length === 0 && <p className="text-gray-500">{t('shoppingList.historyEmpty')}</p>}

      {top.length > 0 && (
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-3">{t('shoppingList.historyTop')}</h3>
          <div className="bg-white rounded-lg shadow divide-y">
            {top.map((entry) => (
              <div key={entry.title.toLowerCase()} className="p-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex-1 min-w-32 font-medium">{entry.title}</span>
                <span className="text-sm text-gray-600">{t('shoppingList.boughtTimes', { count: entry.count })}</span>
                <span className="text-sm text-gray-400">{t('shoppingList.lastBought', { date: formatDate(entry.last_purchased) })}</span>
                <button onClick={() => handleReAdd(entry)} className="text-sm text-blue-600 hover:underline">
                  + {t('shoppingList.reAdd')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {byDay.length > 0 && (
        <section>
          <h3 className="text-xl font-semibold mb-3">{t('shoppingList.historyRecent')}</h3>
          <div className="space-y-4">
            {byDay.map((day) => (
              <div key={day.date} className="bg-white rounded-lg shadow">
                <p className="px-4 py-2 text-sm font-medium text-gray-500 border-b">{formatDate(day.date)}</p>
                <ul className="divide-y">
                  {day.records.map((record) => (
                    <li key={record.id} className="px-4 py-2 flex flex-wrap items-center gap-x-3">
                      <span className="flex-1 min-w-32">
                        {record.quantity !== null && <span className="font-medium">{quantityText(record.quantity, record.unit)} </span>}
                        {record.title}
                      </span>
                      <span className="text-xs text-gray-400">
                        {record.purchased_by_username}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
