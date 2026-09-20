import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  shoppingService, shoppingListService, unitService, ingredientService, memberService,
} from '../services/api';
import Navbar from '../components/Navbar';
import { unitLabel } from '../utils/localized';

const emptyItem = { title: '', quantity: '', unit: '' };

export default function ShoppingList() {
  const { t, i18n } = useTranslation();
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [ingredientNames, setIngredientNames] = useState([]);
  const [members, setMembers] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const [itemForm, setItemForm] = useState(emptyItem);
  const [newListName, setNewListName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [listName, setListName] = useState('');

  const selected = lists.find((l) => l.id === selectedId) || null;

  useEffect(() => {
    const init = async () => {
      try {
        const [listRes, unitRes, ingredientRes, memberRes, meRes] = await Promise.all([
          shoppingListService.getAll(), unitService.getAll(), ingredientService.getAll(),
          memberService.getAll(), memberService.getMe(),
        ]);
        const loaded = listRes.data.results || [];
        setLists(loaded);
        setSelectedId((loaded.find((l) => l.is_favorite_for_cooking_plan) || loaded[0])?.id ?? null);
        setUnits(unitRes.data.results || []);
        setIngredientNames((ingredientRes.data.results || []).map((i) => i.name));
        setMembers(memberRes.data.results || []);
        setMe(meRes.data.user);
      } catch (error) {
        console.error('Error loading shopping data:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      setItems([]);
      return;
    }
    shoppingService.getAll(selectedId)
      .then((res) => setItems(res.data.results || []))
      .catch((error) => console.error('Error loading items:', error));
  }, [selectedId]);

  useEffect(() => {
    setListName(selected?.name ?? '');
  }, [selected?.name]);

  const reloadLists = async () => {
    const res = await shoppingListService.getAll();
    setLists(res.data.results || []);
    return res.data.results || [];
  };

  const reloadItems = async () => {
    const [itemRes] = await Promise.all([shoppingService.getAll(selectedId), reloadLists()]);
    setItems(itemRes.data.results || []);
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    try {
      const res = await shoppingListService.create({ name: newListName });
      setNewListName('');
      await reloadLists();
      setSelectedId(res.data.id);
    } catch (error) {
      console.error('Error creating list:', error);
    }
  };

  const updateList = async (changes) => {
    try {
      await shoppingListService.update(selectedId, changes);
      await reloadLists();
    } catch (error) {
      console.error('Error updating list:', error);
    }
  };

  const handleDeleteList = async () => {
    if (!window.confirm(t('shoppingList.confirmDeleteList', { name: selected.name }))) return;
    try {
      await shoppingListService.delete(selectedId);
      const remaining = await reloadLists();
      setShowSettings(false);
      setSelectedId(remaining[0]?.id ?? null);
    } catch (error) {
      console.error('Error deleting list:', error);
    }
  };

  const toggleMember = (userId) => {
    const current = selected.visible_to;
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    // Un-ticking the last member would silently flip the list back to
    // "everyone"; keep at least the editor on it instead.
    updateList({ visible_to: next.length ? next : [me.id] });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await shoppingService.create({
        shopping_list: selectedId,
        title: itemForm.title,
        quantity: itemForm.quantity === '' ? null : itemForm.quantity,
        unit: itemForm.unit === '' ? null : Number(itemForm.unit),
      });
      setItemForm(emptyItem);
      reloadItems();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleToggle = async (id) => {
    try {
      await shoppingService.toggle(id);
      reloadItems();
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      await shoppingService.delete(id);
      reloadItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleClearCompleted = async () => {
    try {
      await shoppingListService.clearCompleted(selectedId);
      reloadItems();
    } catch (error) {
      console.error('Error clearing completed items:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  const hasCompleted = items.some((i) => i.is_completed);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">{t('shoppingList.title')}</h2>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => { setSelectedId(list.id); setShowSettings(false); }}
              className={`px-4 py-2 rounded-full text-sm border ${list.id === selectedId ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
              {list.is_favorite_for_cooking_plan && <span className="text-amber-400 mr-1">★</span>}
              {list.name}
              {list.open_item_count > 0 && <span className="ml-2 opacity-70">{list.open_item_count}</span>}
            </button>
          ))}
          <form onSubmit={handleCreateList} className="flex gap-2">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder={t('shoppingList.newListPlaceholder')}
              className="px-3 py-2 border border-gray-300 rounded-full text-sm w-40"
              required
            />
            <button type="submit" className="bg-green-600 text-white px-3 py-2 rounded-full text-sm hover:bg-green-700">+</button>
          </form>
        </div>

        {!selected && <p className="text-gray-500">{t('shoppingList.noLists')}</p>}

        {selected && (
          <>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold">{selected.name}</h3>
              <button onClick={() => setShowSettings((v) => !v)} className="text-sm text-blue-600">
                {t('shoppingList.listSettings')}
              </button>
            </div>

            {showSettings && (
              <div className="bg-white rounded-lg shadow p-5 mb-6 space-y-4">
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  onBlur={() => listName.trim() && listName !== selected.name && updateList({ name: listName })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.is_favorite_for_cooking_plan}
                    onChange={(e) => updateList({ is_favorite_for_cooking_plan: e.target.checked })}
                  />
                  {t('shoppingList.favoriteLabel')}
                </label>
                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.visible_to.length > 0}
                      onChange={(e) => updateList({ visible_to: e.target.checked ? [me.id] : [] })}
                    />
                    {t('shoppingList.restrictVisibility')}
                  </label>
                  {selected.visible_to.length > 0 && (
                    <div className="ml-6 mt-2 space-y-1">
                      {members.map((m) => (
                        <label key={m.user.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selected.visible_to.includes(m.user.id)}
                            onChange={() => toggleMember(m.user.id)}
                          />
                          {m.user.username}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleDeleteList} className="text-sm text-red-600 hover:underline">
                  {t('shoppingList.deleteList')}
                </button>
              </div>
            )}

            <form onSubmit={handleAddItem} className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-2">
              <datalist id="shopping-ingredient-suggestions">
                {ingredientNames.map((name) => <option key={name} value={name} />)}
              </datalist>
              <input
                type="number" step="any" min="0"
                placeholder={t('shoppingList.quantityPlaceholder')}
                value={itemForm.quantity}
                onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <select
                value={itemForm.unit}
                onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                className="w-24 px-2 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">{t('shoppingList.noUnit')}</option>
                {units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u, i18n.language)}</option>)}
              </select>
              <input
                type="text" list="shopping-ingredient-suggestions"
                placeholder={t('shoppingList.itemNamePlaceholder')}
                value={itemForm.title}
                onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
              <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                {t('shoppingList.addButton')}
              </button>
            </form>

            <div className="bg-white rounded-lg shadow">
              {items.length === 0 && <p className="p-4 text-gray-500">{t('shoppingList.emptyList')}</p>}
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id} className="p-4 flex items-center">
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={() => handleToggle(item.id)}
                      className="mr-4"
                    />
                    <div className={`flex-1 ${item.is_completed ? 'line-through text-gray-400' : ''}`}>
                      {item.quantity !== null && (
                        <span className="font-medium">{Number(item.quantity)} {unitLabel(units.find((u) => u.id === item.unit), i18n.language)} </span>
                      )}
                      {item.title}
                      {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                    </div>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-gray-300 hover:text-red-600 px-1" aria-label={t('shoppingList.deleteItem')}>✕</button>
                  </li>
                ))}
              </ul>
            </div>

            {hasCompleted && (
              <button onClick={handleClearCompleted} className="mt-3 text-sm text-gray-600 hover:text-red-600">
                {t('shoppingList.clearCompleted')}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
