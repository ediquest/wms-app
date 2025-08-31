import React from 'react';
import { t } from '../i18n.js';
import './NotesDock.css';

export default function NotesOpenPill({ className = '' }) {
  const openDock = () => {
    try {
      if (typeof window !== 'undefined') {
        if (typeof window.openNotesDock === 'function') {
          window.openNotesDock();
          return;
        }
        try { window.dispatchEvent(new CustomEvent('notes:open')); } catch {}
        const el = document.querySelector('[data-notes-toggle], [data-notes-open], .notes-open, .notes__open, button[title="Notatnik"], button[title="Notes"]');
        if (el) el.click();
      }
    } catch {}
  };

  return (
    <div className={`notes-open-pill-wrapper ${className}`}>
      <div className="notes-open-pill" onClick={openDock}>
        <span className="notes-open-text">{t('notes.title') || 'notes.title'}</span>
      </div>
    </div>
  );
}
