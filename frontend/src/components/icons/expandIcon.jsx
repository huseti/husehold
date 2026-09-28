// Flat, single-color "expand to fullscreen" icon -- entry point into Highlight
// mode from the recipe detail view and the dashboard's planned-dish rows
// (same treatment as gearIcon.jsx).

export default function ExpandIcon({ className = '', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" className={className} {...props}>
      <path d="M7 14H5v5h5v-2H7v-3Zm-2-4h2V7h3V5H5v5Zm12 7h-3v2h5v-5h-2v3ZM14 5v2h3v3h2V5h-5Z" />
    </svg>
  );
}
