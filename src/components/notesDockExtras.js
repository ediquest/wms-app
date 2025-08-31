// src/components/notesDockExtras.js
// Minimal helpers to add outside-click closing + window API + Alt+N shortcut
// to your existing NotesDock without changing its layout.

import { useEffect } from 'react';

/**
 * Close panel when clicking outside of the given element.
 * @param {React.RefObject<HTMLElement>} panelRef - ref to your open panel container
 * @param {() => void} close - fn that closes the panel
 */
export function useOutsideClose(panelRef, close) {
  useEffect(() => {
    const onDown = (e) => {
      const el = panelRef?.current;
      if (!el) return;
      if (!el.contains(e.target)) close?.();
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [panelRef, close]);
}

/**
 * Expose simple control API on window: openNotesDock / closeNotesDock / toggleNotesDock
 * @param {{open:()=>void, close:()=>void, toggle:()=>void}} fns
 */
export function useNotesWindowApi({ open, close, toggle }) {
  useEffect(() => {
    window.openNotesDock  = open;
    window.closeNotesDock = close;
    window.toggleNotesDock= toggle;
    return () => {
      try {
        delete window.openNotesDock;
        delete window.closeNotesDock;
        delete window.toggleNotesDock;
      } catch {}
    };
  }, [open, close, toggle]);
}

/**
 * Keyboard shortcut Alt+N to toggle notes.
 * @param {() => void} toggle
 */
export function useNotesShortcut(toggle) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && e.code === 'KeyN' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        toggle?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
}