// Sidebar.jsx — Workspace-only navigation (Projects removed)
import React, { useEffect, useState, startTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { t } from '../i18n.js';
import ConfirmClearModal from '../components/ConfirmClearModal.jsx';
import ImportTemplatesModal from '../components/ImportTemplatesModal.jsx';
import DeleteTemplateModal from '../components/DeleteTemplateModal.jsx';

const textify = (x) => {
  if (Array.isArray(x)) return x.flat().filter(Boolean).map(String).join(' ');
  if (x == null) return '';
  return typeof x === 'string' ? x : String(x);
};

// ⬇️ DODANE: saveValues + LightModal + segmentText
import { loadConfig, loadValues, saveValues } from '../utils.js';
import LightModal from '../components/LightModal.jsx';
import { segmentText } from '../segmentation.js';

import {
  loadTemplates, deleteTemplate, exportTemplatesBlob, importTemplatesText, applyTemplate, renameTemplate
} from '../utils.templates.js';
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

  // ⬇️ DODANE: Ikona segmentacji (jak w dolnym panelu)
  Seg: (p)=>(<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" {...p}>
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
    <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 4L8.5 12L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.5 12H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>)
};

export default function Sidebar(){
  // --- LocalStorage usage indicator (event-driven, no intervals) ---
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
  const LS_MAX = 5 * 1024 * 1024; // ~5MB
  const navigate = useNavigate();
  const [lsBytes, setLsBytes] = useState(0);

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState(() => loadTemplates());

  // Import Templates modal state
  const [isImportTplOpen, setIsImportTplOpen] = useState(false);
  const [importTplParsed, setImportTplParsed] = useState(null);
  const [importTplError, setImportTplError] = useState('');

  // Delete Template modal state
  const [isDeleteTplOpen, setIsDeleteTplOpen] = useState(false);
  const [tplToDelete, setTplToDelete] = useState(null);

  const [isTplOverwriteOpen, setIsTplOverwriteOpen] = useState(false);
  const [tplPending, setTplPending] = useState(null);
  const [isTplAppliedOpen, setIsTplAppliedOpen] = useState(false);
  const [appliedTplName, setAppliedTplName] = useState('');
  const [appliedTargetIfaceId, setAppliedTargetIfaceId] = useState(null);
  const [isTplImportDoneOpen, setIsTplImportDoneOpen] = useState(false);
  const [tplImportStats, setTplImportStats] = useState({added:0, overwritten:0});

  const [editingTplId, setEditingTplId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // ⬇️ DODANE: Stan globalnego modala segmentacji
  const [segOpen, setSegOpen] = useState(false);
  const [segText, setSegText] = useState('');
  const [segFileName, setSegFileName] = useState('');
  const [segBusy, setSegBusy] = useState(false);
  const [segErr, setSegErr] = useState('');
  const fileSegRef = React.useRef(null);

  // keep templates in sync with storage events
  useEffect(() => {
    const onChange = () => setTemplates(loadTemplates());
    window.addEventListener('tcf-templates-changed', onChange);
    return () => window.removeEventListener('tcf-templates-changed', onChange);
  }, []);

  // ===== actuallyApplyTemplate moved out of useEffect for stable scope =====
  const actuallyApplyTemplate = async (tplId, tplName) => {
    // Snapshot BEFORE
    let beforeVals = {}; let beforeCfg = null;
    try { beforeVals = loadValues() || {}; } catch(_) {}
    try { beforeCfg = loadConfig() || null; } catch(_) {}

    // Try to determine target from template metadata (best-effort)
    let targetIfaceId = null;
    try {
      const t = (templates || []).find(x => x && x.id === tplId);
      if (t) {
        targetIfaceId = t.ifaceId
          || (t.ifaceIds && t.ifaceIds[0])
          || (t.interfaces && t.interfaces[0] && (t.interfaces[0].id || t.interfaces[0]))
          || (t.ifaces && t.ifaces[0] && (t.ifaces[0].id || t.ifaces[0]))
          || null;
      }
    } catch(_) {}

    // Apply
    try {
      await applyTemplate(tplId);
    } catch (e) {
      console.error('[Sidebar] applyTemplate failed', e);
    }

    // Snapshot AFTER
    let afterCfg = null; let afterVals = {};
    try { afterCfg = loadConfig() || null; } catch(_) {}
    try { afterVals = loadValues() || {}; } catch(_) {}

    // If we still don't know the target, infer by diff in values
    try {
      if (!targetIfaceId && afterCfg && afterCfg.interfaces) {
        const ids = afterCfg.interfaces.map(i => (i && i.id) ? i.id : i).filter(Boolean);
        const changed = [];
        const countNonEmpty = (obj) => {
          if (!obj || typeof obj !== 'object') return 0;
          let c = 0;
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === '')) c++;
          }
          return c;
        };
        for (const id of ids) {
          const b = beforeVals[id] || {};
          const a = afterVals[id] || {};
          if (JSON.stringify(a) !== JSON.stringify(b)) {
            changed.push(id);
          } else if (countNonEmpty(a) > countNonEmpty(b)) {
            changed.push(id);
          }
        }
        if (changed.length) targetIfaceId = changed[0];
      }
    } catch (e) {
      console.warn('[Sidebar] diff detect failed', e);
    }

    // Fallback to first interface
    if (!targetIfaceId) {
      try {
        const firstId = (afterCfg && afterCfg.interfaces && afterCfg.interfaces[0] && afterCfg.interfaces[0].id)
          ? afterCfg.interfaces[0].id : null;
        targetIfaceId = firstId;
      } catch(_) {}
    }

    // Open success modal and set navigation target
    try {
      setAppliedTplName(tplName || '');
      setAppliedTargetIfaceId(targetIfaceId || null);
      setIsTplAppliedOpen(true);
    } catch (e) {
      console.warn('[Sidebar] navigation target set failed', e);
      setIsTplAppliedOpen(true);
    }
  };

  useEffect(() => {
    const schedule = (fn) => {
      if (typeof queueMicrotask === 'function') queueMicrotask(fn);
      else setTimeout(fn, 0);
    };
    const update = () => {
      const bytes = calcLocalStorageBytes();
      schedule(() => setLsBytes(bytes));
    };
    // inicjał też odkładamy – nie w tej samej fazie renderu
    schedule(update);

    const onEvent = () => schedule(update);
    const evs = ['tcf-values-changed','tcf-config-changed','tcf-workspace-changed','tcf-project-changed','storage'];
    evs.forEach(ev => window.addEventListener(ev, onEvent));
    return () => { evs.forEach(ev => window.removeEventListener(ev, onEvent)); };
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
    const schedule = (fn) => {
      if (typeof queueMicrotask === 'function') queueMicrotask(fn);
      else setTimeout(fn, 0);
    };
    const h = () => schedule(() => setValTick(x => x + 1));
    window.addEventListener('tcf-values-changed', h);
    window.addEventListener('tcf-config-changed', h);
    window.addEventListener('tcf-workspace-changed', h);
    window.addEventListener('tcf-project-changed', h);
    window.addEventListener('storage', h);
    return () => {
      window.removeEventListener('tcf-values-changed', h);
      window.removeEventListener('tcf-config-changed', h);
      window.removeEventListener('tcf-workspace-changed', h);
      window.removeEventListener('tcf-project-changed', h);
      window.removeEventListener('storage', h);
    };
  }, []);

  // Which interfaces are "in use"
  const usedIfaceIds = React.useMemo(() => {
    const used = new Set();
    const vals = loadValues() || {};
    (cfg.interfaces || []).forEach(it => {
      const id = it.id;
      const arr = vals[id] || [];
      const hasVal = Array.isArray(arr) && arr.some(v => String(v ?? '').trim() !== '');
      let hasGen = false;
      try { const g = JSON.parse(localStorage.getItem('tcf_genTabs_' + String(id)) || '[]') || []; hasGen = Array.isArray(g) && g.length > 0; } catch {}
      const includes = Array.isArray(it.includedSections) && it.includedSections.some(Boolean);
      if (hasVal || hasGen || includes) used.add(id);
    });
    return used;
  }, [cfg, valTick]);

  // ===== Workspace actions =====
  const newWorkspace = () => {
    const name = prompt(t('workspaceName') || 'Nazwa projektu', `Projekt ${new Date().toLocaleDateString()}`);
    if (!name) return;

    const cfgNow = loadConfig();
    const pack = { interfaces: {}, meta: { exportedAt: new Date().toISOString() } };
    try {
      (cfgNow.interfaces || []).forEach(it => {
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

    setCurrentWorkspaceId(id);
    const applied = applyWorkspace(data);
    if (!applied) { alert(t('invalidJson') || 'Nieprawidłowy pakiet projektu'); return; }
    setCurrentWs(id);
    queueMicrotask(() => {
      try { window.dispatchEvent(new Event('tcf-config-changed')); } catch {}
      try { window.dispatchEvent(new Event('tcf-values-changed')); } catch {}
    });
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

  // ⬇️ DODANE: obsługa pliku + drop dla Segmentacji
  const readSegFile = (file) => {
    if (!file) return;
    try { setSegFileName(file.name || ''); } catch {}
    const fr = new FileReader();
     fr.onload = () => {
        try {
          setSegText(String(fr.result || ''));
          setSegErr('');
        } catch {}
      };
    fr.onerror = () => setSegErr('Read error');
    try { fr.readAsText(file); } catch (e) { setSegErr(String(e?.message || e) || 'Error'); }
  };
  const onDropSeg = (e) => {
    e.preventDefault(); e.stopPropagation();
    try { const f = e.dataTransfer?.files?.[0]; if (f) readSegFile(f); } catch {}
  };

  const runSegmentation = () => {
    const raw = String(segText || '').trim();
        if (!raw) {
      setSegErr(t('segEmpty') || 'Wklej najpierw tekst do segmentacji.');
      return;
    }
    setSegBusy(true); setSegErr('');
    try {
      const cfg = loadConfig();
      const valsMap = loadValues();
      const res = segmentText(raw, cfg, null, valsMap);
      const { valsMap: nextVals, tabsById, involvedIfaceIds = [] } = res || {};

      // zapisz zakładki wygenerowane przez segmentację – identycznie jak w dolnym panelu
      (cfg?.interfaces || []).forEach((it) => {
        const id = it.id;
        let arr;
        try {
          if (tabsById && typeof tabsById.get === 'function') arr = tabsById.has(id) ? (tabsById.get(id) || []) : undefined;
          else if (tabsById && typeof tabsById === 'object') arr = Object.prototype.hasOwnProperty.call(tabsById, id) ? (tabsById[id] || []) : undefined;
        } catch {}
        if (typeof arr !== 'undefined') {
          try { localStorage.setItem('tcf_genTabs_' + String(id), JSON.stringify(arr || [])); } catch {}
        }
      });

      if (nextVals) saveValues(nextVals);

      // przejście do pierwszego interfejsu, którego dotknęła segmentacja
      let goId = involvedIfaceIds && involvedIfaceIds[0];
      if (!goId && tabsById && typeof tabsById.forEach === 'function') {
        try { tabsById.forEach((arr, id) => { if (!goId && Array.isArray(arr) && arr.length > 0) goId = id; }); } catch {}
      }

      setSegBusy(false);
      setSegOpen(false);
      setSegText(''); setSegFileName('');
      if (goId) navigate('/iface/' + String(goId));
      else alert(t('segSummary') || 'Segmentacja zakończona. Brak dopasowanych interfejsów do otwarcia.');
    } catch (e) {
      console.error(e);
      setSegErr(String(e?.message || e) || 'Error');
      setSegBusy(false);
    }
  };

  return (
    <>
      <aside className="sidebar">
        <div className="s-head" style={{padding:'6px 8px'}}>
          <Link className="s-item s-home" to="/">
            <span className="s-item-icon">🏠</span>
            <span className="s-item-title">{t('home')}</span>
            <span className="chev">›</span>
          </Link>
        </div>

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

        <div className="s-cat s-projects open">
          <div className="s-cat-head" style={{ justifyContent: 'flex-start', gap: 8 }}>
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

        <div className={`s-cat s-templates ${templatesOpen ? 'open' : 'closed'}`}>
          <div className="s-cat-head" onClick={()=>setTemplatesOpen(!templatesOpen)}>
            <span className="s-item-icon"><Icon.Save /></span>
            <span className="s-cat-title">{t('templatesMenu') || t('templates') || 'Schematy'}</span>
            <span className="chev">{templatesOpen ? '▾' : '▸'}</span>
          </div>
          {templatesOpen && (
            <div className="s-list">
              <div className="s-actions">
                {/* IMPORT — nasz modal */}
                <button
                  className="s-item"
                  onClick={()=> setIsImportTplOpen(true)}
                  style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-start'}}
                >
                  <span className="s-item-icon"><Icon.Import /></span>
                  <span className="s-item-title">{t('importTemplates') || 'Importuj schematy'}</span>
                  <span className="chev">›</span>
                </button>

                {/* EXPORT — bez zmian */}
                <button
                  className="s-item"
                  onClick={()=>{
                    try{
                      const b=exportTemplatesBlob();
                      const url=URL.createObjectURL(b);
                      const a=document.createElement('a');
                      a.href=url;
                      const ts=(new Date()).toISOString().replace(/[:.]/g,'-');
                      a.download=`templates_${ts}.json`;
                      document.body.appendChild(a); a.click();
                      setTimeout(()=>{URL.revokeObjectURL(url); a.remove();}, 1000);
                    } catch(e){ console.error(e);}
                  }}
                  style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-start'}}
                >
                  <span className="s-item-icon"><Icon.Export /></span>
                  <span className="s-item-title">{t('exportTemplates') || 'Eksportuj schematy'}</span>
                </button>
              </div>

              <div className="s-list-items">
                {(templates && templates.length) ? templates.map((tpl) => (
                  <div key={tpl.id} className="s-item tpl-row"
                      style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <div className="tpl-title" style={{minWidth:0,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap', cursor:'pointer'}} title={tpl.name} onClick={async ()=>{ const vals = loadValues(); const hasAny = vals && Object.values(vals).some(v=>v && Object.keys(v).length>0); setTplPending({ id: tpl.id, name: tpl.name||'' }); if (hasAny) { setIsTplOverwriteOpen(true); } else { await actuallyApplyTemplate(tpl.id, tpl.name||''); } }}>
                      {editingTplId===tpl.id ? (
                        <input className="tpl-rename-input" autoFocus value={editingName} onChange={e=>setEditingName(e.target.value)}
                              onKeyDown={(e)=>{ if (e.key==='Enter') { renameTemplate(editingTplId, editingName||''); setTemplates(loadTemplates()); setEditingTplId(null); setEditingName(''); } else if (e.key==='Escape') { setEditingTplId(null); setEditingName(''); } }}
                              onBlur={()=>{ renameTemplate(editingTplId, editingName||''); setTemplates(loadTemplates()); setEditingTplId(null); setEditingName(''); }}
                              style={{width:'100%'}} />
                      ) : tpl.name}
                    </div>

                    <button
                      className="tpl-edit"
                      onClick={(e)=>{ e.stopPropagation(); setEditingTplId(tpl.id); setEditingName(tpl.name||''); }}
                      title={t('renameTemplate') || 'Zmień nazwę'}
                    >✎</button>

                    {/* DELETE — nasz modal zamiast confirm */}
                    <button
                      className="tpl-del"
                      onClick={(e)=>{ e.stopPropagation(); setTplToDelete(tpl); setIsDeleteTplOpen(true); }}
                      title={t('delete') || 'Usuń'}
                      style={{color:'inherit'}}
                    >
                      ×
                    </button>
                  </div>
                )) : (
                  <div className="s-item is-empty">{t('templatesEmpty') || 'Brak schematów'}</div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* ⬇️ NOWA POZYCJA W MENU — POD „SCHEMATY”: Segmentacja */}
        <div className="s-cat s-segmentation open">
          <div className="s-list">
            <button
              className="s-item"
              onClick={()=>setSegOpen(true)}
              style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-start'}}
              title={t('segTooltip') || 'Wklej/wczytaj tekst i uruchom segmentację'}
            >
              <span className="s-item-icon"><Icon.Seg /></span>
              <span className="s-item-title">{t('segmentation') || 'Segmentacja'}</span>
              <span className="chev">›</span>
            </button>
          </div>
        </div>

        <div className="ls-usage">
          {fmtMB(lsBytes)}MB / {Math.round(LS_MAX/(1024*1024))}MB
        </div>

        {/* Zastosuj schemat — ostrzeżenie o nadpisaniu */}
        <ConfirmClearModal
          open={isTplOverwriteOpen}
          onClose={()=>{ setIsTplOverwriteOpen(false); setTplPending(null); }}
          onConfirm={async ()=>{ const p = tplPending || {}; setIsTplOverwriteOpen(false); await actuallyApplyTemplate(p.id, p.name); setTplPending(null); }}
          title={t('applyTemplateTitle') || 'Zastosować schemat'}
          message={(t('applyTemplateConfirm')||'Zastosować schemat „{name}”? To może nadpisać istniejące dane.').replace('{name}', tplPending?.name||'')}
          confirmText={t('apply') || t('ok') || 'OK'}
        />

        {/* Sukces zastosowania — z nawigacją do interfejsu */}
        <ConfirmClearModal
          open={isTplAppliedOpen}
          onClose={()=>{ setIsTplAppliedOpen(false); if (appliedTargetIfaceId) navigate(`/iface/${appliedTargetIfaceId}`); }}
          onConfirm={()=>{ setIsTplAppliedOpen(false); if (appliedTargetIfaceId) navigate(`/iface/${appliedTargetIfaceId}`); }}
          title={t('templateAppliedTitle') || 'Zastosowano schemat'}
          message={(t('templateAppliedMsg')||'Zastosowano schemat „{name}”.').replace('{name}', appliedTplName||'')}
          confirmText={t('ok') || 'OK'}
          hideCancel={true}
        />
      </aside>

      {/* ===== Modale: Import + Delete (poza <aside>) ===== */}
      <ImportTemplatesModal
        open={isImportTplOpen}
        existing={templates}
        onClose={()=>{ setIsImportTplOpen(false); setImportTplParsed(null); setImportTplError(''); }}
        onParsed={(parsed)=>{ setImportTplParsed(parsed); setImportTplError(''); }}
        onError={(msg)=>{ setImportTplError(msg||''); }}
        onImport={async (data, opts={})=>{
          try {
            const replace = !!opts.replace;
            // Extract incoming list for stats + replace
            const extract = (payload) => {
              if (!payload) return [];
              if (Array.isArray(payload)) return payload;
              if (Array.isArray(payload.templates)) return payload.templates;
              if (Array.isArray(payload.items)) return payload.items;
              const ks = ['list','records','schemas','schemes','data','payload','templatesList'];
              for (const k of ks) {
                const v = payload[k];
                if (Array.isArray(v)) return v;
                if (v && typeof v==='object' && Array.isArray(v.templates)) return v.templates;
                if (v && typeof v==='object' && Array.isArray(v.items)) return v.items;
              }
              for (const v of Object.values(payload)) {
                if (Array.isArray(v) && v.some(x=>x && typeof x==='object')) return v;
                if (v && typeof v==='object') {
                  for (const vv of Object.values(v)) {
                    if (Array.isArray(vv) && vv.some(x=>x && typeof x==='object')) return vv;
                  }
                }
              }
              return [];
            };
            const arr = extract(data);
            const existingList = Array.isArray(templates) ? templates : [];
            const exById = new Map(existingList.map(x => [String(x.id||''), x]));
            const exByName = new Map(existingList.map(x => [String((x.name||x.title||'').trim().toLowerCase()), x]));

            // pre-count
            let added = 0, overwritten = 0;
            for (const x of arr) {
              const id = x && x.id ? String(x.id) : '';
              const nm = (x && (x.name||x.title)) ? String(x.name||x.title).trim().toLowerCase() : '';
              const dup = (id && exById.has(id)) || (nm && exByName.has(nm));
              if (dup) overwritten++; else added++;
            }

            if (replace) {
              // remove duplicates first (by id OR by name), then import
              const ids = new Set(arr.map(x => x && x.id ? String(x.id) : '').filter(Boolean));
              const names = new Set(arr.map(x => (x && (x.name||x.title)) ? String(x.name||x.title).trim().toLowerCase() : '').filter(Boolean));
              try {
                for (const t of existingList) {
                  const id = t && t.id ? String(t.id) : '';
                  const nm = (t && (t.name||t.title)) ? String(t.name||t.title).trim().toLowerCase() : '';
                  if ((id && ids.has(id)) || (nm && names.has(nm))) {
                    try { deleteTemplate(t.id); } catch(e) { console.warn('[Sidebar] deleteTemplate before replace failed', e); }
                  }
                }
              } catch(e) { console.warn('[Sidebar] replace pre-clean failed', e); }
            }

            const ok = importTemplatesText(JSON.stringify(data));
            if (!ok) throw new Error('invalid');
            setTemplates(loadTemplates());
            setIsImportTplOpen(false);
            setImportTplParsed(null);
            setImportTplError('');

            // show summary
            setTplImportStats({ added, overwritten: replace ? overwritten : 0 });
            setIsTplImportDoneOpen(true);
          } catch (e) {
            console.error('[Sidebar] importTemplates failed', e);
            setImportTplError(t('importInvalid') || 'Invalid file');
          }
        }}
      />

      <DeleteTemplateModal
        open={isDeleteTplOpen}
        template={tplToDelete}
        onClose={()=>{ setIsDeleteTplOpen(false); setTplToDelete(null); }}
        onConfirm={()=>{ try { deleteTemplate(tplToDelete?.id); } catch(e){ console.error('[Sidebar] delete tpl failed', e); } setTemplates(loadTemplates()); setIsDeleteTplOpen(false); setTplToDelete(null); }}
      />

      {/* ⬇️ NOWY MODAL: SEGMENTACJA (globalnie z menu) */}
      <LightModal open={segOpen} onClose={()=>!segBusy && setSegOpen(false)} width={720} title={t('segmentation') || 'Segmentacja'}>
        <div className="form-grid" style={{gridTemplateColumns:'1fr', rowGap:16}}>
          <div className="form-row">
            <div className="muted">{t('chooseFile') || 'Wybierz plik'}</div>
            <div
              onDragOver={e=>{e.preventDefault(); e.stopPropagation();}}
              onDrop={onDropSeg}
              style={{border:'1px dashed var(--border, #1b2447)', borderRadius:10, padding:16, textAlign:'center', userSelect:'none'}}
            >
              <div style={{opacity:.85, marginBottom:8}}>{t('dropHere') || 'Upuść plik tutaj lub kliknij “Wybierz plik”.'}</div>
              <button className="ghost" type="button" onClick={()=>fileSegRef.current?.click()}>{t('chooseFile') || 'Wybierz plik'}</button>
              <input ref={fileSegRef} type="file" accept=".txt,.log,.csv,text/plain" onChange={e=>{ const f=e.target.files?.[0]; if(f) readSegFile(f); e.target.value=''; }} style={{display:'none'}}/>
              {segFileName ? <div className="muted" style={{marginTop:8}}>{segFileName}</div> : null}
            </div>
          </div>

          <label className="form-row">
            <div className="muted">{t('orPasteText') || 'Albo wklej tekst'}</div>
             <textarea
                rows={8}
                value={segText}
                onChange={e=>{ setSegText(e.target.value); if (segErr) setSegErr(''); }}
                placeholder="Wklej linie do segmentacji..."
              />
          </label>

          {segErr ? <div className="muted" style={{color:'#ff6b6b'}}>{segErr}</div> : null}

          <div style={{display:'flex', justifyContent:'flex-end', gap:12}}>
            <button type="button" className="ghost" disabled={segBusy} onClick={()=>setSegOpen(false)}>{t('cancel') || 'Anuluj'}</button>
            <button type="button" onClick={runSegmentation} disabled={segBusy} style={{ background:'#16a34a', color:'#fff', padding:'10px 16px', borderRadius:10, fontWeight:600}}>
              {t('segRun') || 'Uruchom segmentację'}
            </button>
          </div>
        </div>
      </LightModal>
    </>
  );
}
