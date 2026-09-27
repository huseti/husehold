// Flat, single-color gear icon -- the consistent "configure this page" entry
// point, top-right on every page that has one (same treatment as taskIcons.jsx).

export default function GearIcon({ className = '', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" className={className} {...props}>
      <path d="M19.4 13a7.4 7.4 0 0 0 .06-1l1.86-1.45a.5.5 0 0 0 .12-.64l-1.76-3.05a.5.5 0 0 0-.6-.22l-2.2.88a7.3 7.3 0 0 0-1.73-1l-.33-2.34a.5.5 0 0 0-.5-.43h-3.53a.5.5 0 0 0-.5.43l-.33 2.34a7.3 7.3 0 0 0-1.73 1l-2.2-.88a.5.5 0 0 0-.6.22L3.08 9.9a.5.5 0 0 0 .12.64L5.06 12a7.4 7.4 0 0 0 0 2l-1.86 1.45a.5.5 0 0 0-.12.64l1.76 3.05a.5.5 0 0 0 .6.22l2.2-.88a7.3 7.3 0 0 0 1.73 1l.33 2.34a.5.5 0 0 0 .5.43h3.53a.5.5 0 0 0 .5-.43l.33-2.34a7.3 7.3 0 0 0 1.73-1l2.2.88a.5.5 0 0 0 .6-.22l1.76-3.05a.5.5 0 0 0-.12-.64L19.4 13Zm-7.4 2.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}
