import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { taskDefinitionService } from '../services/api';
import { summarizeRecurrenceRule } from '../utils/recurrenceSummary';
import { toISODate } from '../utils/weekDates';

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const ASSIGNMENT_MODES = ['none', 'alternating', 'fixed'];

// Finds the next date (including today) that falls on the given RRULE
// weekday code, so a freshly (re)configured reminder starts from a sane
// anchor date instead of the day the form happened to be saved on.
function nextDateForWeekday(code) {
  const targetIndex = WEEKDAYS.indexOf(code);
  const today = new Date();
  const diff = (targetIndex - (today.getDay() === 0 ? 6 : today.getDay() - 1) + 7) % 7;
  const result = new Date(today);
  result.setDate(today.getDate() + diff);
  return toISODate(result);
}

export default function WeeklyPlanningConfig({ definitions, members, onSaved }) {
  const { t, i18n } = useTranslation();
  const existing = definitions.find((d) => d.system_action === 'weekly_household_planning');

  const [weekday, setWeekday] = useState('SU');
  const [time, setTime] = useState('18:00');
  const [assignmentMode, setAssignmentMode] = useState('none');
  const [defaultAssignee, setDefaultAssignee] = useState('');

  useEffect(() => {
    if (existing) {
      const match = existing.recurrence_rule.match(/BYDAY=([A-Z]{2})/);
      if (match) setWeekday(match[1]);
      if (existing.reminder_time) setTime(existing.reminder_time.slice(0, 5));
      setAssignmentMode(existing.assignment_mode);
      setDefaultAssignee(existing.default_assignee || '');
    }
  }, [existing?.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      title: 'Weekly Household Planning',
      icon: 'calendar',
      starts_on: nextDateForWeekday(weekday),
      recurrence_rule: `FREQ=WEEKLY;BYDAY=${weekday}`,
      assignment_mode: assignmentMode,
      default_assignee: assignmentMode === 'fixed' ? (defaultAssignee || null) : null,
      system_action: 'weekly_household_planning',
      reminder_time: time,
    };
    if (existing) {
      await taskDefinitionService.update(existing.id, payload);
    } else {
      await taskDefinitionService.create(payload);
    }
    onSaved();
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="font-semibold mb-1">{t('weeklyPlanning.title')}</h3>
      <p className="text-xs text-gray-500 mb-3">{t('weeklyPlanning.description')}</p>

      {existing ? (
        <p className="text-sm text-gray-700 mb-3">
          {t('weeklyPlanning.current', {
            summary: summarizeRecurrenceRule(existing.recurrence_rule, t),
            time: existing.reminder_time ? existing.reminder_time.slice(0, 5) : '–',
          })}
          {' · '}
          {existing.assignment_mode === 'fixed'
            ? t('tasks.assignmentSummary.fixed', { name: existing.default_assignee_username || t('tasks.unassigned') })
            : t(`tasks.assignmentMode.${existing.assignment_mode}`)}
        </p>
      ) : (
        <p className="text-sm text-gray-400 mb-3">{t('weeklyPlanning.notSetUp')}</p>
      )}

      <form onSubmit={handleSave} className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500">{t('weeklyPlanning.weekday')}</label>
          <select
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {new Date(nextDateForWeekday(day)).toLocaleDateString(i18n.resolvedLanguage, { weekday: 'long' })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">{t('weeklyPlanning.time')}</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">{t('tasks.formAssignmentMode')}</label>
          <select
            value={assignmentMode}
            onChange={(e) => setAssignmentMode(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {ASSIGNMENT_MODES.map((mode) => (
              <option key={mode} value={mode}>{t(`tasks.assignmentMode.${mode}`)}</option>
            ))}
          </select>
        </div>
        {assignmentMode === 'fixed' && (
          <div>
            <label className="block text-xs text-gray-500">{t('tasks.formDefaultAssignee')}</label>
            <select
              value={defaultAssignee}
              onChange={(e) => setDefaultAssignee(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">{t('tasks.unassigned')}</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.username}</option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
          {t('weeklyPlanning.save')}
        </button>
      </form>
    </div>
  );
}
