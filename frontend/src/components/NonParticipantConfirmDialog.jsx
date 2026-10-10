import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Shown whenever an assignment (direct, or via adding a bucket) names
// someone who isn't a participant of the packing list -- the backend
// rejects the request with 409 + { non_participants: [...] } instead of
// silently applying it (see _non_participant_conflict in views.py).
// Accepting always keeps the assignment as given; the per-person checkbox
// here only additionally makes that person a participant of the trip.
export default function NonParticipantConfirmDialog({ missing, onAccept, onCancel }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(() => new Set());

  const toggle = (id) => setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-3">{t('packingLists.nonParticipantTitle')}</h3>
        <ul className="space-y-3 mb-4">
          {missing.map((person) => (
            <li key={person.id}>
              <p className="text-sm text-gray-700 mb-1">{t('packingLists.nonParticipantWarning', { name: person.username })}</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={checked.has(person.id)} onChange={() => toggle(person.id)} />
                {t('packingLists.nonParticipantAddToTrip', { name: person.username })}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button
            onClick={() => onAccept([...checked])}
            className="btn-primary text-white px-4 py-2 rounded dark:hover:bg-eucalyptus-600"
          >
            {t('packingLists.nonParticipantAccept')}
          </button>
          <button onClick={onCancel} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
            {t('recipes.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
