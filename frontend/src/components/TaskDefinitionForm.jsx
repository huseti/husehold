import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { taskDefinitionService, memberService } from '../services/api';
import RecurrencePicker from './RecurrencePicker';
import TaskIcon, { TASK_ICON_KEYS } from './icons/taskIcons';

const DEFAULT_FORM = {
  title: '',
  icon: 'other',
  starts_on: new Date().toISOString().slice(0, 10),
  recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
  default_assignee: '',
};

export default function TaskDefinitionForm({ members, definitions, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(DEFAULT_FORM);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await taskDefinitionService.create({
      ...form,
      default_assignee: form.default_assignee || null,
    });
    setForm(DEFAULT_FORM);
    onSaved();
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

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-6">
      <div>
        <h3 className="font-semibold mb-2">{t('tasks.memberColors')}</h3>
        <div className="flex gap-4 flex-wrap">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              {m.user.username}
              <input
                type="color"
                defaultValue={m.color_hex}
                onChange={(e) => handleColorChange(m, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2">{t('tasks.recurringTasks')}</h3>
        <ul className="text-sm mb-3 space-y-1">
          {definitions.map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-gray-600">
              <TaskIcon icon={d.icon} className="text-gray-400 flex-shrink-0" />
              <span className="flex-1">
                {d.title} — <code className="text-xs">{d.recurrence_rule}</code>
              </span>
              <button
                type="button"
                onClick={() => handleDelete(d)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                {t('tasks.deleteRecurringTask')}
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} className="space-y-3">
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
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('tasks.formIcon')}</label>
            <div className="flex gap-1 flex-wrap">
              {TASK_ICON_KEYS.map((key) => (
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
              value={form.recurrence_rule}
              onChange={(rule) => setForm((f) => ({ ...f, recurrence_rule: rule }))}
            />
          </div>

          <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
            {t('tasks.addRecurringTask')}
          </button>
        </form>
      </div>
    </div>
  );
}
