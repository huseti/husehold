import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import UndoToast from './UndoToast';

const UndoContext = createContext(null);
const DURATION_MS = 5000;

// One app-wide undo snackbar (it survives page changes).
//
// showUndo({ message, onUndo }) -- the action already happened; Undo reverts it.
// deleteWithUndo({ message, hide, restore, commit }) -- instead of an "Are you
//   sure?" dialog: `hide` removes the item from the screen right away, the real
//   delete (`commit`) only runs once the snackbar is gone, and Undo calls
//   `restore` instead. A second delete commits the first one immediately, as
//   does closing the tab (best effort).
export function UndoProvider({ children }) {
  const [toast, setToast] = useState(null);
  const pendingCommit = useRef(null);

  const flush = useCallback(() => {
    const commit = pendingCommit.current;
    pendingCommit.current = null;
    if (commit) {
      Promise.resolve()
        .then(commit)
        .catch((error) => console.error('Delayed delete failed:', error));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [flush]);

  const showUndo = useCallback(({ message, onUndo }) => {
    flush();
    setToast({ message, onUndo });
  }, [flush]);

  const deleteWithUndo = useCallback(({ message, hide, restore, commit }) => {
    flush();
    hide?.();
    pendingCommit.current = commit;
    setToast({
      message,
      onUndo: () => {
        pendingCommit.current = null;
        restore?.();
      },
    });
  }, [flush]);

  const handleClose = useCallback(() => {
    setToast(null);
    flush();
  }, [flush]);

  const handleUndo = () => {
    const current = toast;
    setToast(null);
    current?.onUndo?.();
  };

  return (
    <UndoContext.Provider value={{ showUndo, deleteWithUndo }}>
      {children}
      <UndoToast toast={toast} onUndo={toast?.onUndo ? handleUndo : undefined} onClose={handleClose} durationMs={DURATION_MS} />
    </UndoContext.Provider>
  );
}

export const useUndo = () => useContext(UndoContext);
