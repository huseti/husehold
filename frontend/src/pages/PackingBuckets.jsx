import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { packingBucketService, packingBucketItemService } from '../services/api';
import Navbar from '../components/Navbar';

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
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketColor, setNewBucketColor] = useState(DEFAULT_COLOR);
  const [bucketName, setBucketName] = useState('');
  const [bucketColor, setBucketColor] = useState(DEFAULT_COLOR);
  const [itemText, setItemText] = useState('');

  const selected = buckets.find((b) => b.id === selectedId) || null;

  const reloadBuckets = async () => {
    const res = await packingBucketService.getAll();
    const loaded = res.data.results || [];
    setBuckets(loaded);
    return loaded;
  };

  useEffect(() => {
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
      await packingBucketItemService.create({ bucket: selectedId, text: itemText.trim() });
      setItemText('');
      await reloadBuckets();
    } catch (err) {
      console.error('Error adding bucket item:', err);
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
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-3xl font-bold">{t('packingBuckets.title')}</h2>
          <Link to="/packing-lists" className="text-sm text-blue-600 hover:underline">
            {t('packingBuckets.backToLists')}
          </Link>
        </div>
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

            <form onSubmit={handleAddItem} className="bg-white rounded-lg shadow p-4 mb-6 flex gap-2">
              <input
                type="text"
                placeholder={t('packingBuckets.itemPlaceholder')}
                value={itemText}
                onChange={(e) => setItemText(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
              <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">
                {t('packingBuckets.addButton')}
              </button>
            </form>

            <div className="bg-white rounded-lg shadow">
              {selected.items.length === 0 && <p className="p-4 text-gray-500">{t('packingBuckets.emptyBucket')}</p>}
              <ul className="divide-y">
                {selected.items.map((item) => (
                  <li key={item.id} className="p-4 flex items-center">
                    <div className="flex-1">{item.text}</div>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-gray-300 hover:text-red-600 px-1" aria-label={t('packingBuckets.deleteItem')}>✕</button>
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
