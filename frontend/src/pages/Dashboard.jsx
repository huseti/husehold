import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  shoppingService, recipeService, cookingPlanEntryService, taskInstanceService, authService, householdSettingsService,
  voucherService,
} from '../services/api';
import Navbar from '../components/Navbar';
import WeekPreview from '../components/WeekPreview';
import OverviewPanel from '../components/OverviewPanel';
import TaskIcon from '../components/icons/taskIcons';
import CookRatingPrompt from '../components/CookRatingPrompt';
import { getDisplayTitle, canSnoozeInstance, getPlanNowPath } from '../utils/taskDisplay';
import { getWeekStart, toISODate, addDays } from '../utils/weekDates';
import { isExpiringSoon } from '../utils/voucherDisplay';

const OVERDUE_LOOKBACK_DAYS = 30;

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [shopping, setShopping] = useState([]);
  const [recipeCount, setRecipeCount] = useState(0);
  const [mealCount, setMealCount] = useState(0);
  const [mealEntries, setMealEntries] = useState([]);
  const [ratingPromptEntry, setRatingPromptEntry] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [householdName, setHouseholdName] = useState('');
  const [loading, setLoading] = useState(true);

  const weekStart = getWeekStart(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayISO = toISODate(new Date());

  const loadData = useCallback(async () => {
    try {
      const fetchStart = addDays(weekStart, -OVERDUE_LOOKBACK_DAYS);
      const [shoppingRes, recipesRes, mealsRes, tasksRes, meRes, settingsRes, vouchersRes] = await Promise.all([
        shoppingService.getAll(),
        recipeService.getAll(),
        cookingPlanEntryService.getRange(toISODate(weekDays[0]), toISODate(weekDays[6])),
        taskInstanceService.getRange(toISODate(fetchStart), toISODate(weekDays[6])),
        authService.getMe(),
        householdSettingsService.get(),
        voucherService.getAll(),
      ]);
      setShopping(shoppingRes.data.results || []);
      setRecipeCount(recipesRes.data.count ?? (recipesRes.data.results || recipesRes.data || []).length);
      const weekMeals = mealsRes.data.results || [];
      setMealEntries(weekMeals);
      // Planned meals this week; leftovers are a re-run of a dish, not another meal to cook.
      setMealCount(weekMeals.filter((entry) => entry.kind !== 'leftovers').length);
      setTasks(tasksRes.data.results || tasksRes.data || []);
      setCurrentUser(meRes.data);
      setHouseholdName(settingsRes.data.household_name);
      setVouchers(vouchersRes.data.results || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleComplete = async (id) => {
    const response = await taskInstanceService.complete(id);
    const cookingEntry = response.data.cooking_entry;
    if (cookingEntry && cookingEntry.recipe && cookingEntry.my_rating === null) setRatingPromptEntry(cookingEntry);
    loadData();
  };

  const handleSkip = async (id) => {
    await taskInstanceService.skip(id);
    loadData();
  };

  const handleSnooze = async (id) => {
    await taskInstanceService.snooze(id);
    loadData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  const incompleteShopping = shopping.filter(item => !item.is_completed);

  const myOpenTasks = tasks
    .filter((task) => task.assigned_to === currentUser?.id && task.status === 'pending' && !task.is_in_backlog)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const overdueTasks = myOpenTasks.filter((task) => task.scheduled_date < todayISO);
  const todayTasks = myOpenTasks.filter((task) => task.scheduled_date === todayISO);
  const thisWeekTasks = myOpenTasks.filter((task) => task.scheduled_date > todayISO);

  const expiringVoucherCount = vouchers.filter(isExpiringSoon).length;

  const householdOverdueCount = tasks.filter(
    (task) => task.status === 'pending' && !task.is_in_backlog && task.scheduled_date < todayISO,
  ).length;


  const renderTaskRow = (task, { overdue = false, today = false } = {}) => {
    const planNowPath = getPlanNowPath(task);
    return (
      <li
        key={task.id}
        className={`flex items-center gap-2 border-l-4 pl-2 py-1 ${overdue ? 'bg-red-50' : ''}`}
        style={{ borderColor: task.assigned_to_color || '#9ca3af' }}
      >
        <TaskIcon icon={task.icon} className="text-gray-500 flex-shrink-0" />
        <span className={`flex-1 text-sm ${overdue ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
          {getDisplayTitle(task, t, i18n)}
          {overdue && <span className="ml-2 text-xs uppercase tracking-wide">{t('dashboard.overdue')}</span>}
          {today && <span className="ml-2 text-xs text-blue-600 uppercase tracking-wide">{t('dashboard.dueToday')}</span>}
        </span>
        {planNowPath && (
          <button
            onClick={() => navigate(planNowPath)}
            className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
          >
            {t('weeklyPlanning.planNow')}
          </button>
        )}
        <button
          onClick={() => handleComplete(task.id)}
          className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
        >
          {t('tasks.complete')}
        </button>
        <button
          onClick={() => handleSkip(task.id)}
          className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
        >
          {t('tasks.skip')}
        </button>
        {canSnoozeInstance(task) && (
          <button
            onClick={() => handleSnooze(task.id)}
            className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
          >
            {t('tasks.snooze')}
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-gray-800">
          {t('dashboard.welcome', { name: currentUser?.first_name || currentUser?.username, household: householdName })}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* My Open Household Tasks */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">{t('dashboard.myOpenTasks')}</h2>
            {myOpenTasks.length === 0 ? (
              <p className="text-gray-400 text-sm">{t('dashboard.noOpenTasks')}</p>
            ) : (
              <ul className="space-y-2">
                {overdueTasks.map((task) => renderTaskRow(task, { overdue: true }))}
                {todayTasks.map((task) => renderTaskRow(task, { today: true }))}
                {thisWeekTasks.map((task) => renderTaskRow(task))}
              </ul>
            )}
            <Link
              to="/tasks"
              className="mt-4 inline-block text-blue-500 hover:text-blue-700 font-medium"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>

          {/* Overview KPIs */}
          <OverviewPanel
            shoppingCount={incompleteShopping.length}
            recipeCount={recipeCount}
            mealCount={mealCount}
            overdueCount={householdOverdueCount}
            expiringVoucherCount={expiringVoucherCount}
          />
        </div>

        <WeekPreview weekDays={weekDays} instances={tasks} meals={mealEntries} />
      </main>
      <CookRatingPrompt entry={ratingPromptEntry} onClose={() => setRatingPromptEntry(null)} />
    </div>
  );
}
