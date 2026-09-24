import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cookingPlanEntryService } from '../services/api';
import { toISODate, addDays } from '../utils/weekDates';

// Step 1 of the household planning: the meals come first, because "Finish
// plan" in the cooking plan is what creates the cook tasks -- planning the
// household's tasks afterwards means those dishes can be assigned right away.
export default function CookingStepModal({ weekStart, onOpenCookingPlan, onSkip }) {
  const { t } = useTranslation();
  const [state, setState] = useState(null); // { dishes, drafts }

  useEffect(() => {
    cookingPlanEntryService.getRange(toISODate(weekStart), toISODate(addDays(weekStart, 6)))
      .then((res) => {
        const dishes = (res.data.results || []).filter((e) => e.kind !== 'leftovers');
        setState({ dishes: dishes.length, drafts: dishes.filter((e) => !e.task_instance).length });
      })
      .catch((error) => {
        console.error('Error loading cooking plan status:', error);
        setState({ dishes: 0, drafts: 0 });
      });
  }, [weekStart]);

  const done = state && state.dishes > 0 && state.drafts === 0;
  let status = t('common.loading');
  if (state) {
    if (state.dishes === 0) status = t('cookingStep.none');
    else if (state.drafts > 0) status = t('cookingStep.drafts', { count: state.drafts });
    else status = t('cookingStep.done', { count: state.dishes });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <p className="text-xs uppercase tracking-wide text-purple-600 mb-1">{t('cookingStep.step')}</p>
        <h3 className="text-xl font-semibold mb-3">{t('cookingStep.title')}</h3>
        <p className="text-sm text-gray-600 mb-2">{t('cookingStep.explanation')}</p>
        <p className={`text-sm font-medium mb-5 ${done ? 'text-green-700' : 'text-gray-800'}`}>{status}</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={onOpenCookingPlan} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            {done ? t('cookingStep.review') : t('cookingStep.open')}
          </button>
          <button onClick={onSkip} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
            {done ? t('cookingStep.continue') : t('cookingStep.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
