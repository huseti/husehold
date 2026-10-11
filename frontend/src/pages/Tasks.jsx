import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { taskInstanceService, taskDefinitionService, memberService, calendarEventService } from '../services/api';
import Navbar from '../components/Navbar';
import WeekBoard from '../components/WeekBoard';
import TaskDefinitionForm from '../components/TaskDefinitionForm';
import AddSingleTaskForm from '../components/AddSingleTaskForm';
import CookRatingPrompt from '../components/CookRatingPrompt';
import CookingStepModal from '../components/CookingStepModal';
import UndoToast from '../components/UndoToast';
import { getDisplayTitle } from '../utils/taskDisplay';
import GearIcon from '../components/icons/gearIcon';
import { getWeekStart, toISODate, addDays, parseISODate } from '../utils/weekDates';
import { BackArrow, NextArrow, PrevArrow } from '../components/icons/uiIcons';

export default function Tasks() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Set when arriving here via a weekly-planning task's "Plan now" button
  // (Dashboard or the calendar itself) -- lets Finish Planning mark that
  // specific reminder instance as done instead of just returning to the
  // calendar with nothing resolved.
  const [planningSourceInstanceId, setPlanningSourceInstanceId] = useState(null);
  const [mode, setMode] = useState('calendar'); // 'calendar' | 'config' | 'planning'
  const [weekStart, setWeekStart] = useState(() => {
    const planWeek = searchParams.get('planWeek');
    return planWeek ? parseISODate(planWeek) : getWeekStart(new Date());
  });
  const [instances, setInstances] = useState([]);
  const [members, setMembers] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddSingle, setShowAddSingle] = useState(false);
  // A just-cooked dish the current user hasn't rated yet -- see CookRatingPrompt.
  const [ratingPromptEntry, setRatingPromptEntry] = useState(null);
  // Step 1 of every household planning: the cooking plan for the same week.
  const [showCookingStep, setShowCookingStep] = useState(false);
  // Confirmation + undo after moving a task to another day (see handleMove).
  const [moveToast, setMoveToast] = useState(null);
  const closeMoveToast = useCallback(() => setMoveToast(null), []);

  useEffect(() => {
    const planWeek = searchParams.get('planWeek');
    const planInstance = searchParams.get('planInstance');
    if (planWeek) {
      setWeekStart(parseISODate(planWeek));
      setMode('planning');
      if (planInstance) setPlanningSourceInstanceId(Number(planInstance));
      // Coming back from the cooking plan (cookingDone) means step 1 is behind us.
      if (!searchParams.get('cookingDone')) setShowCookingStep(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thisWeekStart = getWeekStart(new Date());
  const nextWeekStart = addDays(thisWeekStart, 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];
  const canPlanThisWeek = toISODate(weekStart) === toISODate(thisWeekStart) || toISODate(weekStart) === toISODate(nextWeekStart);

  const loadWeek = useCallback(async () => {
    try {
      // Planning mode fetches from the start of the *actual* current week
      // (not just the week being planned) so carried-over backlog items
      // from an earlier, still-open week show up as their own bucket.
      const fetchStart = mode === 'planning' ? thisWeekStart : weekStart;
      const response = await taskInstanceService.getRange(toISODate(fetchStart), toISODate(weekEnd));
      setInstances(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error loading task instances:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, mode]);

  const loadMembers = async () => {
    try {
      const response = await memberService.getAll();
      setMembers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    }
  };

  const loadDefinitions = async () => {
    try {
      const response = await taskDefinitionService.getAll();
      setDefinitions(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error loading task definitions:', error);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    loadMembers();
    loadDefinitions();
  }, []);

  useEffect(() => {
    calendarEventService.getRange(toISODate(weekDays[0]), toISODate(weekDays[6]))
      .then((response) => setCalendarEvents(response.data.results || []))
      .catch((error) => console.error('Error loading calendar events:', error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toISODate(weekDays[0]), toISODate(weekDays[6])]);

  const handleConfigSaved = () => {
    loadMembers();
    loadDefinitions();
    loadWeek();
  };

  const handleStartPlanning = () => {
    if (!canPlanThisWeek) return;
    setMode('planning');
    setShowCookingStep(true);
  };

  const openCookingPlan = () => {
    const instance = planningSourceInstanceId ? `&householdInstance=${planningSourceInstanceId}` : '';
    navigate(`/cooking-plan?planWeek=${toISODate(weekStart)}&returnTo=household${instance}`);
  };

  const handleFinishPlanning = async () => {
    const unresolved = instances.filter((i) => i.is_in_backlog || !i.assigned_to);
    if (unresolved.length > 0) {
      const confirmed = window.confirm(
        t('weeklyPlanning.finishConfirm', { count: unresolved.length }),
      );
      if (!confirmed) return;
    }
    if (planningSourceInstanceId) {
      await taskInstanceService.complete(planningSourceInstanceId);
      setPlanningSourceInstanceId(null);
    }
    setWeekStart(getWeekStart(new Date()));
    setMode('calendar');
  };

  const handleCancelPlanning = () => {
    setPlanningSourceInstanceId(null);
    setWeekStart(getWeekStart(new Date()));
    setMode('calendar');
  };

  // Moves a task to a day (ISO date) or, with targetISO = null, to the
  // backlog. Shared by drag & drop and the day chips on each card.
  const moveTask = async (instanceId, targetISO) => {
    try {
      if (targetISO === null) await taskInstanceService.moveToBacklog(instanceId);
      else await taskInstanceService.postpone(instanceId, targetISO);
      loadWeek();
      return true;
    } catch (error) {
      console.error('Error moving task:', error);
      // A cook task can't be moved behind the leftovers planned from it.
      if (error.response?.data?.leftovers) window.alert(t('cookingPlan.leftoversOrderError'));
      return false;
    }
  };

  const handleMove = async (instance, targetISO) => {
    const fromISO = instance.is_in_backlog ? null : instance.scheduled_date;
    if (targetISO === fromISO) return;
    if (!(await moveTask(instance.id, targetISO))) return;
    const title = getDisplayTitle(instance, t, i18n);
    const message = targetISO === null
      ? t('tasks.movedToBacklog', { title })
      : t('tasks.movedToDay', {
        title,
        day: parseISODate(targetISO).toLocaleDateString(i18n.resolvedLanguage, { weekday: 'long' }),
      });
    setMoveToast({ message, instanceId: instance.id, fromISO });
  };

  const handleUndoMove = async () => {
    const { instanceId, fromISO } = moveToast;
    setMoveToast(null);
    await moveTask(instanceId, fromISO);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const instance = instances.find((i) => i.id === active.id);
    if (!instance) return;
    const isBacklogLane = over.id === 'backlog' || over.id === 'backlog-a' || over.id === 'backlog-b';
    handleMove(instance, isBacklogLane ? null : over.id);
  };

  const handleComplete = async (id) => {
    const response = await taskInstanceService.complete(id);
    const cookingEntry = response.data.cooking_entry;
    // A free dish (no recipe) has nothing to rate.
    if (cookingEntry && cookingEntry.recipe && cookingEntry.my_rating === null) setRatingPromptEntry(cookingEntry);
    loadWeek();
  };

  const handleSkip = async (id) => {
    await taskInstanceService.skip(id);
    loadWeek();
  };

  const handleSnooze = async (id) => {
    await taskInstanceService.snooze(id);
    loadWeek();
  };

  const handleReassign = async (id, assignedTo) => {
    await taskInstanceService.reassign(id, assignedTo);
    loadWeek();
  };

  const handleReopen = async (id) => {
    await taskInstanceService.reopen(id);
    loadWeek();
  };

  const handleDeleteInstance = async (id) => {
    await taskInstanceService.delete(id);
    loadWeek();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {mode === 'config' && (
          <button
            onClick={() => setMode('calendar')}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4"
          >
            <BackArrow /> {t('common.back')}
          </button>
        )}

        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <h2 className="text-3xl font-bold">
              {mode === 'planning' ? t('weeklyPlanning.title') : mode === 'config' ? t('tasks.configTitle') : t('tasks.title')}
            </h2>
            {mode === 'calendar' && (
              <button
                onClick={() => setMode('config')}
                className="text-gray-500 hover:text-gray-800 text-xl p-2"
                title={t('common.configure')}
                aria-label={t('common.configure')}
              >
                <GearIcon />
              </button>
            )}
          </div>

          {mode === 'calendar' && (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-3 py-1 rounded btn-secondary hover:bg-gray-300"><PrevArrow /></button>
              <span className="text-sm text-gray-600">{toISODate(weekStart)} – {toISODate(weekEnd)}</span>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-3 py-1 rounded btn-secondary hover:bg-gray-300"><NextArrow /></button>
              <button
                onClick={() => setShowAddSingle((v) => !v)}
                className="px-3 py-1 rounded btn-secondary hover:bg-gray-300"
              >
                + {t('tasks.addManualTask')}
              </button>
              <button
                onClick={handleStartPlanning}
                disabled={!canPlanThisWeek}
                title={canPlanThisWeek ? undefined : t('weeklyPlanning.onlyThisOrNextWeek')}
                className={`px-3 py-1 rounded text-white ${canPlanThisWeek ? 'btn-primary dark:hover:bg-eucalyptus-600' : 'bg-gray-300 cursor-not-allowed'}`}
              >
                {t('weeklyPlanning.startNow')}
              </button>
            </div>
          )}

          {mode === 'planning' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">{toISODate(weekStart)} – {toISODate(weekEnd)}</span>
              <button
                onClick={() => setShowAddSingle((v) => !v)}
                className="px-3 py-1 rounded btn-secondary hover:bg-gray-300"
              >
                + {t('tasks.addManualTask')}
              </button>
              <button onClick={handleFinishPlanning} className="px-3 py-1 rounded btn-primary text-white dark:hover:bg-eucalyptus-600">
                {t('weeklyPlanning.finish')}
              </button>
              <button onClick={handleCancelPlanning} className="px-3 py-1 rounded btn-secondary hover:bg-gray-300">
                {t('weeklyPlanning.cancel')}
              </button>
            </div>
          )}
        </div>

        {mode === 'config' && (
          <>
            <TaskDefinitionForm members={members} definitions={definitions} onSaved={handleConfigSaved} />
          </>
        )}

        {(mode === 'calendar' || mode === 'planning') && (
          <>
            {showAddSingle && (
              <AddSingleTaskForm
                weekDays={weekDays}
                members={members}
                onClose={() => setShowAddSingle(false)}
                onAdded={loadWeek}
              />
            )}
            <WeekBoard
              weekDays={weekDays}
              instances={instances}
              members={members}
              calendarEvents={calendarEvents}
              onComplete={handleComplete}
              onSkip={handleSkip}
              onSnooze={handleSnooze}
              onReassign={handleReassign}
              onReopen={handleReopen}
              onDelete={handleDeleteInstance}
              onDragEnd={handleDragEnd}
              onMove={handleMove}
              planningWeekStart={mode === 'planning' ? weekStart : undefined}
            />
          </>
        )}
      </main>
      <CookRatingPrompt entry={ratingPromptEntry} onClose={() => setRatingPromptEntry(null)} />
      <UndoToast toast={moveToast} onUndo={handleUndoMove} onClose={closeMoveToast} />
      {mode === 'planning' && showCookingStep && (
        <CookingStepModal
          weekStart={weekStart}
          onOpenCookingPlan={openCookingPlan}
          onSkip={() => setShowCookingStep(false)}
        />
      )}
    </div>
  );
}
