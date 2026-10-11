// Small UI glyphs (edit, close, back, week arrows, undo, expand) from Phosphor
// (MIT) -- replace the former text characters ✎ ✕ ← → ↺ ▸ so they match the
// rest of the icon set. Thin glyphs use "bold" so they stay legible at 1em.
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';

const glyph = (Component, weight) => function Glyph({ className = '', ...props }) {
  return (
    <Component
      weight={weight}
      size="1em"
      className={`inline-block align-[-0.125em] ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};

export const EditGlyph = glyph(PencilSimple, 'fill');
export const CloseGlyph = glyph(X, 'bold');
export const BackArrow = glyph(ArrowLeft, 'bold');
export const PrevArrow = glyph(ArrowLeft, 'bold');
export const NextArrow = glyph(ArrowRight, 'bold');
export const UndoGlyph = glyph(ArrowCounterClockwise, 'bold');
export const ExpandCaret = glyph(CaretRight, 'bold');
