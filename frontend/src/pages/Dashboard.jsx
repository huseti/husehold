import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { shoppingService, taskService } from '../services/api';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const { t } = useTranslation();
  const [shopping, setShopping] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [shoppingRes, tasksRes] = await Promise.all([
        shoppingService.getAll(),
        taskService.getAll(),
      ]);
      setShopping(shoppingRes.data.results || []);
      setTasks(tasksRes.data.results || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  const incompleteShopping = shopping.filter(item => !item.is_completed);
  const incompleteTasks = tasks.filter(task => !task.is_completed);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
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

          {/* Tasks Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">{t('dashboard.tasksTitle')}</h2>
            <p className="text-gray-600 mb-4">
              {t('dashboard.tasksPending', { count: incompleteTasks.length })}
            </p>
            <ul className="space-y-2">
              {incompleteTasks.slice(0, 5).map(task => (
                <li key={task.id} className="text-gray-700">
                  • {task.title}
                </li>
              ))}
            </ul>
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
