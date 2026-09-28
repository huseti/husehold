import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// One modal for creating, copying, and editing a packing list -- name/dates/
// participants are mandatory but don't fit a one-line form, so nothing
// incomplete is ever persisted (mirrors CreatePackingListModal's original
// create-only version). Edit mode additionally exposes archive/delete,
// replacing the old inline "Reiseeinstellungen" panel on the page.
export default function PackingListFormModal({
  mode, // 'create' | 'copy' | 'edit'
  initialName = '', initialStartDate = '', initialEndDate = '', initialParticipantIds = [],
  isArchived = false, members, onClose, onSave, onDelete, onToggleArchive,
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [participantIds, setParticipantIds] = useState(initialParticipantIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleParticipant = (userId) => {
    setParticipantIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));
  };

  const canSubmit = name.trim() && startDate && endDate && participantIds.length > 0;

  const failedMessage = { create: 'createFailed', copy: 'copyFailed', edit: 'editFailed' }[mode];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onSave({ name: name.trim(), start_date: startDate, end_date: endDate, participant_ids: participantIds });
    } catch (err) {
      console.error('Error saving packing list:', err);
      setError(t(`packingLists.${failedMessage}`));
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('packingLists.confirmDeleteList', { name: initialName }))) return;
    setBusy(true);
    setError('');
    try {
      await onDelete();
    } catch (err) {
      console.error('Error deleting packing list:', err);
      setError(t('packingLists.deleteFailed'));
      setBusy(false);
    }
  };

  const handleToggleArchive = async () => {
    setBusy(true);
    setError('');
    try {
      await onToggleArchive();
    } catch (err) {
      console.error('Error archiving packing list:', err);
      setError(t('packingLists.archiveFailed'));
      setBusy(false);
    }
  };

  const title = { create: 'createTitle', copy: 'copyTitle', edit: 'editTitle' }[mode];
  const submitLabel = mode === 'edit' ? null : { create: 'createButton', copy: 'copyButton' }[mode];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md mx-auto my-8 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">{t(`packingLists.${title}`)}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label={t('recipes.close')}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('packingLists.formNamePlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
            autoFocus
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">{t('packingLists.formStartDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">{t('packingLists.formEndDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">{t('packingLists.formParticipants')}</p>
            <div className="flex flex-wrap gap-4">
              {members.map((member) => (
                <label key={member.user.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={participantIds.includes(member.user.id)}
                    onChange={() => toggleParticipant(member.user.id)}
                  />
                  {member.user.username}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy || !canSubmit}
              className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600 disabled:opacity-50"
            >
              {submitLabel ? t(`packingLists.${submitLabel}`) : t('recipes.save')}
            </button>
            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
              {t('recipes.cancel')}
            </button>
          </div>

          {mode === 'edit' && (
            <div className="flex gap-4 pt-3 border-t">
              <button type="button" onClick={handleToggleArchive} disabled={busy} className="text-sm text-gray-600 hover:underline disabled:opacity-50">
                {isArchived ? t('packingLists.unarchive') : t('packingLists.archive')}
              </button>
              <button type="button" onClick={handleDelete} disabled={busy} className="text-sm text-red-600 hover:underline disabled:opacity-50">
                {t('packingLists.deleteList')}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
