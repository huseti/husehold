import { useTranslation } from 'react-i18next';
import ProgressBar from './ProgressBar';

// This week's completion progress: an overall bar plus a per-member
// breakdown. skipped/snoozed instances are excluded from both the numerator
// and the denominator -- they don't count against the household.
export default function ProgressPanel({ weekDone, weekTotal, members, weekTasks }) {
  const { t } = useTranslation();
  const perMember = members.map((member) => {
    const mine = weekTasks.filter((task) => task.assigned_to === member.user.id);
    return {
      id: member.user.id,
      name: member.user.first_name || member.user.username,
      color: member.color_hex,
      done: mine.filter((task) => task.status === 'done').length,
      total: mine.length,
    };
  });

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">{t('dashboard.progress.title')}</h2>
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{t('dashboard.progress.overall')}</span>
          <span>{weekDone}/{weekTotal}</span>
        </div>
        <ProgressBar done={weekDone} total={weekTotal} />
      </div>
      <ul className="space-y-2">
        {perMember.map((member) => (
          <li key={member.id}>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{member.name}</span>
              <span>{member.done}/{member.total}</span>
            </div>
            <ProgressBar done={member.done} total={member.total} colorHex={member.color} />
          </li>
        ))}
      </ul>
    </div>
  );
}
