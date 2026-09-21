import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedName } from '../utils/localized';

// One planned dish (or "leftovers of ...") in the weekly plan. The cook task
// it owns lives in the household plan; this card mirrors its state.
export default function CookingEntryCard({ entry, meals, weekDays, onUpdate, onDelete, onAddLeftovers }) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [showLeftovers, setShowLeftovers] = useState(false);
  const [form, setForm] = useState({ date: entry.date, meal_category: entry.meal_category, notes: entry.notes });
  const [leftover, setLeftover] = useState({ date: entry.date, meal_category: entry.meal_category });

  const isLeftovers = entry.kind === 'leftovers';
  const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });
  const locked = entry.is_cooked;

  const save = async () => {
    await onUpdate(entry.id, { date: form.date, meal_category: Number(form.meal_category), notes: form.notes });
    setEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(t('cookingPlan.confirmDelete', { title: entry.recipe_title }))) onDelete(entry.id);
  };

  const submitLeftovers = async () => {
    await onAddLeftovers(entry, leftover.date, Number(leftover.meal_category));
    setShowLeftovers(false);
  };

  let status = null;
  if (!isLeftovers) {
    if (entry.is_cooked) status = { text: t('cookingPlan.status.cooked'), className: 'text-green-700' };
    else if (!entry.task_instance) status = { text: t('cookingPlan.status.draft'), className: 'text-gray-400' };
    else status = { text: entry.assigned_to_username || t('cookingPlan.status.unassigned'), className: 'text-gray-500' };
  }

  return (
    <div
      className="border-l-4 rounded shadow-sm bg-gray-50 p-2 text-sm"
      style={{ borderLeftColor: isLeftovers ? '#d1d5db' : (entry.assigned_to_color || '#9ca3af'), opacity: entry.is_cooked ? 0.65 : 1 }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className={`font-medium ${entry.is_cooked ? 'line-through' : ''}`}>
            {isLeftovers ? t('cookingPlan.leftoversOf', { title: entry.recipe_title }) : entry.recipe_title}
          </div>
          {status && <div className={`text-xs ${status.className}`}>{status.text}</div>}
          {entry.notes && <div className="text-xs text-gray-500">{entry.notes}</div>}
        </div>
        <span className="flex items-center gap-1 text-xs text-gray-600 flex-shrink-0">
          <button
            disabled={locked || entry.servings <= 1}
            onClick={() => onUpdate(entry.id, { servings: entry.servings - 1 })}
            className="w-5 h-5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30"
            aria-label="-"
          >−</button>
          <span>{t('cookingPlan.servingsShort', { count: entry.servings })}</span>
          <button
            disabled={locked}
            onClick={() => onUpdate(entry.id, { servings: entry.servings + 1 })}
            className="w-5 h-5 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30"
            aria-label="+"
          >+</button>
        </span>
      </div>

      <div className="flex items-center gap-3 mt-1 text-xs">
        <button onClick={() => setEditing((v) => !v)} className="text-blue-600 hover:underline">{t('cookingPlan.edit')}</button>
        {!isLeftovers && !locked && (
          <button onClick={() => setShowLeftovers((v) => !v)} className="text-blue-600 hover:underline">{t('cookingPlan.planLeftovers')}</button>
        )}
        <button onClick={handleDelete} className="text-red-500 hover:underline ml-auto">{t('recipes.delete')}</button>
      </div>

      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <select value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border rounded px-2 py-1">
            {weekDays.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
            {!weekDays.includes(entry.date) && <option value={entry.date}>{dayLabel(entry.date)}</option>}
          </select>
          <select value={form.meal_category} onChange={(e) => setForm({ ...form, meal_category: e.target.value })} className="border rounded px-2 py-1">
            {meals.map((m) => <option key={m.id} value={m.id}>{localizedName(m, i18n.language)}</option>)}
          </select>
          <input
            type="text"
            placeholder={t('cookingPlan.notesPlaceholder')}
            value={form.notes}
            maxLength={200}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="border rounded px-2 py-1 flex-1 min-w-32"
          />
          <button onClick={save} className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">{t('recipes.save')}</button>
          <button onClick={() => setEditing(false)} className="bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300">{t('recipes.cancel')}</button>
        </div>
      )}

      {showLeftovers && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <span className="text-xs text-gray-500">{t('cookingPlan.leftoversWhen')}</span>
          <select value={leftover.date} onChange={(e) => setLeftover({ ...leftover, date: e.target.value })} className="border rounded px-2 py-1">
            {weekDays.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
          </select>
          <select value={leftover.meal_category} onChange={(e) => setLeftover({ ...leftover, meal_category: e.target.value })} className="border rounded px-2 py-1">
            {meals.map((m) => <option key={m.id} value={m.id}>{localizedName(m, i18n.language)}</option>)}
          </select>
          <button onClick={submitLeftovers} className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">{t('cookingPlan.add')}</button>
        </div>
      )}
    </div>
  );
}
