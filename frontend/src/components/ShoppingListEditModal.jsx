import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloseGlyph } from './icons/uiIcons';

export default function ShoppingListEditModal({ list, onClose, onSave, onDelete }) {
  const { t } = useTranslation();
  const [name, setName] = useState(list.name);
  const [isFavorite, setIsFavorite] = useState(list.is_favorite_for_cooking_plan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action, failedKey) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      console.error('Error saving shopping list:', err);
      setError(t(failedKey));
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    run(() => onSave({ name: name.trim(), is_favorite_for_cooking_plan: isFavorite }), 'shoppingList.editFailed');
  };

  const handleDelete = () => {
    if (!window.confirm(t('shoppingList.confirmDeleteList', { name: list.name }))) return;
    run(onDelete, 'shoppingList.deleteFailed');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md mx-auto my-8 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">{t('shoppingList.editList')}</h3>
          <button onClick={onClose} className="icon-btn text-xl hover:text-gray-700" aria-label={t('recipes.close')}><CloseGlyph /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            required
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFavorite} onChange={(e) => setIsFavorite(e.target.checked)} />
            {t('shoppingList.favoriteLabel')}
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={busy || !name.trim()} className="btn-primary px-4 py-2 rounded disabled:opacity-50">
              {t('recipes.save')}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 rounded">
              {t('recipes.cancel')}
            </button>
          </div>

          <div className="pt-3 border-t">
            <button type="button" onClick={handleDelete} disabled={busy} className="text-sm text-red-600 hover:underline disabled:opacity-50">
              {t('shoppingList.deleteList')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
