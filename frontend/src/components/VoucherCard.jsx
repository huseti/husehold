import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import VoucherIcon from './icons/voucherIcons';
import ExpiringSoonIcon from './icons/expiringSoonIcon';
import { isExpiringSoon } from '../utils/voucherDisplay';

function voucherToEditForm(voucher) {
  return {
    title: voucher.title,
    received_from: voucher.received_from,
    location: voucher.location,
    hasValue: voucher.total_value !== null,
    total_value: voucher.total_value ?? '',
    currency: voucher.currency,
    valid_until: voucher.valid_until ?? '',
  };
}

export default function VoucherCard({ voucher, onRedeem, onToggleArchive, onDelete, onUpdate }) {
  const { t, i18n } = useTranslation();
  const [showRedeemForm, setShowRedeemForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(() => voucherToEditForm(voucher));
  const [amount, setAmount] = useState(null);
  const [error, setError] = useState('');

  const hasValue = voucher.total_value !== null;
  const canEditValue = voucher.redemptions.length === 0;
  const remaining = Number(voucher.remaining_balance);
  const formatDate = (d) => new Date(d).toLocaleDateString(i18n.resolvedLanguage);
  const sliderValue = amount === null ? remaining : amount;

  const openEditForm = () => {
    setEditForm(voucherToEditForm(voucher));
    setIsEditing(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    onUpdate(voucher.id, {
      title: editForm.title,
      received_from: editForm.received_from,
      location: editForm.location,
      ...(canEditValue && {
        total_value: editForm.hasValue && editForm.total_value ? editForm.total_value : null,
        currency: editForm.currency,
      }),
      valid_until: editForm.valid_until || null,
    });
    setIsEditing(false);
  };

  const openRedeemForm = () => {
    setAmount(remaining);
    setShowRedeemForm(true);
  };

  const handleRedeemSubmit = (e) => {
    e.preventDefault();
    const parsed = Number(sliderValue);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > remaining) {
      setError(t('vouchers.redeemInvalidAmount'));
      return;
    }
    onRedeem(voucher.id, parsed);
    setAmount(null);
    setError('');
    setShowRedeemForm(false);
  };

  const handleMarkUsed = () => {
    onRedeem(voucher.id, null);
  };

  const handleDelete = () => {
    if (window.confirm(t('vouchers.confirmDelete', { title: voucher.title }))) {
      onDelete(voucher.id);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-5 ${voucher.is_archived ? 'opacity-60' : ''}`}>
      {isEditing ? (
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <input
            type="text"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            className="w-full px-3 py-1.5 border border-gray-300 rounded"
            required
            autoFocus
          />
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={t('vouchers.formReceivedFromPlaceholder')}
              value={editForm.received_from}
              onChange={(e) => setEditForm({ ...editForm, received_from: e.target.value })}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded"
            />
            <input
              type="text"
              placeholder={t('vouchers.formLocationPlaceholder')}
              value={editForm.location}
              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded"
            />
          </div>

          {canEditValue ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.hasValue}
                  onChange={(e) => setEditForm({ ...editForm, hasValue: e.target.checked })}
                />
                {t('vouchers.formHasValue')}
              </label>
              {editForm.hasValue && (
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t('vouchers.formTotalValue')}
                    value={editForm.total_value}
                    onChange={(e) => setEditForm({ ...editForm, total_value: e.target.value })}
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded"
                    required
                  />
                  <input
                    type="text"
                    maxLength={3}
                    placeholder={t('vouchers.formCurrency')}
                    value={editForm.currency}
                    onChange={(e) => setEditForm({ ...editForm, currency: e.target.value.toUpperCase() })}
                    className="w-20 px-3 py-1.5 border border-gray-300 rounded"
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400">{t('vouchers.valueLockedAfterRedemption')}</p>
          )}

          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('vouchers.formValidUntilOptional')}</label>
            <input
              type="date"
              value={editForm.valid_until}
              onChange={(e) => setEditForm({ ...editForm, valid_until: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600">
              {t('vouchers.editSave')}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="text-sm text-gray-500 px-2">
              {t('vouchers.editCancel')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <VoucherIcon className="text-amber-600 text-2xl flex-shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-lg truncate">{voucher.title}</h4>
              {(voucher.received_from || voucher.location) && (
                <p className="text-sm text-gray-600">
                  {[voucher.received_from, voucher.location].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="text-sm mt-1">
                {hasValue
                  ? t('vouchers.remainingOf', {
                      remaining: voucher.remaining_balance, total: voucher.total_value, currency: voucher.currency,
                    })
                  : t('vouchers.noValue')}
              </p>
              <p className={`text-sm flex items-center gap-1 ${voucher.is_expired && !voucher.is_archived ? 'text-red-600' : isExpiringSoon(voucher) ? 'text-orange-600' : 'text-gray-500'}`}>
                {isExpiringSoon(voucher) && <ExpiringSoonIcon title={t('vouchers.expiringSoon')} />}
                {voucher.valid_until
                  ? t(voucher.is_expired ? 'vouchers.expired' : 'vouchers.expiresOn', { date: formatDate(voucher.valid_until) })
                  : t('vouchers.noExpiry')}
              </p>
            </div>
          </div>

          {!voucher.is_archived && (
            <div className="mt-4 flex flex-wrap gap-2">
              {hasValue ? (
                <button
                  onClick={() => (showRedeemForm ? setShowRedeemForm(false) : openRedeemForm())}
                  className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600"
                >
                  {t('vouchers.redeem')}
                </button>
              ) : (
                <button
                  onClick={handleMarkUsed}
                  className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600"
                >
                  {t('vouchers.markUsed')}
                </button>
              )}
              <button
                onClick={openEditForm}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200"
              >
                {t('vouchers.edit')}
              </button>
              <button
                onClick={() => onToggleArchive(voucher.id)}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200"
              >
                {t('vouchers.archive')}
              </button>
              <button
                onClick={handleDelete}
                className="text-sm text-red-600 px-3 py-1.5 rounded hover:bg-red-50"
              >
                {t('vouchers.delete')}
              </button>
            </div>
          )}

          {voucher.is_archived && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={openEditForm}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200"
              >
                {t('vouchers.edit')}
              </button>
              <button
                onClick={() => onToggleArchive(voucher.id)}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200"
              >
                {t('vouchers.unarchive')}
              </button>
              <button
                onClick={handleDelete}
                className="text-sm text-red-600 px-3 py-1.5 rounded hover:bg-red-50"
              >
                {t('vouchers.delete')}
              </button>
            </div>
          )}
        </>
      )}

      {!isEditing && showRedeemForm && (
        <form onSubmit={handleRedeemSubmit} className="mt-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">{t('vouchers.redeemAmount')}</span>
            <span className="font-medium">{Number(sliderValue).toFixed(2)} {voucher.currency}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              step="0.01"
              min="0"
              max={remaining}
              value={sliderValue}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="flex-1 accent-amber-500"
              autoFocus
            />
            <button type="submit" className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600">
              {t('vouchers.redeemSubmit')}
            </button>
            <button
              type="button"
              onClick={() => { setShowRedeemForm(false); setError(''); }}
              className="text-sm text-gray-500 px-2"
            >
              {t('vouchers.redeemCancel')}
            </button>
          </div>
        </form>
      )}
      {!isEditing && error && <p className="text-sm text-red-600 mt-1">{error}</p>}

      {!isEditing && voucher.redemptions.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            {t('vouchers.history')}
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {voucher.redemptions.map((r) => (
                <li key={r.id}>
                  {r.amount_used !== null
                    ? t('vouchers.historyEntry', {
                        amount: r.amount_used, date: formatDate(r.redeemed_on),
                        name: r.logged_by_username || '?', remaining: r.remaining_after,
                      })
                    : t('vouchers.historyEntryNoValue', { date: formatDate(r.redeemed_on), name: r.logged_by_username || '?' })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
