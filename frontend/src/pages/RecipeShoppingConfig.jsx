import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import RecipeConfig from '../components/RecipeConfig';

// Dedicated config screen for Recipes & Shopping (labels, meal categories,
// units, ingredients) -- these are domain settings, not system settings, so
// they live on their own page rather than under Settings. Reached via the
// gear icon on both the Recipes and Shopping pages -- since either can be
// where you came from, "back" replays browser history rather than a single
// fixed destination.
export default function RecipeShoppingConfig() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
        >
          ← {t('common.back')}
        </button>
        <h2 className="text-3xl font-bold mb-8">{t('recipeConfig.title')}</h2>
        <RecipeConfig />
      </main>
    </div>
  );
}
