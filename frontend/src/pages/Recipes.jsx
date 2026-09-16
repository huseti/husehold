import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { recipeService } from '../services/api';

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const response = await recipeService.getAll();
      setRecipes(response.data.results || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
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
            <Link to="/cooking-plan" className="text-gray-600 hover:text-gray-900">Cooking Plan</Link>
            <Link to="/tasks" className="text-gray-600 hover:text-gray-900">Tasks</Link>
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Recipes</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recipes.map(recipe => (
            <div key={recipe.id} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-2">{recipe.title}</h3>
              <p className="text-gray-600 mb-4">{recipe.description}</p>
              <div className="space-y-2 text-sm text-gray-600">
                {recipe.prep_time && <p>Prep time: {recipe.prep_time} min</p>}
                {recipe.cook_time && <p>Cook time: {recipe.cook_time} min</p>}
                <p>Servings: {recipe.servings}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
