// Flat, single-color icon for vouchers -- same treatment as taskIcons.jsx
// (single currentColor fill, no gradients/strokes/multi-color).

export default function VoucherIcon({ className = '', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" className={className} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7Zm2 0v2.2a4 4 0 0 1 0 7.6V19h14v-2.2a4 4 0 0 1 0-7.6V7H5Zm4 1h2v2H9V8Zm0 3.5h2v2H9v-2Zm0 3.5h2v2H9v-2Z" />
    </svg>
  );
}
