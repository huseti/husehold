// Flat, single-color "print" icon -- triggers the browser print dialog,
// which is also how recipes get exported as PDF ("Save as PDF" in that
// dialog) -- see RecipeDetail.jsx and RecipeHighlight.jsx.

export default function PrintIcon({ className = '', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" className={className} {...props}>
      <path d="M6 9V3h12v6h2a2 2 0 0 1 2 2v6h-4v4H6v-4H2v-6a2 2 0 0 1 2-2h2Zm2-4v4h8V5H8Zm8 12h-8v4h8v-4Zm2-4.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </svg>
  );
}
