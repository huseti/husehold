import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseIngredientLine } from '../utils/recipeDisplay';
import { localizedName, unitLabel } from '../utils/localized';

const emptyLine = () => ({ quantity: '', unit: '', name: '', note: '' });

function recipeToForm(recipe) {
  if (!recipe) {
    return {
      title: '', description: '', servings: 2, prep_time: '', cook_time: '', source_url: '',
      notes: '', instructions: '', categories: [], labels: [], lines: [emptyLine()],
    };
  }
  return {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prep_time: recipe.prep_time ?? '',
    cook_time: recipe.cook_time ?? '',
    source_url: recipe.source_url,
    notes: recipe.notes,
    instructions: recipe.instructions,
    categories: recipe.categories,
    labels: recipe.labels,
    lines: recipe.ingredients.length
      ? recipe.ingredients.map((i) => ({
        quantity: i.quantity ?? '', unit: i.unit ?? '', name: i.ingredient_name, note: i.note,
      }))
      : [emptyLine()],
  };
}

const inputClass = 'px-3 py-2 border border-gray-300 rounded-lg';

export default function RecipeForm({ recipe, units, categories, labels, ingredientNames, onSave, onCancel }) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(() => recipeToForm(recipe));
  const [pasteText, setPasteText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const toggleId = (field, id) => setForm((f) => ({
    ...f,
    [field]: f[field].includes(id) ? f[field].filter((x) => x !== id) : [...f[field], id],
  }));

  const updateLine = (index, field, value) => setForm((f) => ({
    ...f,
    lines: f.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
  }));

  const removeLine = (index) => setForm((f) => ({
    ...f,
    lines: f.lines.length > 1 ? f.lines.filter((_, i) => i !== index) : [emptyLine()],
  }));

  const importPasted = () => {
    const parsed = pasteText
      .split('\n')
      .map((line) => parseIngredientLine(line, units))
      .filter(Boolean)
      .map((p) => ({ quantity: p.quantity ?? '', unit: p.unit ?? '', name: p.name, note: '' }));
    if (parsed.length === 0) return;
    setForm((f) => ({
      ...f,
      lines: [...f.lines.filter((l) => l.name.trim()), ...parsed],
    }));
    setPasteText('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({
        title: form.title,
        description: form.description,
        servings: Number(form.servings) || 1,
        prep_time: form.prep_time === '' ? null : Number(form.prep_time),
        cook_time: form.cook_time === '' ? null : Number(form.cook_time),
        source_url: form.source_url,
        notes: form.notes,
        instructions: form.instructions,
        categories: form.categories,
        labels: form.labels,
        ingredients: form.lines
          .filter((l) => l.name.trim())
          .map((l) => ({
            ingredient_name: l.name.trim(),
            quantity: l.quantity === '' ? null : l.quantity,
            unit: l.unit === '' ? null : Number(l.unit),
            note: l.note,
          })),
      });
    } catch (err) {
      console.error('Error saving recipe:', err);
      setError(t('recipes.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h3 className="text-xl font-semibold">{recipe ? t('recipes.editTitle') : t('recipes.newTitle')}</h3>

      <input
        type="text"
        placeholder={t('recipes.titlePlaceholder')}
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        className={`w-full ${inputClass}`}
        required
      />

      <textarea
        placeholder={t('recipes.descriptionPlaceholder')}
        value={form.description}
        onChange={(e) => set('description', e.target.value)}
        rows={2}
        className={`w-full ${inputClass}`}
      />

      <div className="flex flex-wrap gap-4">
        <label className="text-sm text-gray-600">
          {t('recipes.servingsLabel')}
          <input type="number" min="1" value={form.servings} onChange={(e) => set('servings', e.target.value)} className={`block w-24 mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm text-gray-600">
          {t('recipes.prepTimeLabel')}
          <input type="number" min="0" value={form.prep_time} onChange={(e) => set('prep_time', e.target.value)} className={`block w-24 mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm text-gray-600">
          {t('recipes.cookTimeLabel')}
          <input type="number" min="0" value={form.cook_time} onChange={(e) => set('cook_time', e.target.value)} className={`block w-24 mt-1 ${inputClass}`} />
        </label>
      </div>

      {categories.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-1">{t('recipes.categoriesLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleId('categories', c.id)}
                className={`px-3 py-1 rounded-full text-sm border ${form.categories.includes(c.id) ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                {localizedName(c, i18n.language)}
              </button>
            ))}
          </div>
        </div>
      )}

      {labels.length > 0 && (
        <div>
          <p className="text-sm text-gray-600 mb-1">{t('recipes.labelsLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {labels.map((l) => {
              const on = form.labels.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleId('labels', l.id)}
                  style={on ? { backgroundColor: l.color_hex, borderColor: l.color_hex } : { borderColor: l.color_hex, color: l.color_hex }}
                  className={`px-3 py-1 rounded-full text-sm border ${on ? 'text-white' : 'bg-white'}`}
                >
                  {localizedName(l, i18n.language)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm text-gray-600 mb-1">{t('recipes.ingredientsLabel')}</p>
        <datalist id="ingredient-suggestions">
          {ingredientNames.map((name) => <option key={name} value={name} />)}
        </datalist>
        <div className="space-y-2">
          {form.lines.map((line, index) => (
            <div key={index} className="flex flex-wrap gap-2 items-center">
              <input
                type="number" step="any" min="0"
                placeholder={t('recipes.quantityPlaceholder')}
                value={line.quantity}
                onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                className={`w-20 ${inputClass}`}
              />
              <select value={line.unit} onChange={(e) => updateLine(index, 'unit', e.target.value)} className={`w-24 ${inputClass}`}>
                <option value="">{t('recipes.noUnit')}</option>
                {units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u, i18n.language)}</option>)}
              </select>
              <input
                type="text" list="ingredient-suggestions"
                placeholder={t('recipes.ingredientPlaceholder')}
                value={line.name}
                onChange={(e) => updateLine(index, 'name', e.target.value)}
                className={`flex-1 min-w-32 ${inputClass}`}
              />
              <input
                type="text"
                placeholder={t('recipes.noteHint')}
                value={line.note}
                onChange={(e) => updateLine(index, 'note', e.target.value)}
                className={`w-36 ${inputClass}`}
              />
              <button type="button" onClick={() => removeLine(index)} className="text-gray-400 hover:text-red-600 px-1" aria-label={t('recipes.removeLine')}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))} className="text-sm text-blue-600 mt-2">
          + {t('recipes.addIngredient')}
        </button>

        <details className="mt-3">
          <summary className="text-sm text-gray-600 cursor-pointer">{t('recipes.pasteIngredients')}</summary>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={t('recipes.pastePlaceholder')}
            className={`w-full mt-2 ${inputClass}`}
          />
          <button type="button" onClick={importPasted} className="mt-1 bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300">
            {t('recipes.importLines')}
          </button>
        </details>
      </div>

      <textarea
        placeholder={t('recipes.instructionsPlaceholder')}
        value={form.instructions}
        onChange={(e) => set('instructions', e.target.value)}
        rows={6}
        className={`w-full ${inputClass}`}
      />

      <input
        type="url"
        placeholder={t('recipes.sourceUrlPlaceholder')}
        value={form.source_url}
        onChange={(e) => set('source_url', e.target.value)}
        className={`w-full ${inputClass}`}
      />

      <textarea
        placeholder={t('recipes.notesPlaceholder')}
        value={form.notes}
        onChange={(e) => set('notes', e.target.value)}
        rows={3}
        className={`w-full ${inputClass}`}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">
          {t('recipes.save')}
        </button>
        <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300">
          {t('recipes.cancel')}
        </button>
      </div>
    </form>
  );
}
