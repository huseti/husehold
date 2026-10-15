import { Link } from 'react-router-dom';

// "Nothing here yet": a muted icon, one line of text and, where it helps, the
// next step as a button or link -- instead of a lone grey sentence.
export default function EmptyState({ icon, text, action, compact = false, className = '' }) {
  const actionClass = 'btn btn-sm btn-primary mt-3';
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-4' : 'py-8'} ${className}`}>
      {icon && (
        <span className={`${compact ? 'text-3xl' : 'text-4xl'} text-eucalyptus-300 dark:text-eucalyptus-700 mb-2`} aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="text-sm text-gray-500 max-w-xs">{text}</p>
      {action && (action.to
        ? <Link to={action.to} className={`${actionClass} no-underline text-gray-900 hover:text-gray-900 dark:text-white dark:hover:text-white`}>{action.label}</Link>
        : <button type="button" onClick={action.onClick} className={actionClass}>{action.label}</button>)}
    </div>
  );
}
