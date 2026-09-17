import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { taskInstanceService } from '../services/api';
import TaskIcon, { TASK_ICON_KEYS } from './icons/taskIcons';
import { toISODate } from '../utils/weekDates';

export default function AddSingleTaskForm({ weekDays, members, onClose, onAdded }) {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('other');
  const [assignedTo, setAssignedTo] = useState('');
  const [day, setDay] = useState('backlog');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isBacklog = day === 'backlog';
    await taskInstanceService.create({
      standalone_title: title,
      standalone_icon: icon,
      assigned_to: assignedTo || null,
      scheduled_date: isBacklog ? toISODate(weekDays[0]) : day,
      is_in_backlog: isBacklog,
    });
    onAdded();
    onClose();
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 border border-blue-200">
      <h3 className="font-semibold mb-2">{t('tasks.addSingleTask')}</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500">{t('tasks.formTitle')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="border rounded px-2 py-1 text-sm w-full max-w-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500">{t('tasks.formDefaultAssignee')}</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">{t('tasks.unassigned')}</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.username}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500">{t('tasks.formDay')}</label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="backlog">{t('tasks.backlog')}</option>
              {weekDays.map((d) => (
                <option key={toISODate(d)} value={toISODate(d)}>
                  {d.toLocaleDateString(i18n.resolvedLanguage, { weekday: 'short', day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('tasks.formIcon')}</label>
          <div className="flex gap-1 flex-wrap">
            {TASK_ICON_KEYS.filter((key) => key !== 'calendar').map((key) => (
              <button
                key={key}
                type="button"
                title={t(`tasks.icon.${key}`)}
                onClick={() => setIcon(key)}
                className={`p-2 rounded border text-lg ${
                  icon === key ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                <TaskIcon icon={key} />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
            {t('tasks.addSingleTask')}
          </button>
          <button type="button" onClick={onClose} className="px-3 py-1 rounded text-sm bg-gray-200 hover:bg-gray-300">
            {t('weeklyPlanning.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
