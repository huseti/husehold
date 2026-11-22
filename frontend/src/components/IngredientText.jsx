import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buildIngredientMatcher } from '../utils/ingredientMatching';
import { formatQuantity, scaleQuantity } from '../utils/recipeDisplay';
import { unitLabel } from '../utils/localized';

const POPOVER_WIDTH = 256;

// Recipe text (instructions, description, notes) with the recipe's
// ingredients highlighted; tapping one shows how much of it the recipe
// needs (scaled to the servings currently shown), so nobody has to scroll
// back up to the ingredient list mid-step.
export default function IngredientText({ text, lines, units, fromServings, toServings, className = '' }) {
  const { t, i18n } = useTranslation();
  const matcher = useMemo(() => buildIngredientMatcher(lines), [lines]);
  const segments = useMemo(() => matcher(text || ''), [matcher, text]);
  const [open, setOpen] = useState(null); // { lineIndexes, top, left }
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(null);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    // Deferred so the tap that opened it doesn't immediately close it.
    const timer = setTimeout(() => document.addEventListener('pointerdown', close), 0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const show = (event, lineIndexes) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8));
    // Below the word, or above it when the word sits low on the screen.
    const below = rect.bottom + 6;
    const top = below + 140 > window.innerHeight ? Math.max(8, rect.top - 6) : below;
    setOpen({ lineIndexes, top, left, above: below + 140 > window.innerHeight });
  };

  const amountText = (line) => {
    const amount = formatQuantity(scaleQuantity(line.quantity, fromServings, toServings));
    const unit = line.unit ? unitLabel(units.find((u) => u.id === line.unit), i18n.language) : '';
    return [amount, unit].filter(Boolean).join(' ');
  };

  return (
    <>
      <p className={`whitespace-pre-wrap ${className}`}>
        {segments.map((segment, index) => (segment.lineIndexes ? (
          <button
            key={index}
            type="button"
            onClick={(e) => show(e, segment.lineIndexes)}
            className="inline p-0 m-0 bg-transparent border-0 font-medium text-eucalyptus-700 dark:text-eucalyptus-300 underline decoration-dotted decoration-2 underline-offset-4 cursor-pointer"
          >
            {segment.text}
          </button>
        ) : (
          <span key={index}>{segment.text}</span>
        )))}
      </p>
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-base text-gray-900"
          style={{
            top: open.top, left: open.left, width: POPOVER_WIDTH,
            transform: open.above ? 'translateY(-100%)' : undefined,
          }}
        >
          <ul className="space-y-1">
            {open.lineIndexes.map((lineIndex) => {
              const line = lines[lineIndex];
              const amount = amountText(line);
              return (
                <li key={lineIndex}>
                  <span className="font-semibold">{amount || t('recipes.noAmount')}</span>{' '}
                  {line.ingredient_name}
                  {line.note && <span className="text-gray-500">, {line.note}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
