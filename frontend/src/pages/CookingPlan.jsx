import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cookingPlanService } from '../services/api';

export default function CookingPlan() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await cookingPlanService.getAll();
      setPlans(response.data.results || []);
    } catch (error) {
      console.error('Error loading plans:', error);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-gray-800">HUSEHOLD</Link>
          <div className="space-x-4 flex items-center">
            <Link to="/" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link to="/shopping" className="text-gray-600 hover:text-gray-900">Shopping</Link>
            <Link to="/recipes" className="text-gray-600 hover:text-gray-900">Recipes</Link>
            <Link to="/tasks" className="text-gray-600 hover:text-gray-900">Tasks</Link>
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Cooking Plan</h2>
        <p className="text-gray-600">Coming soon...</p>
      </main>
    </div>
  );
}
