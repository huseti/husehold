import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  cookingPlanEntryService, cookingPlanConfigService, mealCategoryService, labelService, recipeService,
  taskInstanceService,
} from '../services/api';
import Navbar from '../components/Navbar';
import CookingEntryCard from '../components/CookingEntryCard';
import RecipePicker from '../components/RecipePicker';
import AddToShoppingDialog from '../components/AddToShoppingDialog';
import CookingPlanSettings from '../components/CookingPlanSettings';
import { localizedName } from '../utils/localized';
import { getWeekStart, toISODate, addDays, parseISODate } from '../utils/weekDates';

// The weekly meal plan. The household's recurring "weekly meal planning" task
// ("Plan now") lands here for the following week; finishing creates one cook
// task per dish in the household plan, where they get assigned.
export default function CookingPlan() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => {
    const planWeek = searchParams.get('planWeek');
    return planWeek ? parseISODate(planWeek) : getWeekStart(new Date());
  });
  // Set when arriving via the planning reminder's "Plan now" -- finishing
  // then also ticks that reminder off.
  const [planInstanceId, setPlanInstanceId] = useState(() => {
    const id = searchParams.get('planInstance');
    return id ? Number(id) : null;
  });
  const [entries, setEntries] = useState([]);
  const [config, setConfig] = useState(null);
  const [meals, setMeals] = useState([]);
  const [labels, setLabels] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null); // { date, meal }
  const [shoppingDishes, setShoppingDishes] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState(null); // { text, showHouseholdLink }

  useEffect(() => {
    if (searchParams.get('planWeek')) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i))), [weekStart]);
  const rangeStart = weekDays[0];
  const rangeEnd = weekDays[6];

  const loadEntries = useCallback(async () => {
    try {
      const response = await cookingPlanEntryService.getRange(rangeStart, rangeEnd);
      setEntries(response.data.results || []);
    } catch (error) {
      console.error('Error loading cooking plan:', error);
    }
  }, [rangeStart, rangeEnd]);

  const loadRecipes = async () => {
    const response = await recipeService.getAll();
    setRecipes(response.data.results || []);
  };

  useEffect(() => {
    Promise.all([
      cookingPlanConfigService.get(), mealCategoryService.getAll(), labelService.getAll(), loadRecipes(),
    ]).then(([configRes, mealRes, labelRes]) => {
      setConfig(configRes.data);
      setMeals(mealRes.data.results || []);
      setLabels(labelRes.data.results || []);
    }).catch((error) => console.error('Error loading cooking plan data:', error))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const shownMeals = useMemo(() => {
    if (!config) return meals;
    const planned = meals.filter((m) => config.planned_meal_categories.includes(m.id));
    return planned.length > 0 ? planned : meals;
  }, [config, meals]);

  const cookEntries = entries.filter((e) => e.kind === 'cook');
  const draftCount = cookEntries.filter((e) => !e.task_instance).length;

  const dayLabel = (iso) => parseISODate(iso).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'short' });
  const rangeLabel = `${parseISODate(rangeStart).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })} – ${parseISODate(rangeEnd).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}`;

  const handleUpdate = async (id, data) => {
    try {
      await cookingPlanEntryService.update(id, data);
      await loadEntries();
    } catch (error) {
      console.error('Error updating entry:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await cookingPlanEntryService.delete(id);
      await loadEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const handlePickRecipe = async (recipe) => {
    try {
      await cookingPlanEntryService.create({
        date: picker.date, meal_category: picker.meal.id, recipe: recipe.id, servings: recipe.servings,
      });
      setPicker(null);
      await Promise.all([loadEntries(), loadRecipes()]);
    } catch (error) {
      console.error('Error adding dish:', error);
    }
  };

  const handleAddLeftovers = async (source, date, mealCategory) => {
    try {
      await cookingPlanEntryService.create({
        date, meal_category: mealCategory, kind: 'leftovers', source_entry: source.id,
      });
      await loadEntries();
    } catch (error) {
      console.error('Error adding leftovers:', error);
    }
  };

  const handlePickLeftovers = async (source) => {
    await handleAddLeftovers(source, picker.date, picker.meal.id);
    setPicker(null);
  };

  const openShopping = async () => {
    try {
      const response = await cookingPlanEntryService.shoppingPreview(rangeStart, rangeEnd);
      if (response.data.length === 0) {
        setNotice({ text: t('cookingPlan.noDishesForShopping') });
        return null;
      }
      setShoppingDishes(response.data);
      return response.data;
    } catch (error) {
      console.error('Error loading shopping preview:', error);
      return null;
    }
  };

  const handleFinish = async () => {
    try {
      const response = await cookingPlanEntryService.finalize(rangeStart, rangeEnd);
      if (planInstanceId) {
        await taskInstanceService.complete(planInstanceId);
        setPlanInstanceId(null);
      }
      setNotice({
        text: response.data.created > 0
          ? t('cookingPlan.finished', { count: response.data.created })
          : t('cookingPlan.finishedNothingNew'),
        showHouseholdLink: response.data.created > 0,
      });
      await loadEntries();
      await openShopping();
    } catch (error) {
      console.error('Error finishing the plan:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-3xl font-bold">{t('cookingPlan.title')}</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">←</button>
            <span className="text-sm text-gray-600">{rangeLabel}</span>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">→</button>
          </div>
        </div>

        {planInstanceId && (
          <div className="bg-purple-50 text-purple-800 rounded-lg px-4 py-2 mb-4 text-sm">
            {t('cookingPlan.planningBanner', { range: rangeLabel })}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={handleFinish} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            {draftCount > 0 ? t('cookingPlan.finishWithCount', { count: draftCount }) : t('cookingPlan.finish')}
          </button>
          <button onClick={openShopping} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            {t('cookingPlan.shoppingButton')}
          </button>
          <button onClick={() => setShowSettings((v) => !v)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
            {t('cookingPlan.settings')}
          </button>
        </div>

        {notice && (
          <p className="text-sm text-green-700 mb-4">
            {notice.text}{' '}
            {notice.showHouseholdLink && <Link to="/tasks" className="text-blue-600 hover:underline">{t('cookingPlan.toHouseholdPlan')}</Link>}
          </p>
        )}

        {showSettings && config && (
          <CookingPlanSettings config={config} meals={meals} onSaved={setConfig} />
        )}

        {meals.length === 0 && <p className="text-gray-500">{t('cookingPlan.noMeals')}</p>}

        <div className="space-y-4">
          {weekDays.map((iso) => {
            const isToday = iso === toISODate(new Date());
            return (
              <section key={iso} className={`bg-white rounded-lg shadow p-4 ${isToday ? 'ring-2 ring-blue-300' : ''}`}>
                <h3 className="font-semibold mb-3">{dayLabel(iso)}</h3>
                <div className="space-y-3">
                  {shownMeals.map((meal) => {
                    const cell = entries.filter((e) => e.date === iso && e.meal_category === meal.id);
                    return (
                      <div key={meal.id} className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-2">
                        <div className="text-sm text-gray-500 pt-1">{localizedName(meal, i18n.language)}</div>
                        <div className="space-y-2">
                          {cell.map((entry) => (
                            <CookingEntryCard
                              key={entry.id}
                              entry={entry}
                              meals={shownMeals}
                              weekDays={weekDays}
                              onUpdate={handleUpdate}
                              onDelete={handleDelete}
                              onAddLeftovers={handleAddLeftovers}
                            />
                          ))}
                          <button
                            onClick={() => setPicker({ date: iso, meal })}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            + {t('cookingPlan.addDish')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {picker && (
        <RecipePicker
          dayLabel={dayLabel(picker.date)}
          meal={picker.meal}
          recipes={recipes}
          labels={labels}
          weekCookEntries={cookEntries}
          onPickRecipe={handlePickRecipe}
          onPickLeftovers={handlePickLeftovers}
          onClose={() => setPicker(null)}
        />
      )}

      {shoppingDishes && (
        <AddToShoppingDialog dishes={shoppingDishes} onClose={() => setShoppingDishes(null)} />
      )}
    </div>
  );
}
