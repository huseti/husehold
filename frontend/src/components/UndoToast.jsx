import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Bottom snackbar confirming an action, with an Undo button. Auto-dismisses
// after a few seconds; a new toast (new `toast` object) restarts the timer.
export default function UndoToast({ toast, onUndo, onClose, durationMs = 5000 }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [toast, onClose, durationMs]);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md flex items-center gap-3 rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-lg px-4 py-3 text-sm"
    >
      <span className="flex-1 min-w-0 truncate">{toast.message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="font-semibold text-eucalyptus-300 dark:text-eucalyptus-700 hover:underline flex-shrink-0"
        >
          {t('tasks.undo')}
        </button>
      )}
    </div>
  );
}
