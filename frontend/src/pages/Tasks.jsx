import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { taskInstanceService, taskDefinitionService, memberService } from '../services/api';
import Navbar from '../components/Navbar';
import WeekBoard from '../components/WeekBoard';
import TaskDefinitionForm from '../components/TaskDefinitionForm';
import AddSingleTaskForm from '../components/AddSingleTaskForm';
import { getWeekStart, toISODate, addDays } from '../utils/weekDates';

export default function Tasks() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('calendar'); // 'calendar' | 'config' | 'planning'
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [instances, setInstances] = useState([]);
  const [members, setMembers] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddSingle, setShowAddSingle] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];

  const loadWeek = useCallback(async () => {
    try {
      const response = await taskInstanceService.getRange(toISODate(weekStart), toISODate(weekEnd));
      setInstances(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error loading task instances:', error);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

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

  const handleConfigSaved = () => {
    loadMembers();
    loadDefinitions();
    loadWeek();
  };

  const handleStartPlanning = () => {
    // Plans whichever week is currently open on the calendar -- the "next
    // calendar week by default" behavior belongs only to the automatic
    // weekly planning reminder (WeeklyPlanningConfig), not this button.
    setMode('planning');
  };

  const handleFinishPlanning = () => {
    const unresolved = instances.filter((i) => i.is_in_backlog || !i.assigned_to);
    if (unresolved.length > 0) {
      const confirmed = window.confirm(
        t('weeklyPlanning.finishConfirm', { count: unresolved.length }),
      );
      if (!confirmed) return;
    }
    setWeekStart(getWeekStart(new Date()));
    setMode('calendar');
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    const instance = instances.find((i) => i.id === active.id);
    if (!instance) return;
    try {
      if (over.id === 'backlog') {
        if (!instance.is_in_backlog) await taskInstanceService.moveToBacklog(instance.id);
      } else if (instance.scheduled_date !== over.id || instance.is_in_backlog) {
        await taskInstanceService.postpone(instance.id, over.id);
      } else {
        return;
      }
      loadWeek();
    } catch (error) {
      console.error('Error moving task:', error);
    }
  };

  const handleComplete = async (id) => {
    await taskInstanceService.complete(id);
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

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h2 className="text-3xl font-bold">
            {mode === 'planning' ? t('weeklyPlanning.title') : mode === 'config' ? t('tasks.configTitle') : t('tasks.title')}
          </h2>

          {mode === 'calendar' && (
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">←</button>
              <span className="text-sm text-gray-600">{toISODate(weekStart)} – {toISODate(weekEnd)}</span>
              <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">→</button>
              <button
                onClick={() => setShowAddSingle((v) => !v)}
                className="ml-2 px-3 py-1 rounded bg-gray-800 text-white hover:bg-black"
                title={t('tasks.addSingleTask')}
              >
                +
              </button>
              <button onClick={handleStartPlanning} className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">
                {t('weeklyPlanning.startNow')}
              </button>
              <button onClick={() => setMode('config')} className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600">
                {t('tasks.manageRecurringTasks')}
              </button>
            </div>
          )}

          {mode === 'planning' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{toISODate(weekStart)} – {toISODate(weekEnd)}</span>
              <button
                onClick={() => setShowAddSingle((v) => !v)}
                className="ml-2 px-3 py-1 rounded bg-gray-800 text-white hover:bg-black"
                title={t('tasks.addSingleTask')}
              >
                +
              </button>
              <button onClick={handleFinishPlanning} className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700">
                {t('weeklyPlanning.finish')}
              </button>
            </div>
          )}
        </div>

        {mode === 'config' && (
          <>
            <TaskDefinitionForm members={members} definitions={definitions} onSaved={handleConfigSaved} />
            <div className="flex gap-2">
              <button
                onClick={() => { handleConfigSaved(); setMode('calendar'); }}
                className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-900"
              >
                {t('tasks.configSave')}
              </button>
              <button
                onClick={() => setMode('calendar')}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                {t('tasks.configCancel')}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">{t('tasks.configSaveNote')}</p>
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
              onComplete={handleComplete}
              onSkip={handleSkip}
              onSnooze={handleSnooze}
              onReassign={handleReassign}
              onDragEnd={handleDragEnd}
            />
          </>
        )}
      </main>
    </div>
  );
}
