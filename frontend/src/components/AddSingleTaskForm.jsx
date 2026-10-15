import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { taskInstanceService } from '../services/api';
import TaskIconChooser from './TaskIconChooser';
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
    <div className="bg-white rounded-xl shadow p-4 mb-4 border border-eucalyptus-200">
      <h3 className="font-semibold mb-2">{t('tasks.addSingleTask')}</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500">{t('tasks.formTitle')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="border rounded-lg px-2 py-1 text-sm w-full max-w-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500">{t('tasks.formDefaultAssignee')}</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="border rounded-lg px-2 py-1 text-sm"
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
              className="border rounded-lg px-2 py-1 text-sm"
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
          <TaskIconChooser value={icon} onChange={setIcon} />
        </div>

        <div className="flex gap-2">
          <button type="submit" className="btn btn-sm btn-primary text-white hover:btn-primary">
            {t('tasks.addSingleTask')}
          </button>
          <button type="button" onClick={onClose} className="btn btn-sm btn-secondary hover:bg-gray-300">
            {t('weeklyPlanning.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
