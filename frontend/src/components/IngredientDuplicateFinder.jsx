import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ingredientService } from '../services/api';
import { localizedName, unitLabel } from '../utils/localized';

const inputClass = 'px-2 py-1.5 border border-gray-300 rounded-lg text-sm';
const SECTIONS = ['duplicate', 'name', 'unit'];

// Unit selects hold '' (none), an existing unit id as a string, or
// 'new:<name>' for a unit the AI found in a name that doesn't exist yet.
const unitValue = (id, newName) => (id ? String(id) : newName ? `new:${newName}` : '');
const unitPayload = (value) => (value.startsWith('new:')
  ? { unit: null, new_unit: value.slice(4) }
  : { unit: value === '' ? null : Number(value), new_unit: '' });

function apiError(error, t) {
  return error.response?.data?.detail || t('ingredientDuplicates.failed');
}

function toDraft(s) {
  return {
    ...s,
    keepId: s.keep_id,
    preferredUnit: unitValue(s.preferred_unit, s.preferred_new_unit),
    members: s.members.map((m) => ({
      ...m, included: true, note: m.note || '', quantity: m.quantity || '', unit: unitValue(m.unit, m.new_unit),
    })),
    busy: false,
    error: '',
  };
}

function toMergeRequest(draft) {
  const preferred = unitPayload(draft.preferredUnit);
  return {
    keep_id: draft.keepId,
    name: draft.name.trim(),
    preferred_unit: preferred.unit,
    preferred_new_unit: preferred.new_unit,
    members: draft.members.filter((m) => m.included).map((m) => ({
      id: m.id, note: m.note.trim(), quantity: m.quantity.trim(), ...unitPayload(m.unit),
    })),
  };
}

function UnitSelect({ value, onChange, units, newUnits, emptyLabel, className, disabled, title }) {
  const { t, i18n } = useTranslation();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} title={title} className={`${inputClass} ${className || ''}`}>
      <option value="">{emptyLabel}</option>
      {newUnits.map((name) => <option key={name} value={`new:${name}`}>{t('ingredientDuplicates.newUnitOption', { name })}</option>)}
      {units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u, i18n.language)}</option>)}
    </select>
  );
}

// What happens to one member, in words -- so it's clear which entry
// "wins" and what the others turn into.
function memberEffect(draft, m, t, unitText) {
  if (!m.included) return t('ingredientDuplicates.effectSkipped');
  const extras = [
    m.quantity && t('ingredientDuplicates.effectQuantity', { quantity: m.quantity }),
    m.unit && t('ingredientDuplicates.effectUnit', { unit: unitText(m.unit) }),
    m.note.trim() && t('ingredientDuplicates.effectNote', { note: m.note.trim() }),
  ].filter(Boolean);
  const name = draft.name.trim();
  let main;
  if (m.id === draft.keepId) {
    main = name && name !== m.name ? t('ingredientDuplicates.effectKeepRenamed', { name }) : t('ingredientDuplicates.effectKeep');
  } else {
    main = t('ingredientDuplicates.effectMerged', { name });
  }
  return [main, ...extras].join(' · ');
}

function SuggestionCard({ draft, units, categories, onChange, onApply, onDismiss }) {
  const { t, i18n } = useTranslation();
  const newUnits = [...new Set([draft.preferred_new_unit, ...draft.members.map((m) => m.new_unit)].filter(Boolean))];
  const unitText = (value) => (value.startsWith('new:')
    ? value.slice(4)
    : unitLabel(units.find((u) => u.id === Number(value)), i18n.language));
  const categoryName = (id) => {
    const category = categories.find((c) => c.id === id);
    return category ? localizedName(category, i18n.language) : null;
  };
  const updateMember = (id, changes) => onChange({ members: draft.members.map((m) => (m.id === id ? { ...m, ...changes } : m)) });
  const included = draft.members.filter((m) => m.included);
  const multi = draft.members.length > 1;

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-40 text-xs text-gray-500">
          {t('ingredientDuplicates.newName')}
          <input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} className={`block w-full mt-1 font-medium ${inputClass}`} />
        </label>
        <label className="text-xs text-gray-500">
          {t('ingredientDuplicates.preferredUnit')}
          <UnitSelect
            value={draft.preferredUnit} onChange={(v) => onChange({ preferredUnit: v })}
            units={units} newUnits={newUnits} emptyLabel={t('recipeConfig.none')} className="block mt-1"
          />
        </label>
      </div>

      <ul className="space-y-3">
        {draft.members.map((m) => {
          const isKeep = m.id === draft.keepId;
          const category = categoryName(m.category);
          return (
            <li key={m.id} className={`text-sm ${m.included ? '' : 'opacity-50'}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {multi && (
                  <>
                    <input
                      type="radio" name={`keep-${draft.key}`} checked={isKeep}
                      onChange={() => onChange({ keepId: m.id, members: draft.members.map((x) => (x.id === m.id ? { ...x, included: true } : x)) })}
                      aria-label={t('ingredientDuplicates.keepThis', { name: m.name })} title={t('ingredientDuplicates.keepThis', { name: m.name })}
                    />
                    <input
                      type="checkbox" checked={m.included} disabled={isKeep}
                      onChange={(e) => updateMember(m.id, { included: e.target.checked })}
                      aria-label={t('ingredientDuplicates.include')} title={t('ingredientDuplicates.include')}
                    />
                  </>
                )}
                <span className={isKeep && multi ? 'font-semibold' : ''}>{m.name}</span>
                <span className="text-xs text-gray-500">
                  {t('ingredientDuplicates.recipeCount', { count: m.recipe_count })}{category && ` · ${category}`}
                </span>
                {isKeep && multi && <span className="text-xs px-1.5 py-0.5 rounded bg-eucalyptus-100 text-eucalyptus-800">{t('ingredientDuplicates.kept')}</span>}
              </div>
              <p className={`text-xs mt-0.5 ${multi ? 'pl-11' : ''} text-gray-600`}>→ {memberEffect(draft, m, t, unitText)}</p>
              {m.included && (
                <div className={`flex flex-wrap gap-2 mt-1 ${multi ? 'pl-11' : ''}`}>
                  <input
                    value={m.quantity} onChange={(e) => updateMember(m.id, { quantity: e.target.value })}
                    placeholder={t('ingredientDuplicates.quantityPlaceholder')} title={t('ingredientDuplicates.quantityHint')}
                    className={`w-20 ${inputClass}`}
                  />
                  <UnitSelect
                    value={m.unit} onChange={(v) => updateMember(m.id, { unit: v })}
                    units={units} newUnits={newUnits} emptyLabel={t('ingredientDuplicates.noUnit')}
                    className="w-28" title={t('ingredientDuplicates.unitHint')}
                  />
                  <input
                    value={m.note} onChange={(e) => updateMember(m.id, { note: e.target.value })}
                    placeholder={t('ingredientDuplicates.notePlaceholder')} title={t('ingredientDuplicates.noteHint')}
                    className={`flex-1 min-w-36 ${inputClass}`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {draft.error && <p className="text-sm text-red-600">{draft.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onApply} disabled={draft.busy || !draft.name.trim()} className="btn btn-sm btn-primary text-white disabled:opacity-50">
          {included.length > 1 ? t('ingredientDuplicates.merge', { count: included.length }) : t('ingredientDuplicates.apply')}
        </button>
        <button type="button" onClick={onDismiss} disabled={draft.busy} className="btn btn-sm btn-secondary text-gray-700 disabled:opacity-50">
          {t('ingredientDuplicates.dismiss')}
        </button>
      </div>
    </div>
  );
}

// Config section: one Claude call (~1 minute, about a cent) suggests
// duplicates, messy names and units/amounts hidden in names; the results
// are split into those three sections, each reviewable card by card or
// applied all at once.
export default function IngredientDuplicateFinder({ units, categories, onMerged }) {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(null);
  const [error, setError] = useState('');

  const search = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await ingredientService.duplicateSuggestions();
      setDrafts(response.data.suggestions.map(toDraft));
    } catch (err) {
      setError(apiError(err, t));
    } finally {
      setLoading(false);
    }
  };

  const patch = (key, changes) => setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...changes } : d)));
  const remove = (key) => setDrafts((list) => list.filter((d) => d.key !== key));

  const apply = async (draft) => {
    patch(draft.key, { busy: true, error: '' });
    try {
      await ingredientService.merge(toMergeRequest(draft));
      remove(draft.key);
      return true;
    } catch (err) {
      patch(draft.key, { busy: false, error: apiError(err, t) });
      return false;
    }
  };

  const applyOne = async (draft) => {
    if (await apply(draft)) onMerged?.();
  };

  // One after the other -- each merge can change what the next one sees.
  const applyAll = async (kind) => {
    setBulkBusy(kind);
    for (const draft of drafts.filter((d) => d.kind === kind && d.name.trim())) {
      // eslint-disable-next-line no-await-in-loop
      await apply(draft);
    }
    setBulkBusy(null);
    onMerged?.();
  };

  const dismiss = async (draft) => {
    patch(draft.key, { busy: true, error: '' });
    try {
      await ingredientService.dismissSuggestion(draft.members.map((m) => m.id));
      remove(draft.key);
    } catch (err) {
      patch(draft.key, { busy: false, error: apiError(err, t) });
    }
  };

  return (
    <details className="border-t py-3">
      <summary className="cursor-pointer font-medium">{t('ingredientDuplicates.title')}</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-gray-500">{t('ingredientDuplicates.hint')}</p>
        <button type="button" onClick={search} disabled={loading || bulkBusy} className="btn btn-sm btn-primary text-white disabled:opacity-50">
          {loading ? t('ingredientDuplicates.searching') : t('ingredientDuplicates.search')}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {drafts && drafts.length === 0 && <p className="text-sm text-gray-500">{t('ingredientDuplicates.none')}</p>}
        {drafts && SECTIONS.map((kind) => {
          const inSection = drafts.filter((d) => d.kind === kind);
          if (inSection.length === 0) return null;
          return (
            <details key={kind} open={kind === 'duplicate'} className="rounded-lg bg-gray-50 p-3">
              <summary className="cursor-pointer font-medium">
                {t(`ingredientDuplicates.section.${kind}`)} <span className="text-sm text-gray-400">({inSection.length})</span>
              </summary>
              <div className="mt-2 space-y-3">
                <p className="text-sm text-gray-500">{t(`ingredientDuplicates.sectionHint.${kind}`)}</p>
                {kind === 'duplicate' && <p className="text-sm text-gray-500">{t('ingredientDuplicates.keepHint')}</p>}
                <button
                  type="button" onClick={() => applyAll(kind)} disabled={!!bulkBusy}
                  className="btn btn-sm btn-secondary text-gray-700 disabled:opacity-50"
                >
                  {bulkBusy === kind ? t('ingredientDuplicates.applyingAll') : t('ingredientDuplicates.applyAll', { count: inSection.length })}
                </button>
                {inSection.map((draft) => (
                  <SuggestionCard
                    key={draft.key} draft={draft} units={units} categories={categories}
                    onChange={(changes) => patch(draft.key, changes)}
                    onApply={() => applyOne(draft)}
                    onDismiss={() => dismiss(draft)}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </details>
  );
}
