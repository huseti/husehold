import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  recipeService, mealEventService, unitService, ingredientService, labelService, mealCategoryService,
} from '../services/api';
import Navbar from '../components/Navbar';
import StarRating from '../components/StarRating';
import RecipeForm from '../components/RecipeForm';
import RecipeDetail from '../components/RecipeDetail';
import { localizedName } from '../utils/localized';

export default function Recipes() {
  const { t, i18n } = useTranslation();
  const [recipes, setRecipes] = useState([]);
  const [units, setUnits] = useState([]);
  const [labels, setLabels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredientNames, setIngredientNames] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // mode: null | { type: 'view', id } | { type: 'edit', recipe|null }
  const [mode, setMode] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadRecipes = async () => {
    const response = await recipeService.getAll();
    setRecipes(response.data.results || []);
  };

  const loadIngredientNames = async () => {
    const response = await ingredientService.getAll();
    setIngredientNames((response.data.results || []).map((i) => i.name));
  };

  const loadAll = async () => {
    try {
      const [, unitRes, labelRes, categoryRes] = await Promise.all([
        loadRecipes(), unitService.getAll(), labelService.getAll(), mealCategoryService.getAll(),
        loadIngredientNames(),
      ]);
      setUnits(unitRes.data.results || []);
      setLabels(labelRes.data.results || []);
      setCategories(categoryRes.data.results || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (labelFilter && !r.labels.includes(Number(labelFilter))) return false;
      if (categoryFilter && !r.categories.includes(Number(categoryFilter))) return false;
      if (!q) return true;
      return r.title.toLowerCase().includes(q)
        || r.ingredients.some((i) => i.ingredient_name.toLowerCase().includes(q));
    });
  }, [recipes, search, labelFilter, categoryFilter]);

  const viewing = mode?.type === 'view' ? recipes.find((r) => r.id === mode.id) : null;

  const handleSave = async (payload) => {
    const editing = mode.recipe;
    const response = editing
      ? await recipeService.update(editing.id, payload)
      : await recipeService.create(payload);
    await Promise.all([loadRecipes(), loadIngredientNames()]);
    setMode({ type: 'view', id: response.data.id });
  };

  const replaceRecipe = (updated) => setRecipes((list) => list.map((r) => (r.id === updated.id ? updated : r)));

  const handleRate = async (score) => {
    try {
      replaceRecipe((await recipeService.rate(viewing.id, score)).data);
    } catch (error) {
      console.error('Error rating recipe:', error);
    }
  };

  const handleClearRating = async () => {
    try {
      replaceRecipe((await recipeService.clearRating(viewing.id)).data);
    } catch (error) {
      console.error('Error clearing rating:', error);
    }
  };

  const handleLogCooked = async (data) => {
    await mealEventService.create({ recipe: viewing.id, ...data });
    await loadRecipes();
  };

  const handleDeleteMeal = async (id) => {
    try {
      await mealEventService.delete(id);
      await loadRecipes();
    } catch (error) {
      console.error('Error deleting meal log entry:', error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('recipes.confirmDelete', { title: viewing.title }))) return;
    try {
      await recipeService.delete(viewing.id);
      setMode(null);
      loadRecipes();
    } catch (error) {
      console.error('Error deleting recipe:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">{t('recipes.title')}</h2>
          <button
            onClick={() => setMode({ type: 'edit', recipe: null })}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + {t('recipes.newButton')}
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="search"
            placeholder={t('recipes.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2 border border-gray-300 rounded-lg"
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">{t('recipes.allCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{localizedName(c, i18n.language)}</option>)}
          </select>
          <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">{t('recipes.allLabels')}</option>
            {labels.map((l) => <option key={l.id} value={l.id}>{localizedName(l, i18n.language)}</option>)}
          </select>
        </div>

        {filtered.length === 0 && (
          <p className="text-gray-500">{recipes.length === 0 ? t('recipes.empty') : t('recipes.noMatches')}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setMode({ type: 'view', id: recipe.id })}
              className="text-left bg-white rounded-lg shadow p-5 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold mb-1">{recipe.title}</h3>
              <div className="flex items-center gap-2 mb-2 text-sm text-gray-500">
                {recipe.average_rating !== null
                  ? <><StarRating value={recipe.average_rating} className="text-base" /><span>{recipe.average_rating}</span></>
                  : <span>{t('recipes.notRatedYet')}</span>}
                {(recipe.prep_time !== null || recipe.cook_time !== null) && (
                  <span>· {t('recipes.totalMinutes', { minutes: (recipe.prep_time || 0) + (recipe.cook_time || 0) })}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {labels.filter((l) => recipe.labels.includes(l.id)).map((l) => (
                  <span key={l.id} style={{ backgroundColor: l.color_hex }} className="px-2 py-0.5 rounded-full text-xs text-white">{localizedName(l, i18n.language)}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </main>

      {mode && (
        <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={() => setMode(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl mx-auto my-8 p-6" onClick={(e) => e.stopPropagation()}>
            {mode.type === 'edit' ? (
              <RecipeForm
                recipe={mode.recipe}
                units={units}
                categories={categories}
                labels={labels}
                ingredientNames={ingredientNames}
                onSave={handleSave}
                onCancel={() => setMode(mode.recipe ? { type: 'view', id: mode.recipe.id } : null)}
              />
            ) : viewing && (
              <RecipeDetail
                key={viewing.id}
                recipe={viewing}
                labels={labels}
                categories={categories}
                units={units}
                onLogCooked={handleLogCooked}
                onDeleteMeal={handleDeleteMeal}
                onRate={handleRate}
                onClearRating={handleClearRating}
                onEdit={() => setMode({ type: 'edit', recipe: viewing })}
                onDelete={handleDelete}
                onClose={() => setMode(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
