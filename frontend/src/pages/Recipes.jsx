import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { recipeService } from '../services/api';
import Navbar from '../components/Navbar';

export default function Recipes() {
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const response = await recipeService.getAll();
      setRecipes(response.data.results || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('recipes.title')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recipes.map(recipe => (
            <div key={recipe.id} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-2">{recipe.title}</h3>
              <p className="text-gray-600 mb-4">{recipe.description}</p>
              <div className="space-y-2 text-sm text-gray-600">
                {recipe.prep_time && <p>{t('recipes.prepTime', { minutes: recipe.prep_time })}</p>}
                {recipe.cook_time && <p>{t('recipes.cookTime', { minutes: recipe.cook_time })}</p>}
                <p>{t('recipes.servings', { count: recipe.servings })}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
