import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import './NotesDock.css';
import {
  initNotesDB, listTabs, addTab, renameTab, deleteTab,
  getActiveTabId, setActiveTabId,
  listElements, newTextElement, saveTextContent, moveResizeElement, deleteElement,
  addImageElement, getBlobUrl,
  getUI, setUI
} from '../db/notesDB.js';
import { t } from '../i18n.js';
import ScrollTabs from './ScrollTabs.jsx';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function NotesDock() {
  const [ready, setReady] = useState(false);
  const [ui, setUi] = useState({ open: false, widthPct: 0.6, heightPct: 0.6, handleOffset: 0 });
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveId] = useState(null);
  const [elements, setElements] = useState([]);

  const dockRef = useRef(null);
  const canvasRef = useRef(null);
  const panelRef = useRef(null);
  const [handleTop, setHandleTop] = useState(null);
  const dockResizeRef = useRef({ mode:null, startX:0, startY:0, startW:0, startH:0 });
  const dragHandleRef = useRef({ dragging: false, moved:false, startX: 0, startY: 0, startW: 0, startH: 0, startOff: 0 });

  const setDockAndPanelRef = useCallback((el) => { dockRef.current = el; panelRef.current = el; }, []);

  // Close when clicking outside
  useEffect(() => {
    const onDown = (e) => {
      if (!ui.open) return;
      const panel = panelRef.current;
      if (!panel) return;
      if (!panel.contains(e.target) && !e.target.closest?.('.notes-handle')) {
        setUi(u => ({ ...u, open: false }));
      }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [ui.open]);

  // Window API + Alt+N
  useEffect(() => {
    window.openNotesDock  = () => setUi(u => ({ ...u, open: true }));
    window.closeNotesDock = () => setUi(u => ({ ...u, open: false }));
    window.toggleNotesDock= () => setUi(u => ({ ...u, open: !u.open }));
    const onKey = (e) => {
      if (e.altKey && e.code === 'KeyN' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        setUi(u => ({ ...u, open: !u.open }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      delete window.openNotesDock;
      delete window.closeNotesDock;
      delete window.toggleNotesDock;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Init DB + UI + tabs
  useEffect(() => {
    (async () => {
      await initNotesDB();
      const uiState = await getUI();
      setUi({ open: false, widthPct: uiState?.widthPct ?? 0.6, heightPct: uiState?.heightPct ?? 0.8, handleOffset: uiState?.handleOffset ?? 0 });
      const tb = await listTabs();
      setTabs(tb);
      const aId = (await getActiveTabId()) || (tb[0]?.id ?? null);
      setActiveId(aId);
      setReady(true);
    })();
  }, []);

  // Load elements for active tab
  useEffect(() => {
    if (!activeTabId) return;
    (async () => {
      const els = await listElements(activeTabId);
      const withUrls = await Promise.all(els.map(async e => {
        if (e.type === 'image' && e.blobId) {
          const url = await getBlobUrl(e.blobId);
          return { ...e, url };
        }
        return e;
      }));
      setElements(withUrls);
    })();
  }, [activeTabId, ready]);

  // Apply CSS vars + persist UI

  // Recompute handle top to stick to dock center when open
  useEffect(() => {
    if (!ui.open) return;
    const recalc = () => {
      try {
        const el = dockRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const top = r.top + (r.height / 2);
        setHandleTop(top);
      } catch {}
    };
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, { passive: true });
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc);
    };
  }, [ui.open, ui.handleOffset, ui.heightPct, ui.widthPct]);

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    el.style.setProperty('--dock-width', `${Math.round((ui.widthPct ?? 0.6) * 100)}vw`);
    el.style.setProperty('--dock-height', `${Math.round((ui.heightPct ?? 0.6) * 100)}vh`);
    el.style.setProperty('--handle-offset', `${ui.handleOffset || 0}px`);
    setUI({ open: ui.open, widthPct: ui.widthPct, heightPct: ui.heightPct, handleOffset: ui.handleOffset });
  }, [ui]);

  const toggleOpen = useCallback(() => { setUi(u => ({ ...u, open: !u.open })); }, []);

  // Drag the handle to resize notes panel / move handle vertically
  useEffect(() => {
    const handleMove = (e) => {
      if (!dragHandleRef.current.dragging) return;
      const dx = dragHandleRef.current.startX - e.clientX;
      const dy = dragHandleRef.current.startY - e.clientY;
      const vw = Math.max(window.innerWidth, 1);
      const vh = Math.max(window.innerHeight, 1);
      dragHandleRef.current.moved = dragHandleRef.current.moved || Math.abs(dx) + Math.abs(dy) > 3;
      // available half-height of the dock
      const dockH = (ui.heightPct ?? 0.6) * Math.max(window.innerHeight, 1);
      const margin = dockH * 0.05; // 5% margin
      const half = dockH / 2;
      let handleOffset = clamp(
        dragHandleRef.current.startOff + (e.clientY - dragHandleRef.current.startY),
        -half + margin,
        half - margin
      );
      if (ui.open) {
        let widthPct  = clamp(dragHandleRef.current.startW + dx / vw, 0.3, 0.9);
        let heightPct = clamp(dragHandleRef.current.startH + dy / vh, 0.3, 0.8);
        setUi(u => ({ ...u, widthPct, heightPct, handleOffset }));
      } else {
        setUi(u => ({ ...u, handleOffset }));
      }
    };
    const handleUp = () => {
      try { document.querySelector('.notes-handle')?.classList.remove('dragging'); } catch {}
      dragHandleRef.current.dragging = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    const start = (e) => {
      try { document.querySelector('.notes-handle')?.classList.add('dragging'); } catch {}
      dragHandleRef.current.dragging = true;
      dragHandleRef.current.moved = false;
      dragHandleRef.current.startX = e.clientX;
      dragHandleRef.current.startY = e.clientY;
      dragHandleRef.current.startW = ui.widthPct ?? 0.6;
      dragHandleRef.current.startH = ui.heightPct ?? 0.6;
      dragHandleRef.current.startOff = ui.handleOffset || 0;
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    };
    const handleEl = document.querySelector('.notes-handle');
    if (!handleEl) return;
    handleEl.addEventListener('mousedown', start);
    return () => handleEl.removeEventListener('mousedown', start);
  }, [ui.widthPct, ui.heightPct, ui.handleOffset]);

  // Z-index helper
  const bringToFront = useCallback(async (id) => {
    const nextZ = (elements.reduce((m,e)=>Math.max(m, e.zIndex||0), 0) || 0) + 1;
    setElements(prev => prev.map(x => x.id === id ? { ...x, zIndex: nextZ } : x));
    try { await moveResizeElement(id, { zIndex: nextZ }); } catch {}
  }, [elements]);

  // Canvas dblclick add
  const onCanvasDoubleClick = async (e) => {
    if (!canvasRef.current || !activeTabId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left - 120, 8, rect.width - 248);
    const y = clamp(e.clientY - rect.top - 60, 8, rect.height - 140);
    const el = await newTextElement(activeTabId, x, y);
    const nextZ = (elements.reduce((m,e)=>Math.max(m, e.zIndex||0), 0) || 0) + 1;
    setElements(prev => [...prev, { ...el, zIndex: nextZ }]);
    try { await moveResizeElement(el.id, { zIndex: nextZ }); } catch {}
    setTimeout(() => {
      const ta = canvasRef.current?.querySelector(`[data-note="${el.id}"] textarea`);
      ta?.focus();
    }, 0);
  };

  const handlePaste = async (evt) => {
    if (!activeTabId) return;
    const items = evt.clipboardData?.items || [];
    for (const it of items) {
      if (it.type.startsWith('image/')) {
        const blob = it.getAsFile();
        const el = await addImageElement(activeTabId, blob, 16, 16);
        const url = await getBlobUrl(el.blobId);
        const nextZ = (elements.reduce((m,e)=>Math.max(m, e.zIndex||0), 0) || 0) + 1;
        setElements(prev => [...prev, { ...el, url, zIndex: nextZ }]);
        try { await moveResizeElement(el.id, { zIndex: nextZ }); } catch {}
        evt.preventDefault();
        break;
      }
    }
  };
  const handleDrop = async (evt) => {
    if (!activeTabId) return;
    evt.preventDefault();
    const files = Array.from(evt.dataTransfer.files || []);
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        const el = await addImageElement(activeTabId, f, 24, 24);
        const url = await getBlobUrl(el.blobId);
        const nextZ = (elements.reduce((m,e)=>Math.max(m, e.zIndex||0), 0) || 0) + 1;
        setElements(prev => [...prev, { ...el, url, zIndex: nextZ }]);
        try { await moveResizeElement(el.id, { zIndex: nextZ }); } catch {}
      }
    }
  };

  // Tabs ops
  const onAddTab = async () => {
    const id = await addTab(`${t('notes.newTab','Nowa zakładka')}`);
    const tb = await listTabs();
    setTabs(tb);
    setActiveId(id);
    await setActiveTabId(id);
  };
  const onPickTab = async (id) => { setActiveId(id); await setActiveTabId(id); };
  const onRenameTab = async (id, name) => {
    await renameTab(id, name.trim() || t('notes.tab','Zakładka'));
    setTabs(await listTabs());
  };

  // Move note
  const startDrag = (id, startX, startY) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    bringToFront(id);
    const mm = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const nx = clamp(el.x + dx, 0, Math.max((canvasRef.current?.clientWidth||0) - el.width - 4, 0));
      const ny = clamp(el.y + dy, 0, Math.max((canvasRef.current?.clientHeight||0) - el.height - 4, 0));
      setElements(prev => prev.map(x => x.id === id ? { ...x, x: nx, y: ny } : x));
    };
    const mu = async () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
      const final = elements.find(e => e.id === id);
      if (final) await moveResizeElement(id, { x: final.x, y: final.y });
    };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  };

  // Resize note (dir: 'e' | 's' | 'se')
  const startResize = (id, startX, startY, dir='se') => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    bringToFront(id);
    const cw = canvasRef.current?.clientWidth||0;
    const ch = canvasRef.current?.clientHeight||0;
    const minW = 160, minH = 110;
    const mm = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let nw = el.width;
      let nh = el.height;
      if (dir==='e' || dir==='se') nw = clamp(el.width + dx, minW, Math.min(1400, cw - el.x - 4));
      if (dir==='s' || dir==='se') nh = clamp(el.height + dy, minH, Math.min(1400, ch - el.y - 4));
      setElements(prev => prev.map(x => x.id === id ? { ...x, width: nw, height: nh } : x));
    };
    const mu = async () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
      const final = elements.find(e => e.id === id);
      if (final) await moveResizeElement(id, { width: final.width, height: final.height });
    };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  };

  const onChangeText = async (id, value) => {
    setElements(prev => prev.map(x => x.id === id ? { ...x, content: value } : x));
    await saveTextContent(id, value);
  };

  const onDeleteElement = async (id) => {
    await deleteElement(id);
    setElements(prev => prev.filter(x => x.id !== id));
  };

  // --- Dock edge resizing (top 'n' and left 'w') ---
  useEffect(() => {
    if (!ui.open) return; // only when open
    const root = dockRef.current;
    if (!root) return;
    const north = root.querySelector('.dock-resize-n');
    const west  = root.querySelector('.dock-resize-w');
    const vw = Math.max(window.innerWidth, 1);
    const vh = Math.max(window.innerHeight, 1);

    const move = (e) => {
      if (!dockResizeRef.current.mode) return;
      e.preventDefault();
      if (dockResizeRef.current.mode === 'n') {
        const dy = (dockResizeRef.current.startY - e.clientY) / vh;
        const heightPct = clamp(dockResizeRef.current.startH + dy, 0.4, 0.95);
        setUi(u => ({ ...u, heightPct }));
      } else if (dockResizeRef.current.mode === 'w') {
        const dx = (dockResizeRef.current.startX - e.clientX) / vw;
        const widthPct = clamp(dockResizeRef.current.startW + dx, 0.35, 0.95);
        setUi(u => ({ ...u, widthPct }));
      }
    };
    const up = () => {
      dockResizeRef.current.mode = null;
      document.body.classList.remove('notes-resizing');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    const downN = (e) => {
      dockResizeRef.current.mode = 'n';
      dockResizeRef.current.startX = e.clientX;
      dockResizeRef.current.startY = e.clientY;
      dockResizeRef.current.startW = ui.widthPct ?? 0.6;
      dockResizeRef.current.startH = ui.heightPct ?? 0.6;
      document.body.classList.add('notes-resizing');
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };
    const downW = (e) => {
      dockResizeRef.current.mode = 'w';
      dockResizeRef.current.startX = e.clientX;
      dockResizeRef.current.startY = e.clientY;
      dockResizeRef.current.startW = ui.widthPct ?? 0.6;
      dockResizeRef.current.startH = ui.heightPct ?? 0.6;
      document.body.classList.add('notes-resizing');
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };

    north?.addEventListener('mousedown', downN);
    west?.addEventListener('mousedown', downW);
    return () => {
      north?.removeEventListener('mousedown', downN);
      west?.removeEventListener('mousedown', downW);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.classList.remove('notes-resizing');
    };
  }, [ui.open]);
if (!ready) return null;

  // Handle glued to dock when open; at right edge when closed
  const widthPct = typeof ui.widthPct === 'number' ? ui.widthPct : 0.6;
  const handleStyle = {
    right: ui.open ? `calc(${Math.round(widthPct * 100)}vw + 12px)` : '12px',
    top:  ui.open && handleTop != null
          ? `${Math.round(handleTop)}px`
          : `calc(50vh + ${(ui.handleOffset || 0)}px)`
  };


  
  return (
    <>
      <div
        className={`notes-handle ${ui.open ? 'on' : 'off'}`}
        title={t('notes.open','Otwórz/Zamknij Notes')}
        onClick={toggleOpen}
        style={handleStyle}
      >
        <span className="label">{t('notes.title','Notes')}</span>
      </div>

      <div ref={setDockAndPanelRef} className={`notes-dock ${ui.open ? 'open':''}`}>
          <div className="dock-resize-n" />
          <div className="dock-resize-w" />
        <div className="notes-topbar">
          <ScrollTabs height={38}>
            {tabs.map(tab => (
              <TabPill
                key={tab.id}
                active={tab.id === activeTabId}
                name={tab.name}
                onClick={() => onPickTab(tab.id)}
                onRename={(name) => onRenameTab(tab.id, name)}
                onDelete={() => {
                  if (confirm(t('notes.deleteTabConfirm','Usunąć zakładkę?'))) deleteTab(tab.id).then(async ()=>{
                    setTabs(await listTabs());
                    setActiveId(await getActiveTabId());
                  });
                }}
              />
            ))}
            <button className="notes-addtab" onClick={onAddTab}>+ {t('notes.addTab','Dodaj zakładkę')}</button>
          </ScrollTabs>

          <div className="notes-actions">
            <button className="notes-iconbtn" onClick={()=>alert(t('notes.hintShort','Podwójnie kliknij siatkę, aby dodać notatkę. Wklej obrazek Ctrl+V.'))}>ℹ</button>
          </div>
        </div>

        <div
          ref={canvasRef}
          className="notes-canvas"
          onDoubleClick={onCanvasDoubleClick}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(e)=>e.preventDefault()}
        >
          <div className="notes-tip">{t('notes.tip','Podwójnie kliknij, aby dodać notatkę. Przeciągaj, zmieniaj rozmiar. Wklej/upuść obrazek.')}</div>

          {elements.map(el => (
            <NoteItem
              key={el.id}
              el={el}
              onBringToFront={()=>bringToFront(el.id)}
              onDragStart={(sx,sy)=>startDrag(el.id, sx, sy)}
              onResizeStart={(sx,sy,dir)=>startResize(el.id, sx, sy, dir)}
              onChangeText={(val)=>onChangeText(el.id, val)}
              onDelete={()=>onDeleteElement(el.id)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function TabPill({ active, name, onClick, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  useEffect(()=>setVal(name), [name]);

  return (
    <div className={`notes-tab ${active ? 'active':''}`} onClick={!editing ? onClick : undefined}>
      {!editing ? (
        <span onDoubleClick={()=>setEditing(true)} title={name}>{name}</span>
      ) : (
        <input
          className="notes-rename-input"
          value={val}
          onChange={e=>setVal(e.target.value)}
          onBlur={()=>{ setEditing(false); onRename(val); }}
          onKeyDown={(e)=>{
            if (e.key==='Enter') { e.currentTarget.blur(); }
            if (e.key==='Escape') { setVal(name); setEditing(false); }
          }}
          autoFocus
        />
      )}
      <span style={{ marginLeft: 6, opacity: 0.6 }}>
        <button className="notes-iconbtn" onClick={(e)=>{ e.stopPropagation(); setEditing(true); }} title={t('notes.rename','Zmień nazwę')}>✎</button>
        <button className="notes-iconbtn" onClick={(e)=>{ e.stopPropagation(); onDelete(); }} title={t('notes.delete','Usuń')}>🗑</button>
      </span>
    </div>
  );
}

function NoteItem({ el, onBringToFront, onDragStart, onResizeStart, onChangeText, onDelete }) {
  const boxStyle = useMemo(()=>({
    left: el.x, top: el.y, width: el.width, height: el.height, zIndex: el.zIndex || 0
  }), [el.x, el.y, el.width, el.height, el.zIndex]);

  const [val, setVal] = useState(el.content || '');
  const saveTimerRef = useRef(null);
  useEffect(() => { setVal(el.content || ''); }, [el.id]);
  useEffect(() => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { onChangeText(val); }, 300);
    return () => clearTimeout(saveTimerRef.current);
  }, [val]);

  const headerRef = useRef(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const md = (e) => {
      onBringToFront?.();
      onDragStart(e.clientX, e.clientY);
      e.preventDefault();
    };
    header.addEventListener('mousedown', md);
    return () => header.removeEventListener('mousedown', md);
  }, [onDragStart, onBringToFront]);

  const onContainerMouseDown = () => onBringToFront?.();

  const HEADER_H = 28;

  // Bigger, always-inside hit areas (not clipped by overflow)
  const edgeRightStyle = { position:'absolute', top:0, right:0, width:12, height:'100%', cursor:'ew-resize', zIndex:3, background:'transparent' };
  const edgeBottomStyle= { position:'absolute', left:0, bottom:0, width:'100%', height:12, cursor:'ns-resize', zIndex:3, background:'transparent' };
  const cornerStyle    = { position:'absolute', right:0, bottom:0, width:24, height:24, cursor:'nwse-resize', zIndex:4, background:'transparent' };

  return (
    <div className="note-item" style={boxStyle} data-note={el.id} onMouseDown={onContainerMouseDown}>
      {/* Header / grab */}
      <div
        ref={headerRef}
        className="note-header"
        style={{
          position:'absolute', top:0, left:0, right:0, height: HEADER_H,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding: '0 8px', borderBottom: '1px solid rgba(0,0,0,.06)',
          background: 'linear-gradient(to bottom, rgba(0,0,0,.04), rgba(0,0,0,.02))',
          cursor:'grab', userSelect:'none', zIndex: 2
        }}
      >
        <span style={{ fontSize:12, opacity:.6 }}>{t('notes.card','Notatka')}</span>
        <button
          className="notes-iconbtn"
          onMouseDown={(e)=>e.stopPropagation()}
          onClick={(e)=>{ e.stopPropagation(); onDelete(); }}
          title={t('notes.delete','Usuń')}
        >✕</button>
      </div>

      {/* Content */}
      {el.type === 'text' ? (
        <textarea
          className="note-textarea"
          value={val}
          onChange={(e)=>setVal(e.target.value)}
          placeholder={t('notes.placeholder','Twoja notatka…')}
          spellCheck={false}
          style={{ position:'absolute', top: HEADER_H, left:0, right:0, bottom:0, zIndex: 1 }}
        />
      ) : (
        <div style={{ position:'absolute', top: HEADER_H, left:0, right:0, bottom:0, overflow:'hidden' }}>
          <img className="note-image" src={el.url} alt="" draggable={false} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        </div>
      )}

      {/* Resize hit areas (inside edges, high z-index) */}
      <div style={edgeRightStyle} onMouseDown={(e)=>{ e.stopPropagation(); onResizeStart(e.clientX, e.clientY, 'e'); }} />
      <div style={edgeBottomStyle} onMouseDown={(e)=>{ e.stopPropagation(); onResizeStart(e.clientX, e.clientY, 's'); }} />
      <div style={cornerStyle} onMouseDown={(e)=>{ e.stopPropagation(); onResizeStart(e.clientX, e.clientY, 'se'); }} />
    </div>
  );
}
