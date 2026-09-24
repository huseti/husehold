import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Generic inline editor for the small config-editable lookup tables
// (labels, meal categories, units, ingredients). Each row saves on change
// (checkbox/color) or blur (text/number); `fields` describes the columns:
// { key, labelKey, type: 'text' | 'number' | 'color' | 'checkbox', className? }.

function errorMessage(error, t) {
  if (error.response?.status === 409) return t('recipeConfig.inUse');
  const data = error.response?.data;
  const first = data && typeof data === 'object' ? Object.values(data).flat()[0] : null;
  return typeof first === 'string' ? first : t('recipeConfig.saveFailed');
}

function Row({ item, fields, onUpdate, onDelete }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(item);
  const [error, setError] = useState('');

  useEffect(() => setDraft(item), [item]);

  const save = async (changes) => {
    setError('');
    try {
      await onUpdate(item.id, changes);
    } catch (err) {
      setDraft(item);
      setError(errorMessage(err, t));
    }
  };

  const remove = async () => {
    setError('');
    try {
      await onDelete(item.id);
    } catch (err) {
      setError(errorMessage(err, t));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 py-1">
        {fields.map((field) => {
          if (field.type === 'checkbox') {
            return (
              <label key={field.key} className="flex items-center gap-1 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={!!draft[field.key]}
                  onChange={(e) => { setDraft({ ...draft, [field.key]: e.target.checked }); save({ [field.key]: e.target.checked }); }}
                />
                {t(field.labelKey)}
              </label>
            );
          }
          if (field.type === 'color') {
            return (
              <input
                key={field.key}
                type="color"
                value={draft[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                onBlur={() => draft[field.key] !== item[field.key] && save({ [field.key]: draft[field.key] })}
                className="w-9 h-9 p-0 border border-gray-300 rounded cursor-pointer"
              />
            );
          }
          return (
            <input
              key={field.key}
              type={field.type}
              value={draft[field.key] ?? ''}
              placeholder={t(field.labelKey)}
              onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              onBlur={() => String(draft[field.key] ?? '') !== String(item[field.key] ?? '') && save({ [field.key]: draft[field.key] })}
              className={`px-3 py-1.5 border border-gray-300 rounded ${field.className || 'flex-1 min-w-28'}`}
            />
          );
        })}
        <button onClick={remove} className="text-gray-400 hover:text-red-600 px-1" aria-label={t('recipeConfig.delete')}>✕</button>
      </div>
      {error && <p className="text-sm text-red-600 pb-1">{error}</p>}
    </div>
  );
}

export default function LookupEditor({ titleKey, service, fields, newItemDefaults, searchable = false }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState(newItemDefaults);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Searchable lists (ingredients) filter server-side, since the API
  // paginates and the catalogue can outgrow one page.
  const load = async () => {
    const response = await service.getAll(searchable && search.trim() ? { q: search.trim() } : undefined);
    setItems(response.data.results || []);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch((err) => console.error('Error loading config list:', err));
    }, searchable ? 250 : 0);
    return () => clearTimeout(timer);
  }, [search]);

  const handleUpdate = async (id, changes) => {
    const response = await service.update(id, changes);
    setItems((list) => list.map((i) => (i.id === id ? response.data : i)));
  };

  const handleDelete = async (id) => {
    await service.delete(id);
    setItems((list) => list.filter((i) => i.id !== id));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await service.create(newItem);
      setNewItem(newItemDefaults);
      await load();
    } catch (err) {
      setError(errorMessage(err, t));
    }
  };

  return (
    <details className="border-t py-3">
      <summary className="cursor-pointer font-medium">{t(titleKey)} <span className="text-sm text-gray-400">({items.length})</span></summary>
      <div className="mt-3">
        {searchable && (
          <input
            type="search"
            placeholder={t('recipeConfig.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded mb-2"
          />
        )}
        <div className={searchable ? 'max-h-80 overflow-y-auto' : ''}>
          {items.map((item) => (
            <Row key={item.id} item={item} fields={fields} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>

        <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-dashed">
          {fields.filter((f) => f.type !== 'checkbox').map((field) => (
            field.type === 'color' ? (
              <input
                key={field.key}
                type="color"
                value={newItem[field.key]}
                onChange={(e) => setNewItem({ ...newItem, [field.key]: e.target.value })}
                className="w-9 h-9 p-0 border border-gray-300 rounded cursor-pointer"
              />
            ) : (
              <input
                key={field.key}
                type={field.type}
                value={newItem[field.key] ?? ''}
                placeholder={t(field.labelKey)}
                onChange={(e) => setNewItem({ ...newItem, [field.key]: e.target.value })}
                className={`px-3 py-1.5 border border-gray-300 rounded ${field.className || 'flex-1 min-w-28'}`}
                required={field.key === 'name' || field.key === 'name_de' || field.key === 'text'}
              />
            )
          ))}
          <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 text-sm">
            {t('recipeConfig.add')}
          </button>
        </form>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
    </details>
  );
}
