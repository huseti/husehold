import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cookingSuggestionService } from '../services/api';
import { localizedName } from '../utils/localized';
import { mealName } from '../utils/taskDisplay';
import StarRating from './StarRating';

const BUCKETS = ['craving', 'top_rated', 'long_ago', 'random', 'rest'];

function daysAgo(iso) {
  const then = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today - then) / 86400000);
}

// Choose what to cook for one day + meal: suggestion buckets (craving / best
// rated / not cooked in a while / random / rest), a search over all recipes
// with a label filter, or "leftovers of" a dish already planned this week.
export default function RecipePicker({
  dayLabel, meal, recipes, labels, weekCookEntries, onPickRecipe, onPickLeftovers, onClose,
}) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState('recipes');
  const [suggestions, setSuggestions] = useState(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState('');

  // Dishes already planned this week aren't suggested again (searching still finds them).
  const plannedRecipeIds = useMemo(
    () => [...new Set(weekCookEntries.map((e) => e.recipe))].sort((a, b) => a - b),
    [weekCookEntries],
  );

  useEffect(() => {
    cookingSuggestionService.get(meal.id, plannedRecipeIds, seed)
      .then((res) => setSuggestions(res.data))
      .catch((err) => console.error('Error loading suggestions:', err));
  }, [meal.id, seed, plannedRecipeIds]);

  const searching = search.trim() !== '' || labelFilter !== '';
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (labelFilter && !r.labels.includes(Number(labelFilter))) return false;
      return !q || r.title.toLowerCase().includes(q)
        || r.ingredients.some((i) => i.ingredient_name.toLowerCase().includes(q));
    }).map((r) => ({
      id: r.id, title: r.title, servings: r.servings, labels: r.labels,
      average_rating: r.average_rating, last_cooked_date: r.last_cooked_date,
    }));
  }, [recipes, search, labelFilter]);

  const row = (item) => (
    <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <div className="flex-1 min-w-40">
        <div className="font-medium">{item.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {item.average_rating !== null ? <StarRating value={item.average_rating} className="text-sm" /> : <span>{t('recipes.notRatedYet')}</span>}
          <span>
            {!item.last_cooked_date
              ? t('cookingPlan.neverCooked')
              : daysAgo(item.last_cooked_date) === 0
                ? t('cookingPlan.cookedToday')
                : t('cookingPlan.lastCookedAgo', { count: daysAgo(item.last_cooked_date) })}
          </span>
          {labels.filter((l) => item.labels.includes(l.id)).map((l) => (
            <span key={l.id} style={{ backgroundColor: l.color_hex }} className="px-2 rounded-full text-white">{localizedName(l, i18n.language)}</span>
          ))}
        </div>
      </div>
      <button onClick={() => onPickRecipe(item)} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
        + {t('cookingPlan.add')}
      </button>
    </li>
  );

  const bucketTitle = { craving: 'craving', top_rated: 'topRated', long_ago: 'longAgo', random: 'random', rest: 'rest' };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl mx-auto my-8 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">{t('cookingPlan.pickerTitle', { meal: localizedName(meal, i18n.language), day: dayLabel })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label={t('recipes.close')}>✕</button>
        </div>

        <div className="flex gap-6 border-b mb-4">
          {['recipes', 'leftovers'].map((name) => (
            <button
              key={name}
              onClick={() => setTab(name)}
              className={`pb-2 -mb-px border-b-2 ${tab === name ? 'border-gray-800 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {t(`cookingPlan.tab.${name}`)}
            </button>
          ))}
        </div>

        {tab === 'leftovers' ? (
          weekCookEntries.length === 0 ? (
            <p className="text-gray-500">{t('cookingPlan.leftoversEmpty')}</p>
          ) : (
            <ul className="divide-y">
              {weekCookEntries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1">
                    <span className="font-medium">{entry.recipe_title}</span>
                    <span className="text-sm text-gray-500"> · {new Date(`${entry.date}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}, {mealName(entry, i18n)}</span>
                  </span>
                  <button onClick={() => onPickLeftovers(entry)} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                    + {t('cookingPlan.add')}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <>
            <div className="flex flex-wrap gap-3 mb-4">
              <input
                type="search"
                placeholder={t('cookingPlan.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-40 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">{t('recipes.allLabels')}</option>
                {labels.map((l) => <option key={l.id} value={l.id}>{localizedName(l, i18n.language)}</option>)}
              </select>
            </div>

            {searching ? (
              searchResults.length === 0
                ? <p className="text-gray-500">{t('recipes.noMatches')}</p>
                : <ul className="divide-y">{searchResults.map(row)}</ul>
            ) : !suggestions ? (
              <p className="text-gray-500">{t('common.loading')}</p>
            ) : BUCKETS.every((b) => suggestions[b].length === 0) ? (
              <p className="text-gray-500">{t('cookingPlan.noSuggestions')}</p>
            ) : (
              <div className="space-y-5">
                {BUCKETS.filter((b) => suggestions[b].length > 0).map((bucket) => {
                  const heading = (
                    <>
                      <span className="font-semibold">{t(`cookingPlan.bucket.${bucketTitle[bucket]}`)}</span>
                      <span className="text-xs text-gray-400 ml-2">{t(`cookingPlan.bucketHint.${bucketTitle[bucket]}`)}</span>
                    </>
                  );
                  if (bucket === 'rest') {
                    return (
                      <details key={bucket}>
                        <summary className="cursor-pointer">{heading} <span className="text-sm text-gray-400">({suggestions.rest.length})</span></summary>
                        <ul className="divide-y mt-1">{suggestions.rest.map(row)}</ul>
                      </details>
                    );
                  }
                  return (
                    <section key={bucket}>
                      <div className="flex items-center justify-between">
                        <h4>{heading}</h4>
                        {bucket === 'random' && (
                          <button onClick={() => setSeed(Math.floor(Math.random() * 1e6))} className="text-sm text-blue-600 hover:underline">
                            ↻ {t('cookingPlan.reroll')}
                          </button>
                        )}
                      </div>
                      <ul className="divide-y">{suggestions[bucket].map(row)}</ul>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
