import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { taskService } from '../services/api';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-gray-800">HUSEHOLD</Link>
          <div className="space-x-4 flex items-center">
            <Link to="/" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link to="/shopping" className="text-gray-600 hover:text-gray-900">Shopping</Link>
            <Link to="/recipes" className="text-gray-600 hover:text-gray-900">Recipes</Link>
            <Link to="/cooking-plan" className="text-gray-600 hover:text-gray-900">Cooking Plan</Link>
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Tasks</h2>

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
