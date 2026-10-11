import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  shoppingService, recipeService, cookingPlanEntryService, taskInstanceService, authService, householdSettingsService,
  voucherService, memberService, packingListService, calendarEventService,
} from '../services/api';
import Navbar from '../components/Navbar';
import WeekPreview from '../components/WeekPreview';
import OverviewPanel from '../components/OverviewPanel';
import TasksPanel from '../components/TasksPanel';
import ProgressPanel from '../components/ProgressPanel';
import TodaysMealsPanel from '../components/TodaysMealsPanel';
import CookRatingPrompt from '../components/CookRatingPrompt';
import { getWeekStart, toISODate, addDays } from '../utils/weekDates';
import { isExpiringSoon } from '../utils/voucherDisplay';

const OVERDUE_LOOKBACK_DAYS = 30;

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [shopping, setShopping] = useState([]);
  const [recipeCount, setRecipeCount] = useState(0);
  const [mealCount, setMealCount] = useState(0);
  const [mealEntries, setMealEntries] = useState([]);
  const [ratingPromptEntry, setRatingPromptEntry] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [packingLists, setPackingLists] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [householdName, setHouseholdName] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  // Week shown in the "This week" preview, relative to the current week. Other
  // weeks are fetched separately so KPIs/today's meals keep referring to now.
  const [weekOffset, setWeekOffset] = useState(0);
  const [otherWeek, setOtherWeek] = useState(null);

  const weekStart = getWeekStart(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const previewDays = weekDays.map((day) => addDays(day, 7 * weekOffset));
  const todayISO = toISODate(new Date());

  const loadData = useCallback(async () => {
    try {
      const fetchStart = addDays(weekStart, -OVERDUE_LOOKBACK_DAYS);
      const [shoppingRes, recipesRes, mealsRes, tasksRes, meRes, settingsRes, vouchersRes, membersRes, packingListsRes, calendarEventsRes] = await Promise.all([
        shoppingService.getAll(),
        recipeService.getAll(),
        cookingPlanEntryService.getRange(toISODate(weekDays[0]), toISODate(weekDays[6])),
        taskInstanceService.getRange(toISODate(fetchStart), toISODate(weekDays[6])),
        authService.getMe(),
        householdSettingsService.get(),
        voucherService.getAll(),
        memberService.getAll(),
        packingListService.getAll(),
        calendarEventService.getRange(toISODate(weekDays[0]), toISODate(weekDays[6])),
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
      setMembers(membersRes.data.results || membersRes.data || []);
      setPackingLists(packingListsRes.data.results || []);
      setCalendarEvents(calendarEventsRes.data.results || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (weekOffset === 0) {
      setOtherWeek(null);
      return undefined;
    }
    let cancelled = false;
    const start = toISODate(addDays(weekStart, 7 * weekOffset));
    const end = toISODate(addDays(weekStart, 7 * weekOffset + 6));
    Promise.all([
      taskInstanceService.getRange(start, end),
      cookingPlanEntryService.getRange(start, end),
      calendarEventService.getRange(start, end),
    ]).then(([tasksRes, mealsRes, eventsRes]) => {
      if (cancelled) return;
      setOtherWeek({
        instances: tasksRes.data.results || tasksRes.data || [],
        meals: mealsRes.data.results || [],
        events: eventsRes.data.results || [],
      });
    }).catch((error) => console.error('Error loading week:', error));
    return () => { cancelled = true; };
  }, [weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const upcomingPackingListCount = packingLists.filter((list) => list.end_date >= todayISO).length;

  const householdOverdueTasks = tasks
    .filter((task) => task.status === 'pending' && !task.is_in_backlog && task.scheduled_date < todayISO)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const householdOverdueCount = householdOverdueTasks.length;
  const otherOverdueTasks = householdOverdueTasks.filter((task) => task.assigned_to !== currentUser?.id);

  const weekStartISO = toISODate(weekDays[0]);
  const weekEndISO = toISODate(weekDays[6]);
  const weekTasks = tasks.filter(
    (task) => !task.is_in_backlog && task.scheduled_date >= weekStartISO && task.scheduled_date <= weekEndISO
      && task.status !== 'skipped' && task.status !== 'snoozed',
  );
  const weekDone = weekTasks.filter((task) => task.status === 'done').length;
  const weekTotal = weekTasks.length;

  const todaysMeals = mealEntries.filter((entry) => entry.date === todayISO);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />

      {/* One flat grid so `order` can resequence panels on mobile (tasks, today's
          meals, progress, week, KPIs) without changing the desktop layout. */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <h1 className="order-first md:col-span-2 text-xl md:text-2xl font-bold">
          {t('dashboard.welcome', { name: currentUser?.first_name || currentUser?.username })}{' '}
          {/* Own line on mobile, same line from md up */}
          <span className="block md:inline">{t('dashboard.welcomeUpcoming', { household: householdName })}</span>
        </h1>

        <div className="order-4 md:order-1 md:col-span-2">
          <WeekPreview
            weekDays={previewDays}
            instances={weekOffset === 0 ? tasks : otherWeek?.instances || []}
            meals={weekOffset === 0 ? mealEntries : otherWeek?.meals || []}
            calendarEvents={weekOffset === 0 ? calendarEvents : otherWeek?.events || []}
            isCurrentWeek={weekOffset === 0}
            onPrev={() => setWeekOffset((o) => o - 1)}
            onNext={() => setWeekOffset((o) => o + 1)}
            onCurrent={() => setWeekOffset(0)}
          />
        </div>

        <div className="order-1 md:order-2 [&>*]:h-full">
          <TasksPanel
            overdueTasks={overdueTasks}
            todayTasks={todayTasks}
            thisWeekTasks={thisWeekTasks}
            otherOverdueTasks={otherOverdueTasks}
            members={members}
            onComplete={handleComplete}
            onSkip={handleSkip}
            onSnooze={handleSnooze}
            navigate={navigate}
          />
        </div>

        <div className="order-5 md:order-3">
          <OverviewPanel
            shoppingCount={incompleteShopping.length}
            recipeCount={recipeCount}
            mealCount={mealCount}
            overdueCount={householdOverdueCount}
            expiringVoucherCount={expiringVoucherCount}
            upcomingPackingListCount={upcomingPackingListCount}
          />
        </div>

        <div className="order-3 md:order-4 [&>*]:h-full">
          <ProgressPanel weekDone={weekDone} weekTotal={weekTotal} members={members} weekTasks={weekTasks} />
        </div>

        <div className="order-2 md:order-5 [&>*]:h-full">
          <TodaysMealsPanel meals={todaysMeals} members={members} onMarkCooked={handleComplete} />
        </div>
      </main>
      <CookRatingPrompt entry={ratingPromptEntry} onClose={() => setRatingPromptEntry(null)} />
    </div>
  );
}
