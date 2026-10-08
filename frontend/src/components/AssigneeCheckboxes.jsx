import { useTranslation } from 'react-i18next';

// Shared by PackingLists.jsx (list items) and PackingBuckets.jsx (bucket
// items) -- always every household member, not just a trip's current
// participants, since a bucket item has no trip context at all and a list
// item can intentionally be assigned to someone not yet on the trip (see
// the non-participant confirm dialog both pages use).
export default function AssigneeCheckboxes({ members, selectedIds, onChange }) {
  const { t } = useTranslation();
  const toggle = (userId) => onChange(
    selectedIds.includes(userId) ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId],
  );

  if (members.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      <span className="text-xs text-gray-500">{t('packingLists.assigneesLabel')}:</span>
      {members.map((member) => (
        <label key={member.user.id} className="flex items-center gap-1 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={selectedIds.includes(member.user.id)}
            onChange={() => toggle(member.user.id)}
          />
          {member.user.username}
        </label>
      ))}
    </div>
  );
}
