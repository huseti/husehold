import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseGlyph } from './icons/uiIcons';

const emptyForm = { title: '', received_from: '', location: '', hasValue: false, total_value: '', currency: 'EUR', valid_until: '' };

export default function VoucherFormModal({ onClose, onSave }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave({
        title: form.title,
        received_from: form.received_from,
        location: form.location,
        total_value: form.hasValue && form.total_value ? form.total_value : null,
        currency: form.currency,
        valid_until: form.valid_until || null,
      });
    } catch (err) {
      console.error('Error adding voucher:', err);
      setError(t('vouchers.createFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md mx-auto my-8 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">{t('vouchers.addTitle')}</h3>
          <button onClick={onClose} className="icon-btn text-xl hover:text-gray-700" aria-label={t('recipes.close')}><CloseGlyph /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder={t('vouchers.formTitlePlaceholder')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
            autoFocus
          />
          <div className="flex flex-col sm:flex-row gap-4">
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="btn-primary px-4 py-2 rounded disabled:opacity-50">
              {t('vouchers.addButton')}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 rounded">
              {t('recipes.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
