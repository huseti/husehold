import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { taskDefinitionService, memberService } from '../services/api';

const DEFAULT_FORM = {
  title: '',
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
            <li key={d.id} className="text-gray-600">
              {d.title} — <code className="text-xs">{d.recurrence_rule}</code>
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap items-end">
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
            <label className="block text-xs text-gray-500">{t('tasks.formRecurrenceRule')}</label>
            <input
              value={form.recurrence_rule}
              onChange={(e) => setForm({ ...form, recurrence_rule: e.target.value })}
              required
              placeholder="FREQ=WEEKLY;BYDAY=MO"
              className="border rounded px-2 py-1 text-sm w-56"
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
          <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
            {t('tasks.addRecurringTask')}
          </button>
        </form>
      </div>
    </div>
  );
}
