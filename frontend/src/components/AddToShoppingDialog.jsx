import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { shoppingListService, unitService } from '../services/api';
import { unitLabel } from '../utils/localized';
import { mealName } from '../utils/taskDisplay';

// "Add ingredients to a shopping list": one block per dish (so each dish can
// be skipped as a whole), one checkbox per ingredient (staples such as salt
// start unticked). Used for a whole week of the cooking plan and for a
// single recipe. `dishes` come from the API's shopping preview /
// recipe shopping-lines: [{ key, recipe_title, servings, lines: [...] }].
export default function AddToShoppingDialog({ dishes, onClose, onDone }) {
  const { t, i18n } = useTranslation();
  const [lists, setLists] = useState([]);
  const [units, setUnits] = useState([]);
  const [listId, setListId] = useState('');
  const [dishOn, setDishOn] = useState(() => Object.fromEntries(dishes.map((d) => [d.key, true])));
  const [lineOn, setLineOn] = useState(() => Object.fromEntries(
    dishes.flatMap((d) => d.lines.map((line, i) => [`${d.key}:${i}`, !line.excluded_by_default])),
  ));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([shoppingListService.getAll(), unitService.getAll()])
      .then(([listRes, unitRes]) => {
        const loaded = listRes.data.results || [];
        setLists(loaded);
        setUnits(unitRes.data.results || []);
        setListId((loaded.find((l) => l.is_favorite_for_cooking_plan) || loaded[0])?.id ?? '');
      })
      .catch((err) => console.error('Error loading shopping lists:', err));
  }, []);

  const selectedLines = dishes.flatMap((d) => (dishOn[d.key]
    ? d.lines.filter((_, i) => lineOn[`${d.key}:${i}`]).map((line) => ({
      ingredient: line.ingredient, title: line.ingredient_name, quantity: line.quantity, unit: line.unit,
    }))
    : []));

  const handleAdd = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await shoppingListService.addIngredients(listId, selectedLines);
      setResult(response.data);
      onDone?.();
    } catch (err) {
      console.error('Error adding ingredients:', err);
      setError(t('shoppingDialog.failed'));
    } finally {
      setBusy(false);
    }
  };

  const describe = (line) => {
    const amount = line.quantity !== null ? `${Number(line.quantity)} ${unitLabel(units.find((u) => u.id === line.unit), i18n.language)}`.trim() : '';
    return `${amount} ${line.ingredient_name}`.trim();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-xl mx-auto my-8 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">{t('shoppingDialog.title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label={t('recipes.close')}>✕</button>
        </div>

        {result ? (
          <div>
            <p className="text-green-700 mb-4">{t('shoppingDialog.result', result)}</p>
            <button onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">{t('recipes.close')}</button>
          </div>
        ) : (
          <>
            <label className="block text-sm text-gray-600 mb-4">
              {t('shoppingDialog.list')}
              <select value={listId} onChange={(e) => setListId(e.target.value)} className="block mt-1 px-3 py-2 border border-gray-300 rounded-lg">
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>

            <div className="space-y-4">
              {dishes.map((d) => (
                <div key={d.key} className="border rounded-lg p-3">
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={dishOn[d.key]}
                      onChange={(e) => setDishOn({ ...dishOn, [d.key]: e.target.checked })}
                    />
                    <span>{d.recipe_title}</span>
                    <span className="text-sm font-normal text-gray-400">
                      {t('cookingPlan.servingsShort', { count: d.servings })}
                      {d.date && ` · ${new Date(`${d.date}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}`}
                      {d.meal_category_name_de && ` · ${mealName(d, i18n)}`}
                    </span>
                  </label>
                  {d.lines.length === 0 ? (
                    <p className="text-sm text-gray-400 mt-2 ml-6">{t('shoppingDialog.noIngredients')}</p>
                  ) : (
                    <ul className={`mt-2 ml-6 space-y-1 ${dishOn[d.key] ? '' : 'opacity-40'}`}>
                      {d.lines.map((line, i) => (
                        <li key={i}>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              disabled={!dishOn[d.key]}
                              checked={!!lineOn[`${d.key}:${i}`]}
                              onChange={(e) => setLineOn({ ...lineOn, [`${d.key}:${i}`]: e.target.checked })}
                            />
                            <span>{describe(line)}</span>
                            {line.excluded_by_default && <span className="text-xs text-gray-400">({t('shoppingDialog.staple')})</span>}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleAdd}
                disabled={busy || !listId || selectedLines.length === 0}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {t('shoppingDialog.add', { count: selectedLines.length })}
              </button>
              <button onClick={onClose} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">{t('recipes.cancel')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
