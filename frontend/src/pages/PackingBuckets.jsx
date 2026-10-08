import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { packingBucketService, packingBucketItemService, memberService } from '../services/api';
import Navbar from '../components/Navbar';
import AssigneeCheckboxes from '../components/AssigneeCheckboxes';

function errorMessage(error) {
  const data = error.response?.data;
  const first = data && typeof data === 'object' ? Object.values(data).flat()[0] : null;
  if (typeof first === 'string') return first;
  if (error.response) return `${error.response.status} ${error.response.statusText}`;
  return error.message || 'Unknown error';
}

const DEFAULT_COLOR = '#5b7a5e';

export default function PackingBuckets() {
  const { t } = useTranslation();
  const [buckets, setBuckets] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketColor, setNewBucketColor] = useState(DEFAULT_COLOR);
  const [bucketName, setBucketName] = useState('');
  const [bucketColor, setBucketColor] = useState(DEFAULT_COLOR);
  const [itemText, setItemText] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemAssigneeIds, setItemAssigneeIds] = useState([]);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemText, setEditItemText] = useState('');
  const [editItemQuantity, setEditItemQuantity] = useState('');
  const [editItemAssigneeIds, setEditItemAssigneeIds] = useState([]);

  const selected = buckets.find((b) => b.id === selectedId) || null;

  const reloadBuckets = async () => {
    const res = await packingBucketService.getAll();
    const loaded = res.data.results || [];
    setBuckets(loaded);
    return loaded;
  };

  useEffect(() => {
    memberService.getAll()
      .then((res) => setMembers(res.data.results || res.data || []))
      .catch((err) => console.error('Error loading members:', err));
    reloadBuckets()
      .then((loaded) => setSelectedId(loaded[0]?.id ?? null))
      .catch((err) => { console.error('Error loading buckets:', err); setError(errorMessage(err)); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setBucketName(selected?.name ?? '');
    setBucketColor(selected?.color_hex ?? DEFAULT_COLOR);
  }, [selected?.id, selected?.name, selected?.color_hex]);

  const handleCreateBucket = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await packingBucketService.create({ name: newBucketName, color_hex: newBucketColor });
      setNewBucketName('');
      setNewBucketColor(DEFAULT_COLOR);
      await reloadBuckets();
      setSelectedId(res.data.id);
    } catch (err) {
      console.error('Error creating bucket:', err);
      setError(errorMessage(err));
    }
  };

  const updateSelectedBucket = async (changes) => {
    setError('');
    try {
      await packingBucketService.update(selectedId, changes);
      await reloadBuckets();
    } catch (err) {
      console.error('Error updating bucket:', err);
      setError(errorMessage(err));
    }
  };

  const handleDeleteBucket = async () => {
    if (!selected || !window.confirm(t('packingBuckets.confirmDelete', { name: selected.name }))) return;
    setError('');
    try {
      await packingBucketService.delete(selectedId);
      const remaining = await reloadBuckets();
      setSelectedId(remaining[0]?.id ?? null);
    } catch (err) {
      console.error('Error deleting bucket:', err);
      setError(errorMessage(err));
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!itemText.trim()) return;
    setError('');
    try {
      await packingBucketItemService.create({
        bucket: selectedId, text: itemText.trim(),
        quantity: itemQuantity ? Number(itemQuantity) : null, assignee_ids: itemAssigneeIds,
      });
      setItemText(''); setItemQuantity(''); setItemAssigneeIds([]);
      await reloadBuckets();
    } catch (err) {
      console.error('Error adding bucket item:', err);
      setError(errorMessage(err));
    }
  };

  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditItemText(item.text);
    setEditItemQuantity(item.quantity ?? '');
    setEditItemAssigneeIds(item.assignees.map((a) => a.id));
  };

  const saveEditItem = async () => {
    if (!editItemText.trim()) return;
    setError('');
    try {
      await packingBucketItemService.update(editingItemId, {
        text: editItemText.trim(), quantity: editItemQuantity ? Number(editItemQuantity) : null,
        assignee_ids: editItemAssigneeIds,
      });
      setEditingItemId(null);
      await reloadBuckets();
    } catch (err) {
      console.error('Error editing bucket item:', err);
      setError(errorMessage(err));
    }
  };

  const handleDeleteItem = async (id) => {
    setError('');
    try {
      await packingBucketItemService.delete(id);
      await reloadBuckets();
    } catch (err) {
      console.error('Error deleting bucket item:', err);
      setError(errorMessage(err));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/packing-lists" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          ← {t('packingBuckets.backToLists')}
        </Link>
        <h2 className="text-3xl font-bold mb-2">{t('packingBuckets.title')}</h2>
        <p className="text-sm text-gray-500 mb-6">{t('packingBuckets.hint')}</p>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {buckets.map((bucket) => (
            <button
              key={bucket.id}
              onClick={() => setSelectedId(bucket.id)}
              className={`px-4 py-2 rounded-full text-sm border flex items-center gap-2 ${bucket.id === selectedId ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: bucket.color_hex }} />
              {bucket.name}
            </button>
          ))}
          <form onSubmit={handleCreateBucket} className="flex gap-2">
            <input
              type="color"
              value={newBucketColor}
              onChange={(e) => setNewBucketColor(e.target.value)}
              className="w-9 h-9 p-0 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
              placeholder={t('packingBuckets.newBucketPlaceholder')}
              className="px-3 py-2 border border-gray-300 rounded-full text-sm w-40"
              required
            />
            <button type="submit" className="bg-green-600 text-white px-3 py-2 rounded-full text-sm hover:bg-green-700">+</button>
          </form>
        </div>

        {!selected && <p className="text-gray-500">{t('packingBuckets.noBuckets')}</p>}

        {selected && (
          <>
            <div className="bg-white rounded-lg shadow p-5 mb-6 space-y-4">
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={bucketColor}
                  onChange={(e) => setBucketColor(e.target.value)}
                  onBlur={() => bucketColor !== selected.color_hex && updateSelectedBucket({ color_hex: bucketColor })}
                  className="w-9 h-9 p-0 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  onBlur={() => bucketName.trim() && bucketName !== selected.name && updateSelectedBucket({ name: bucketName })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <button onClick={handleDeleteBucket} className="text-sm text-red-600 hover:underline">
                {t('packingBuckets.deleteBucket')}
              </button>
            </div>

            <form onSubmit={handleAddItem} className="bg-white rounded-lg shadow p-4 mb-6 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('packingBuckets.itemPlaceholder')}
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
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                  {t('packingBuckets.addButton')}
                </button>
              </div>
              <AssigneeCheckboxes members={members} selectedIds={itemAssigneeIds} onChange={setItemAssigneeIds} />
            </form>

            <div className="bg-white rounded-lg shadow">
              {selected.items.length === 0 && <p className="p-4 text-gray-500">{t('packingBuckets.emptyBucket')}</p>}
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
                          <button onClick={saveEditItem} className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 text-sm">
                            {t('recipes.save')}
                          </button>
                          <button onClick={() => setEditingItemId(null)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300 text-sm">
                            {t('recipes.cancel')}
                          </button>
                        </div>
                        <AssigneeCheckboxes members={members} selectedIds={editItemAssigneeIds} onChange={setEditItemAssigneeIds} />
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <div className="flex-1">
                          {item.quantity ? `${item.quantity}x ` : ''}{item.text}
                          {item.assignees.length > 0 && (
                            <span className="text-gray-400 text-sm"> — {item.assignees.map((a) => a.username).join(', ')}</span>
                          )}
                        </div>
                        <button onClick={() => startEditItem(item)} className="text-gray-300 hover:text-blue-600 px-1" aria-label={t('packingBuckets.editItem')}>✎</button>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-gray-300 hover:text-red-600 px-1" aria-label={t('packingBuckets.deleteItem')}>✕</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
