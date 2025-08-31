// src/components/NotesOverlayMount.jsx
import React from 'react';
import { createPortal } from 'react-dom';
import NotesPills from './NotesPills.jsx';
import NotesDock from './NotesDock.jsx';
import { emit } from '../bus/notesBus.js';

export default function NotesOverlayMount() {
  const containerRef = React.useRef(null);
  const [ctx, setCtx] = React.useState({ ifaceId: 'global', secKey: '0' });
  const [forceOpen, setForceOpen] = React.useState(false);
  const [debug, setDebug] = React.useState(false);

  React.useEffect(() => {
    try {
      const seen = localStorage.getItem('notesFirstShown');
      if (!seen) {
        setForceOpen(true);
        localStorage.setItem('notesFirstShown', '1');
      }
      setDebug(localStorage.getItem('notesDebug') === '1');
    } catch {}
  }, []);

  React.useEffect(() => {
    const handler = (e) => {
      const { ifaceId, secKey } = e.detail || {};
      setCtx({
        ifaceId: String(ifaceId ?? 'global'),
        secKey: String(secKey ?? '0'),
      });
    };
    window.addEventListener('notes:ctx', handler);
    return () => window.removeEventListener('notes:ctx', handler);
  }, []);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (e.code === 'KeyN') { emit('notes:open'); }
        if (e.code === 'KeyT') { emit('notes:openTrash'); }
        if (e.code === 'KeyA') { emit('notes:align'); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    if (!containerRef.current) {
      const el = document.createElement('div');
      el.id = 'notes-overlay-root';
      el.style.position = 'fixed';
      el.style.inset = '0';
      el.style.zIndex = '2147483647'; // maximum
      el.style.pointerEvents = 'none'; // restore on children
      if (debug) {
        el.style.outline = '2px dashed red';
        el.style.outlineOffset = '-2px';
      }
      document.body.appendChild(el);
      containerRef.current = el;
    }
  }, [debug]);

  if (!containerRef.current) return null;

  return createPortal(
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto' }}>
        <NotesPills />
        <NotesDock ifaceId={ctx.ifaceId} secKey={ctx.secKey} openInitially={forceOpen} />
      </div>
    </div>,
    containerRef.current
  );
}