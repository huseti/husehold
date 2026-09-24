import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  shoppingService, shoppingListService, unitService, ingredientService,
} from '../services/api';
import Navbar from '../components/Navbar';
import PurchaseHistory from '../components/PurchaseHistory';
import { unitLabel } from '../utils/localized';

const emptyItem = { title: '', quantity: '', unit: '' };

export default function ShoppingList() {
  const { t, i18n } = useTranslation();
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [ingredientNames, setIngredientNames] = useState([]);
  const [loading, setLoading] = useState(true);

  const [itemForm, setItemForm] = useState(emptyItem);
  const [newListName, setNewListName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [listName, setListName] = useState('');
  const [view, setView] = useState('list');
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState(emptyItem);

  const selected = lists.find((l) => l.id === selectedId) || null;

  useEffect(() => {
    const init = async () => {
      // The lists are what the page is for, so they load on their own; the
      // supporting data below must never be able to blank them out if one of
      // those requests fails.
      try {
        const listRes = await shoppingListService.getAll();
        const loaded = listRes.data.results || [];
        setLists(loaded);
        setSelectedId((loaded.find((l) => l.is_favorite_for_cooking_plan) || loaded[0])?.id ?? null);
      } catch (error) {
        console.error('Error loading shopping lists:', error);
      } finally {
        setLoading(false);
      }

      const [unitRes, ingredientRes] = await Promise.allSettled([
        unitService.getAll(), ingredientService.getAll(),
      ]);
      if (unitRes.status === 'fulfilled') setUnits(unitRes.value.data.results || []);
      if (ingredientRes.status === 'fulfilled') {
        setIngredientNames((ingredientRes.value.data.results || []).map((i) => i.name));
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

  // Buying something again from the history: same name, and the quantity/unit
  // of the last purchase, dropped onto whichever list is currently selected.
  const handleReAdd = async (entry) => {
    await shoppingService.create({
      shopping_list: selectedId, title: entry.title, quantity: entry.quantity, unit: entry.unit,
    });
    await reloadLists();
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

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditForm({ title: item.title, quantity: item.quantity ?? '', unit: item.unit ?? '' });
  };

  const saveEditItem = async () => {
    try {
      await shoppingService.update(editingItemId, {
        title: editForm.title,
        quantity: editForm.quantity === '' ? null : editForm.quantity,
        unit: editForm.unit === '' ? null : Number(editForm.unit),
      });
      setEditingItemId(null);
      reloadItems();
    } catch (error) {
      console.error('Error updating item:', error);
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

        <div className="flex gap-6 border-b mb-6">
          {['list', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`pb-2 -mb-px border-b-2 ${view === tab ? 'border-gray-800 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {t(tab === 'list' ? 'shoppingList.tabList' : 'shoppingList.tabHistory')}
            </button>
          ))}
        </div>

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

        {view === 'history' ? (
          selected ? (
            <PurchaseHistory key={selected.id} units={units} listId={selected.id} listName={selected.name} onReAdd={handleReAdd} />
          ) : (
            <p className="text-gray-500">{t('shoppingList.noLists')}</p>
          )
        ) : (
          <>
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
                    <li key={item.id} className="p-4">
                      {editingItemId === item.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number" step="any" min="0"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg"
                          />
                          <select
                            value={editForm.unit}
                            onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                            className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg"
                          >
                            <option value="">{t('shoppingList.noUnit')}</option>
                            {units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u, i18n.language)}</option>)}
                          </select>
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="flex-1 min-w-32 px-3 py-1.5 border border-gray-300 rounded-lg"
                            required
                          />
                          <button onClick={saveEditItem} className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 text-sm">
                            {t('recipes.save')}
                          </button>
                          <button onClick={() => setEditingItemId(null)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300 text-sm">
                            {t('recipes.cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center">
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
                          <button onClick={() => startEditItem(item)} className="text-gray-300 hover:text-blue-600 px-1" aria-label={t('shoppingList.editItem')}>✎</button>
                          <button onClick={() => handleDeleteItem(item.id)} className="text-gray-300 hover:text-red-600 px-1" aria-label={t('shoppingList.deleteItem')}>✕</button>
                        </div>
                      )}
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
          </>
        )}
      </main>
    </div>
  );
}
