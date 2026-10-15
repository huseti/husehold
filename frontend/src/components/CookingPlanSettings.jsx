import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cookingPlanConfigService } from '../services/api';
import { localizedName } from '../utils/localized';

// Tuning knobs for the recipe suggestions, and which meals the weekly plan
// shows. See PLANNING.md 2b / services/cooking_suggestions.py for how the
// five suggestion buckets use them.
export default function CookingPlanSettings({ config, meals, onSaved }) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(config);
  const [error, setError] = useState('');

  useEffect(() => setForm(config), [config]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // Every change saves immediately (autosave), patching only the changed field.
  const persist = async (patch) => {
    setError('');
    try {
      const response = await cookingPlanConfigService.update(patch);
      onSaved(response.data);
    } catch (err) {
      console.error('Error saving cooking plan settings:', err);
      setError(t('cookingSettings.failed'));
      setForm(config);
    }
  };

  const toggleMeal = (id) => {
    const current = form.planned_meal_categories;
    const planned = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setForm((f) => ({ ...f, planned_meal_categories: planned }));
    persist({ planned_meal_categories: planned });
  };

  const commitNumber = (field, min) => {
    const value = Number(form[field]);
    if (form[field] === '' || Number.isNaN(value) || value < min) {
      set(field, config[field]);
      return;
    }
    if (value !== Number(config[field])) persist({ [field]: value });
  };

  const number = (field, min, step = 1) => (
    <input
      type="number" min={min} step={step} value={form[field]}
      onChange={(e) => set(field, e.target.value)}
      onBlur={() => commitNumber(field, min)}
      className="block w-24 mt-1 px-3 py-1.5 border border-gray-300 rounded-lg"
    />
  );

  return (
    <div className="bg-white rounded-xl shadow p-5 mb-6 space-y-4">
      <p className="text-xs text-gray-500">{t('cookingSettings.hint')}</p>

      <div>
        <p className="text-sm text-gray-600 mb-1">{t('cookingSettings.plannedMeals')}</p>
        <div className="flex flex-wrap gap-2">
          {meals.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMeal(m.id)}
              aria-pressed={form.planned_meal_categories.includes(m.id)}
              className={`px-3 py-1 rounded-full text-sm border ${form.planned_meal_categories.includes(m.id) ? 'bg-eucalyptus-300 text-gray-900 border-eucalyptus-300 dark:bg-eucalyptus-700 dark:text-white dark:border-eucalyptus-500' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              {localizedName(m, i18n.language)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-600">
        <label>{t('cookingSettings.cravingCount')}{number('craving_count', 0)}</label>
        <label>{t('cookingSettings.longAgoCount')}{number('long_ago_count', 0)}</label>
        <label>{t('cookingSettings.randomCount')}{number('random_count', 0)}</label>
        <label>{t('cookingSettings.topPercentile')}{number('top_rating_percentile', 1)}</label>
        <label>{t('cookingSettings.uncookedDays')}{number('uncooked_threshold_days', 1)}</label>
        <label>{t('cookingSettings.ratingWeight')}{number('rating_weight', 0, 0.1)}</label>
        <label>{t('cookingSettings.neglectWeight')}{number('neglect_weight', 0, 0.1)}</label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
