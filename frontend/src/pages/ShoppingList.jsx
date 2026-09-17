import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { shoppingService } from '../services/api';
import Navbar from '../components/Navbar';

export default function ShoppingList() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('shoppingList.title')}</h2>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">{t('shoppingList.addItemTitle')}</h3>
          <form onSubmit={handleAddItem} className="space-y-4">
            <input
              type="text"
              placeholder={t('shoppingList.itemNamePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
            <textarea
              placeholder={t('shoppingList.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {t('shoppingList.addButton')}
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
