import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { taskDefinitionService, memberService } from '../services/api';
import RecurrencePicker from './RecurrencePicker';
import WeeklyPlanningConfig from './WeeklyPlanningConfig';
import TaskIcon, { TASK_ICON_KEYS } from './icons/taskIcons';
import { summarizeRecurrenceRule } from '../utils/recurrenceSummary';
import { toISODate } from '../utils/weekDates';

const DEFAULT_FORM = {
  title: '',
  icon: 'other',
  starts_on: toISODate(new Date()),
  recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
  has_preferred_day: true,
  assignment_mode: 'none',
  default_assignee: '',
};

const ASSIGNMENT_MODES = ['none', 'alternating', 'fixed'];

function formFromDefinition(d) {
  return {
    title: d.title,
    icon: d.icon,
    starts_on: d.starts_on,
    recurrence_rule: d.recurrence_rule,
    has_preferred_day: d.has_preferred_day,
    assignment_mode: d.assignment_mode,
    default_assignee: d.default_assignee || '',
  };
}

export default function TaskDefinitionForm({ members, definitions, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);

  const regularDefinitions = definitions.filter((d) => d.system_action === 'none');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      default_assignee: form.assignment_mode === 'fixed' ? (form.default_assignee || null) : null,
    };
    if (editingId) {
      await taskDefinitionService.update(editingId, payload);
    } else {
      await taskDefinitionService.create(payload);
    }
    setForm(DEFAULT_FORM);
    setEditingId(null);
    onSaved();
  };

  const handleEdit = (definition) => {
    setEditingId(definition.id);
    setForm(formFromDefinition(definition));
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const handleColorChange = async (member, color) => {
    await memberService.update(member.id, { color_hex: color });
    onSaved();
  };

  const handleDelete = async (definition) => {
    try {
      await taskDefinitionService.delete(definition.id);
      onSaved();
    } catch (error) {
      if (error.response?.status === 409) {
        const { instance_count } = error.response.data;
        const confirmed = window.confirm(
          t('tasks.confirmDeleteWithInstances', { title: definition.title, count: instance_count }),
        );
        if (confirmed) {
          await taskDefinitionService.delete(definition.id, true);
          onSaved();
        }
      } else {
        console.error('Error deleting task definition:', error);
      }
    }
  };

  const assignmentSummary = (d) => {
    if (d.assignment_mode === 'fixed') {
      return d.default_assignee_username
        ? t('tasks.assignmentSummary.fixed', { name: d.default_assignee_username })
        : t('tasks.assignmentMode.fixed');
    }
    return t(`tasks.assignmentMode.${d.assignment_mode}`);
  };

  return (
    <div className="space-y-6 mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-2">{t('tasks.memberColors')}</h3>
        <div className="flex gap-4 flex-wrap">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              {m.user.username}
              <input
                type="color"
                value={m.color_hex}
                onChange={(e) => handleColorChange(m, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <WeeklyPlanningConfig definitions={definitions} onSaved={onSaved} />

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-2">{t('tasks.recurringTasks')}</h3>
        <ul className="text-sm mb-3 space-y-2">
          {regularDefinitions.map((d) => (
            <li key={d.id} className="flex items-start gap-2 text-gray-600 border-b pb-2 last:border-0">
              <TaskIcon icon={d.icon} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-gray-800">{d.title}</div>
                <div className="text-xs text-gray-500">
                  {d.has_preferred_day
                    ? summarizeRecurrenceRule(d.recurrence_rule, t)
                    : t('tasks.recurrence.summary.noPreferredDay', {
                        every: summarizeRecurrenceRule(d.recurrence_rule, t).split(' on ')[0],
                      })}
                  {' · '}
                  {assignmentSummary(d)}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {t('tasks.createdInfo', {
                    date: new Date(d.created_at).toLocaleDateString(),
                    name: d.created_by_username || t('tasks.unassigned'),
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleEdit(d)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {t('tasks.editRecurringTask')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(d)}
                title={t('tasks.deleteRecurringTask')}
                className="text-red-500 hover:text-red-700"
              >
                <TaskIcon icon="trash" />
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} className="space-y-3">
          {editingId && (
            <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">{t('tasks.nowEditing')}</p>
          )}
          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <label className="block text-xs text-gray-500">{t('tasks.formTitle')}</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">{t('tasks.formStartsOn')}</label>
              <input
                type="date"
                value={form.starts_on}
                onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
                required
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <label className="block text-xs text-gray-500">{t('tasks.formAssignmentMode')}</label>
              <select
                value={form.assignment_mode}
                onChange={(e) => setForm({ ...form, assignment_mode: e.target.value })}
                className="border rounded px-2 py-1 text-sm"
              >
                {ASSIGNMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>{t(`tasks.assignmentMode.${mode}`)}</option>
                ))}
              </select>
            </div>
            {form.assignment_mode === 'fixed' && (
              <div>
                <label className="block text-xs text-gray-500">{t('tasks.formDefaultAssignee')}</label>
                <select
                  value={form.default_assignee}
                  onChange={(e) => setForm({ ...form, default_assignee: e.target.value })}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="">{t('tasks.unassigned')}</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>{m.user.username}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('tasks.formIcon')}</label>
            <div className="flex gap-1 flex-wrap">
              {TASK_ICON_KEYS.filter((key) => key !== 'calendar').map((key) => (
                <button
                  key={key}
                  type="button"
                  title={t(`tasks.icon.${key}`)}
                  onClick={() => setForm({ ...form, icon: key })}
                  className={`p-2 rounded border text-lg ${
                    form.icon === key
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  <TaskIcon icon={key} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('tasks.formRecurrenceRule')}</label>
            <RecurrencePicker
              key={editingId || 'new'}
              value={form.recurrence_rule}
              initialRule={form.recurrence_rule}
              hasPreferredDay={form.has_preferred_day}
              onHasPreferredDayChange={(checked) => setForm((f) => ({ ...f, has_preferred_day: checked }))}
              onChange={(rule) => setForm((f) => ({ ...f, recurrence_rule: rule }))}
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
              {editingId ? t('weeklyPlanning.save') : t('tasks.addRecurringTask')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300"
              >
                {t('weeklyPlanning.cancel')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
