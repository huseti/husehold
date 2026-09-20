import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StarRating from './StarRating';
import { formatQuantity, scaleQuantity } from '../utils/recipeDisplay';
import { localizedName, unitLabel } from '../utils/localized';

const todayIso = () => new Date().toLocaleDateString('sv-SE');

export default function RecipeDetail({
  recipe, labels, categories, units, onRate, onClearRating, onLogCooked, onDeleteMeal, onEdit, onDelete, onClose,
}) {
  const { t, i18n } = useTranslation();
  const [servings, setServings] = useState(recipe.servings);
  const [showCookForm, setShowCookForm] = useState(false);
  const [cookDate, setCookDate] = useState(todayIso());
  const [cookServings, setCookServings] = useState(recipe.servings);
  const [cookError, setCookError] = useState('');
  const [askForRating, setAskForRating] = useState(false);

  const formatDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language);

  const openCookForm = () => {
    setCookDate(todayIso());
    setCookServings(servings);
    setCookError('');
    setShowCookForm(true);
  };

  const submitCooked = async (e) => {
    e.preventDefault();
    setCookError('');
    try {
      await onLogCooked({ date_cooked: cookDate, servings_made: Number(cookServings) || 1 });
      setShowCookForm(false);
      // Rating right after cooking is when the opinion is freshest.
      setAskForRating(true);
    } catch (error) {
      console.error('Error logging cooked meal:', error);
      setCookError(t('recipes.cookLogFailed'));
    }
  };

  const rateFromPrompt = (score) => {
    onRate(score);
    setAskForRating(false);
  };

  const recipeLabels = labels.filter((l) => recipe.labels.includes(l.id));
  const recipeCategories = categories.filter((c) => recipe.categories.includes(c.id));

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start gap-4">
        <h3 className="text-2xl font-bold">{recipe.title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label={t('recipes.close')}>✕</button>
      </div>

      {(recipeCategories.length > 0 || recipeLabels.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {recipeCategories.map((c) => (
            <span key={`c${c.id}`} className="px-3 py-1 rounded-full text-sm bg-gray-800 text-white">{localizedName(c, i18n.language)}</span>
          ))}
          {recipeLabels.map((l) => (
            <span key={`l${l.id}`} style={{ backgroundColor: l.color_hex }} className="px-3 py-1 rounded-full text-sm text-white">{localizedName(l, i18n.language)}</span>
          ))}
        </div>
      )}

      {recipe.description && <p className="text-gray-600">{recipe.description}</p>}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
        {recipe.prep_time !== null && <span>{t('recipes.prepTime', { minutes: recipe.prep_time })}</span>}
        {recipe.cook_time !== null && <span>{t('recipes.cookTime', { minutes: recipe.cook_time })}</span>}
      </div>

      <div className="bg-gray-50 rounded-lg p-4 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <p className="text-xs uppercase text-gray-500 mb-1">{t('recipes.ratingAverage')}</p>
          {recipe.average_rating !== null ? (
            <span className="flex items-center gap-2">
              <StarRating value={recipe.average_rating} />
              <span className="text-sm text-gray-600">{recipe.average_rating} ({recipe.ratings.length})</span>
            </span>
          ) : (
            <span className="text-sm text-gray-400">{t('recipes.notRatedYet')}</span>
          )}
        </div>
        <div>
          <p className="text-xs uppercase text-gray-500 mb-1">{t('recipes.myRating')}</p>
          <span className="flex items-center gap-2">
            <StarRating value={recipe.my_rating} onChange={onRate} />
            {recipe.my_rating && (
              <button onClick={onClearRating} className="text-xs text-gray-400 hover:text-red-600">{t('recipes.clearRating')}</button>
            )}
          </span>
        </div>
        {recipe.ratings.length > 0 && (
          <div>
            <p className="text-xs uppercase text-gray-500 mb-1">{t('recipes.ratingsByMember')}</p>
            <ul className="text-sm text-gray-700">
              {recipe.ratings.map((r) => (
                <li key={r.id}>{r.rated_by_username}: {r.score}/5</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <h4 className="font-semibold">{t('recipes.ingredientsLabel')}</h4>
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <button onClick={() => setServings((s) => Math.max(1, s - 1))} className="w-7 h-7 rounded border border-gray-300 hover:bg-gray-100" aria-label="-">−</button>
            <span>{t('recipes.servings', { count: servings })}</span>
            <button onClick={() => setServings((s) => s + 1)} className="w-7 h-7 rounded border border-gray-300 hover:bg-gray-100" aria-label="+">+</button>
          </span>
        </div>
        {recipe.ingredients.length === 0 ? (
          <p className="text-sm text-gray-400">{t('recipes.noIngredients')}</p>
        ) : (
          <ul className="space-y-1">
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
      </div>

      {recipe.instructions && (
        <div>
          <h4 className="font-semibold mb-2">{t('recipes.instructionsLabel')}</h4>
          <p className="whitespace-pre-wrap">{recipe.instructions}</p>
        </div>
      )}

      {recipe.notes && (
        <div>
          <h4 className="font-semibold mb-2">{t('recipes.notesLabel')}</h4>
          <p className="whitespace-pre-wrap text-gray-700">{recipe.notes}</p>
        </div>
      )}

      {recipe.source_url && (
        <p className="text-sm">
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
            {t('recipes.source')}: {recipe.source_url}
          </a>
        </p>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h4 className="font-semibold">{t('recipes.cookingHistory')}</h4>
          <span className="text-sm text-gray-600">
            {recipe.last_cooked_date
              ? t('recipes.lastCooked', { date: formatDate(recipe.last_cooked_date), count: recipe.times_cooked })
              : t('recipes.neverCooked')}
          </span>
          {!showCookForm && (
            <button onClick={openCookForm} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
              {t('recipes.cookedButton')}
            </button>
          )}
        </div>

        {showCookForm && (
          <form onSubmit={submitCooked} className="bg-gray-50 rounded-lg p-3 flex flex-wrap items-end gap-3 mb-3">
            <label className="text-sm text-gray-600">
              {t('recipes.cookedOn')}
              <input type="date" max={todayIso()} value={cookDate} onChange={(e) => setCookDate(e.target.value)}
                className="block mt-1 px-3 py-1.5 border border-gray-300 rounded-lg" required />
            </label>
            <label className="text-sm text-gray-600">
              {t('recipes.servingsMade')}
              <input type="number" min="1" value={cookServings} onChange={(e) => setCookServings(e.target.value)}
                className="block w-24 mt-1 px-3 py-1.5 border border-gray-300 rounded-lg" required />
            </label>
            <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">{t('recipes.save')}</button>
            <button type="button" onClick={() => setShowCookForm(false)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300">{t('recipes.cancel')}</button>
            {cookError && <p className="w-full text-sm text-red-600">{cookError}</p>}
          </form>
        )}

        {askForRating && (
          <div className="bg-amber-50 rounded-lg p-3 flex flex-wrap items-center gap-3 mb-3">
            <span className="text-sm">{t('recipes.howWasIt')}</span>
            <StarRating value={recipe.my_rating} onChange={rateFromPrompt} />
            <button onClick={() => setAskForRating(false)} className="text-sm text-gray-500 hover:text-gray-800">{t('recipes.skip')}</button>
          </div>
        )}

        {recipe.recent_meal_events.length > 0 && (
          <ul className="text-sm text-gray-700 space-y-1">
            {recipe.recent_meal_events.map((event) => (
              <li key={event.id} className="flex items-center gap-2">
                <span>{formatDate(event.date_cooked)}</span>
                <span className="text-gray-500">· {t('recipes.servings', { count: event.servings_made })}</span>
                {event.logged_by_username && <span className="text-gray-400">· {event.logged_by_username}</span>}
                <button onClick={() => onDeleteMeal(event.id)} className="text-gray-300 hover:text-red-600 px-1" aria-label={t('recipes.removeLogEntry')}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-3 pt-2 border-t">
        <button onClick={onEdit} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">{t('recipes.edit')}</button>
        <button onClick={onDelete} className="bg-gray-200 text-red-600 px-4 py-2 rounded hover:bg-gray-300">{t('recipes.delete')}</button>
      </div>
    </div>
  );
}
