import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TaskIcon, { TASK_ICON_KEYS } from './icons/taskIcons';
import IconPickerModal from './IconPickerModal';

const QUICK_KEYS = TASK_ICON_KEYS.filter((key) => key !== 'calendar');

// The quick-pick row of curated task icons, plus "More…" for any Phosphor
// icon; a picked non-curated icon shows up (selected) at the end of the row.
export default function TaskIconChooser({ value, onChange }) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const isCustom = !QUICK_KEYS.includes(value);

  const iconButton = (key, title) => (
    <button
      key={key}
      type="button"
      title={title}
      onClick={() => onChange(key)}
      className={`p-2 rounded border text-lg ${
        value === key ? 'btn-primary text-white border-eucalyptus-500' : 'bg-white text-gray-600 border-gray-300'
      }`}
    >
      <TaskIcon icon={key} />
    </button>
  );

  return (
    <div className="flex gap-1 flex-wrap">
      {QUICK_KEYS.map((key) => iconButton(key, t(`tasks.icon.${key}`)))}
      {isCustom && value && iconButton(value, value)}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="px-3 rounded border border-dashed border-gray-300 text-sm text-eucalyptus-600 hover:bg-eucalyptus-50"
      >
        {t('iconPicker.more')}
      </button>
      {pickerOpen && (
        <IconPickerModal value={value} onSelect={onChange} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}
