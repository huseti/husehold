import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shoppingService } from '../services/api';

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const response = await shoppingService.getAll();
      setItems(response.data.results || []);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await shoppingService.create({ title, description });
      setTitle('');
      setDescription('');
      loadItems();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleToggle = async (id) => {
    try {
      await shoppingService.toggle(id);
      loadItems();
    } catch (error) {
      console.error('Error toggling item:', error);
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
            <Link to="/recipes" className="text-gray-600 hover:text-gray-900">Recipes</Link>
            <Link to="/cooking-plan" className="text-gray-600 hover:text-gray-900">Cooking Plan</Link>
            <Link to="/tasks" className="text-gray-600 hover:text-gray-900">Tasks</Link>
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Shopping List</h2>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Add Item</h3>
          <form onSubmit={handleAddItem} className="space-y-4">
            <input
              type="text"
              placeholder="Item name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Add Item
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow">
          <ul className="divide-y">
            {items.map(item => (
              <li key={item.id} className="p-4 flex items-center">
                <input
                  type="checkbox"
                  checked={item.is_completed}
                  onChange={() => handleToggle(item.id)}
                  className="mr-4"
                />
                <div className="flex-1">
                  <p className={item.is_completed ? 'line-through text-gray-400' : ''}>
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-sm text-gray-600">{item.description}</p>
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
