// src/notesOpenMount.js (no JSX)
import React from 'react';
import { createRoot } from 'react-dom/client';
import NotesOpenPill from './components/NotesOpenPill.jsx';

export function mountNotesOpenPill() {
  const id = 'notes-open-pill-root';
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  const root = createRoot(el);
  root.render(React.createElement(NotesOpenPill, {}));
}