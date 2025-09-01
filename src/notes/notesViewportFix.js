// src/notes/notesViewportFix.js
// Small helpers to avoid "invisible overlay" issues with the notes canvas.

/**
 * Toggles .notes-open / .notes-closed classes on <html> based on the "open" state.
 * Call inside NotesDock component: useNotesOpenClass(open)
 */
export function useNotesOpenClass(open){
  try {
    const el = document.documentElement;
    if (open) {
      el.classList.add('notes-open');
      el.classList.remove('notes-closed');
    } else {
      el.classList.remove('notes-open');
      el.classList.add('notes-closed');
    }
  } catch (_) {}
}

/**
 * Listens for a global 'notes:safe-close' event and runs the provided callback,
 * so you can force-close notes after import success.
 */
export function useNotesSafeClose(onClose){
  try {
    const handler = () => { try { onClose && onClose(); } catch(_) {} };
    window.addEventListener('notes:safe-close', handler);
    // Return cleanup function for React effect usage
    return () => window.removeEventListener('notes:safe-close', handler);
  } catch (_) {
    return () => {};
  }
}

/** Programmatically emit a "safe close" request (use after successful import) */
export function emitNotesSafeClose(){
  try { window.dispatchEvent(new Event('notes:safe-close')); } catch(_) {}
}
