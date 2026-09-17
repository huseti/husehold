import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { taskService } from '../services/api';
import Navbar from '../components/Navbar';

export default function Tasks() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const response = await taskService.getAll();
      setTasks(response.data.results || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      await taskService.toggle(id);
      loadTasks();
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('tasks.title')}</h2>

        <div className="bg-white rounded-lg shadow">
          <ul className="divide-y">
            {tasks.map(task => (
              <li key={task.id} className="p-4 flex items-center">
                <input
                  type="checkbox"
                  checked={task.is_completed}
                  onChange={() => handleToggle(task.id)}
                  className="mr-4"
                />
                <div className="flex-1">
                  <p className={task.is_completed ? 'line-through text-gray-400' : ''}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-sm text-gray-600">{task.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
