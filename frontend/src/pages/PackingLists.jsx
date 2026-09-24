import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  packingListService, packingItemService, packingBucketService, memberService,
} from '../services/api';
import Navbar from '../components/Navbar';
import CreatePackingListModal from '../components/CreatePackingListModal';
import { toISODate } from '../utils/weekDates';

function errorMessage(error) {
  const data = error.response?.data;
  const first = data && typeof data === 'object' ? Object.values(data).flat()[0] : null;
  if (typeof first === 'string') return first;
  if (error.response) return `${error.response.status} ${error.response.statusText}`;
  return error.message || 'Unknown error';
}

export default function PackingLists() {
  const { t, i18n } = useTranslation();
  const [lists, setLists] = useState([]);
  const [members, setMembers] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newListName, setNewListName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [listName, setListName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [itemText, setItemText] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemText, setEditItemText] = useState('');
  const [bucketToAdd, setBucketToAdd] = useState('');

  const selected = lists.find((l) => l.id === selectedId) || null;

  useEffect(() => {
    const init = async () => {
      try {
        const [listRes, membersRes] = await Promise.all([packingListService.getAll(), memberService.getAll()]);
        const loaded = listRes.data.results || [];
        setLists(loaded);
        setMembers(membersRes.data.results || membersRes.data || []);
      } catch (err) {
        console.error('Error loading packing lists:', err);
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
      try {
        const bucketRes = await packingBucketService.getAll();
        setBuckets(bucketRes.data.results || []);
      } catch (err) {
        console.error('Error loading packing buckets:', err);
      }
    };
    init();
  }, []);

  useEffect(() => {
    setListName(selected?.name ?? '');
    setStartDate(selected?.start_date ?? '');
    setEndDate(selected?.end_date ?? '');
  }, [selected?.id, selected?.name, selected?.start_date, selected?.end_date]);

  const reloadLists = async () => {
    const res = await packingListService.getAll();
    const loaded = res.data.results || [];
    setLists(loaded);
    return loaded;
  };

  const handleCreate = async (data) => {
    const res = await packingListService.create(data);
    await reloadLists();
    setSelectedId(res.data.id);
    setShowCreateModal(false);
    setNewListName('');
  };

  const openCreateModal = (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    setShowCreateModal(true);
  };

  const updateSelected = async (changes) => {
    setError('');
    try {
      await packingListService.update(selectedId, changes);
      await reloadLists();
    } catch (err) {
      console.error('Error updating packing list:', err);
      setError(errorMessage(err));
    }
  };

  const handleDeleteList = async () => {
    if (!selected || !window.confirm(t('packingLists.confirmDeleteList', { name: selected.name }))) return;
    setError('');
    try {
      await packingListService.delete(selectedId);
      const remaining = await reloadLists();
      setShowSettings(false);
      setSelectedId(remaining[0]?.id ?? null);
    } catch (err) {
      console.error('Error deleting packing list:', err);
      setError(errorMessage(err));
    }
  };

  const toggleSelectedParticipant = async (userId, isParticipant) => {
    setError('');
    try {
      if (isParticipant) {
        await packingListService.removeParticipant(selectedId, userId);
      } else {
        await packingListService.addParticipant(selectedId, userId);
      }
      await reloadLists();
    } catch (err) {
      console.error('Error updating participants:', err);
      setError(errorMessage(err));
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!itemText.trim()) return;
    setError('');
    try {
      await packingItemService.create({ packing_list: selectedId, text: itemText.trim() });
      setItemText('');
      await reloadLists();
    } catch (err) {
      console.error('Error adding item:', err);
      setError(errorMessage(err));
    }
  };

  const handleToggleItem = async (item) => {
    setError('');
    try {
      await packingItemService.update(item.id, { is_packed: !item.is_packed });
      await reloadLists();
    } catch (err) {
      console.error('Error toggling item:', err);
      setError(errorMessage(err));
    }
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditItemText(item.text);
  };

  const saveEditItem = async () => {
    if (!editItemText.trim()) return;
    setError('');
    try {
      await packingItemService.update(editingItemId, { text: editItemText.trim() });
      setEditingItemId(null);
      await reloadLists();
    } catch (err) {
      console.error('Error editing item:', err);
      setError(errorMessage(err));
    }
  };

  const handleDeleteItem = async (id) => {
    setError('');
    try {
      await packingItemService.delete(id);
      await reloadLists();
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(errorMessage(err));
    }
  };

  const handleAddBucket = async (e) => {
    e.preventDefault();
    if (!bucketToAdd) return;
    setError('');
    try {
      await packingListService.addBucket(selectedId, Number(bucketToAdd));
      setBucketToAdd('');
      await reloadLists();
    } catch (err) {
      console.error('Error adding bucket:', err);
      setError(errorMessage(err));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  const todayISO = toISODate(new Date());
  const byStartAsc = (a, b) => a.start_date.localeCompare(b.start_date);
  const upcoming = lists.filter((l) => l.end_date >= todayISO).sort(byStartAsc);
  const past = lists.filter((l) => l.end_date < todayISO).sort((a, b) => byStartAsc(b, a));
  const availableBuckets = selected ? buckets.filter((b) => !selected.added_bucket_ids.includes(b.id)) : [];

  const renderPill = (list) => (
    <button
      key={list.id}
      onClick={() => { setSelectedId(list.id); setShowSettings(false); }}
      className={`px-4 py-2 rounded-full text-sm border ${list.id === selectedId ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
    >
      {list.name}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">{t('packingLists.title')}</h2>
          <Link to="/packing-buckets" className="text-sm text-blue-600 hover:underline">
            {t('packingLists.manageBuckets')}
          </Link>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="mb-4">
          <p className="text-sm font-medium text-gray-500 mb-2">{t('packingLists.upcoming')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {upcoming.map(renderPill)}
            {upcoming.length === 0 && <p className="text-sm text-gray-400">{t('packingLists.noUpcomingLists')}</p>}
          </div>
        </div>

        {past.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-500 mb-2">{t('packingLists.past')}</p>
            <div className="flex flex-wrap items-center gap-2">
              {past.map(renderPill)}
            </div>
          </div>
        )}

        <form onSubmit={openCreateModal} className="flex gap-2 mb-8">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder={t('packingLists.newListPlaceholder')}
            className="px-3 py-2 border border-gray-300 rounded-full text-sm w-56"
            required
          />
          <button type="submit" className="bg-green-600 text-white px-3 py-2 rounded-full text-sm hover:bg-green-700">+</button>
        </form>

        {!selected && <p className="text-gray-500">{t('packingLists.noLists')}</p>}

        {selected && (
          <>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold">{selected.name}</h3>
              <button onClick={() => setShowSettings((v) => !v)} className="text-sm text-blue-600">
                {t('packingLists.listSettings')}
              </button>
            </div>

            {showSettings && (
              <div className="bg-white rounded-lg shadow p-5 mb-6 space-y-4">
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  onBlur={() => listName.trim() && listName !== selected.name && updateSelected({ name: listName })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">{t('packingLists.formStartDate')}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      onBlur={() => startDate && startDate !== selected.start_date && updateSelected({ start_date: startDate })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">{t('packingLists.formEndDate')}</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      onBlur={() => endDate && endDate !== selected.end_date && updateSelected({ end_date: endDate })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('packingLists.formParticipants')}</p>
                  <div className="flex flex-wrap gap-4">
                    {members.map((member) => {
                      const isParticipant = selected.participants.some((p) => p.user === member.user.id);
                      return (
                        <label key={member.user.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isParticipant}
                            onChange={() => toggleSelectedParticipant(member.user.id, isParticipant)}
                          />
                          {member.user.username}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <button onClick={handleDeleteList} className="text-sm text-red-600 hover:underline">
                  {t('packingLists.deleteList')}
                </button>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
              <form onSubmit={handleAddItem} className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('packingLists.itemPlaceholder')}
                  value={itemText}
                  onChange={(e) => setItemText(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                  {t('packingLists.addButton')}
                </button>
              </form>

              {availableBuckets.length > 0 && (
                <form onSubmit={handleAddBucket} className="flex gap-2">
                  <select
                    value={bucketToAdd}
                    onChange={(e) => setBucketToAdd(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">{t('packingLists.selectBucket')}</option>
                    {availableBuckets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <button type="submit" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm">
                    {t('packingLists.addBucketButton')}
                  </button>
                </form>
              )}
            </div>

            <div className="bg-white rounded-lg shadow">
              {selected.items.length === 0 && <p className="p-4 text-gray-500">{t('packingLists.emptyList')}</p>}
              <ul className="divide-y">
                {selected.items.map((item) => (
                  <li key={item.id} className="p-4">
                    {editingItemId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editItemText}
                          onChange={(e) => setEditItemText(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg"
                          autoFocus
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
                          checked={item.is_packed}
                          onChange={() => handleToggleItem(item)}
                          className="mr-4"
                        />
                        <div className={`flex-1 ${item.is_packed ? 'line-through text-gray-400' : ''}`}>
                          {item.text}
                        </div>
                        <button onClick={() => startEditItem(item)} className="text-gray-300 hover:text-blue-600 px-1" aria-label={t('packingLists.editItem')}>✎</button>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-gray-300 hover:text-red-600 px-1" aria-label={t('packingLists.deleteItem')}>✕</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-gray-500 mt-3">
              {selected.start_date === selected.end_date
                ? new Date(`${selected.start_date}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage)
                : `${new Date(`${selected.start_date}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage)} – ${new Date(`${selected.end_date}T00:00:00`).toLocaleDateString(i18n.resolvedLanguage)}`}
              {' · '}
              {selected.participants.map((p) => p.username).join(', ')}
            </p>
          </>
        )}
      </main>

      {showCreateModal && (
        <CreatePackingListModal
          initialName={newListName}
          members={members}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
