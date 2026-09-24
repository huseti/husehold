// Flat, single-color icon for packing lists -- same treatment as voucherIcons.jsx
// (single currentColor fill, no gradients/strokes/multi-color).

export default function PackingListIcon({ className = '', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" className={className} {...props}>
      <path d="M9 3a2 2 0 0 0-2 2v1H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2V5a2 2 0 0 0-2-2H9Zm0 3V5h6v1H9Zm-4 2h14v10H5V8Zm4 2v6h2v-6H9Zm4 0v6h2v-6h-2Z" />
    </svg>
  );
}
