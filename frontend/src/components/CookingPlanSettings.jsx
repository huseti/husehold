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
  const [status, setStatus] = useState('');

  useEffect(() => setForm(config), [config]);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const toggleMeal = (id) => setForm((f) => ({
    ...f,
    planned_meal_categories: f.planned_meal_categories.includes(id)
      ? f.planned_meal_categories.filter((x) => x !== id)
      : [...f.planned_meal_categories, id],
  }));

  const save = async (e) => {
    e.preventDefault();
    setStatus('');
    try {
      const response = await cookingPlanConfigService.update({
        top_rating_percentile: Number(form.top_rating_percentile),
        uncooked_threshold_days: Number(form.uncooked_threshold_days),
        rating_weight: Number(form.rating_weight),
        neglect_weight: Number(form.neglect_weight),
        craving_count: Number(form.craving_count),
        random_count: Number(form.random_count),
        planned_meal_categories: form.planned_meal_categories,
      });
      onSaved(response.data);
      setStatus(t('cookingSettings.saved'));
    } catch (error) {
      console.error('Error saving cooking plan settings:', error);
      setStatus(t('cookingSettings.failed'));
    }
  };

  const number = (field, min, step = 1) => (
    <input
      type="number" min={min} step={step} value={form[field]}
      onChange={(e) => set(field, e.target.value)}
      className="block w-24 mt-1 px-3 py-1.5 border border-gray-300 rounded-lg"
    />
  );

  return (
    <form onSubmit={save} className="bg-white rounded-lg shadow p-5 mb-6 space-y-4">
      <div>
        <h3 className="font-semibold">{t('cookingSettings.title')}</h3>
        <p className="text-xs text-gray-500">{t('cookingSettings.hint')}</p>
      </div>

      <div>
        <p className="text-sm text-gray-600 mb-1">{t('cookingSettings.plannedMeals')}</p>
        <div className="flex flex-wrap gap-2">
          {meals.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMeal(m.id)}
              className={`px-3 py-1 rounded-full text-sm border ${form.planned_meal_categories.includes(m.id) ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              {localizedName(m, i18n.language)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-600">
        <label>{t('cookingSettings.cravingCount')}{number('craving_count', 0)}</label>
        <label>{t('cookingSettings.randomCount')}{number('random_count', 0)}</label>
        <label>{t('cookingSettings.topPercentile')}{number('top_rating_percentile', 1)}</label>
        <label>{t('cookingSettings.uncookedDays')}{number('uncooked_threshold_days', 1)}</label>
        <label>{t('cookingSettings.ratingWeight')}{number('rating_weight', 0, 0.1)}</label>
        <label>{t('cookingSettings.neglectWeight')}{number('neglect_weight', 0, 0.1)}</label>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">{t('recipes.save')}</button>
        {status && <span className="text-sm text-gray-600">{status}</span>}
      </div>
    </form>
  );
}
