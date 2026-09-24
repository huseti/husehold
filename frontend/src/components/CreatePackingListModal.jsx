import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// "Create a packing list": name is typed inline on the page first (see
// PackingLists.jsx), this modal collects the two things that are mandatory
// but don't fit a one-line form -- participants and trip dates -- and only
// then actually creates the list, so an incomplete list is never persisted.
export default function CreatePackingListModal({ initialName, members, onClose, onCreate }) {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [participantIds, setParticipantIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleParticipant = (userId) => {
    setParticipantIds((ids) => (ids.includes(userId) ? ids.filter((id) => id !== userId) : [...ids, userId]));
  };

  const canSubmit = name.trim() && startDate && endDate && participantIds.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onCreate({ name: name.trim(), start_date: startDate, end_date: endDate, participant_ids: participantIds });
    } catch (err) {
      console.error('Error creating packing list:', err);
      setError(t('packingLists.createFailed'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md mx-auto my-8 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">{t('packingLists.createTitle')}</h3>
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
              {t('packingLists.createButton')}
            </button>
            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
              {t('recipes.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
