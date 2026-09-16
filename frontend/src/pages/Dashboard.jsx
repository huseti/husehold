import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shoppingService, taskService } from '../services/api';

export default function Dashboard() {
  const [shopping, setShopping] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const incompleteShopping = shopping.filter(item => !item.is_completed);
  const incompleteTasks = tasks.filter(task => !task.is_completed);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">HUSEHOLD</h1>
          <div className="space-x-4 flex items-center">
            <Link to="/shopping" className="text-gray-600 hover:text-gray-900">Shopping</Link>
            <Link to="/recipes" className="text-gray-600 hover:text-gray-900">Recipes</Link>
            <Link to="/cooking-plan" className="text-gray-600 hover:text-gray-900">Cooking Plan</Link>
            <Link to="/tasks" className="text-gray-600 hover:text-gray-900">Tasks</Link>
            <Link to="/settings" className="text-gray-600 hover:text-gray-900">Settings</Link>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Shopping Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Shopping List</h2>
            <p className="text-gray-600 mb-4">
              {incompleteShopping.length} items to buy
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
              View all →
            </Link>
          </div>

          {/* Tasks Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Tasks</h2>
            <p className="text-gray-600 mb-4">
              {incompleteTasks.length} tasks pending
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
              View all →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
