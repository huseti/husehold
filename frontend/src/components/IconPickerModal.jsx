import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadPhosphorLibrary, phosphorIconNames } from '../utils/phosphorLibrary';
import { CloseGlyph } from './icons/uiIcons';
import { SearchIcon } from './icons/searchIcons';

const MAX_SHOWN = 240;

// Picks any Phosphor icon by (English) name. `suggestions` are curated
// [key, IconComponent] pairs shown above the full, searchable library.
export default function IconPickerModal({
  value, suggestions = [], suggestionLabel, renderSuggestion, onSelect, onClose,
}) {
  const { t } = useTranslation();
  const [library, setLibrary] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadPhosphorLibrary().then((mod) => { if (!cancelled) setLibrary(mod); });
    return () => { cancelled = true; };
  }, []);

  const names = useMemo(() => (library ? phosphorIconNames(library) : []), [library]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[\s_-]+/g, '');
    return q ? names.filter((name) => name.toLowerCase().includes(q)) : names;
  }, [names, query]);

  const choose = (icon) => {
    onSelect(icon);
    onClose();
  };

  const cell = (selected) => `flex items-center justify-center aspect-square rounded border text-2xl ${
    selected
      ? 'bg-eucalyptus-300 text-gray-900 border-eucalyptus-500 dark:bg-eucalyptus-700 dark:text-white'
      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
  }`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl mx-auto my-8 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">{t('iconPicker.title')}</h3>
          <button onClick={onClose} className="icon-btn text-xl hover:text-gray-700" aria-label={t('recipes.close')}><CloseGlyph /></button>
        </div>

        {suggestions.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-2">{t('iconPicker.suggestions')}</p>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 mb-5">
              {suggestions.map((key) => (
                <button key={key} type="button" onClick={() => choose(key)} className={cell(value === key)} title={suggestionLabel ? suggestionLabel(key) : key}>
                  {renderSuggestion(key)}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-eucalyptus-600 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('iconPicker.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            autoFocus
          />
        </div>

        {!library && <p className="text-sm text-gray-500">{t('common.loading')}</p>}
        {library && matches.length === 0 && <p className="text-sm text-gray-500">{t('iconPicker.noMatch')}</p>}
        {library && matches.length > 0 && (
          <>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {matches.slice(0, MAX_SHOWN).map((name) => {
                const Icon = library[name];
                return (
                  <button key={name} type="button" onClick={() => choose(name)} className={cell(value === name)} title={name}>
                    <Icon weight="fill" size="1em" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            {matches.length > MAX_SHOWN && (
              <p className="text-xs text-gray-500 mt-2">{t('iconPicker.refine', { shown: MAX_SHOWN, count: matches.length })}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
