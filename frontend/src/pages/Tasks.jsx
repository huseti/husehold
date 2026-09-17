import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext } from '@dnd-kit/core';
import { taskInstanceService, taskDefinitionService, memberService } from '../services/api';
import Navbar from '../components/Navbar';
import TaskDayColumn from '../components/TaskDayColumn';
import TaskDefinitionForm from '../components/TaskDefinitionForm';

// Monday-first week, matching the "once a week, plan the coming week" workflow.
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export default function Tasks() {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [instances, setInstances] = useState([]);
  const [members, setMembers] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

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

  const handleStartPlanningNow = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;
    const instance = instances.find((i) => i.id === active.id);
    if (!instance || instance.scheduled_date === over.id) return;
    try {
      await taskInstanceService.postpone(instance.id, over.id);
      loadWeek();
    } catch (error) {
      console.error('Error postponing task:', error);
    }
  };

  const handleComplete = async (id) => {
    await taskInstanceService.complete(id);
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
          <h2 className="text-3xl font-bold">{t('tasks.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            >
              ←
            </button>
            <span className="text-sm text-gray-600">
              {toISODate(weekStart)} – {toISODate(weekEnd)}
            </span>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            >
              →
            </button>
            <button
              onClick={handleStartPlanningNow}
              className="ml-4 px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
            >
              {t('weeklyPlanning.startNow')}
            </button>
            <button
              onClick={() => setShowConfig((v) => !v)}
              className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              {t('tasks.manageRecurringTasks')}
            </button>
          </div>
        </div>

        {showConfig && (
          <TaskDefinitionForm
            members={members}
            definitions={definitions}
            onSaved={handleConfigSaved}
          />
        )}

        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const iso = toISODate(day);
              const dayInstances = instances.filter((i) => i.scheduled_date === iso);
              return (
                <TaskDayColumn
                  key={iso}
                  date={day}
                  dateISO={iso}
                  instances={dayInstances}
                  members={members}
                  onComplete={handleComplete}
                  onSnooze={handleSnooze}
                  onReassign={handleReassign}
                />
              );
            })}
          </div>
        </DndContext>
      </main>
    </div>
  );
}
