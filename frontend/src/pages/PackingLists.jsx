import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  packingListService, packingItemService, packingBucketService, memberService,
} from '../services/api';
import Navbar from '../components/Navbar';
import PackingListFormModal from '../components/PackingListFormModal';
import NonParticipantConfirmDialog from '../components/NonParticipantConfirmDialog';
import AssigneeCheckboxes from '../components/AssigneeCheckboxes';
import AssigneeSelect from '../components/AssigneeSelect';
import GearIcon from '../components/icons/gearIcon';
import CopyIcon from '../components/icons/copyIcon';
import EditIcon from '../components/icons/editIcon';
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

  // { mode: 'create' | 'copy' | 'edit', list: <source/target list, or null for create> }
  const [modal, setModal] = useState(null);

  // { missing: [{id, username}], retry: (addToTripIds) => Promise<void> } --
  // set whenever the backend answers 409 (an assignee isn't a participant
  // of this list yet). Cancel just discards it, nothing is saved.
  const [conflict, setConflict] = useState(null);

  const [itemText, setItemText] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemAssigneeIds, setItemAssigneeIds] = useState([]);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemText, setEditItemText] = useState('');
  const [editItemQuantity, setEditItemQuantity] = useState('');
  // A single row has at most one assignee -- '' means "shared, nobody specific".
  const [editItemAssignedTo, setEditItemAssignedTo] = useState('');
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

  const reloadLists = async () => {
    const res = await packingListService.getAll();
    const loaded = res.data.results || [];
    setLists(loaded);
    return loaded;
  };

  // Runs makeRequest({}) first; if the backend answers 409 with
  // non_participants, stashes a retry (makeRequest with confirm_non_participants
  // + whatever the dialog's checkboxes end up being) in `conflict` instead of
  // treating it as a plain error. onSuccess runs after either the first try
  // or (if confirmed) the retry succeeds -- e.g. clearing a form, reloading
  // the list, closing a modal.
  const runWithConflictHandling = async (makeRequest, onSuccess) => {
    try {
      const res = await makeRequest({});
      await onSuccess(res);
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.non_participants) {
        setConflict({
          missing: err.response.data.non_participants,
          retry: async (addToTripIds) => {
            try {
              const res = await makeRequest({ confirm_non_participants: true, add_to_trip: addToTripIds });
              await onSuccess(res);
              setConflict(null);
            } catch (retryErr) {
              console.error('Error after confirming non-participant assignment:', retryErr);
              setError(errorMessage(retryErr));
              setConflict(null);
            }
          },
        });
      } else {
        console.error('Error:', err);
        setError(errorMessage(err));
      }
    }
  };

  const handleSaveModal = async (data) => {
    let res;
    if (modal.mode === 'copy') res = await packingListService.copy(modal.list.id, data);
    else if (modal.mode === 'edit') res = await packingListService.update(modal.list.id, data);
    else res = await packingListService.create(data);
    await reloadLists();
    setSelectedId(res.data.id);
    setModal(null);
  };

  const handleDeleteModalList = async () => {
    await packingListService.delete(modal.list.id);
    const remaining = await reloadLists();
    if (selectedId === modal.list.id) setSelectedId(remaining[0]?.id ?? null);
    setModal(null);
  };

  const handleToggleArchiveModalList = async () => {
    await packingListService.toggleArchived(modal.list.id);
    await reloadLists();
    setModal(null);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!itemText.trim()) return;
    setError('');
    await runWithConflictHandling(
      (extra) => packingItemService.create({
        packing_list: selectedId, text: itemText.trim(),
        quantity: itemQuantity ? Number(itemQuantity) : null, assignee_ids: itemAssigneeIds,
        ...extra,
      }),
      async () => {
        setItemText(''); setItemQuantity(''); setItemAssigneeIds([]);
        await reloadLists();
      },
    );
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
    setEditItemQuantity(item.quantity ?? '');
    setEditItemAssignedTo(item.assigned_to ? String(item.assigned_to.id) : '');
  };

  const saveEditItem = async () => {
    if (!editItemText.trim()) return;
    setError('');
    await runWithConflictHandling(
      (extra) => packingItemService.update(editingItemId, {
        text: editItemText.trim(), quantity: editItemQuantity ? Number(editItemQuantity) : null,
        assigned_to_id: editItemAssignedTo ? Number(editItemAssignedTo) : null, ...extra,
      }),
      async () => {
        setEditingItemId(null);
        await reloadLists();
      },
    );
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
    await runWithConflictHandling(
      (extra) => packingListService.addBucket(selectedId, Number(bucketToAdd), extra),
      async () => {
        setBucketToAdd('');
        await reloadLists();
      },
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  const todayISO = toISODate(new Date());
  const byStartAsc = (a, b) => a.start_date.localeCompare(b.start_date);
  const active = lists.filter((l) => !l.is_archived);
  const upcoming = active.filter((l) => l.end_date >= todayISO).sort(byStartAsc);
  const past = active.filter((l) => l.end_date < todayISO).sort((a, b) => byStartAsc(b, a));
  const archived = lists.filter((l) => l.is_archived).sort((a, b) => byStartAsc(b, a));
  const availableBuckets = selected ? buckets.filter((b) => !selected.added_bucket_ids.includes(b.id)) : [];

  const renderPill = (list) => (
    <span
      key={list.id}
      className={`flex items-center gap-1 pl-4 pr-1 py-1 rounded-full text-sm border ${list.id === selectedId ? 'bg-eucalyptus-300 dark:bg-eucalyptus-500 text-gray-900 dark:text-white border-eucalyptus-300 dark:border-eucalyptus-500' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'} ${list.is_archived ? 'opacity-60' : ''}`}
    >
      <button onClick={() => setSelectedId(list.id)}>
        {list.name}
      </button>
      <button
        onClick={() => setModal({ mode: 'copy', list })}
        className={`p-1.5 rounded-full ${list.id === selectedId ? 'hover:bg-eucalyptus-400 dark:hover:bg-eucalyptus-600' : 'hover:btn-secondary'}`}
        title={t('packingLists.copyToNewList')}
        aria-label={t('packingLists.copyToNewList')}
      >
        <CopyIcon />
      </button>
      <button
        onClick={() => setModal({ mode: 'edit', list })}
        className={`p-1.5 rounded-full ${list.id === selectedId ? 'hover:bg-eucalyptus-400 dark:hover:bg-eucalyptus-600' : 'hover:btn-secondary'}`}
        title={t('packingLists.editList')}
        aria-label={t('packingLists.editList')}
      >
        <EditIcon />
      </button>
    </span>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">{t('packingLists.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal({ mode: 'create', list: null })}
              className="btn-primary text-white px-4 py-2 rounded dark:hover:bg-eucalyptus-600"
            >
              + {t('packingLists.newButton')}
            </button>
            <Link
              to="/packing-buckets"
              className="text-gray-500 hover:text-gray-800 text-xl p-2"
              title={t('common.configure')}
              aria-label={t('common.configure')}
            >
              <GearIcon />
            </Link>
          </div>
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

        {archived.length > 0 && (
          <details className="mb-4">
            <summary className="text-sm font-medium text-gray-500 cursor-pointer">
              {t('packingLists.archived')} ({archived.length})
            </summary>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {archived.map(renderPill)}
            </div>
          </details>
        )}

        {!selected && <p className="text-gray-500 mt-6">{t('packingLists.noLists')}</p>}

        {selected && (
          <>
            <h3 className="text-xl font-semibold mb-3">{selected.name}</h3>

            <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
              <form onSubmit={handleAddItem} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('packingLists.itemPlaceholder')}
                    value={itemText}
                    onChange={(e) => setItemText(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder={t('packingLists.quantityPlaceholder')}
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button type="submit" className="btn-primary text-white px-4 py-2 rounded-lg hover:btn-primary">
                    {t('packingLists.addButton')}
                  </button>
                </div>
                <AssigneeCheckboxes members={members} selectedIds={itemAssigneeIds} onChange={setItemAssigneeIds} />
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
                  <button type="submit" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:btn-secondary text-sm">
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
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editItemText}
                            onChange={(e) => setEditItemText(e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg"
                            autoFocus
                          />
                          <input
                            type="number"
                            min="1"
                            placeholder={t('packingLists.quantityPlaceholder')}
                            value={editItemQuantity}
                            onChange={(e) => setEditItemQuantity(e.target.value)}
                            className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg"
                          />
                          <button onClick={saveEditItem} className="btn-primary text-white px-3 py-1.5 rounded dark:hover:bg-eucalyptus-600 text-sm">
                            {t('recipes.save')}
                          </button>
                          <button onClick={() => setEditingItemId(null)} className="btn-secondary text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300 text-sm">
                            {t('recipes.cancel')}
                          </button>
                        </div>
                        <AssigneeSelect members={members} value={editItemAssignedTo} onChange={setEditItemAssignedTo} />
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
                          {item.quantity ? `${item.quantity}x ` : ''}{item.text}
                          {item.assigned_to && (
                            <span className="text-gray-400 text-sm"> — {item.assigned_to.username}</span>
                          )}
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

      {modal?.mode === 'create' && (
        <PackingListFormModal mode="create" members={members} onClose={() => setModal(null)} onSave={handleSaveModal} />
      )}

      {modal?.mode === 'copy' && (
        <PackingListFormModal
          mode="copy"
          initialName={t('packingLists.copyNamePlaceholder', { name: modal.list.name })}
          initialParticipantIds={modal.list.participants.map((p) => p.user)}
          members={members}
          onClose={() => setModal(null)}
          onSave={handleSaveModal}
        />
      )}

      {modal?.mode === 'edit' && (
        <PackingListFormModal
          mode="edit"
          initialName={modal.list.name}
          initialStartDate={modal.list.start_date}
          initialEndDate={modal.list.end_date}
          initialParticipantIds={modal.list.participants.map((p) => p.user)}
          isArchived={modal.list.is_archived}
          members={members}
          onClose={() => setModal(null)}
          onSave={handleSaveModal}
          onDelete={handleDeleteModalList}
          onToggleArchive={handleToggleArchiveModalList}
        />
      )}

      {conflict && (
        <NonParticipantConfirmDialog
          missing={conflict.missing}
          onAccept={conflict.retry}
          onCancel={() => setConflict(null)}
        />
      )}
    </div>
  );
}
