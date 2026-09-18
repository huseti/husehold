import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { voucherService } from '../services/api';
import Navbar from '../components/Navbar';
import VoucherCard from '../components/VoucherCard';

const emptyForm = { title: '', received_from: '', location: '', hasValue: false, total_value: '', currency: 'EUR', valid_until: '' };

export default function Vouchers() {
  const { t } = useTranslation();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      const response = await voucherService.getAll();
      setVouchers(response.data.results || []);
    } catch (error) {
      console.error('Error loading vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await voucherService.create({
        title: form.title,
        received_from: form.received_from,
        location: form.location,
        total_value: form.hasValue && form.total_value ? form.total_value : null,
        currency: form.currency,
        valid_until: form.valid_until || null,
      });
      setForm(emptyForm);
      loadVouchers();
    } catch (error) {
      console.error('Error adding voucher:', error);
    }
  };

  const handleRedeem = async (id, amount) => {
    try {
      await voucherService.redeem(id, amount);
      loadVouchers();
    } catch (error) {
      console.error('Error redeeming voucher:', error);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await voucherService.update(id, data);
      loadVouchers();
    } catch (error) {
      console.error('Error updating voucher:', error);
    }
  };

  const handleToggleArchive = async (id) => {
    try {
      await voucherService.toggleArchived(id);
      loadVouchers();
    } catch (error) {
      console.error('Error archiving voucher:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await voucherService.delete(id);
      loadVouchers();
    } catch (error) {
      console.error('Error deleting voucher:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  // Soonest-expiring first; vouchers with no expiry sort to the end.
  const byExpiry = (a, b) => {
    if (!a.valid_until && !b.valid_until) return 0;
    if (!a.valid_until) return 1;
    if (!b.valid_until) return -1;
    return a.valid_until.localeCompare(b.valid_until);
  };

  const active = vouchers.filter((v) => !v.is_archived).sort(byExpiry);
  const archived = vouchers.filter((v) => v.is_archived).sort(byExpiry);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('vouchers.title')}</h2>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">{t('vouchers.addTitle')}</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <input
              type="text"
              placeholder={t('vouchers.formTitlePlaceholder')}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
            <div className="flex gap-4">
              <input
                type="text"
                placeholder={t('vouchers.formReceivedFromPlaceholder')}
                value={form.received_from}
                onChange={(e) => setForm({ ...form, received_from: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="text"
                placeholder={t('vouchers.formLocationPlaceholder')}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hasValue}
                onChange={(e) => setForm({ ...form, hasValue: e.target.checked })}
              />
              {t('vouchers.formHasValue')}
            </label>

            {form.hasValue && (
              <div className="flex gap-4">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t('vouchers.formTotalValue')}
                  value={form.total_value}
                  onChange={(e) => setForm({ ...form, total_value: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <input
                  type="text"
                  maxLength={3}
                  placeholder={t('vouchers.formCurrency')}
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  className="w-20 px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-600 mb-1">{t('vouchers.formValidUntilOptional')}</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600"
            >
              {t('vouchers.addButton')}
            </button>
          </form>
        </div>

        <h3 className="text-xl font-semibold mb-4">{t('vouchers.active')}</h3>
        <div className="space-y-3 mb-8">
          {active.length === 0 && <p className="text-gray-500">{t('vouchers.noActiveVouchers')}</p>}
          {active.map((v) => (
            <VoucherCard key={v.id} voucher={v} onRedeem={handleRedeem} onUpdate={handleUpdate} onToggleArchive={handleToggleArchive} onDelete={handleDelete} />
          ))}
        </div>

        <h3 className="text-xl font-semibold mb-4">{t('vouchers.archived')}</h3>
        <div className="space-y-3">
          {archived.length === 0 && <p className="text-gray-500">{t('vouchers.noArchivedVouchers')}</p>}
          {archived.map((v) => (
            <VoucherCard key={v.id} voucher={v} onRedeem={handleRedeem} onUpdate={handleUpdate} onToggleArchive={handleToggleArchive} onDelete={handleDelete} />
          ))}
        </div>
      </main>
    </div>
  );
}
