// Flat, single-color icons for the navbar's main menu items -- same
// treatment as taskIcons.jsx/voucherIcons.jsx (single currentColor fill, no
// gradients/strokes/multi-color). Shopping and cooking already have icons
// in taskIcons.jsx and are reused from there instead of duplicating them.

export function TasksMenuIcon({ className = '', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" className={className} {...props}>
      <path d="M9 2a1 1 0 0 0-1 1v1H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V3a1 1 0 0 0-1-1H9Zm0 2h6v2H9V4ZM6 6h2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1h2v14H6V6Zm9.3 4.3-4.3 4.3-2.3-2.3-1.4 1.4 3.7 3.7 5.7-5.7-1.4-1.4Z" />
    </svg>
  );
}

export function RecipesMenuIcon({ className = '', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" className={className} {...props}>
      <path d="M12 4c-2-1-5-1.5-7.5-1a1 1 0 0 0-.5.9v14a1 1 0 0 0 .6.9c2.3.5 5.2.9 7.1 2 .2.1.5.1.6 0 1.9-1.1 4.8-1.5 7.1-2a1 1 0 0 0 .6-.9v-14a1 1 0 0 0-.5-.9C17 2.5 14 3 12 4Zm0 2.2c1.5-.7 3.6-1 5-1v12c-1.8.4-3.6.8-5 1.5V6.2Zm-2 12.5c-1.4-.7-3.2-1.1-5-1.5v-12c1.4 0 3.5.3 5 1v12.5Z" />
    </svg>
  );
}

export function AnalyticsMenuIcon({ className = '', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" className={className} {...props}>
      <path d="M4 20V10h3v10H4Zm6.5 0V4h3v16h-3ZM17 20v-7h3v7h-3Z" />
    </svg>
  );
}
