// Eucalyptus icon in front of a page or section title -- the same icon the page
// has in the navigation, so you recognize where you are at a glance.
export default function TitleIcon({ children, className = '' }) {
  return (
    <span className={`inline-flex flex-shrink-0 text-[0.85em] text-eucalyptus-600 dark:text-eucalyptus-400 ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}
