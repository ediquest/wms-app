// src/components/NotesPills.jsx
import React from 'react';
import { emit } from '../bus/notesBus.js';
import { t } from '../i18n.js';

const Pill = ({ title, onClick, children }) => {
  const styleFallback = {
    width: 36, height: 64, borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)',
    background: 'rgba(255,255,255,0.9)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
  };
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex items-center justify-center w-9 h-16 rounded-2xl shadow-md ring-1 ring-black/5 dark:ring-white/10 bg-white/90 dark:bg-neutral-900/90 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
      style={styleFallback}
    >
      {children}
    </button>
  );
};

const IconInfo = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M11 10h2v7h-2zm0-3h2v2h-2z"/><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 .001-16.001A8 8 0 0 1 12 20z"/>
  </svg>
);
const IconTrash = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M9 3h6a1 1 0 0 1 1 1v1h4v2H4V5h4V4a1 1 0 0 1 1-1zm1 5h2v10h-2zm4 0h2v10h-2zM7 8h2v10H7z"/>
  </svg>
);
const IconAlign = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...props}>
    <path fill="currentColor" d="M3 4h18v2H3zM3 9h12v2H3zM3 14h18v2H3zM3 19h12v2H3z"/>
  </svg>
);

export default function NotesPills({ className='' }) {
  const wrapperFallback = {
    position: 'fixed', right: 12, top: 24, zIndex: 2147483647,
    display: 'flex', flexDirection: 'column', gap: 8
  };
  return (
    <div className={`fixed right-3 top-6 z-[2147483647] flex flex-col gap-2 ${className}`} style={wrapperFallback}>
      <Pill title={t('openTrash')} onClick={()=>emit('notes:openTrash')}><IconTrash /></Pill>
      <Pill title={t('alignNotes')} onClick={()=>emit('notes:align')}><IconAlign /></Pill>
      <Pill title={t('about')} onClick={()=>emit('notes:open')}><IconInfo /></Pill>
    </div>
  );
}