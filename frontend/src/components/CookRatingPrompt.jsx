import { useTranslation } from 'react-i18next';
import { recipeService } from '../services/api';
import StarRating from './StarRating';

// Shown right after a cook task is ticked off, when the current user hasn't
// rated that recipe yet -- the moment their opinion is freshest. `entry` is
// the task's `cooking_entry` (null = nothing to ask).
export default function CookRatingPrompt({ entry, onClose }) {
  const { t } = useTranslation();
  if (!entry) return null;

  const handleRate = async (score) => {
    try {
      await recipeService.rate(entry.recipe, score);
    } catch (error) {
      console.error('Error rating recipe:', error);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-gray-500 mb-1">{t('cookingPlan.cookedLogged')}</p>
        <h3 className="text-lg font-semibold mb-4">{t('cookingPlan.howWasIt', { title: entry.recipe_title })}</h3>
        <StarRating value={null} onChange={handleRate} className="text-4xl" />
        <div className="mt-5">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">{t('recipes.skip')}</button>
        </div>
      </div>
    </div>
  );
}
