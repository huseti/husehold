import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  shoppingService, shoppingListService, unitService, ingredientService, ingredientCategoryService,
} from '../services/api';
import Navbar from '../components/Navbar';
import PurchaseHistory from '../components/PurchaseHistory';
import GearIcon from '../components/icons/gearIcon';
import EditIcon from '../components/icons/editIcon';
import ShoppingListEditModal from '../components/ShoppingListEditModal';
import CategoryIcon from '../components/icons/categoryIcons';
import { unitLabel, localizedName } from '../utils/localized';
import { CloseGlyph, EditGlyph, CheckGlyph, TrashGlyph } from '../components/icons/uiIcons';
import { useRevalidate } from '../services/apiCache';
import PageSkeleton from '../components/PageSkeleton';
import { useUndo } from '../components/UndoProvider';
import SwipeActions from '../components/SwipeActions';
import EmptyState from '../components/EmptyState';
import TaskIcon from '../components/icons/taskIcons';
import TitleIcon from '../components/TitleIcon';
import { ShoppingMenuIcon } from '../components/icons/navIcons';

const emptyItem = { title: '', quantity: '', unit: '' };

// Ticked items sink to the bottom of their group, so what's left to grab stays on top.
const openFirst = (items) => [...items].sort((a, b) => Number(a.is_completed) - Number(b.is_completed));

export default function ShoppingList() {
  const { t, i18n } = useTranslation();
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [ingredientCategories, setIngredientCategories] = useState([]);
  const [ingredientNames, setIngredientNames] = useState([]);
  const [loading, setLoading] = useState(true);

  const [itemForm, setItemForm] = useState(emptyItem);
  const [newListName, setNewListName] = useState('');
  const [showNewList, setShowNewList] = useState(false);
  const itemNameRef = useRef(null);
  const [editingList, setEditingList] = useState(null);
  const [view, setView] = useState('list');
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState(emptyItem);

  const selected = lists.find((l) => l.id === selectedId) || null;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const { deleteWithUndo } = useUndo();

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

      const [unitRes, ingredientRes, categoryRes] = await Promise.allSettled([
        unitService.getAll(), ingredientService.getAll(), ingredientCategoryService.getAll(),
      ]);
      if (unitRes.status === 'fulfilled') setUnits(unitRes.value.data.results || []);
      if (ingredientRes.status === 'fulfilled') {
        setIngredientNames((ingredientRes.value.data.results || []).map((i) => i.name));
      }
      if (categoryRes.status === 'fulfilled') setIngredientCategories(categoryRes.value.data.results || []);
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

  const reloadLists = async () => {
    const res = await shoppingListService.getAll();
    setLists(res.data.results || []);
    return res.data.results || [];
  };

  const reloadItems = async () => {
    const [itemRes] = await Promise.all([shoppingService.getAll(selectedId), reloadLists()]);
    setItems(itemRes.data.results || []);
  };

  // Background refresh brought news (e.g. the other person ticked something off).
  useRevalidate(() => (selectedId === null ? reloadLists() : reloadItems()).catch(() => {}));

  const handleCreateList = async (e) => {
    e.preventDefault();
    try {
      const res = await shoppingListService.create({ name: newListName });
      setNewListName('');
      setShowNewList(false);
      await reloadLists();
      setSelectedId(res.data.id);
    } catch (error) {
      console.error('Error creating list:', error);
    }
  };

  // Errors propagate to the edit modal, which shows them and stays open.
  const handleSaveList = async (changes) => {
    await shoppingListService.update(editingList.id, changes);
    await reloadLists();
    setEditingList(null);
  };

  const handleDeleteList = async () => {
    await shoppingListService.delete(editingList.id);
    const remaining = await reloadLists();
    if (selectedId === editingList.id) setSelectedId(remaining[0]?.id ?? null);
    setEditingList(null);
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
      // Keep the cursor in the name field: items usually get added in a row.
      itemNameRef.current?.focus();
      reloadItems();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleToggle = async (id) => {
    // Tick immediately -- in the shop the tap must feel instant, the reload follows.
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_completed: !i.is_completed } : i)));
    try {
      await shoppingService.toggle(id);
      reloadItems();
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const handleDeleteItem = (id) => {
    const item = items.find((i) => i.id === id);
    if (editingItemId === id) setEditingItemId(null);
    deleteWithUndo({
      message: t('common.deleted', { title: item?.title ?? '' }),
      hide: () => setItems((prev) => prev.filter((i) => i.id !== id)),
      // Nothing was written yet, so this comes straight from the API cache.
      restore: () => shoppingService.getAll(selectedIdRef.current)
        .then((res) => setItems(res.data.results || []))
        .catch(() => {}),
      commit: async () => {
        await shoppingService.delete(id);
        await reloadLists();
      },
    });
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
    return <PageSkeleton width="max-w-4xl" />;
  }

  const hasCompleted = items.some((i) => i.is_completed);

  // Thematic clustering, sorted to roughly match a typical supermarket
  // walk (IngredientCategory.sort_order) -- items with no category yet
  // (a genuinely new/unrecognized name) land in one trailing group instead
  // of being scattered or hidden.
  const groupedItems = ingredientCategories
    .map((cat) => ({
      id: cat.id, name: localizedName(cat, i18n.language), icon: cat.icon, color: cat.color_hex,
      items: openFirst(items.filter((item) => item.category === cat.id)),
    }))
    .filter((group) => group.items.length > 0);
  const uncategorizedItems = openFirst(items.filter((item) => item.category === null));
  const itemGroups = uncategorizedItems.length > 0
    ? [...groupedItems, { id: 'uncategorized', name: t('shoppingList.uncategorized'), icon: 'other', color: '#9e9e9e', items: uncategorizedItems }]
    : groupedItems;

  const renderItem = (item) => (
    <li key={item.id}>
      {editingItemId === item.id ? (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
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
          <button onClick={saveEditItem} className="btn btn-sm btn-primary text-white dark:hover:bg-eucalyptus-600">
            {t('recipes.save')}
          </button>
          <button onClick={() => setEditingItemId(null)} className="btn btn-sm btn-secondary text-gray-700 hover:bg-gray-300">
            {t('recipes.cancel')}
          </button>
          <button onClick={() => handleDeleteItem(item.id)} className="btn btn-sm btn-danger ml-auto">
            {t('shoppingList.deleteItem')}
          </button>
        </div>
      ) : (
        <SwipeActions
          right={{
            label: item.is_completed ? t('tasks.undo') : t('tasks.complete'),
            icon: <CheckGlyph />,
            className: 'bg-eucalyptus-500 text-white',
            onAction: () => handleToggle(item.id),
          }}
          left={{ label: t('recipes.delete'), icon: <TrashGlyph />, className: 'bg-red-500 text-white', onAction: () => handleDeleteItem(item.id) }}
          contentClassName="bg-white dark:bg-gray-800 px-4 py-1.5"
        >
        <div className="flex items-center">
          {/* The whole row (not just the tiny box) ticks the item off. Phones show
              only the edit pencil -- deleting lives in the edit row. */}
          <label className="flex-1 flex items-center gap-4 py-1.5 min-h-[2.75rem] cursor-pointer">
            <input
              type="checkbox"
              checked={item.is_completed}
              onChange={() => handleToggle(item.id)}
              className="h-5 w-5 flex-shrink-0"
            />
            <span className={`flex-1 ${item.is_completed ? 'line-through text-gray-400' : ''}`}>
              {item.quantity !== null && (
                <span className="font-medium tabular-nums">{Number(item.quantity)} {unitLabel(units.find((u) => u.id === item.unit), i18n.language)} </span>
              )}
              {item.title}
              {item.description && <span className="block text-sm text-gray-500">{item.description}</span>}
            </span>
          </label>
          <button onClick={() => startEditItem(item)} className="icon-btn hover:text-eucalyptus-600" aria-label={t('shoppingList.editItem')}><EditGlyph /></button>
          <button onClick={() => handleDeleteItem(item.id)} className="icon-btn hover:text-red-600 !hidden md:!inline-flex" aria-label={t('shoppingList.deleteItem')}><CloseGlyph /></button>
        </div>
        </SwipeActions>
      )}
    </li>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-1 mb-6">
          <h2 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold"><TitleIcon><ShoppingMenuIcon /></TitleIcon>{t('shoppingList.title')}</h2>
          <Link
            to="/recipe-shopping-config"
            className="text-gray-500 hover:text-gray-800 text-xl p-2"
            title={t('common.configure')}
            aria-label={t('common.configure')}
          >
            <GearIcon />
          </Link>
        </div>

        <div className="flex gap-6 border-b mb-6">
          {['list', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`pb-2 -mb-px border-b-2 ${view === tab ? 'border-eucalyptus-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {t(tab === 'list' ? 'shoppingList.tabList' : 'shoppingList.tabHistory')}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {lists.map((list) => (
            <span
              key={list.id}
              className={`flex items-center gap-1 pl-4 pr-1 py-1 rounded-full text-sm border ${list.id === selectedId ? 'bg-eucalyptus-300 dark:bg-eucalyptus-700 text-gray-900 dark:text-white border-eucalyptus-300 dark:border-eucalyptus-500' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <button onClick={() => setSelectedId(list.id)}>
                {list.is_favorite_for_cooking_plan && <span className="text-amber-700 dark:text-amber-300 mr-1">★</span>}
                {list.name}
                {list.open_item_count > 0 && <span className="ml-2 opacity-70">{list.open_item_count}</span>}
              </button>
              <button
                onClick={() => setEditingList(list)}
                className={`p-1.5 rounded-full ${list.id === selectedId ? 'hover:bg-eucalyptus-400 dark:hover:bg-eucalyptus-600' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                title={t('shoppingList.editList')}
                aria-label={t('shoppingList.editList')}
              >
                <EditIcon />
              </button>
            </span>
          ))}
          {showNewList ? (
            <form onSubmit={handleCreateList} className="flex gap-2">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setShowNewList(false); }}
                onBlur={() => { if (!newListName.trim()) setShowNewList(false); }}
                placeholder={t('shoppingList.newListPlaceholder')}
                className="px-3 py-1.5 border border-gray-300 rounded-full text-sm w-40"
                autoFocus
                required
              />
              <button type="submit" className="btn-primary px-3 py-1.5 rounded-full text-sm dark:hover:bg-eucalyptus-600">{t('shoppingList.createList')}</button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewList(true)}
              className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              + {t('shoppingList.newList')}
            </button>
          )}
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
              {/* Sticky: stays reachable while scrolling a long list in the shop.
                  (Below the laptop's sticky navbar; phones have no top bar. Top rather than
                  bottom: a bottom-fixed field fights the iOS keyboard.) */}
              <form onSubmit={handleAddItem} className="sticky top-[env(safe-area-inset-top)] md:top-[4.25rem] z-10 bg-white rounded-xl shadow p-2 sm:p-4 mb-4 sm:mb-6 flex gap-2">
                <datalist id="shopping-ingredient-suggestions">
                  {ingredientNames.map((name) => <option key={name} value={name} />)}
                </datalist>
                <input
                  type="number" step="any" min="0"
                  placeholder={t('shoppingList.quantityPlaceholder')}
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                  className="w-[4.5rem] sm:w-24 px-2 sm:px-3 py-2 border border-gray-300 rounded-lg"
                />
                <select
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  className="w-[4.5rem] sm:w-24 px-1 sm:px-2 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">{t('shoppingList.noUnit')}</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u, i18n.language)}</option>)}
                </select>
                <input
                  ref={itemNameRef}
                  type="text" list="shopping-ingredient-suggestions"
                  placeholder={t('shoppingList.itemNamePlaceholder')}
                  value={itemForm.title}
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  enterKeyHint="done"
                  required
                />
                <button
                  type="submit"
                  className="btn-primary px-3 sm:px-4 py-2 rounded-lg flex-shrink-0"
                  aria-label={t('shoppingList.addButton')}
                >
                  <span className="sm:hidden text-lg leading-none">+</span>
                  <span className="hidden sm:inline">{t('shoppingList.addButton')}</span>
                </button>
              </form>

              {items.length === 0 ? (
                <div className="bg-white rounded-xl shadow">
                  <EmptyState
                    icon={<TaskIcon icon="shopping" />}
                    text={t('shoppingList.emptyList')}
                    action={{ label: `+ ${t('shoppingList.addFirstItem')}`, onClick: () => itemNameRef.current?.focus() }}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {itemGroups.map((group) => (
                    <div key={group.id} className="bg-white rounded-xl shadow overflow-hidden">
                      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0"
                          style={{ backgroundColor: group.color }}
                        >
                          <CategoryIcon icon={group.icon} />
                        </span>
                        <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{group.name}</p>
                      </div>
                      <ul className="divide-y">
                        {group.items.map(renderItem)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

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
      {editingList && (
        <ShoppingListEditModal
          key={editingList.id}
          list={editingList}
          onClose={() => setEditingList(null)}
          onSave={handleSaveList}
          onDelete={handleDeleteList}
        />
      )}
    </div>
  );
}
