import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import RecipeConfig from '../components/RecipeConfig';

// Dedicated config screen for Recipes & Shopping (labels, meal categories,
// units, ingredients) -- these are domain settings, not system settings, so
// they live on their own page rather than under Settings. Reached via the
// gear icon on both the Recipes and Shopping pages.
export default function RecipeShoppingConfig() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('recipeConfig.title')}</h2>
        <RecipeConfig />
      </main>
    </div>
  );
}
