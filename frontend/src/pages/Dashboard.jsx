import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shoppingService, taskInstanceService, authService } from '../services/api';
import Navbar from '../components/Navbar';
import WeekPreview from '../components/WeekPreview';
import TaskIcon from '../components/icons/taskIcons';
import { getWeekStart, toISODate, addDays } from '../utils/weekDates';

export default function Dashboard() {
  const { t } = useTranslation();
  const [shopping, setShopping] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  const weekStart = getWeekStart(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadData = useCallback(async () => {
    try {
      const [shoppingRes, tasksRes, meRes] = await Promise.all([
        shoppingService.getAll(),
        taskInstanceService.getRange(toISODate(weekStart), toISODate(weekDays[6])),
        authService.getMe(),
      ]);
      setShopping(shoppingRes.data.results || []);
      setTasks(tasksRes.data.results || tasksRes.data || []);
      setCurrentUserId(meRes.data.id);
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
    await taskInstanceService.complete(id);
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
    .filter((task) => task.assigned_to === currentUserId && task.status === 'pending')
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <WeekPreview weekDays={weekDays} instances={tasks} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Shopping Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">{t('dashboard.shoppingListTitle')}</h2>
            <p className="text-gray-600 mb-4">
              {t('dashboard.itemsToBuy', { count: incompleteShopping.length })}
            </p>
            <ul className="space-y-2">
              {incompleteShopping.slice(0, 5).map(item => (
                <li key={item.id} className="text-gray-700">
                  • {item.title}
                </li>
              ))}
            </ul>
            <Link
              to="/shopping"
              className="mt-4 inline-block text-blue-500 hover:text-blue-700 font-medium"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>

          {/* My Open Household Tasks */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">{t('dashboard.myOpenTasks')}</h2>
            {myOpenTasks.length === 0 ? (
              <p className="text-gray-400 text-sm">{t('dashboard.noOpenTasks')}</p>
            ) : (
              <ul className="space-y-2">
                {myOpenTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2 border-l-4 pl-2 py-1"
                    style={{ borderColor: task.assigned_to_color || '#9ca3af' }}
                  >
                    <TaskIcon icon={task.icon} className="text-gray-500 flex-shrink-0" />
                    <span className="flex-1 text-gray-700 text-sm">{task.title}</span>
                    <button
                      onClick={() => handleComplete(task.id)}
                      className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      {t('tasks.complete')}
                    </button>
                    <button
                      onClick={() => handleSnooze(task.id)}
                      className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                    >
                      {t('tasks.snooze')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/tasks"
              className="mt-4 inline-block text-blue-500 hover:text-blue-700 font-medium"
            >
              {t('dashboard.viewAll')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
