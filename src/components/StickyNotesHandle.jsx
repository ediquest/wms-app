
import React, { useEffect, useRef, useState } from 'react';
import { getUI, setUI } from '../db/notesDB.js';
import { t } from '../i18n.js';

/**
 * StickyNotesHandle
 * - Always visible (fixed position, very high z-index).
 * - Glued to the right edge of the dock (centered) when dock is open.
 * - When dock is closed, sits at right:12px and can be dragged vertically;
 *   the vertical offset is saved in dockUI.handleOffset.
 * - Does NOT rely on external CSS other than a tiny class below.
 */
export default function StickyNotesHandle(){
  const elRef = useRef(null);
  const [ui, setUi] = useState({ open:false, handleOffset: 0 });
  const drag = useRef({ on:false, startY:0, startOff:0 });

  // Read initial UI (offset), and set up observers for dock position
  useEffect(() => {
    let mounted = true;
    (async () => {
      const v = await getUI();
      if (!mounted) return;
      setUi(prev => ({ ...prev, open: !!v.open, handleOffset: v.handleOffset || 0 }));
      recalc(); // initial
    })();

    const onToggle = () => {
      // called after dock toggles open/close; recalc position
      Promise.resolve().then(recalc);
      // also refresh "open" flag from DB for robustness
      getUI().then(v => setUi(prev => ({ ...prev, open: !!v.open })));
    };

    window.addEventListener('resize', recalc, { passive: true });
    window.addEventListener('scroll', recalc, { passive: true });
    window.addEventListener('notes:open', onToggle);
    window.addEventListener('notes:close', onToggle);
    window.addEventListener('notes:toggle', onToggle);

    // Observe DOM changes around the dock
    const mo = new MutationObserver(() => recalc());
    const root = document.body;
    mo.observe(root, { attributes:true, childList:true, subtree:true });

    return () => {
      mounted = false;
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc);
      window.removeEventListener('notes:open', onToggle);
      window.removeEventListener('notes:close', onToggle);
      window.removeEventListener('notes:toggle', onToggle);
      mo.disconnect();
    };
  }, []);

  const gap = 8;
  function recalc(){
    const el = elRef.current;
    if (!el) return;
    const dock = document.querySelector('.notes-dock');
    const open = dock?.classList.contains('open');
    const rect = dock?.getBoundingClientRect();
    const h = el.offsetHeight || 56;
    const w = el.offsetWidth || 28;

    el.style.position = 'fixed';
    el.style.zIndex = '2147483647';
    el.style.left = '';
    el.style.top = '';
    el.style.right = '';

    if (open && rect) {
      // stick to dock: to the left of its bounding box, centered vertically
      const left = Math.round(rect.left - w - gap);
      const top  = Math.round(rect.top + rect.height / 2 - h / 2);
      el.style.left = left + 'px';
      el.style.top  = top + 'px';
    } else {
      // closed: park at right:12px and use saved offset from UI
      const top = Math.round(window.innerHeight/2 + (ui.handleOffset || 0) - h/2);
      el.style.right = '12px';
      el.style.top   = top + 'px';
    }
  }

  // Drag vertically when closed
  function onMouseDown(e){
    // only allow drag when dock is closed
    const dock = document.querySelector('.notes-dock');
    if (dock?.classList.contains('open')) return;
    drag.current.on = true;
    drag.current.startY = e.clientY;
    drag.current.startOff = ui.handleOffset || 0;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    try { document.body.classList.add('notes-resizing'); } catch {}
    e.preventDefault();
    e.stopPropagation();
  }
  function onMove(e){
    if (!drag.current.on) return;
    const dy = e.clientY - drag.current.startY;
    let next = drag.current.startOff + dy;
    const vh = Math.max(window.innerHeight, 1);
    const dockH = (0.75) * vh; // assume typical height to clamp when closed
    const margin = dockH * 0.05;
    const half = dockH / 2;
    if (next < -half + margin) next = -half + margin;
    if (next >  half - margin) next =  half - margin;
    setUi(prev => ({ ...prev, handleOffset: next }));
    recalc();
  }
  async function onUp(){
    if (!drag.current.on) return;
    drag.current.on = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    try { document.body.classList.remove('notes-resizing'); } catch {}
    // persist
    try {
      const v = await getUI();
      await setUI({ ...v, handleOffset: ui.handleOffset || 0 });
    } catch {}
  }

  // Recalc every time ui.handleOffset changes
  useEffect(() => { recalc(); }, [ui.handleOffset]);

  // Toggle dock open/close by firing the same event NotesDock handles
  const toggle = () => {
    try {
      window.dispatchEvent(new CustomEvent('notes:toggle'));
      setTimeout(recalc, 0);
    } catch {}
  };

  return (
    <div
      ref={elRef}
      className="sticky-notes-handle"
      title={t('notes.open','Otwórz/Zamknij Notes')}
      onMouseDown={onMouseDown}
      onClick={toggle}
      style={{background:'#27b3a7', color:'#fff', borderRadius:'12px 0 0 12px', padding:'10px 6px', cursor:'pointer', userSelect:'none'}}
    >
      <span style={{writingMode:'vertical-rl', transform:'rotate(180deg)', fontWeight:600}}>{t('notes.title','Notes')}</span>
    </div>
  );
}
