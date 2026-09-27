import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CookingPlanSettings from '../components/CookingPlanSettings';
import { cookingPlanConfigService, mealCategoryService } from '../services/api';

// Dedicated config screen for the Cooking Plan (suggestion tuning, which
// meals the weekly plan shows) -- reached via the gear icon on the Cooking
// Plan page, always goes back there (unambiguous, unlike the shared
// Recipes/Shopping config page).
export default function CookingPlanConfig() {
  const { t } = useTranslation();
  const [config, setConfig] = useState(null);
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([cookingPlanConfigService.get(), mealCategoryService.getAll()])
      .then(([configRes, mealRes]) => {
        setConfig(configRes.data);
        setMeals(mealRes.data.results || []);
      })
      .catch((error) => console.error('Error loading cooking plan config:', error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/cooking-plan" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          ← {t('common.back')}
        </Link>
        <h2 className="text-3xl font-bold mb-6">{t('cookingSettings.title')}</h2>

        {loading && <p className="text-gray-500">{t('common.loading')}</p>}
        {!loading && config && <CookingPlanSettings config={config} meals={meals} onSaved={setConfig} />}
      </main>
    </div>
  );
}
