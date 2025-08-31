
// src/components/NotesOpenPill.jsx  (glue version)
import React from 'react';
import { t } from '../i18n.js';

const IconInfo = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M11 10h2v7h-2zm0-3h2v2h-2z"/><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 .001-16.001A8 8 0 0 1 12 20z"/>
  </svg>
);

export default function NotesOpenPill({ className='' }) {
  const wrapperFallback = {
    position: 'fixed', right: 12, top: 24, zIndex: 2147483647,
    display: 'flex', flexDirection: 'column', gap: 8
  };
  const pillFallback = {
    width: 36, height: 64, borderRadius: 16,
    border: '1px solid rgba(0,0,0,0.08)',
    background: 'rgba(255,255,255,0.9)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer'
  };

  const openDock = () => {
    try {
      if (typeof window !== 'undefined') {
        // Preferred: direct global function (Dock exposes it)
        if (typeof window.openNotesDock === 'function') {
          window.openNotesDock();
          return;
        }
        // Fallback: DOM CustomEvent (jeśli coś nasłuchuje)
        try { window.dispatchEvent(new CustomEvent('notes:open')); } catch {}
        // Fallback 2: spróbuj kliknąć istniejący przycisk z projektu
        const el = document.querySelector('[data-notes-toggle], [data-notes-open], .notes-open, .notes__open, button[title="Notatnik"], button[title="Notes"]');
        if (el) { el.click(); }
      }
    } catch {}
  };

  return (
    <div className={`fixed right-3 top-6 z-[2147483647] ${className}`} style={wrapperFallback}>
      <button
        title={t('openNotes')}
        onClick={openDock}
        className="flex items-center justify-center w-9 h-16 rounded-2xl shadow-md ring-1 ring-black/5 dark:ring-white/10 bg-white/90 dark:bg-neutral-900/90 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
        style={pillFallback}
      >
        <IconInfo />
      </button>
    </div>
  );
}
