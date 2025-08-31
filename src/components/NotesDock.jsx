
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

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function NotesDock() {
  const [ready, setReady] = useState(false);
  const [ui, setUi] = useState({ open: false, widthPct: 0.6, heightPct: 0.6, handleOffset: 0 });
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveId] = useState(null);
  const [elements, setElements] = useState([]);

  const dockRef = useRef(null);
  const canvasRef = useRef(null);
  const dragHandleRef = useRef({ dragging: false, startX: 0, startY: 0, startW: 0, startH: 0, startOff: 0 });

  // panelRef wskazuje kontener panelu (to samo co dockRef)
  const panelRef = useRef(null);
  const setDockAndPanelRef = useCallback((el) => {
    dockRef.current = el;
    panelRef.current = el;
  }, []);

  // [1] Zamykanie po kliknięciu poza panelem (jak modal)
  useEffect(() => {
    const onDown = (e) => {
      if (!ui.open) return; // reaguj tylko gdy otwarty
      const panel = panelRef.current;
      if (!panel) return;
      if (!panel.contains(e.target) && !e.target.closest?.('.notes-handle')) {
        setUi(u => ({ ...u, open: false }));
      }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [ui.open]);

  // [2] API w window + skrót Alt+N
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

  useEffect(() => {
    (async () => {
      await initNotesDB();
      const uiState = await getUI();
      setUi({ ...uiState, handleOffset: 0 });
      const tb = await listTabs();
      setTabs(tb);
      const aId = await getActiveTabId();
      setActiveId(aId || (tb[0]?.id ?? null));
      setReady(true);
    })();
  }, []);

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

  useEffect(() => {
    if (!dockRef.current) return;
    const el = dockRef.current;
    el.style.setProperty('--dock-width', `${Math.round(ui.widthPct * 100)}vw`);
    el.style.setProperty('--dock-height', `${Math.round(ui.heightPct * 100)}vh`);
    el.style.setProperty('--handle-offset', `${ui.handleOffset || 0}px`);
    setUI({ open: ui.open, widthPct: ui.widthPct, heightPct: ui.heightPct });
  }, [ui]);

  const toggleOpen = useCallback(() => {
    setUi(u => ({ ...u, open: !u.open }));
  }, []);

  useEffect(() => {
    const handleMove = (e) => {
      if (!dragHandleRef.current.dragging) return;
      const dx = dragHandleRef.current.startX - e.clientX;
      const dy = dragHandleRef.current.startY - e.clientY;
      const vw = Math.max(window.innerWidth, 1);
      const vh = Math.max(window.innerHeight, 1);
      let widthPct = clamp(dragHandleRef.current.startW + dx / vw, 0.3, 0.9);
      let heightPct = clamp(dragHandleRef.current.startH + dy / vh, 0.3, 0.6);
      let handleOffset = clamp(dragHandleRef.current.startOff + (e.clientY - dragHandleRef.current.startY), -120, 120);
      setUi(u => ({ ...u, widthPct, heightPct, handleOffset }));
    };
    const handleUp = () => {
      dragHandleRef.current.dragging = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    const start = (e) => {
      dragHandleRef.current.dragging = true;
      dragHandleRef.current.startX = e.clientX;
      dragHandleRef.current.startY = e.clientY;
      dragHandleRef.current.startW = ui.widthPct;
      dragHandleRef.current.startH = ui.heightPct;
      dragHandleRef.current.startOff = ui.handleOffset || 0;
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    };
    const handleEl = document.querySelector('.notes-handle');
    if (!handleEl) return;
    handleEl.addEventListener('mousedown', start);
    return () => handleEl.removeEventListener('mousedown', start);
  }, [ui.widthPct, ui.heightPct, ui.handleOffset]);

  // ===== Helpers for z-index stacking =====
  const bringToFront = useCallback(async (id) => {
    const nextZ = (elements.reduce((m,e)=>Math.max(m, e.zIndex||0), 0) || 0) + 1;
    setElements(prev => prev.map(x => x.id === id ? { ...x, zIndex: nextZ } : x));
    try { await moveResizeElement(id, { zIndex: nextZ }); } catch {}
  }, [elements]);

  // Double click to add new note
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

  const onAddTab = async () => {
    const id = await addTab(`${t('notes.newTab','Nowa zakładka')}`);
    const tb = await listTabs();
    setTabs(tb);
    setActiveId(id);
    await setActiveTabId(id);
  };
  const onPickTab = async (id) => {
    setActiveId(id);
    await setActiveTabId(id);
  };
  const onRenameTab = async (id, name) => {
    await renameTab(id, name.trim() || t('notes.tab','Zakładka'));
    const tb = await listTabs();
    setTabs(tb);
  };

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

  const startResize = (id, startX, startY) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    bringToFront(id);
    const mm = (e) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const nw = clamp(el.width + dx, 140, Math.min(1200, (canvasRef.current?.clientWidth||0) - el.x - 4));
      const nh = clamp(el.height + dy, 80, Math.min(1200, (canvasRef.current?.clientHeight||0) - el.y - 4));
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

  if (!ready) return null;

  return (
    <>
      <div className={`notes-handle ${ui.open ? 'on' : 'off'}`} title={t('notes.open', 'Otwórz/Zamknij Notes')} onClick={toggleOpen}>
        <div className="label">{t('notes.title','Notes')}</div>
      </div>

      <div ref={setDockAndPanelRef} className={`notes-dock ${ui.open ? 'open':''}`}>
        <div className="notes-topbar">
          <div className="notes-tabs" role="tablist" aria-label={t('notes.tabs','Zakładki')}>
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
          </div>

          <div className="notes-actions">
            <button className="notes-iconbtn" onClick={()=>alert(t('notes.hintShort','Wskazówka: podwójnie kliknij siatkę, aby dodać notatkę. Wklej obrazek Ctrl+V.'))}>ℹ</button>
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
              onResizeStart={(sx,sy)=>startResize(el.id, sx, sy)}
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
  React.useEffect(()=>setVal(name), [name]);

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

  return (
    <div className="note-item" style={boxStyle} data-note={el.id} onMouseDown={onContainerMouseDown}>
      {/* Nagłówek/zakładka do przenoszenia */}
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

      {/* Treść */}
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

      {/* Uchwyt rozmiaru */}
      <div className="note-resize" onMouseDown={(e)=>{ e.stopPropagation(); onResizeStart(e.clientX, e.clientY); }} />
    </div>
  );
}
