// Sidebar.jsx — Workspace-only navigation (Projects removed)
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../i18n.js';
import {
  loadConfig, saveConfig,
  loadValues, saveValues
} from '../utils.js';
import {
  loadWorkspaceProjects, saveWorkspaceProjects,
  newWorkspaceId, snapshotWorkspace, applyWorkspace,
  exportWorkspaceBlob, getCurrentWorkspaceId, setCurrentWorkspaceId
} from '../utils.workspace.js';

// ——— Ikony (inline SVG, stroke: currentColor) ———
const Icon = {
  Plus:   (p)=>(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...p}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  Save:   (p)=>(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...p}><path d="M17 21H7a2 2 0 0 1-2-2V5h11l3 3v11a2 2 0 0 1-2 2Z" stroke="currentColor" strokeWidth="2"/><path d="M7 5v6h10" stroke="currentColor" strokeWidth="2"/><path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="2"/></svg>),
  Import: (p)=>(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...p}><path d="M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 21H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  Export: (p)=>(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...p}><path d="M12 21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M16 13l-4-4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 3H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  Trash:  (p)=>(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  FolderOpen:(p)=>(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...p}><path d="M3 7h5l2 2h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>),
};

export default function Sidebar(){
  

  // --- LocalStorage usage indicator ---
  const calcLocalStorageBytes = () => {
    try {
      let chars = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) chars += k.length;
        const v = localStorage.getItem(k);
        if (v) chars += v.length;
      }
      return chars * 2; // UTF-16 ~2 bytes per char
    } catch { return 0; }
  };
  const LS_MAX = 5 * 1024 * 1024; // ~5MB (browser-dependent)
  const [lsBytes, setLsBytes] = useState(0);

  useEffect(() => {
    const update = () => setLsBytes(calcLocalStorageBytes());
    update();
    const id = setInterval(update, 1500);
    window.addEventListener('storage', update);
    return () => { clearInterval(id); window.removeEventListener('storage', update); };
  }, []);

  const fmtMB = (b) => {
    try {
      const n = b / (1024 * 1024);
      const nf = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return nf.format(n);
    } catch { return (b / (1024*1024)).toFixed(2); }
  };

  // Base config
  const [cfg, setCfg] = React.useState(loadConfig());

  // Categories collapsed by default
  const [openCats, setOpenCats] = React.useState(() => {
    const map = {}; (cfg.categories || []).forEach(c => map[c.id] = false); return map;
  });
  const toggleCat = (id) => setOpenCats(prev => ({ ...prev, [id]: !prev[id] }));

  // Workspace (multi-interface) storage
  const [wsMap, setWsMap] = React.useState(loadWorkspaceProjects() || {});
  const [currentWs, setCurrentWs] = React.useState(getCurrentWorkspaceId() || '');
  const fileWsRef = React.useRef(null);
// Recompute highlight when values/workspace change
  const [valTick, setValTick] = React.useState(0);
  React.useEffect(() => {
    const h = () => setValTick(x => x + 1);
    window.addEventListener('tcf-values-changed', h);
    window.addEventListener('tcf-workspace-changed', h);
    window.addEventListener('storage', h);
    return () => {
      window.removeEventListener('tcf-values-changed', h);
      window.removeEventListener('tcf-workspace-changed', h);
      window.removeEventListener('storage', h);
    };
  }, []);

  // Which interfaces are "in use" (workspace perspective)
  const usedIfaceIds = React.useMemo(() => {
    const used = new Set();
    const vals = loadValues() || {};
    (cfg.interfaces || []).forEach(it => {
      const arr = vals[it.id] || [];
      const hasVal = Array.isArray(arr) && arr.some(s => (s || '').trim().length > 0);
      const includes = Array.isArray(it.includedSections) && it.includedSections.some(Boolean);
      if (hasVal || includes) used.add(it.id);
    });
    return used;
  }, [cfg, valTick]);

  // ===== Workspace actions =====
  const newWorkspace = () => {
  const name = prompt(t('workspaceName') || 'Nazwa projektu', `Projekt ${new Date().toLocaleDateString()}`);
  if (!name) return;

  // Zbuduj PUSTY pakiet projektu w formacie utils.workspace.js (interfaces map)
  const cfg = loadConfig();
  const pack = { interfaces: {}, meta: { exportedAt: new Date().toISOString() } };
  try {
    (cfg.interfaces || []).forEach(it => {
      if (!it || !it.id) return;
      const id = it.id;
      const labelsLen = Array.isArray(it.labels) ? it.labels.length : 0;
      const secLen = Array.isArray(it.sections) ? it.sections.length : Math.max(
        Array.isArray(it.includedSections) ? it.includedSections.length : 0,
        Array.isArray(it.sectionColors) ? it.sectionColors.length : 0
      );
      pack.interfaces[id] = {
        interfaceId: id,
        interfaceName: it.name || id,
        values: Array.from({ length: labelsLen }, () => ''),
        sectionColors: Array.from({ length: secLen }, () => ''),
        includedSections: Array.from({ length: secLen }, () => false),
      };
    });
  } catch {}

  const id = crypto.randomUUID();
  const data = pack;
  const map = { ...(wsMap || {}) };
  map[id] = { id, name, data };
  saveWorkspaceProjects(map);
  setWsMap(map);

  // NATYCHMIAST przełącz i zastosuj pusty projekt
  setCurrentWorkspaceId(id);
  const applied = applyWorkspace(data);
  if (!applied) { alert(t('invalidJson') || 'Nieprawidłowy pakiet projektu'); return; }
  setCurrentWs(id);
  setTimeout(() => {
    try { window.dispatchEvent(new Event('tcf-config-changed')); } catch {}
    try { window.dispatchEvent(new Event('tcf-values-changed')); } catch {}
  }, 0);
};

  const saveWorkspace = () => {
    const pack = snapshotWorkspace();
    const name = prompt(t('workspaceName') || 'Workspace name'); if (!name) return;
    const id = newWorkspaceId(); const map = loadWorkspaceProjects() || {};
    pack.meta = { ...(pack.meta||{}), name };
    map[id] = { name, data: pack }; saveWorkspaceProjects(map); setWsMap(map);
    setCurrentWorkspaceId(id); setCurrentWs(id);
    try { window.dispatchEvent(new Event('tcf-workspace-changed')); } catch {}
    alert(t('workspaceSaved') || 'Workspace saved');
  };

  const exportWorkspace = () => {
    const pack = snapshotWorkspace();
    exportWorkspaceBlob(pack, `workspace_${Date.now()}.json`);
  };
  const saveProjectChanges = () => {
    const wid = currentWs || getCurrentWorkspaceId();
    if (!wid) { alert(t('noActiveProject') || 'Brak aktywnego projektu'); return; }
    try {
      const map = loadWorkspaceProjects() || {};
      const pack = snapshotWorkspace();
      const name = map[wid]?.name || pack?.meta?.name || 'Projekt';
      map[wid] = { ...(map[wid]||{}), id: wid, name, data: pack };
      saveWorkspaceProjects(map);
      setWsMap(map);
      alert(t('projectChangesSaved') || 'Zmiany w projekcie zapisane');
    } catch (e) {
      console.error('saveProjectChanges failed', e);
      alert(t('saveFailed') || 'Nie udało się zapisać zmian');
    }
  };


  const importWorkspace = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; if (!file) return;
    try{
      const text = await file.text(); const obj = JSON.parse(text);
      if (applyWorkspace(obj)){
        const id = newWorkspaceId(); const map = loadWorkspaceProjects() || {};
        const name = obj.meta?.name || ('Workspace ' + id);
        map[id] = { name, data: obj }; saveWorkspaceProjects(map); setWsMap(map);
        setCurrentWorkspaceId(id); setCurrentWs(id);
        try { window.dispatchEvent(new Event('tcf-workspace-changed')); } catch {}
        alert((t('workspaceApplied') || 'Workspace applied') + (name ? `: ${name}` : ''));
      } else {
        alert(t('invalidJson') || 'Invalid JSON');
      }
    }catch(err){ console.error(err); alert(t('invalidJson') || 'Invalid JSON'); }
  };

  const deleteCurrentWorkspace = () => {
    const wid = currentWs || getCurrentWorkspaceId();
    if (!wid) return;
    if (!confirm(t('confirmDeleteWorkspace') || 'Delete current workspace?')) return;
    const map = loadWorkspaceProjects() || {};
    delete map[wid]; saveWorkspaceProjects(map); setWsMap(map);
    setCurrentWorkspaceId(''); setCurrentWs('');
    alert(t('deleted') || 'Deleted');
  };

  // UI helpers
  const ifaceHighlightStyle = { boxShadow: 'inset 0 0 0 2px #2ecc71', borderRadius: 8 };

  return (
    <aside className="sidebar">
      {/* Home */}
      <div className="s-head" style={{padding:'6px 8px'}}>
        <Link className="s-item s-home" to="/">
          <span className="s-item-icon">🏠</span>
          <span className="s-item-title">{t('home')}</span>
          <span className="chev">›</span>
        </Link>
      </div>

      {/* Interfaces grouped by category (collapsed by default) */}
      <div className="s-cat-list">
        {Array.from((() => {
          const byCat = new Map();
          (cfg.categories || []).forEach(c => byCat.set(c.id, { cat:c, items:[] }));
          (cfg.interfaces || []).forEach(it => {
            const key = it.categoryId || (cfg.categories && cfg.categories[0]?.id) || 'inbound';
            if (!byCat.has(key)) byCat.set(key, { cat:{ id:key, name:key }, items:[] });
            byCat.get(key).items.push(it);
          });
          return byCat;
        })().values()).map(group => (
          <div key={group.cat.id} className={`s-cat ${openCats[group.cat.id] ? 'open' : 'closed'}`}>
            <div className="s-cat-head" onClick={()=>toggleCat(group.cat.id)}>
              <span className="s-item-icon">📂</span>
              <span className="s-cat-title">{group.cat.name}</span>
              <span className="badge">{group.items.length}</span>
              <span className="chev">{openCats[group.cat.id] ? '▾' : '▸'}</span>
            </div>
            <div className="s-list">
              {group.items.map(it => {
                const isUsed = usedIfaceIds.has(it.id);
                return (
                  <Link key={it.id}
                        className={`s-item ${isUsed ? 'used' : ''}`}
                        to={`/iface/${it.id}`}
                        style={isUsed ? ifaceHighlightStyle : undefined}
                  >
                    <span className="s-item-title">{it.name}</span>
                    <span className="chev">›</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Workspace projects (multi-interface only) */}
      <div className="s-cat s-projects open">
        <div className="s-cat-head">
          <span className="s-item-icon"><Icon.FolderOpen /></span>
          <span className="s-cat-title">{t('workspaceProjects') || t('projects') || 'Projekty'}</span>
        </div>
        <div className="s-list">
          <button className="s-item" onClick={newWorkspace} style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-start"}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:8}}><Icon.Plus /> <span className="s-item-title">{t('newWorkspace') || 'Nowy projekt'}</span></span>
            <span className="chev">›</span>
          </button>
          <button className="s-item" onClick={saveWorkspace} style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-start"}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:8}}><Icon.Save /> <span className="s-item-title">{t('saveWorkspace') || 'Zapisz projekt'}</span></span>
            <span className="chev">›</span>
          </button>
          <button className="s-item" onClick={exportWorkspace} style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-start"}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:8}}><Icon.Export /> <span className="s-item-title">{t('exportWorkspace') || 'Eksport projektu'}</span></span>
            <span className="chev">›</span>
          </button>
          <button className="s-item" onClick={()=>fileWsRef.current?.click()} style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-start"}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:8}}><Icon.Import /> <span className="s-item-title">{t('importWorkspace') || 'Import projektu'}</span></span>
            <span className="chev">›</span>
          </button>

          <div className="s-list">
            {Object.entries(wsMap).map(([wid, w]) => (
              <button
                key={wid}
                className={`s-item ${wid===currentWs?'active':''}`}
                onClick={()=>{
                  if (applyWorkspace(w.data)){
                    setCurrentWorkspaceId(wid); setCurrentWs(wid);
                    try { window.dispatchEvent(new Event('tcf-workspace-changed')); } catch {}
                    alert((t('workspaceApplied') || 'Workspace applied') + (w?.name ? `: ${w.name}` : ''));
                  } else {
                    alert(t('invalidJson') || 'Invalid JSON');
                  }
                }}
              >
                <span className="s-item-title">{w?.name || wid}</span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>

          <button className="s-item danger" onClick={deleteCurrentWorkspace} style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-start", color:"var(--danger,#c43)"}}>
            <span style={{display:"inline-flex",alignItems:"center",gap:8}}><Icon.Trash /> <span className="s-item-title">{t('deleteWorkspace') || 'Usuń projekt'}</span></span>
            <span className="chev">›</span>
          </button>

          <div className="current-project" style={{marginTop:8}}>
            <div className="muted" style={{opacity:0.8,fontSize:12}}>{t('currentWorkspace') || 'Aktualny projekt'}</div>
            <div style={{fontWeight:700}}>{wsMap[currentWs]?.name || '-'}</div>
          </div>
        </div>
        <input ref={fileWsRef} type="file" accept="application/json" style={{display:'none'}} onChange={importWorkspace} />
      </div>

      
      {/* Save-project button (shows only when a project is active) */}
      {Boolean(currentWs) && (
        <div className="project-save" style={{textAlign:'center', padding:'12px 8px'}}>
          <button className="s-item" onClick={saveProjectChanges} style={{display:'inline-flex',alignItems:'center',gap:8,justifyContent:'center', padding:'8px 12px'}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:8}}><Icon.Save /> <span className="s-item-title">{t('saveProjectChanges') || 'Zapisz zmiany w projekcie'}</span></span>
          </button>
        </div>
      )}
      <div className="ls-usage">
        {fmtMB(lsBytes)}MB / {Math.round(LS_MAX/(1024*1024))}MB
      </div>

    </aside>
  );
}