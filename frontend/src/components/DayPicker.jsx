import { useTranslation } from 'react-i18next';
import { toISODate } from '../utils/weekDates';

// One-tap day assignment for a task card: a row of weekday chips (plus a
// "backlog" chip for tasks that already have a day). The touch-friendly
// alternative to dragging a card across a long single-column week on a phone.
export default function DayPicker({ weekDays, selectedISO, onPick, showBacklog = false, className = '' }) {
  const { t, i18n } = useTranslation();
  const todayISO = toISODate(new Date());

  const chipBase = 'h-7 min-w-[1.75rem] px-1 md:h-6 md:min-w-[1.5rem] rounded text-xs md:text-[11px] font-medium inline-flex items-center justify-center';
  const idle = 'btn-secondary text-gray-700';
  const active = 'bg-eucalyptus-700 text-white dark:bg-eucalyptus-600';

  return (
    <div role="group" aria-label={t('tasks.assignDay')} className={`flex flex-wrap gap-0.5 mt-1 ${className}`}>
      {weekDays.map((day) => {
        const iso = toISODate(day);
        const isSelected = iso === selectedISO;
        const label = day.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short' }).replace('.', '');
        return (
          <button
            key={iso}
            type="button"
            aria-pressed={isSelected}
            title={day.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'long', day: 'numeric', month: 'short' })}
            onClick={() => !isSelected && onPick(iso)}
            className={`${chipBase} ${isSelected ? active : idle} ${iso === todayISO && !isSelected ? 'underline underline-offset-2' : ''}`}
          >
            {label}
          </button>
        );
      })}
      {showBacklog && (
        <button
          type="button"
          onClick={() => onPick(null)}
          className={`${chipBase} ${idle}`}
        >
          {t('tasks.backlogShort')}
        </button>
      )}
    </div>
  );
}
