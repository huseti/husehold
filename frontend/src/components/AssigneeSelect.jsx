import { useTranslation } from 'react-i18next';

// Editing one existing item row -- it has at most one assignee (or none,
// for a shared item), unlike adding a new item where AssigneeCheckboxes'
// multi-select fans out into several rows. value/onChange use '' for
// "nobody" since <select> options are always strings.
export default function AssigneeSelect({ members, value, onChange }) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-2 text-xs text-gray-600">
      {t('packingLists.assigneesLabel')}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 border border-gray-300 rounded text-sm"
      >
        <option value="">{t('packingLists.unassigned')}</option>
        {members.map((member) => (
          <option key={member.user.id} value={member.user.id}>{member.user.username}</option>
        ))}
      </select>
    </label>
  );
}
