import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { slotKey } from '../utils/mealSlots';
import { getWeekStart, toISODate, addDays, parseISODate } from '../utils/weekDates';

// The weekly meal plan. Two ways in besides the navbar:
//  - the recurring "weekly meal planning" task's "Plan now" (planWeek + planInstance):
//    finishing also ticks that reminder off;
//  - step 1 of the household planning (planWeek + returnTo=household): finishing
//    -- or skipping -- leads back into the household planning, where the freshly
//    created cook tasks can be assigned.
// "Finish plan" creates one cook task per dish and then offers the ingredients
// for the shopping list.
export default function CookingPlan() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => {
    const planWeek = searchParams.get('planWeek');
    return planWeek ? parseISODate(planWeek) : getWeekStart(new Date());
  });
  const [planInstanceId, setPlanInstanceId] = useState(() => {
    const id = searchParams.get('planInstance');
    return id ? Number(id) : null;
  });
  // Set when this page is step 1 of the household planning.
  const [householdReturn, setHouseholdReturn] = useState(() => (
    searchParams.get('returnTo') === 'household'
      ? { instanceId: searchParams.get('householdInstance') || '' }
      : null
  ));
  const [entries, setEntries] = useState([]);
  const [config, setConfig] = useState(null);
  const [meals, setMeals] = useState([]);
  const [labels, setLabels] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picker, setPicker] = useState(null); // { date, meal }
  const [shoppingDishes, setShoppingDishes] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState(null); // { text, showHouseholdLink, error }

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

  // Dishes that get a cook task: recipes and free dishes (leftovers don't).
  const dishEntries = entries.filter((e) => e.kind !== 'leftovers');
  const draftCount = dishEntries.filter((e) => !e.task_instance).length;

  // Leftovers can only be planned after their dish, so the picker offers just
  // the dishes that come earlier than the slot being filled.
  const leftoverSources = picker
    ? dishEntries.filter((entry) => {
      const entryMeal = meals.find((m) => m.id === entry.meal_category);
      return entryMeal && slotKey(entry.date, entryMeal) < slotKey(picker.date, picker.meal);
    })
    : [];

  const dayLabel = (iso) => parseISODate(iso).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'short' });
  const rangeLabel = `${parseISODate(rangeStart).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })} – ${parseISODate(rangeEnd).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}`;

  const goBackToHousehold = () => {
    const instance = householdReturn.instanceId ? `&planInstance=${householdReturn.instanceId}` : '';
    navigate(`/tasks?planWeek=${rangeStart}${instance}&cookingDone=1`);
  };

  // The three mutations below resolve to null on success, or to the API's error
  // body, so the entry card can say why something was refused (e.g. leftovers
  // planned before their dish).
  const attempt = async (action, errorMessage) => {
    try {
      await action();
      return null;
    } catch (error) {
      console.error(errorMessage, error);
      return error.response?.data ?? {};
    }
  };

  const handleUpdate = async (id, data) => {
    const error = await attempt(() => cookingPlanEntryService.update(id, data), 'Error updating entry:');
    await loadEntries();
    return error;
  };

  const handleDelete = async (id) => {
    await attempt(() => cookingPlanEntryService.delete(id), 'Error deleting entry:');
    await loadEntries();
  };

  const handleAddLeftovers = async (source, date, mealCategory) => {
    const error = await attempt(() => cookingPlanEntryService.create({
      date, meal_category: mealCategory, kind: 'leftovers', source_entry: source.id,
    }), 'Error adding leftovers:');
    await loadEntries();
    return error;
  };

  const handlePickRecipe = async (recipe) => {
    await attempt(() => cookingPlanEntryService.create({
      date: picker.date, meal_category: picker.meal.id, recipe: recipe.id, servings: recipe.servings,
    }), 'Error adding dish:');
    setPicker(null);
    await Promise.all([loadEntries(), loadRecipes()]);
  };

  const handlePickFree = async (title) => {
    await attempt(() => cookingPlanEntryService.create({
      date: picker.date, meal_category: picker.meal.id, kind: 'free', title,
    }), 'Error adding free dish:');
    setPicker(null);
    await loadEntries();
  };

  const handlePickLeftovers = async (source) => {
    const error = await handleAddLeftovers(source, picker.date, picker.meal.id);
    setPicker(null);
    if (error) setNotice({ text: t('cookingPlan.leftoversOrderError'), error: true });
  };

  const closeShopping = () => {
    setShoppingDishes(null);
    if (householdReturn) goBackToHousehold();
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
        showHouseholdLink: response.data.created > 0 && !householdReturn,
      });
      await loadEntries();

      // Every dish that still has to be made: which of its ingredients (and
      // which dishes) are actually needed on the shopping list?
      const preview = await cookingPlanEntryService.shoppingPreview(rangeStart, rangeEnd);
      if (preview.data.length > 0) setShoppingDishes(preview.data);
      else if (householdReturn) goBackToHousehold();
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

        {householdReturn && (
          <div className="bg-purple-50 text-purple-800 rounded-lg px-4 py-3 mb-4 text-sm flex flex-wrap items-center gap-3">
            <span className="flex-1">{t('cookingPlan.householdStepBanner', { range: rangeLabel })}</span>
            <button onClick={goBackToHousehold} className="bg-white text-purple-800 border border-purple-300 px-3 py-1 rounded hover:bg-purple-100">
              {t('cookingPlan.skipToHousehold')}
            </button>
          </div>
        )}

        {planInstanceId && !householdReturn && (
          <div className="bg-purple-50 text-purple-800 rounded-lg px-4 py-2 mb-4 text-sm">
            {t('cookingPlan.planningBanner', { range: rangeLabel })}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={handleFinish} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
            {draftCount > 0 ? t('cookingPlan.finishWithCount', { count: draftCount }) : t('cookingPlan.finish')}
          </button>
          <button onClick={() => setShowSettings((v) => !v)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
            {t('cookingPlan.settings')}
          </button>
        </div>

        {notice && (
          <p className={`text-sm mb-4 ${notice.error ? 'text-red-600' : 'text-green-700'}`}>
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
                              allMeals={meals}
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
          weekCookEntries={dishEntries.filter((e) => e.recipe)}
          leftoverSources={leftoverSources}
          onPickRecipe={handlePickRecipe}
          onPickLeftovers={handlePickLeftovers}
          onPickFree={handlePickFree}
          onClose={() => setPicker(null)}
        />
      )}

      {shoppingDishes && (
        <AddToShoppingDialog dishes={shoppingDishes} onClose={closeShopping} onDone={() => {}} />
      )}
    </div>
  );
}
