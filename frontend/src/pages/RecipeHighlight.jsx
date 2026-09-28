import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { recipeService, unitService } from '../services/api';
import { formatQuantity, scaleQuantity } from '../utils/recipeDisplay';
import { unitLabel } from '../utils/localized';
import { asClickableUrl } from '../utils/sourceDisplay';

const SOURCE_TYPE_KEYS = { manual: 'sourceTypeManual', website: 'sourceTypeWebsite', photo: 'sourceTypePhoto', instagram: 'sourceTypeInstagram' };
const FONT_SCALE_KEY = 'recipeHighlightFontScale';
const BODY_SIZES = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl'];
const TITLE_SIZES = ['text-3xl', 'text-4xl', 'text-5xl', 'text-6xl'];
const HEADING_SIZES = ['text-xl', 'text-2xl', 'text-3xl', 'text-4xl'];
const MAX_SCALE = BODY_SIZES.length - 1;

const readStoredFontScale = () => {
  const stored = Number(localStorage.getItem(FONT_SCALE_KEY));
  return Number.isFinite(stored) && stored >= 0 && stored <= MAX_SCALE ? stored : 1;
};

// Full-screen, large-text, scrollable recipe view for reading while cooking --
// reached from the recipe detail modal or an Expand button on a planned dish
// (Dashboard's "This Week"/"Today's meals" panels). Keeps the screen awake
// (Wake Lock API) since a phone would otherwise dim/lock mid-recipe.
export default function RecipeHighlight() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [recipe, setRecipe] = useState(null);
  const [units, setUnits] = useState([]);
  const [servings, setServings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fontScale, setFontScale] = useState(readStoredFontScale);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([recipeService.get(id), unitService.getAll()])
      .then(([recipeRes, unitsRes]) => {
        setRecipe(recipeRes.data);
        setUnits(unitsRes.data.results || []);
        const requested = Number(searchParams.get('servings'));
        setServings(Number.isFinite(requested) && requested > 0 ? requested : recipeRes.data.servings);
      })
      .catch((error) => console.error('Error loading recipe:', error))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (error) {
      // Common on backgrounded tabs / unsupported contexts -- non-fatal, reading still works.
      console.error('Wake lock request failed:', error);
    }
  }, []);

  useEffect(() => {
    requestWakeLock();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [requestWakeLock]);

  const adjustFont = (delta) => {
    setFontScale((current) => {
      const next = Math.min(MAX_SCALE, Math.max(0, current + delta));
      localStorage.setItem(FONT_SCALE_KEY, String(next));
      return next;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  if (!recipe) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-gray-500">{t('recipes.highlightNotFound')}</p>
        <button onClick={() => navigate('/recipes')} className="text-blue-600 hover:underline">
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 bg-white border-b z-10 px-4 py-3 flex items-center justify-between gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1">
          ← {t('common.back')}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustFont(-1)}
            disabled={fontScale === 0}
            className="w-9 h-9 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 text-sm font-semibold"
            aria-label={t('recipes.highlightFontSmaller')}
            title={t('recipes.highlightFontSmaller')}
          >
            A−
          </button>
          <button
            onClick={() => adjustFont(1)}
            disabled={fontScale === MAX_SCALE}
            className="w-9 h-9 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 text-sm font-semibold"
            aria-label={t('recipes.highlightFontLarger')}
            title={t('recipes.highlightFontLarger')}
          >
            A+
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-16">
        <h1 className={`${TITLE_SIZES[fontScale]} font-bold mb-6`}>{recipe.title}</h1>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className={`${BODY_SIZES[fontScale]} font-semibold`}>{t('recipes.ingredientsLabel')}</span>
          <span className="flex items-center gap-2">
            <button onClick={() => setServings((s) => Math.max(1, s - 1))} className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100" aria-label="-">−</button>
            <span className={BODY_SIZES[Math.max(0, fontScale - 1)]}>{t('recipes.servings', { count: servings })}</span>
            <button onClick={() => setServings((s) => s + 1)} className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100" aria-label="+">+</button>
          </span>
        </div>

        {recipe.ingredients.length === 0 ? (
          <p className={`${BODY_SIZES[fontScale]} text-gray-400 mb-8`}>{t('recipes.noIngredients')}</p>
        ) : (
          <ul className={`${BODY_SIZES[fontScale]} space-y-2 mb-8`}>
            {recipe.ingredients.map((line) => {
              const amount = formatQuantity(scaleQuantity(line.quantity, recipe.servings, servings));
              return (
                <li key={line.id}>
                  {amount && <span className="font-medium">{amount} </span>}
                  {line.unit && <span>{unitLabel(units.find((u) => u.id === line.unit), i18n.language)} </span>}
                  {line.ingredient_name}
                  {line.note && <span className="text-gray-500">, {line.note}</span>}
                </li>
              );
            })}
          </ul>
        )}

        {recipe.instructions && (
          <div className="mb-8">
            <h2 className={`${HEADING_SIZES[fontScale]} font-semibold mb-3`}>{t('recipes.instructionsLabel')}</h2>
            <p className={`${BODY_SIZES[fontScale]} whitespace-pre-wrap leading-relaxed`}>{recipe.instructions}</p>
          </div>
        )}

        {(recipe.prep_time !== null || recipe.cook_time !== null || recipe.notes || recipe.source) && (
          <div className="border-t pt-4 space-y-2 text-sm text-gray-500">
            {(recipe.prep_time !== null || recipe.cook_time !== null) && (
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {recipe.prep_time !== null && <span>{t('recipes.prepTime', { minutes: recipe.prep_time })}</span>}
                {recipe.cook_time !== null && <span>{t('recipes.cookTime', { minutes: recipe.cook_time })}</span>}
              </div>
            )}
            {recipe.notes && (
              <div>
                <p className="font-semibold text-gray-600 mb-1">{t('recipes.notesLabel')}</p>
                <p className="whitespace-pre-wrap">{recipe.notes}</p>
              </div>
            )}
            {recipe.source && (
              <p>
                {asClickableUrl(recipe.source) ? (
                  <a href={asClickableUrl(recipe.source)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                    {t('recipes.source')}: {recipe.source}
                  </a>
                ) : (
                  <span>{t('recipes.source')}: {recipe.source}</span>
                )}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6">
          {t('recipes.addedMeta', {
            date: new Date(`${recipe.created_at.slice(0, 10)}T00:00:00`).toLocaleDateString(i18n.language),
            by: recipe.created_by_username || t('recipes.addedMetaUnknown'),
          })}
          {' · '}{t(`recipes.${SOURCE_TYPE_KEYS[recipe.source_type] || SOURCE_TYPE_KEYS.manual}`)}
        </p>
      </main>
    </div>
  );
}
