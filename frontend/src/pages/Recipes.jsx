import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  recipeService, mealEventService, unitService, ingredientService, labelService, mealCategoryService,
} from '../services/api';
import Navbar from '../components/Navbar';
import StarRating from '../components/StarRating';
import RecipeForm from '../components/RecipeForm';
import RecipeDetail from '../components/RecipeDetail';
import AddToShoppingDialog from '../components/AddToShoppingDialog';
import RecipeImportModal from '../components/RecipeImportModal';
import GearIcon from '../components/icons/gearIcon';
import { SearchIcon, FilterIcon } from '../components/icons/searchIcons';
import { localizedName } from '../utils/localized';
import { pillStyle } from '../utils/colorContrast';
import { useRevalidate } from '../services/apiCache';
import PageSkeleton from '../components/PageSkeleton';
import { useUndo } from '../components/UndoProvider';
import EmptyState from '../components/EmptyState';
import { RecipesMenuIcon } from '../components/icons/navIcons';
import TitleIcon from '../components/TitleIcon';

export default function Recipes() {
  const { t, i18n } = useTranslation();
  const [recipes, setRecipes] = useState([]);
  const [units, setUnits] = useState([]);
  const [labels, setLabels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ingredientNames, setIngredientNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const { deleteWithUndo } = useUndo();

  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // mode: null | { type: 'view', id } | { type: 'edit', recipe|null, draft? }
  const [mode, setMode] = useState(null);
  const [shoppingDishes, setShoppingDishes] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);
  useRevalidate(() => loadRecipes().catch(() => {}));

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

  const handleAddToShopping = async (servings) => {
    try {
      const response = await recipeService.shoppingLines(viewing.id, servings);
      setShoppingDishes([response.data]);
    } catch (error) {
      console.error('Error loading ingredients:', error);
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

  const handleImported = (draft) => {
    setShowImportModal(false);
    setMode({ type: 'edit', recipe: null, draft });
  };

  const handleDelete = () => {
    const { id, title } = viewing;
    setMode(null);
    deleteWithUndo({
      message: t('common.deleted', { title }),
      hide: () => setRecipes((prev) => prev.filter((r) => r.id !== id)),
      restore: () => loadRecipes().catch(() => {}),
      commit: async () => {
        await recipeService.delete(id);
        loadRecipes();
      },
    });
  };

  if (loading) {
    return <PageSkeleton width="max-w-4xl" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div className="flex items-center gap-1">
            <h2 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold"><TitleIcon><RecipesMenuIcon /></TitleIcon>{t('recipes.title')}</h2>
            <Link
              to="/recipe-shopping-config"
              className="text-gray-500 hover:text-gray-800 text-xl p-2"
              title={t('common.configure')}
              aria-label={t('common.configure')}
            >
              <GearIcon />
            </Link>
          </div>
          {/* Phones: both buttons share one row with short labels */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={() => setShowImportModal(true)} className="btn btn-md btn-primary flex-1 sm:flex-none px-3 sm:px-4">
              + <span className="sm:hidden">{t('recipes.importShort')}</span><span className="hidden sm:inline">{t('recipes.importButton')}</span>
            </button>
            <button onClick={() => setMode({ type: 'edit', recipe: null })} className="btn btn-md btn-primary flex-1 sm:flex-none px-3 sm:px-4">
              + <span className="sm:hidden">{t('recipes.newShort')}</span><span className="hidden sm:inline">{t('recipes.newButton')}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-48">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-eucalyptus-600 pointer-events-none" />
            <input
              type="search"
              placeholder={t('recipes.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="relative flex-1 sm:flex-none min-w-0">
            <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-eucalyptus-600 pointer-events-none" />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg">
              <option value="">{t('recipes.allCategories')}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{localizedName(c, i18n.language)}</option>)}
            </select>
          </div>
          <div className="relative flex-1 sm:flex-none min-w-0">
            <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-eucalyptus-600 pointer-events-none" />
            <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg">
              <option value="">{t('recipes.allLabels')}</option>
              {labels.map((l) => <option key={l.id} value={l.id}>{localizedName(l, i18n.language)}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 && (
          recipes.length === 0 ? (
            <EmptyState
              icon={<RecipesMenuIcon />}
              text={t('recipes.empty')}
              action={{ label: `+ ${t('recipes.importButton')}`, onClick: () => setShowImportModal(true) }}
            />
          ) : (
            <EmptyState
              icon={<SearchIcon />}
              text={t('recipes.noMatches')}
              action={{ label: t('recipes.resetFilters'), onClick: () => { setSearch(''); setCategoryFilter(''); setLabelFilter(''); } }}
            />
          )
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setMode({ type: 'view', id: recipe.id })}
              className="text-left bg-white rounded-xl shadow p-4 sm:p-5 hover:shadow-md transition-shadow"
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
                  <span key={l.id} style={pillStyle(l.color_hex)} className="px-2 py-0.5 rounded-full text-xs">{localizedName(l, i18n.language)}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </main>

      {shoppingDishes && (
        <AddToShoppingDialog dishes={shoppingDishes} onClose={() => setShoppingDishes(null)} />
      )}

      {showImportModal && (
        <RecipeImportModal onClose={() => setShowImportModal(false)} onExtracted={handleImported} />
      )}

      {mode && (
        <div className="modal-backdrop fixed inset-0 z-40 bg-black/40 overflow-y-auto p-4 print:static print:overflow-visible print:bg-white print:p-0" onClick={() => setMode(null)}>
          <div className="modal-panel bg-white rounded-xl shadow-xl max-w-2xl mx-auto my-8 p-6 print:shadow-none print:m-0 print:max-w-none print:p-0" onClick={(e) => e.stopPropagation()}>
            {mode.type === 'edit' ? (
              <RecipeForm
                recipe={mode.recipe}
                draft={mode.draft}
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
                onAddToShopping={handleAddToShopping}
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
