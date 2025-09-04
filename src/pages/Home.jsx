import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { loadConfig, saveConfig, loadValues, saveValues as saveValuesCore, timestamp, loadProjects, saveProjects, snapshotProject, applyProject, KEY_VALS } from '../utils.js';
import { t } from '../i18n.js';
import { fitToLength } from '../utils/fixedWidth.js';
import { saveTemplate as tplSave } from '../utils.templates.js';
import ScrollTabs from '../components/ScrollTabs.jsx';
import GeneratedTabs from '../components/GeneratedTabs.jsx';
import ConfirmClearModal from '../components/ConfirmClearModal.jsx';

import SaveTemplateModal from '../components/SaveTemplateModal.jsx';
import DeleteTemplateModal from '../components/DeleteTemplateModal.jsx';
import { segmentText } from '../segmentation.js';
import { createWorkbookNewFile, downloadWorkbook } from '../utils/excelMapping';
// --- DEV/PROD-safe tabs reader ---
function readGenTabsLS(id) {
  const sid = String(id);
  // exact for current BASE_URL
  try {
    const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/';
    const k = `intgen:v63:${base}:genTabs_${sid}`;
    const v = localStorage.getItem(k);
    if (v != null) return JSON.parse(v) || [];
  } catch (e) {}
  // scan any namespaced match (handles GH Pages subpaths)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (k.startsWith('intgen:v63:') && k.endsWith(`:genTabs_${sid}`)) {
        const v = localStorage.getItem(k);
        if (v != null) return JSON.parse(v) || [];
      }
    }
  } catch (e) {}
  // legacy fallback
  try {
    const legacy = localStorage.getItem('tcf_genTabs_' + sid);
    return JSON.parse(legacy || '[]') || [];
  } catch (e) { return []; }
}


// Use "live" values only if the active tab belongs to the same subsection
function isActiveTabForSection(activeTab, secIdx) {
  try { return activeTab && Number(activeTab.secIdx) === Number(secIdx); } catch { return false; }
}
export default function Home() {
  // Router info (declare ONCE inside the component)
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // remember last seen values payload to avoid redundant/foreign rehydrates
  
const lastValsJsonRef = useRef('');
useEffect(() => {
  try { lastValsJsonRef.current = localStorage.getItem(KEY_VALS) || ''; } catch {}
}, []);

// ---- Extended columns (Origin, Comment, Default value) ----
const [extended, setExtended] = useState(() => { try { return localStorage.getItem('tcf_ui_extended') === '1'; } catch { return false; } });

    // width for 3 extra columns in extended mode
    const extraCol = extended ? 'minmax(0, 1.2fr)' : 'minmax(0, 0fr)';
    const [extHover, setExtHover] = useState(false);
    const labelCol = 'var(--label-col, 440px)';
    const valueCol = extended ? 'minmax(260px, 2fr)' : '1fr';

// ---- Extras local state (independent, unlimited length; persisted to localStorage) ----
const [extras, setExtras] = useState({});
const EXTRAS_LS_KEY = React.useMemo(() => 'tcf_field_extras_' + String(id ?? ''), [id]);

useEffect(() => {
  try {
    const raw = localStorage.getItem(EXTRAS_LS_KEY);
    setExtras(raw ? JSON.parse(raw) : {});
  } catch { setExtras({}); }
}, [EXTRAS_LS_KEY]);

const setExtra = useCallback((secIdx, fldIdx, key, val) => {
  setExtras(prev => {
    const next = { ...prev };
    if (!next[secIdx]) next[secIdx] = {};
    if (!next[secIdx][fldIdx]) next[secIdx][fldIdx] = {};
    next[secIdx][fldIdx][key] = val;
    try { localStorage.setItem(EXTRAS_LS_KEY, JSON.stringify(next)); } catch {}
    return next;
  });
}, [EXTRAS_LS_KEY]);

useEffect(() => { try { localStorage.setItem('tcf_ui_extended', extended ? '1' : '0'); } catch {} }, [extended]);
useEffect(() => {
  const onKey = (e) => { if (e.shiftKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); setExtended(v => !v); } };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);

  // --- anti-echo for local saves (cooldown + wrapper) ---
  const SAVE_ECHO_COOLDOWN_MS = 2500;
  const lastLocalSaveTs = useRef(0);
  const saveValuesLocal = (...args) => {
    lastLocalSaveTs.current = Date.now(); return saveValuesCore(...args);
    try { lastValsJsonRef.current = localStorage.getItem(KEY_VALS) || ''; } catch { }
  };

  // ===== Export modes (CSV / JSON) =====
  // CSV
  const [csvMode, setCsvMode] = useState(() => { try { return localStorage.getItem('tcf_csv_mode') === '1'; } catch { return false; } });
  const [csvSep, setCsvSep] = useState(() => { try { return localStorage.getItem('tcf_csv_sep') || ';'; } catch { return ';'; } });

  // Generated tabs change counter (textarea auto-refresh)
  const [genTabsVersion, setGenTabsVersion] = useState(0);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isClearSectionOpen, setIsClearSectionOpen] = useState(false);
  const [clearSectionIdx, setClearSectionIdx] = useState(-1);
  const bumpGenTabs = React.useCallback(() => setGenTabsVersion(v => v + 1), []);
  useEffect(() => { try { localStorage.setItem('tcf_csv_mode', csvMode ? '1' : '0'); } catch (e) { } }, [csvMode]);
  useEffect(() => { try { localStorage.setItem('tcf_csv_sep', csvSep || ';'); } catch (e) { } }, [csvSep]);


  const [csvHeader, setCsvHeader] = useState(() => { try { const v = localStorage.getItem('tcf_csv_header'); return v == null ? true : v === '1'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('tcf_csv_header', csvHeader ? '1' : '0'); } catch (e) { } }, [csvHeader]);

  // JSON
  const [jsonMode, setJsonMode] = useState(() => { try { return localStorage.getItem('tcf_json_mode') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('tcf_json_mode', jsonMode ? '1' : '0'); } catch (e) { } }, [jsonMode]);

  const [skipEmpty, setSkipEmpty] = useState(() => { try { return localStorage.getItem('tcf_skip_empty') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('tcf_skip_empty', skipEmpty ? '1' : '0'); } catch (e) { } }, [skipEmpty]);

  const [jsonMinified, setJsonMinified] = useState(() => { try { return localStorage.getItem('tcf_json_min') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('tcf_json_min', jsonMinified ? '1' : '0'); } catch (e) { } }, [jsonMinified]);
  // JSON array/object toggle
  const [jsonArray, setJsonArray] = useState(() => { try { const v = localStorage.getItem('tcf_json_array'); return v == null ? true : v === '1'; } catch { return true; } });

  // --- Segmentation state ---
  const [segmentMode, setSegmentMode] = useState(false);
  // Toggle Segmentation button handler (highlight toggle)
  const onToggleSegmentation = () => {
    try {
      setSegmentMode(prev => {
        const next = !prev;
        // when leaving segmentation, clear the pasted text
        if (!next) {
          try { setSegmentTextStr(''); } catch (e) { }
        }
        return next;
      });
    } catch (e) { }
  };

  const [segmentTextStr, setSegmentTextStr] = useState('');
  const [copiedFlash, setCopiedFlash] = useState(false);

  useEffect(() => { try { localStorage.setItem('tcf_json_array', jsonArray ? '1' : '0'); } catch (e) { } }, [jsonArray]);




  // Per-field FLEX helpers
  const isFlex = (fi) => {
    if (!iface) return false;
    if (Array.isArray(iface.flexFields) && typeof iface.flexFields[fi] === 'boolean') return !!iface.flexFields[fi];
    if (iface.mode === 'flex') return true;
    return false;
  };
  const isFlexFor = (itf, i) => {
    if (!itf) return false;
    if (Array.isArray(itf.flexFields) && typeof itf.flexFields[i] === 'boolean') return !!itf.flexFields[i];
    if (itf.mode === 'flex') return true;
    return false;
  };
  // Small helper to read *real* per-field length (never silently 10 unless missing/invalid)
  const getLen = (i, fallback = 10) => {
    const v = Array.isArray(iface?.lengths) ? Number.parseInt(iface.lengths[i], 10) : NaN;
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };

  // -- tcf-project-apply: apply project snapshot when ?project=PID is present
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const pid = q.get('project');
    if (!pid) return;
    try {
      const map = loadProjects();
      const p = map && map[pid];
      if (p && p.data && applyProject(p.data)) {
        // remove query param from URL
        navigate(window.location.pathname, { replace: true });
        // notify UI to refresh values
        try {
          queueMicrotask?.(() => window.dispatchEvent(new Event('tcf-values-changed')));

        } catch (e) { }
      } else {
        console.warn('Project not found or failed to apply:', pid);
      }
    } catch (err) {
      console.error('Failed to apply project from URL:', err);
    }
  }, [location.search, navigate]);

  // State
  const [cfg, setCfg] = useState(loadConfig());
  const [dockOpen, setDockOpen] = useState(true);

  const [templFlash, setTemplFlash] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isDeleteTplOpen, setIsDeleteTplOpen] = useState(false);
  const [tplToDelete, setTplToDelete] = useState(null);
  const [iface, setIface] = useState(null);
  const [valsMap, setValsMap] = useState(loadValues());
  const [values, setValues] = useState([]);
  const [activeSec, setActiveSec] = useState(0);
  const goToAdmin = React.useCallback((e) => {
    if (e && e.preventDefault) e.preventDefault();
    const ifId = iface?.id || '';
    const sec  = Number(activeSec) || 0;
    try {
      localStorage.setItem('intgen_admin_jump', JSON.stringify({ ifaceId: ifId, sec, ts: Date.now() }));
    } catch {}
    (() => {
      try { sessionStorage.setItem('intgen_admin_return', JSON.stringify({ from: 'home', path: location.pathname, search: `?sec=${sec}`, ts: Date.now() })); } catch {} 
      return navigate({ pathname: '/admin', search: `?view=edit&iface=${encodeURIComponent(ifId)}&sec=${sec}` }, { state: { from: 'home', backPath: location.pathname, backSearch: `?sec=${sec}` } });
    })()
  }, [iface?.id, activeSec, navigate]);

  // --- Section notes (per section) ---
  const secNotesUserKey = useMemo(() => iface ? (String(iface.id) + '_secNotes') : null, [iface]);
  const secNotesUserArr = useMemo(() => {
    const n = iface?.sections?.length || 0;
    const base = Array(n).fill('');
    try {
      const arr = secNotesUserKey ? valsMap[secNotesUserKey] : null;
      if (Array.isArray(arr)) {
        for (let i = 0; i < n; i++) base[i] = String(arr[i] ?? '');
      }
    } catch (e) { }
    // fallback to defaults from config if user has nothing
    if (iface && Array.isArray(iface.sectionNotes)) {
      for (let i = 0; i < Math.min(base.length, iface.sectionNotes.length); i++) {
        if (!base[i]) base[i] = String(iface.sectionNotes[i] ?? '');
      }
    }
    return base;
  }, [iface, valsMap, secNotesUserKey]);
  const secNoteValue = secNotesUserArr?.[activeSec] ?? '';
  const saveSecNote = useCallback((val) => {
    if (!iface || !secNotesUserKey) return;
    const n = iface.sections?.length || 0;
    const curr = Array.isArray(valsMap[secNotesUserKey]) ? valsMap[secNotesUserKey].slice() : Array(n).fill('');
    if (curr.length < n) { const nn = Array(n).fill(''); for (let i = 0; i < curr.length; i++) nn[i] = curr[i]; curr.splice(0, curr.length, ...nn); }
    curr[activeSec] = val;
    const map = { ...valsMap, [secNotesUserKey]: curr };
    setValsMap(map); saveValuesLocal(map);
  }, [iface, activeSec, valsMap, secNotesUserKey]);

  // --- guard: block rehydrate for a short period after switching sections/tabs
  const secSwitchTsRef = useRef(0);
  const SEC_SWITCH_BLOCK_MS = 1500;
  const setActiveSecSafe = useCallback((ix) => { secSwitchTsRef.current = Date.now(); setActiveSec(ix); }, []);

  const [colorPickerFor, setColorPicker] = useState(null);
  const [colorDraft, setColorDraft] = useState('#ffffff');


  // Combine mode: collect lines from multiple interfaces into the result
  const [combineAll, setCombineAll] = useState(() => { try { return localStorage.getItem('tcf_combine_all') === '1'; } catch { return false; } });
  const [combineOrder, setCombineOrder] = useState(() => { try { return JSON.parse(localStorage.getItem('tcf_combine_order') || '[]') || []; } catch { return []; } }); // array of interface IDs

  useEffect(() => { try { localStorage.setItem('tcf_combine_all', combineAll ? '1' : '0'); } catch (e) { } }, [combineAll]);

  // keep order in sync with current cfg (first-time populate or when interfaces change)
  useEffect(() => {
    const ids = (cfg?.interfaces || []).map(i => i.id);
    setCombineOrder(prev => {
      const keep = prev.filter(id => ids.includes(id));
      const add = ids.filter(id => !keep.includes(id));
      return keep.concat(add);
    });
  }, [cfg?.interfaces?.length]);
  useEffect(() => { try { localStorage.setItem('tcf_combine_order', JSON.stringify(combineOrder || [])); } catch (e) { } }, [combineOrder]);


  // helper to compute length for arbitrary interface
  const getLenFor = (ifc, i, fallback = 10) => {
    const v = Array.isArray(ifc?.lengths) ? Number.parseInt(ifc.lengths[i], 10) : NaN;
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };

  // Drag & drop ordering for combine mode
  const [dragId, setDragId] = useState(null);

  // Only show interfaces that actually contribute lines (have included sections beyond Introduction)

  // Generated sections (tabs) storage helper (per interface id)
  const getGenTabsFor = (ifaceId) => {
    try { return JSON.parse(localStorage.getItem('tcf_genTabs_' + String(ifaceId)) || '[]') || []; } catch { return []; }
  };
  const usedIds = useMemo(() => {
    const all = (cfg?.interfaces || []);
    const withIncluded = all.filter(itf => {
      const g = getGenTabsFor(itf.id);
      if (Array.isArray(g) && g.length > 0) return true;
      const incl = (Array.isArray(itf.includedSections) && itf.includedSections.length === itf.sections.length)
        ? itf.includedSections
        : (itf.sections || []).map(() => false);
      for (let s = 1; s < (itf.sections?.length || 1); s++) if (incl[s]) return true;
      return false;
    }).map(i => i.id);
    const prioritized = (combineOrder || []).filter(id => withIncluded.includes(id));
    const rest = withIncluded.filter(id => !prioritized.includes(id));
    return prioritized.concat(rest);
  }, [combineOrder, cfg?.interfaces, genTabsVersion, valsMap]);
  // === Section usage helpers (icon + counter in Introduction) ===
  const usedCountForSection = (itf, sIx) => {
    if (!itf || sIx == null) return 0;
    const idxs = (itf.fieldSections || []).map((sec, i) => (sec === sIx ? i : -1)).filter(i => i !== -1);
    if (!idxs.length) return 0;
    try {
      const g = JSON.parse(localStorage.getItem('tcf_genTabs_' + String(itf.id)) || '[]') || [];
      if (Array.isArray(g) && g.length > 0) {
        return g.filter(t => t && Number(t.secIdx) === Number(sIx)).length;
      }
    } catch (e) { }
    const vals = valsMap[itf.id] || values || [];
    if (idxs.some(i => String(vals[i] ?? '').trim() !== '')) return 1;
    const included = (Array.isArray(itf.includedSections) && itf.includedSections.length === (itf.sections?.length || 0))
      ? itf.includedSections
      : (itf.sections || []).map(() => false);
    return included[sIx] ? 1 : 0;
  };

  const sectionFieldCount = React.useMemo(() => {
    try {
      if (!iface || clearSectionIdx < 0) return 0;
      const fs = Array.isArray(iface.fieldSections) ? iface.fieldSections : [];
      const idx = Number(clearSectionIdx);
      return fs.filter(sec => Number(sec) === idx).length;
    } catch { return 0; }
  }, [iface, clearSectionIdx]);

  const hasDataForSection = (itf, sIx) => {
    try { return usedCountForSection(itf, sIx) > 0; } catch { return false; }
  };



  // Workspace-aware keys for persistence
  const wsIdForPersist = useMemo(() => {
    try {
      let id = localStorage.getItem('tcf_ws_current');
      if (!id) {
        const meta = JSON.parse(localStorage.getItem('tcf_workspace') || 'null');
        id = meta && meta.current;
      }
      return id || 'default';
    } catch { return 'default'; }
  }, [cfg?.interfaces?.length]);

  // Dock sizing (drag top bar, double-click to reset)
  const dockDefaultH = 140;
  const [dockH, setDockH] = useState(dockDefaultH);
  const [dockAnim, setDockAnim] = useState(false);

  // === Global Sequence helpers ===
  const pad7 = (n) => String(n).padStart(7, '0');

  const findSeqIndex = (itf, sectionIx) => {
    const idxs = (itf.fieldSections || []).map((s, i) => s === sectionIx ? i : -1).filter(i => i !== -1);
    // 1) Label match
    for (const i of idxs) {
      const label = String((itf.labels || [])[i] || '');
      if (/^sequence(\s*no\.?)?$/i.test(label)) return i;
    }
    // 2) Heuristic: numeric length 7
    for (const i of idxs) {
      const len = (itf.lengths || [])[i];
      const typ = String((itf.types || [])[i] || '').toLowerCase();
      if (len === 7 && typ === 'numeric') return i;
    }
    return null;
  };



  const fillDefaultValues = () => {
    if (!iface) return;
    const sectionIndex = activeSec;
    const idxs = (iface.fieldSections || []).map((s, i) => s === sectionIndex ? i : -1).filter(i => i !== -1);
    if (!Array.isArray(idxs) || idxs.length < 4) return;

    const typeStr = String((iface.ifaceType || '')).replace(/\s+/g, '');
    const appCode = typeStr.slice(0, 2);
    const ifCode = typeStr.slice(2, 4);

    const secRaw = (iface.sectionNumbers && iface.sectionNumbers[sectionIndex])
      || ((((iface.sections?.[sectionIndex] || '').match(/\b(\d{3})\b/) || [])[1]))
      || String(sectionIndex * 10);
    const secNum = String(secRaw || '').toString().padStart(3, '0').slice(-3);

    setValues(curr => {
      const next = curr.slice();
      // NIE ustawiamy Sequence tutaj — liczy się globalnie w finalText
      // Zakładamy kolejność pól w sekcji: [Sequence, Application, Interface, Section]
      if (idxs.length >= 2) next[idxs[1]] = appCode || '';
      if (idxs.length >= 3) next[idxs[2]] = ifCode || '';
      if (idxs.length >= 4) next[idxs[3]] = secNum || '';
      const map = { ...valsMap, [iface.id]: next };
      setValsMap(map); saveValuesLocal(map);
      return next;
    });
  };


  const dockHeadRef = useRef(null);

  // Load per-workspace persisted states
  useEffect(() => {
    try {
      const h = localStorage.getItem(`tcf_${wsIdForPersist}_dock_h`);
      if (h) setDockH(Math.max(120, Math.min(window.innerHeight - 120, parseInt(h, 10) || dockDefaultH)));
      const ca = localStorage.getItem(`tcf_${wsIdForPersist}_combine_all`);
      if (ca != null) setCombineAll(ca === '1');
      const co = JSON.parse(localStorage.getItem(`tcf_${wsIdForPersist}_combine_order`) || '[]');
      if (Array.isArray(co) && co.length) setCombineOrder(co);
    } catch (e) { }
  }, [wsIdForPersist]);



  // seed combineOrder when combineAll toggles
  useEffect(() => {
    if (combineAll && (!combineOrder || !combineOrder.length)) {
      const seed = (usedIds && usedIds.length) ? usedIds : (iface ? [iface.id] : (cfg?.interfaces || []).map(i => i.id));
      try { setCombineOrder(seed); } catch (e) { }
    }
  }, [combineAll, combineOrder, usedIds, iface, cfg?.interfaces]);
  useEffect(() => { try { localStorage.setItem(`tcf_${wsIdForPersist}_dock_h`, String(Math.round(dockH))); } catch (e) { } }, [dockH, wsIdForPersist]);
  useEffect(() => { try { localStorage.setItem(`tcf_${wsIdForPersist}_combine_all`, combineAll ? '1' : '0'); } catch (e) { } }, [combineAll, wsIdForPersist]);
  useEffect(() => { try { localStorage.setItem(`tcf_${wsIdForPersist}_combine_order`, JSON.stringify(combineOrder || [])); } catch (e) { } }, [combineOrder, wsIdForPersist]);

  const handleDockReset = () => {
    setDockAnim(true);
    setDockH(dockDefaultH);
    setTimeout(() => setDockAnim(false), 220);
  };
  const handleDockMouseDown = (ev) => {
    // ignore drag start from toggle button
    const t = ev.target;
    if (t && t.classList && t.classList.contains('dock-toggle')) return;
    const startY = ev.clientY;
    const startH = dockH;
    let moving = true;
    const onMove = (e) => {
      if (!moving) return;
      const dy = startY - e.clientY; // moving up increases height
      const next = Math.max(120, Math.min(window.innerHeight - 240, startH + dy));
      setDockH(next);
    };
    const onUp = () => {
      moving = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // -- tcf-autosave: persist current interface values/colors/includes into current project
  useEffect(() => {
    const pid = localStorage.getItem('tcf_current_project') || '';
    const on = localStorage.getItem('tcf_autosave') === '1';
    if (!iface || !pid || !on) return;
    // debounce ~400ms
    const timer = setTimeout(() => {
      try {
        const projMap = loadProjects();
        if (!projMap || !projMap[pid]) return;
        const snap = snapshotProject(iface, values);
        if (!snap) return;
        snap.projectName = projMap[pid].name || snap.interfaceName || 'Project';
        projMap[pid] = { id: pid, name: snap.projectName, data: snap };
        saveProjects(projMap);
        try {
          queueMicrotask?.(() => window.dispatchEvent(new Event('tcf-project-changed')));

        } catch (e) { }
      } catch (e) { console.warn('autosave failed', e); }
    }, 400);

    // Recompute when localStorage tabs change (defensive for cross-tab/async updates)
    useEffect(() => {
      const h = (e) => {
        try {
          const k = e && e.key ? String(e.key) : '';
          if (k.startsWith('tcf_genTabs_')) bumpGenTabs();
        } catch (e) { }
      };
      window.addEventListener('storage', h);
      return () => window.removeEventListener('storage', h);
    }, []);
    return () => clearTimeout(timer);
  }, [iface && JSON.stringify({ c: iface?.sectionColors, inc: iface?.includedSections }), values]);

  // Ensure arrays exist and, if needed, persist back to cfg
  const ensureInit = (i, freshCfg) => {
    if (!i) return i;
    const separators = Array.isArray(i.separators) ? i.separators : [];
    const included = (Array.isArray(i.includedSections) && i.includedSections.length === i.sections.length)
      ? i.includedSections
      : (i.sections || []).map((_, ix) => false); // default: all unchecked
    const colors = (Array.isArray(i.sectionColors) && i.sectionColors.length === i.sections.length)
      ? i.sectionColors
      : (i.sections || []).map(() => '');
    const needPersist = (i.includedSections !== included) || (i.sectionColors !== colors) || (i.separators !== separators);
    if (needPersist) {
      const fixed = { ...i, includedSections: included, sectionColors: colors, separators };
      const nextCfg = {
        ...freshCfg,
        interfaces: freshCfg.interfaces.map(x => x.id === i.id ? fixed : x)
      };
      setCfg(nextCfg);
      saveConfig(nextCfg);
      return fixed;
    }
    return i;
  };




  // shorcuts sections
  useEffect(() => {
    const isEditable = (el) => {
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };

    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return; // tylko „gołe” strzałki
      if (isEditable(document.activeElement)) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const total = Array.isArray(iface?.sections) ? iface.sections.length : 0;
        if (total <= 1) return;
        setActiveSec((prev) => {
          const next = e.key === 'ArrowRight' ? prev + 1 : prev - 1;
          return (next + total) % total; // zawijanie (last→0 / 0→last)
        });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [iface?.sections?.length, setActiveSec]);


  //shortcut dolny panel
useEffect(() => {
  const isInteractive = (el) => {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (el.isContentEditable) return true;
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (tag === 'button') return true;
    if (tag === 'a' && el.hasAttribute('href')) return true;
    return false;
  };

  const onKey = (e) => {
    // SPACJA bez modyfikatorów
    const isSpace = (e.code === 'Space') || (e.key === ' ' || e.key === 'Spacebar');
    if (isSpace && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      // jeśli fokus na kontrolce – nie przeszkadzaj (checkbox/btn/link/itd.)
      if (isInteractive(document.activeElement)) return;

      // faktycznie przechwytujemy -> nie scrolluj strony
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      if (typeof toggleBottomPanel === 'function') {
        toggleBottomPanel();
      } else {
        const btn = document.getElementById('btn-toggle-bottom-panel');
        if (btn) btn.click();
      }
      return;
    }

    // (tu może zostać Twoja obsługa ArrowLeft/ArrowRight)
  };

  const opts = { capture: true }; // złap zanim inne hotkeye zareagują
  window.addEventListener('keydown', onKey, opts);
  return () => window.removeEventListener('keydown', onKey, opts);
}, []);




  // Load config on route change, normalize iface, and sync values
  useEffect(() => {
    const fresh = loadConfig();
    const found = fresh.interfaces.find(i => i.id === id) || fresh.interfaces[0];
    const normalized = ensureInit(found, fresh);
    setIface(normalized);
    const map = loadValues();
    setValsMap(map);
    const arr = (map[normalized.id] ?? Array.from({ length: normalized.labels.length }, () => '')).slice(0, normalized.labels.length);
    setValues(arr);
    setActiveSec(0);
    setColorPicker(null);
  }, [id]);

  const isSequenceField = (i) => /^sequence(\s*no\.?)?$/i.test(String((iface.labels || [])[i] || ''));

  const perSectionJoined = useMemo(() => {
    if (!iface) return [];
    const gen = getGenTabsFor(iface.id);
    if (Array.isArray(gen) && gen.length > 0) {
      return gen.map(tab => {
        const sIx = tab.secIdx;
        const idxs = (iface.fieldSections || []).map((s, i) => s === sIx ? i : -1).filter(i => i !== -1);
        const snapMap = new Map(((tab.snapshot) || []).map(p => [p.i, p.v]));
        return idxs.map(i => fitToLength(snapMap.has(i) ? snapMap.get(i) : (values[i] ?? ''), getLen(i), (iface.types?.[i] || 'alphanumeric'), { flex: isFlex(i), truncate: true })).join('');
      });
    }
    const included = (Array.isArray(iface.includedSections) && iface.includedSections.length === iface.sections.length)
      ? iface.includedSections
      : (iface.sections || []).map((_, ix) => false);
    const lines = (iface.sections || []).map((_, secIdx) => {
      if (secIdx > 0 && !included[secIdx]) return '';
      const idxs = iface.fieldSections.map((s, i) => s === secIdx ? i : -1).filter(i => i !== -1);
      return idxs.map(i => fitToLength(values[i] ?? '', getLen(i), (iface.types?.[i] || 'alphanumeric'), { flex: isFlex(i), truncate: true })).join('');
    });
    return lines;
  }, [values, iface]);

  const finalText = useMemo(() => {
    // Helper to get field indexes for a section
    const idxsFor = (itf, sectionIx) => (itf.fieldSections || [])
      .map((sec, i) => sec === sectionIx ? i : -1).filter(i => i !== -1);

    let seq = 1; // Global sequence counter (start from 1)

    const buildForOne = (itf, vals) => {
      const included = (Array.isArray(itf.includedSections) && itf.includedSections.length === itf.sections.length)
        ? itf.includedSections
        : (itf.sections || []).map(() => false);

      const lines = [];
      // Prefer generated tabs (bottom subsections). If present, build from them.
      try {
        const gen = readGenTabsLS(itf.id);
        if (Array.isArray(gen) && gen.length > 0) {
          const linesFromTabs = [];
          let activeId = null; try { activeId = localStorage.getItem('tcf_genTabs_active_' + String(itf.id)) || null; } catch (e) { }
          for (const tab of gen) {
            const sIx = tab.secIdx;
            const idxs = idxsFor(itf, sIx);
            if (!idxs.length) continue;
            // choose source values
            const snap = Array.isArray(tab.snapshot) ? tab.snapshot : vals;
            let rowVals;
            if (!combineAll && tab.id && activeId && tab.id === activeId && Number(tab.secIdx) === Number(secIdx)) {
              // active tab uses live values so textarea updates while typing
              rowVals = idxs.map(i => String((vals[i] ?? '')).trim());
            } else if (snap && typeof snap[0] === 'object' && snap[0] && snap[0].i !== undefined) {
              const map = new Map(snap.map(p => [p.i, p.v]));
              rowVals = idxs.map(i => String((map.has(i) ? map.get(i) : (vals[i] ?? ''))).trim());
            } else {
              rowVals = idxs.map(i => String((snap[i] ?? '')).trim());
            }
            // if all fields empty, skip this line even if included
            if (!rowVals.some(v => v !== '')) continue;
            // overwrite Sequence if field exists in this section
            const seqIdx = findSeqIndex(itf, sIx);
            if (seqIdx != null) {
              const posInRow = idxs.indexOf(seqIdx);
              if (posInRow !== -1) {
                const fieldLen = Math.max(1, getLenFor(itf, seqIdx) || 7);
                const seqStr = String(seq).padStart(fieldLen, '0').slice(-fieldLen);
                rowVals[posInRow] = seqStr;
              }
            }
            const padded = rowVals.map((v, k) => fitToLength(v, getLenFor(itf, idxs[k]), (itf.types?.[idxs[k]] || 'alphanumeric'), { flex: isFlexFor(itf, idxs[k]), truncate: true }));
            linesFromTabs.push(padded.join(''));
            seq += 1;
          }
          return linesFromTabs;
        }
      } catch (e) { }

      for (let sIx = 0; sIx < (itf.sections?.length || 0); sIx++) {
        if (!included[sIx]) {
          const idxsProbe = (itf.fieldSections || []).map((sec, i) => sec === sIx ? i : -1).filter(i => i !== -1);
          const hasData = idxsProbe.some(i => String((vals[i] ?? '')).trim() !== '');
          if (!hasData) continue;
        }
        const idxs = idxsFor(itf, sIx);
        if (!idxs.length) continue;

        // raw row values
        const row = idxs.map(i => String((vals[i] ?? '')).trim());
        // if nothing filled, skip row to avoid 'sequence only' line
        if (!row.some(v => v !== '')) continue;

        // overwrite Sequence in this row
        const seqIdx = findSeqIndex(itf, sIx);
        if (seqIdx != null) {
          const posInRow = idxs.indexOf(seqIdx);
          if (posInRow !== -1) {
            const fieldLen = Math.max(1, getLenFor(itf, seqIdx) || 7);
            const seqStr = String(seq).padStart(fieldLen, '0').slice(-fieldLen);
            row[posInRow] = seqStr;
          }
        }

        // padding per field using existing helpers
        const padded = row.map((v, k) => fitToLength(v, getLenFor(itf, idxs[k]), (itf.types?.[idxs[k]] || 'alphanumeric'), { flex: isFlexFor(itf, idxs[k]), truncate: true }));
        lines.push(padded.join(''));

        // increment global sequence after pushing line
        seq += 1;
      }
      return lines;
    };

    if (!combineAll && !iface) return '';

    const outLines = [];
    if (combineAll) {
      let order = [];
      if (Array.isArray(combineOrder) && combineOrder.length) {
        order = combineOrder;
      } else if (Array.isArray(usedIds) && usedIds.length) {
        order = usedIds;
      } else {
        order = iface ? [iface.id] : (cfg.interfaces || []).map(i => i.id);
      }
      order = order.filter(id => (cfg.interfaces || []).some(i => i.id === id));
      for (const ifId of order) {
        const itf = (cfg.interfaces || []).find(i => i.id === ifId);
        if (!itf) continue;
        const vals = valsMap[ifId] || [];
        outLines.push(...buildForOne(itf, vals));
      }
    } else {
      outLines.push(...buildForOne(iface, values));
    }


    // --- Post-process for CSV / JSON modes ---
    if (jsonMode) {
      const rows = [];
      let gseq = 1;
      const emitRowsFor = (itf, vals) => {
        const gen = (function () { try { return readGenTabsLS(itf.id); } catch { return []; } })();
        if (Array.isArray(gen) && gen.length > 0) {
          for (const tab of gen) {
            const sIx = tab.secIdx;
            const idxs = idxsFor(itf, sIx);
            if (!idxs.length) continue;
            const snapMap = new Map(((tab.snapshot) || []).map(p => [p.i, p.v]));
            const rowVals = idxs.map(i => String((snapMap.has(i) ? snapMap.get(i) : (vals[i] ?? ''))).trim());
            const seqIdx = findSeqIndex(itf, sIx);
            if (seqIdx != null) {
              const posInRow = idxs.indexOf(seqIdx);
              if (posInRow !== -1) {
                const fieldLen = Math.max(1, getLenFor(itf, seqIdx) || 7);
                const seqStr = String(gseq).padStart(fieldLen, '0').slice(-fieldLen);
                rowVals[posInRow] = seqStr;
                gseq++;
              }
            }
            const obj = {};
            idxs.forEach((i, k) => {
              const label = String((itf.labels || [])[i] || `f${i}`);
              const v = rowVals[k];
              if (!skipEmpty || String(v).trim() !== '') obj[label] = v;
            });
            // push only if there is at least one key
            if (Object.keys(obj).length) rows.push(obj);

          }
          return;
        }
        // fallback to legacy includedSections
        const included = (Array.isArray(itf.includedSections) && itf.includedSections.length === itf.sections.length)
          ? itf.includedSections
          : (itf.sections || []).map(() => false);
        for (let sIx = 0; sIx < (itf.sections?.length || 0); sIx++) {
          if (!included[sIx]) {
            const idxsProbe = (itf.fieldSections || []).map((sec, i) => sec === sIx ? i : -1).filter(i => i !== -1);
            const hasData = idxsProbe.some(i => String((vals[i] ?? '')).trim() !== '');
            if (!hasData) continue;
          }
          const idxs = idxsFor(itf, sIx);
          if (!idxs.length) continue;
          const rowVals = idxs.map(i => String((vals[i] ?? '')).trim());
          const seqIdx = findSeqIndex(itf, sIx);
          if (seqIdx != null) {
            const posInRow = idxs.indexOf(seqIdx);
            if (posInRow !== -1) {
              const fieldLen = Math.max(1, getLenFor(itf, seqIdx) || 7);
              const seqStr = String(gseq).padStart(fieldLen, '0').slice(-fieldLen);
              rowVals[posInRow] = seqStr;
              gseq++;
            }
          }
          const obj = {};
          idxs.forEach((i, k) => {
            const label = String((itf.labels || [])[i] || `f${i}`);
            const v = rowVals[k];
            if (!skipEmpty || String(v).trim() !== '') obj[label] = v;
          });
          // push only if there is at least one key
          if (Object.keys(obj).length) rows.push(obj);

        }
      };
      if (combineAll) {
        const order = (Array.isArray(combineOrder) && combineOrder.length ? combineOrder : [iface.id])
          .filter(id => (cfg.interfaces || []).some(i => i.id === id));
        for (const ifId of order) {
          const itf = (cfg.interfaces || []).find(i => i.id === ifId);
          if (!itf) continue;
          emitRowsFor(itf, (valsMap[ifId] || []));
        }
      } else {
        emitRowsFor(iface, values);
      }
      const space = jsonMinified ? 0 : 2;
      if (jsonArray) return JSON.stringify(rows, null, space);
      return rows.map(o => JSON.stringify(o)).join('\n'); // NDJSON
    }
    if (csvMode) {
      const rows = [];
      let header = null;
      let gseq = 1;
      const esc = (v) => {
        const s = String(v ?? '');
        const wrap = s.includes('\n') || s.includes(csvSep) || s.includes('"');
        const s2 = s.replace(/"/g, '""');
        return wrap ? '"' + s2 + '"' : s2;
      };
      const joinRow = (row) => {
        // Accept arrays or objects; when object, follow header order
        if (Array.isArray(row)) return row.map(esc).join(csvSep);
        if (row && typeof row === 'object') {
          if (!header) header = Object.keys(row);
          return header.map(k => esc(row[k] ?? '')).join(csvSep);
        }
        // Fallback for primitives/invalid
        return esc(String(row ?? ''));
      };
      const emitRowsFor = (itf, vals) => {
        const gen = (function () { try { return readGenTabsLS(itf.id); } catch { return []; } })();
        if (Array.isArray(gen) && gen.length > 0) {
          for (const tab of gen) {
            const sIx = tab.secIdx;
            const idxs = idxsFor(itf, sIx);
            if (!idxs.length) continue;
            const snapMap = new Map(((tab.snapshot) || []).map(p => [p.i, p.v]));
            const rowVals = idxs.map(i => String((snapMap.has(i) ? snapMap.get(i) : (vals[i] ?? ''))).trim());
            const seqIdx = findSeqIndex(itf, sIx);
            if (seqIdx != null) {
              const posInRow = idxs.indexOf(seqIdx);
              if (posInRow !== -1) {
                const fieldLen = Math.max(1, getLenFor(itf, seqIdx) || 7);
                const seqStr = String(gseq).padStart(fieldLen, '0').slice(-fieldLen);
                rowVals[posInRow] = seqStr;
                gseq++;
              }
            }
            const obj = {};
            idxs.forEach((i, k) => {
              const label = String((itf.labels || [])[i] || `f${i}`);
              const v = rowVals[k];
              if (!skipEmpty || String(v).trim() !== '') obj[label] = v;
            });
            // push only if there is at least one key
            if (Object.keys(obj).length) rows.push(obj);
            if (!header) header = Object.keys(obj);

          }
          return;
        }
        // fallback to legacy includedSections
        const included = (Array.isArray(itf.includedSections) && itf.includedSections.length === itf.sections.length)
          ? itf.includedSections
          : (itf.sections || []).map(() => false);
        for (let sIx = 0; sIx < (itf.sections?.length || 0); sIx++) {
          if (!included[sIx]) continue;
          const idxs = idxsFor(itf, sIx);
          if (!idxs.length) continue;
          const rowVals = idxs.map(i => String((vals[i] ?? '')).trim());
          const seqIdx = findSeqIndex(itf, sIx);
          if (seqIdx != null) {
            const posInRow = idxs.indexOf(seqIdx);
            if (posInRow !== -1) {
              const fieldLen = Math.max(1, getLenFor(itf, seqIdx) || 7);
              const seqStr = String(gseq).padStart(fieldLen, '0').slice(-fieldLen);
              rowVals[posInRow] = seqStr;
              gseq++;
            }
          }
          const obj = {};
          idxs.forEach((i, k) => {
            const label = String((itf.labels || [])[i] || `f${i}`);
            const v = rowVals[k];
            if (!skipEmpty || String(v).trim() !== '') obj[label] = v;
          });
          // push only if there is at least one key
          if (Object.keys(obj).length) rows.push(obj);
          if (!header) header = Object.keys(obj);

        }
      };
      if (combineAll) {
        const order = (Array.isArray(combineOrder) && combineOrder.length ? combineOrder : [iface.id])
          .filter(id => (cfg.interfaces || []).some(i => i.id === id));
        for (const ifId of order) {
          const itf = (cfg.interfaces || []).find(i => i.id === ifId);
          if (!itf) continue;
          emitRowsFor(itf, (valsMap[ifId] || []));
        }
      } else {
        emitRowsFor(iface, values);
      }
      const out = [];
      // If header requested, optionally filter to only keys that have any non-empty value across rows
      if (csvHeader && header) {
        if (skipEmpty) {
          const nonEmptySet = new Set();
          for (const r of rows) for (const [k, v] of Object.entries(r)) if (String(v ?? '').trim() !== '') nonEmptySet.add(k);
          header = header.filter(k => nonEmptySet.has(k));
        }
        out.push(joinRow(header));
      }
      for (const r of rows) out.push(joinRow(r));
      return out.join('\n');
    }
    // Default: fixed width
    return outLines.join('\n');

  }, [combineAll, combineOrder, cfg, valsMap, iface, values, csvMode, csvSep, csvHeader, jsonMode, skipEmpty, jsonMinified, jsonArray, genTabsVersion]);
  ;

  const onChange = (i, v) => {
    if (!iface) return;
    const max = getLen(i);
    let nextVal = String(v);
    if (iface.types[i] === 'numeric') nextVal = nextVal.replace(/[^0-9]/g, '');
    if (!isFlex(i)) nextVal = nextVal.slice(0, max);
    setValues(curr => {
      const next = curr.slice(); next[i] = nextVal;
      const map = { ...valsMap, [iface.id]: next }; setValsMap(map); saveValuesLocal(map);
      return next;
    });
  };
  const onBlur = (i) => {
    if (!iface) return;
    const max = getLen(i);
    if (isFlex(i)) {
      setValues(curr => {
        const next = curr.slice();
        const map = { ...valsMap, [iface.id]: next }; setValsMap(map); saveValuesLocal(map);
        return next;
      });
      return;
    }
    setValues(curr => {
      const next = curr.slice(); next[i] = fitToLength(next[i] ?? '', max, (iface.types?.[i] || 'alphanumeric'), { flex: isFlex(i), truncate: true });
      const map = { ...valsMap, [iface.id]: next }; setValsMap(map); saveValuesLocal(map);
      return next;
    });
  };

  // Include / exclude section in result
  const toggleInclude = (secIdx, checked) => {
    const next = { ...iface };
    next.includedSections = Array.isArray(next.includedSections) && next.includedSections.length === next.sections.length
      ? next.includedSections.slice()
      : (next.sections || []).map((_, ix) => false);
    next.includedSections[secIdx] = !!checked;
    setIface(next);
    const nextCfg = { ...cfg, interfaces: cfg.interfaces.map(i => i.id === next.id ? next : i) };
    setCfg(nextCfg); saveConfig(nextCfg);
  };

  // Color pick & persist
  const onPickColor = (secIdx, color) => {
    const next = { ...iface };
    next.sectionColors = Array.isArray(next.sectionColors) && next.sectionColors.length === next.sections.length
      ? next.sectionColors.slice()
      : (next.sections || []).map(() => '');
    next.sectionColors[secIdx] = color || '';
    setIface(next);
    const nextCfg = { ...cfg, interfaces: cfg.interfaces.map(i => i.id === next.id ? next : i) };
    setCfg(nextCfg); saveConfig(nextCfg);
  };

  const guard = () => {
    if (!iface) return { ok: true };
    const included = (Array.isArray(iface.includedSections) && iface.includedSections.length === iface.sections.length)
      ? iface.includedSections : (iface.sections || []).map((_, ix) => false);
    for (let s = 1; s < (iface.sections?.length || 1); s++) {
      if (!included[s]) continue;
      const idxs = iface.fieldSections.map((sec, i) => sec === s ? i : -1).filter(i => i !== -1);
      for (const i of idxs) {
        if (isSequenceField && isSequenceField(i)) { /* auto */ } else if (iface.required[i] && !String(values[i] || '').trim()) return { ok: false, reason: 'required' };
        if (iface.types[i] === 'numeric' && /\\D/.test(String(values[i] || ''))) return { ok: false, reason: 'invalidNumeric' };
      }
    }
    return { ok: true };
  };
  const saveAsTemplate = async () => { setIsSaveTemplateOpen(true); };
  const doSaveTemplate = async (providedName) => {
    const name = providedName;
    const isMulti = !!combineAll;
    const idList = isMulti ? (combineOrder || []) : [iface?.id].filter(Boolean);
    const byId = {};
    try {
      for (const id of idList) {
        const vals = (valsMap && valsMap[id]) ? valsMap[id] : [];
        const itf = (cfg?.interfaces || []).find(i => i.id === id) || {};
        const incl = Array.isArray(itf.includedSections) ? itf.includedSections : (Array.isArray(itf.sections) ? itf.sections.map(() => false) : []);
        const gen = JSON.parse(localStorage.getItem('tcf_genTabs_' + String(id)) || '[]') || [];
        byId[id] = { values: vals, includedSections: incl, genTabs: gen };
      }
    } catch (e) { }
    const payload = { text: finalText, multi: isMulti, order: idList, snapshot: byId, createdAt: Date.now() };
    tplSave(name, payload);
    setTemplFlash(false); try { void document?.querySelector('.result-area')?.offsetWidth; } catch (e) { }
    setTemplFlash(true); setTimeout(() => setTemplFlash(false), 900);
  };



  const copyResult = async () => {
    try {
      await navigator.clipboard.writeText(finalText);
      setCopiedFlash(false); // reset to allow retrigger
      // Force reflow so animation restarts even if class was recently removed
      try { void document?.querySelector('.result-area')?.offsetWidth; } catch (e) { }
      setCopiedFlash(true);
      setTimeout(() => setCopiedFlash(false), 900);
    } catch {
      window.prompt('Skopiuj ręcznie:', finalText);
    }
  };
  const downloadResult = async () => {
    const name = iface?.name?.trim() || 'interface';
    const fileName = `${name}_${timestamp()}.txt`.replace(/\\s+/g, '_');
    const blob = new Blob([finalText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1500);
  };

  const clearForm = (force = false) => {
    if (!iface) return;
    // Confirm
    const ok = force ? true : ((typeof window !== 'undefined' && window.confirm)
      ? window.confirm(t('confirmClearAll') || 'Na pewno wyczyścić pola, podsekcje i kolory?')
      : true);
    if (!ok) return;
    const targetSec = (typeof overrideSec === 'number' ? overrideSec : activeSec);

    // 1) Clear all field values for this interface
    const empties = Array.from({ length: (iface.labels?.length || 0) }, () => '');
    setValues(empties);
    const map = { ...valsMap, [iface.id]: empties };
    setValsMap(map);
    saveValuesLocal(map); // fires tcf-values-changed

    // 1b) Reset segmentation UI so textarea switches back to finalText (no leftover 'sekwencja')
    try { setSegmentTextStr(''); setSegmentMode(false); } catch (e) { }


    // 2) Clear includedSections (legacy) and all section colors — in-state & persist
    try {
      setCfg(prev => {
        const next = {
          ...prev,
          interfaces: (prev?.interfaces || []).map(it => {
            if (it.id !== iface.id) return it;
            const zeros = Array.from({ length: (it.sections?.length || 0) }, () => 0);
            const flags = zeros.map(() => false);
            return { ...it, includedSections: flags, sectionColors: flags.map(() => ''), sectionUsageCounts: zeros };
          })
        };
        saveConfig(next);
        try { window.dispatchEvent(new Event('tcf-config-changed')); } catch (e) { }
        return next;
      });
    } catch (e) { console.warn('clearForm: includedSections reset failed', e); }

    // Mirror the same reset onto the local `iface` state so Introduction reflects immediately
    try {
      setIface(prev => {
        if (!prev || prev.id !== iface.id) return prev;
        const zeros = Array.from({ length: (prev.sections?.length || 0) }, () => 0);
        const flags = zeros.map(() => false);
        return { ...prev, includedSections: flags, sectionColors: flags.map(() => ''), sectionUsageCounts: zeros };
      });
    } catch (e) { console.warn('clearForm: iface mirror reset failed', e); }

    // 3) Remove all generated subsections (tabs) for this interface
    try {
      const key = 'tcf_genTabs_' + String(iface.id);
      const akey = 'tcf_genTabs_active_' + String(iface.id);
      try { localStorage.removeItem(key); } catch (e) { }
      try { localStorage.removeItem(akey); } catch (e) { }
      try { bumpGenTabs(); } catch (e) { }
    } catch (e) { console.warn('clearForm: tabs wipe failed', e); }



    
// 3b) Recompute section-usage counters (Introduction badges) after wipe
try {
  const tabsById = new Map();
  for (const it of (cfg?.interfaces || [])) {
    try {
      const raw = localStorage.getItem('tcf_genTabs_' + String(it.id));
      const arr = JSON.parse(raw || '[]') || [];
      tabsById.set(it.id, arr);
    } catch (e) { tabsById.set(it.id, []); }
  }
  const nextVals = { ...valsMap, [iface.id]: Array.from({ length: (iface.labels?.length || 0) }, () => '') };
  applySectionUsage(nextVals, tabsById);
} catch (e) { }
// 4) Reset UI anchors
    setActiveSec(0);
    setColorPicker(null);
  };

  // Run segmentation: parse textarea content into fields & tabs, update states & auto-enable Multi if needed
  const segmentRun = () => {
    try {
      const raw = String(segmentTextStr || '').trim();
      if (!raw) { try { alert(t('segEmpty') || 'Wklej najpierw tekst do segmentacji.'); } catch (e) { } return; }

      // Parse
      const res = segmentText(raw, cfg, iface, valsMap);
      const { valsMap: nextVals, tabsById, readCount = 0, badLines = [], involvedIfaceIds = [] } = res || {};

      // Persist generated tabs per interface
      try {

        // Persist generated tabs per interface — update only those touched by this segmentation
        try {
          for (const it of (cfg?.interfaces || [])) {
            const id = it.id;
            const key = 'tcf_genTabs_' + String(id);
            let nextArr = undefined;

            try {
              if (tabsById && typeof tabsById.get === 'function') {
                nextArr = tabsById.has(id) ? (tabsById.get(id) || []) : undefined;
              } else if (tabsById && typeof tabsById === 'object') {
                nextArr = Object.prototype.hasOwnProperty.call(tabsById, id) ? (tabsById[id] || []) : undefined;
              }
            } catch (e) {
              nextArr = undefined;
            }

            if (typeof nextArr === 'undefined') {
              // untouched in this run — keep previous value
              continue;
            }
            localStorage.setItem(key, JSON.stringify(nextArr || []));
          }
        } catch (e) { }

      } catch (e) { }

      // Update values
      setValsMap(nextVals);
      saveValuesLocal(nextVals);

      // Recompute usage for Introduction badges

      // Build merged view of tabs: take fresh tabs for touched interfaces, keep stored for others
      const tabsMerged = new Map();
      try {
        for (const it of (cfg?.interfaces || [])) {
          const id = it.id;
          const key = 'tcf_genTabs_' + String(id);
          let fromSeg = undefined;
          if (tabsById && typeof tabsById.get === 'function') {
            fromSeg = tabsById.has(id) ? (tabsById.get(id) || undefined) : undefined;
          } else if (tabsById && typeof tabsById === 'object') {
            fromSeg = Object.prototype.hasOwnProperty.call(tabsById, id) ? (tabsById[id] || undefined) : undefined;
          }
          let stored = [];
          try { stored = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { stored = []; }
          tabsMerged.set(id, (typeof fromSeg !== 'undefined') ? (fromSeg || []) : (stored || []));
        }
      } catch (e) { }

      applySectionUsage(nextVals, tabsMerged);


      // Auto-enable Multi if >= 2 interfaces (involvedIfaceIds ∪ ids with generated tabs)
      try {
        const inv = Array.isArray(involvedIfaceIds) ? involvedIfaceIds : [];
        const fromTabs = [];
        try {
          if (tabsById && typeof tabsById.forEach === 'function') {
            tabsById.forEach((arr, id) => { if (Array.isArray(arr) && arr.length > 0) fromTabs.push(id); });
          }
        } catch (e) { }
        const allIds = Array.from(new Set([...(inv || []), ...(fromTabs || [])]));
        if (allIds.length > 1) {
          setCombineOrder(allIds);
          setCombineAll(true);
        } else {
          setCombineAll(false);
        }
      } catch (e) { }

      // Summary + required-fields validation
      try {
        // Validate required fields per used section
        let missingReq = 0;
        for (const it of (cfg?.interfaces || [])) {
          const id = it.id;
          const base = Array.isArray(nextVals?.[id]) ? nextVals[id] : [];
          const tabs = (tabsById && typeof tabsById.get === 'function') ? (tabsById.get(id) || []) : [];
          const total = (it.sections || []).length;
          for (let s = 1; s < total; s++) {
            // section considered only if included
            const idxs = (it.fieldSections || []).map((sec, i) => sec === s ? i : -1).filter(i => i !== -1);
            const reqIdxs = idxs.filter(i => Array.isArray(it.required) && !!it.required[i]);
            if (!reqIdxs.length) continue;
            const tabsFor = tabs.filter(t => t.secIdx === s);
            if (tabsFor.length) {
              for (const t of tabsFor) {
                const snap = t.snapshot || [];
                const map = new Map(snap.map(x => [x.i, x.v]));
                const ok = reqIdxs.every(i => String(map.get(i) ?? base[i] ?? '').trim() !== '');
                if (!ok) missingReq++;
              }
            } else {
              const ok = reqIdxs.every(i => String(base[i] || '').trim() !== '');
              if (!ok) missingReq++;
            }
          }
        }
        const invalidCount = Array.isArray(badLines) ? badLines.length : 0;
        const msg = `${t('segSummary') || 'Podsumowanie'}:` +
          `\n${t('segRead') || 'Odczytane linie'}: ${String(readCount)}` +
          `\n${t('segBad') || 'Błędne linie'}: ${String(invalidCount)}` +
          (invalidCount ? `\n- ${badLines.join('\n- ')}` : '');
        alert(msg);
      } catch (e) { }

      // Exit segmentation view
      setSegmentTextStr('');
      setSegmentMode(false);

    } catch (e) {
      console.error('segmentRun error', e);
      try { alert('Segmentacja nie powiodła się: ' + (e?.message || e)); } catch (e) { }
    }
  };



  const clearSection = (force = false, overrideSec = null) => {
    if (!iface) return;
    const ok = force ? true : ((typeof window !== 'undefined' && window.confirm) ? window.confirm(t('confirmClearSection') || 'Na pewno wyczyścić sekcję i pola?') : true);
    if (!ok) return;
    const targetSec = (typeof overrideSec === 'number' ? overrideSec : activeSec);
    const arr = (valsMap[iface.id] ?? Array.from({ length: iface.labels.length }, () => '')).slice();
    const idxs = iface.fieldSections.map((s, i) => s === targetSec ? i : -1).filter(i => i !== -1);
    idxs.forEach(i => { arr[i] = ''; });
    setValues(arr);
    const map = { ...valsMap, [iface.id]: arr }; setValsMap(map); saveValuesLocal(map);

    // Also remove generated subsections (tabs) for this section
    try {
      const k = 'tcf_genTabs_' + String(iface.id);
      const raw = localStorage.getItem(k);
      const arrTabs = JSON.parse(raw || '[]') || [];
      const rest = Array.isArray(arrTabs) ? arrTabs.filter(t => Number(t?.secIdx) !== Number(targetSec)) : [];
      localStorage.setItem(k, JSON.stringify(rest));
      try { localStorage.removeItem('tcf_genTabs_active_' + String(iface.id)); } catch (e) { }
      try { bumpGenTabs(); } catch (e) { }
    } catch (e) { console.warn('clearSection: tabs wipe failed', e); }

    // Recompute section usage counters for badges
    try {
      const tabsById = new Map();
      for (const it of (cfg?.interfaces || [])) {
        try {
          const raw = localStorage.getItem('tcf_genTabs_' + String(it.id));
          const arr = JSON.parse(raw || '[]') || [];
          tabsById.set(it.id, arr);
        } catch (e) { }
      }
      const nextVals = { ...valsMap, [iface.id]: arr };
      applySectionUsage(nextVals, tabsById);
    } catch (e) { }

    // Reset color & inclusion flag for this section
    try {
      const it = iface;
      const total = it.sections?.length || 0;
      const colors = (Array.isArray(it.sectionColors) && it.sectionColors.length === total) ? it.sectionColors.slice() : Array.from({ length: total }, () => '');
      const included = (Array.isArray(it.includedSections) && it.includedSections.length === total) ? it.includedSections.slice() : Array.from({ length: total }, () => false);
      colors[targetSec] = '';
      included[targetSec] = false;
      const fixed = { ...it, sectionColors: colors, includedSections: included };
      const nextCfg = { ...cfg, interfaces: cfg.interfaces.map(x => x.id === it.id ? fixed : x) };
      saveConfig(nextCfg); setCfg(nextCfg);
    } catch (e) { }

  };



  // Global hook so any "x" button can trigger our modal instead of window.confirm
  useEffect(() => {
    const opener = (name, onConfirm) => {
      try { setTplToDelete({ name, onConfirm }); setIsDeleteTplOpen(true); } catch (e) { }
    };
    try { window.tcfAskDeleteTemplate = opener; } catch (_) { }
    return () => {
      try { if (window.tcfAskDeleteTemplate === opener) delete window.tcfAskDeleteTemplate; } catch (_) { }
    };
  }, []);
  // --- Auto-sync after config/values changes (e.g., New Project) ---
  const syncingRef = useRef(false);

  useEffect(() => {
    const syncFromEvents = (e) => {


      // block rehydrate immediately after switching section/tab
      try { const k = (e && e.key) ? String(e.key) : ''; if (k && k.startsWith('tcf_genTabs_')) return; } catch { }
      try { if (Date.now() - (secSwitchTsRef.current || 0) < SEC_SWITCH_BLOCK_MS) return; } catch { }
      // filtered syncFromEvents
      // React only to our keys and only when values actually changed
      try {
        const k = (e && e.key) ? String(e.key) : '';
        if (k && k.startsWith('tcf_config_') && k.endsWith('_bump')) return; // ignore CMP bumps
        if (k && k !== KEY_VALS && !k.startsWith('tcf_genTabs_')) return;    // ignore foreign keys
      } catch { }
      try {
        const now = localStorage.getItem(KEY_VALS) || '';
        if (now === (lastValsJsonRef.current || '')) return;
        lastValsJsonRef.current = now;
      } catch { }
      try { if (e && e.key && e.key.startsWith('tcf_config_') && e.key.endsWith('_bump')) return; } catch { }
      if (Date.now() - (lastLocalSaveTs.current || 0) < SAVE_ECHO_COOLDOWN_MS) return;
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const fresh = loadConfig();
        const all = Array.isArray(fresh.interfaces) ? fresh.interfaces : [];
        const found2 = all.find(i => i.id === id) || all[0] || null;
        const normalized2 = found2 ? ensureInit(found2, fresh) : null;
        if (normalized2) {
          setIface(normalized2);
          const map2 = loadValues();
          setValsMap(map2);
          const arr = (map2[normalized2.id] ?? Array.from({ length: normalized2.labels.length }, () => '')).slice(0, normalized2.labels.length);
          setValues(arr);
          setActiveSec(prev => (Array.isArray(normalized2.sections) && prev < normalized2.sections.length ? prev : 0));
          setColorPicker(prev => (prev != null && Array.isArray(normalized2.sections) && prev < normalized2.sections.length ? prev : null));
        } else {
          setIface(null);
          setValues([]);
        }
      } catch (e) {
        console.error('syncFromEvents error', e);
      } finally {
        setTimeout(() => { syncingRef.current = false; }, 0);
      }
    };
    window.addEventListener('tcf-values-changed', syncFromEvents);
    window.addEventListener('tcf-config-changed', syncFromEvents);
    return () => {
      window.removeEventListener('tcf-values-changed', syncFromEvents);
      window.removeEventListener('tcf-config-changed', syncFromEvents);
    };
  }, [id]);



  // Compute includedSections and sectionUsageCounts based on valsMap + tabs
  function applySectionUsage(valsMap, tabsById) {
    try {
      const nextCfg = { ...cfg };
      nextCfg.interfaces = (cfg?.interfaces || []).map(it => {
        const id = it.id;
        const sections = it.sections || [];
        const total = sections.length || 0;
        const base = Array.isArray(valsMap?.[id]) ? valsMap[id] : [];
        const tabs = (tabsById && typeof tabsById.get === 'function') ? (tabsById.get(id) || []) : [];
        const counts = Array.from({ length: total }, () => 0);
        const included = Array.from({ length: total }, () => false);
        for (let s = 1; s < total; s++) {
          const idxs = (it.fieldSections || []).map((sec, i) => sec === s ? i : -1).filter(i => i !== -1);
          const hasBase = idxs.some(i => String(base[i] || '').trim() !== '');
          const tabsFor = tabs.filter(t => t.secIdx === s);
          const hasTab = tabsFor.some(t => (t.snapshot || []).some(({ i, v }) => idxs.includes(i) && String(v || '').trim() !== ''));
          included[s] = hasBase || hasTab;
          counts[s] = Math.max(0, tabsFor.length) || (hasBase ? 1 : 0);
        }
        return { ...it, includedSections: included, sectionUsageCounts: counts };
      });
      setCfg(nextCfg); saveConfig(nextCfg);
      // mirror to iface if same id
      try {
        if (iface) {
          const cur = nextCfg.interfaces.find(x => x.id === iface.id);
          if (cur) setIface(cur);
        }
      } catch (e) { }
    } catch (e) { console.error('applySectionUsage failed', e); }
  }
  // === SEGMENTATION HELPERS ===
  function anyDataPresent() {
    try {
      const vals = valsMap || {};
      const hasVals = (cfg?.interfaces || []).some(it => {
        const arr = vals[it.id] || [];
        return Array.isArray(arr) && arr.some(v => String(v ?? '').trim() !== '');
      });
      if (hasVals) return true;
      const hasTabs = (cfg?.interfaces || []).some(it => {
        try { const g = JSON.parse(localStorage.getItem('tcf_genTabs_' + String(it.id)) || '[]') || []; return Array.isArray(g) && g.length > 0; } catch { return false; }
      });
      if (hasTabs) return true;
      const hasOverlays = (cfg?.interfaces || []).some(it => {
        const anyColor = (it.sectionColors || []).some(c => String(c || '').trim() !== '');
        const anyIncl = (it.includedSections || []).some(Boolean);
        return anyColor || anyIncl;
      });
      return hasOverlays;
    } catch { return false; }
  }

  function globalWipeAll() {
    try {
      const all = (cfg?.interfaces || []);
      // wipe values + tabs
      const nextVals = {};
      for (const it of all) {
        nextVals[it.id] = Array.from({ length: (it.labels?.length || 0) }, () => '');
        try { localStorage.removeItem('tcf_genTabs_' + String(it.id)); } catch (e) { }
        try { localStorage.removeItem('tcf_genTabs_active_' + String(it.id)); } catch (e) { }
      }
      setValsMap(nextVals);
      saveValuesLocal(nextVals);
      // reset overlays
      const newCfg = {
        ...cfg,
        interfaces: all.map(it => {
          const n = (it.sections?.length || 0);
          return {
            ...it,
            includedSections: Array.from({ length: n }, () => false),
            sectionColors: Array.from({ length: n }, () => ''),
          };
        }),
      };
      setCfg(newCfg);
      saveConfig(newCfg);
      // close project if opened
      try { localStorage.removeItem('tcf_current_project'); } catch (e) { }
      try { window.dispatchEvent(new Event('tcf-project-changed')); } catch (e) { }
      // UI resets
      try { bumpGenTabs?.(); } catch (e) { }
      applySectionUsage(nextVals, tabsById);
      // Auto-enable Multi if >=2 interfaces were touched; ensure order is unique; fallback to usedIds if segmentation omitted some.
      try {
        const unique = Array.from(new Set(Array.isArray(involvedIfaceIds) ? involvedIfaceIds : []));
        const multiReady = unique.length > 1 ? unique : ((usedIds && usedIds.length > 1) ? usedIds : []);
        if (multiReady.length > 1) {
          setCombineOrder(multiReady);
          setCombineAll(true);
        } else {
          setCombineAll(false);
        }
      } catch (e) { }
      const invalidCount = badLines.length;
      const msg = (t('segSummary') || 'Podsumowanie') + ':\n' +
        (t('segRead') || 'Odczytane linie') + ': ' + String(readCount) + '\n' +
        (t('segBad') || 'Błędne linie') + ': ' + String(invalidCount) + (invalidCount ? ('\n- ' + badLines.join('\n- ')) : '');
      try { alert(msg); } catch (e) { }
      setSegmentTextStr('');
      setSegmentMode(false);
    } catch (e) {
      console.error('segmentRun error', e);
      try { alert('Segmentacja nie powiodła się: ' + (e?.message || e)); } catch (e) { }
    }
  }
  // === LIVE SECTION USAGE SYNC (valsMap -> includedSections) ===
  React.useEffect(() => {
    const h = setTimeout(() => {
      try {
        const tabsById = new Map();
        for (const it of (cfg?.interfaces || [])) {
          try {
            const raw = localStorage.getItem('tcf_genTabs_' + String(it.id));
            const arr = JSON.parse(raw || '[]') || [];
            tabsById.set(it.id, Array.isArray(arr) ? arr : []);
          } catch (e) { tabsById.set(it.id, []); }
        }
        applySectionUsage(valsMap, tabsById);
      } catch (e) { }
    }, 150);
    return () => clearTimeout(h);
  }, [valsMap]);
  if (!iface) return null;

  // Indices ordering & defaults first
  const indicesInSec = iface.fieldSections.map((s, i) => ({ s, i })).filter(o => o.s === activeSec).map(o => o.i);
  const defSet = new Set((iface.defaultFields || []).map(df => (df.label || '').toLowerCase()));
  const isDef = (idx) => defSet.has((iface.labels[idx] || '').toLowerCase());
  const orderedInSec = indicesInSec.slice().sort((a, b) => (isDef(b) ? 1 : 0) - (isDef(a) ? 1 : 0));


  return (
    <main className="wrap wide">
      <section className="card">
        <h2>{t('interface')}: {iface.name}</h2>
        <p className="muted"><a href="#" className="link" onClick={goToAdmin}>{t('editInAdmin')}</a></p>

        <ScrollTabs><div className="tabs-admin">
          {(iface.sections || []).map((name, idx) => (
            <button
              key={idx}
              className={`tab-admin ${idx === activeSec ? 'active' : ''}`}
              style={{ backgroundColor: iface.sectionColors?.[idx] || undefined }}
              onClick={() => setActiveSecSafe(idx)}
            >
              {idx === 0 ? 'Introduction' : ((((iface.sections[idx] || '').match(/\b(\d{3})\b/) || [])[1] || iface.sectionNumbers?.[idx] || String(idx * 10).padStart(3, '0')))}
            </button>
          ))}
        </div></ScrollTabs>

        <div>
          {activeSec === 0 ? (
            <div className="card" style={{ padding: 12 }}>
              <h3>Introduction</h3>
              <table className="table">
                <thead><tr><th>{t('number')}</th><th>{t('desc')}</th><th>{t('include')}</th></tr></thead>
                <tbody>
                  {(iface.sections || []).map((nm, ix) => ix > 0 && (
                    <tr key={ix} style={{ backgroundColor: iface.sectionColors?.[ix] || 'transparent' }}>
                      <td
                        className="numCell"
                        style={{ backgroundColor: iface.sectionColors?.[ix] || 'transparent' }}
                        onClick={() => { setColorPicker(ix); setColorDraft(iface.sectionColors?.[ix] || '#ffffff'); }}
                        title={t('sectionNumber')}
                      >
                        {(((iface.sections[ix] || '').match(/\b(\d{3})\b/) || [])[1] || iface.sectionNumbers?.[ix] || String(ix * 10).padStart(3, '0'))}
                      </td>
                      <td
                        className="clickCell"
                        style={{ backgroundColor: iface.sectionColors?.[ix] || 'transparent' }}
                        onClick={() => setActiveSecSafe(ix)}
                        title={t('desc')}
                      >
                        {nm}
                      </td>
                      <td style={{ backgroundColor: iface.sectionColors?.[ix] || 'transparent' }}>
                        {(() => {
                          const count = usedCountForSection(iface, ix);
                          const on = hasDataForSection(iface, ix);
                          return (
                            <span className="includeCell" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} title={(t('include') + `: ${count}`)}>
                              <span aria-hidden="true" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: on ? 'var(--ok, #16a34a)' : 'var(--mutedText, #999)' }}></span>
                              <span className="badge" style={{ fontSize: 12, opacity: .8 }}>{count}</span>
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {colorPickerFor !== null ? (
                <div className="colorPanel">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span>{t('sectionNumber')}: {(iface.sectionNumbers?.[colorPickerFor] || String(colorPickerFor * 10).padStart(3, '0'))}</span>
                    <input
                      type="color"
                      value={colorDraft}
                      onChange={e => { setColorDraft(e.target.value); onPickColor(colorPickerFor, e.target.value); }}
                      onInput={e => { setColorDraft(e.target.value); onPickColor(colorPickerFor, e.target.value); }}
                    />
                    <button onClick={() => { onPickColor(colorPickerFor, colorDraft); setColorPicker(null); }}>{t('apply') || 'Zastosuj'}</button>
                    <button onClick={() => { onPickColor(colorPickerFor, ''); setColorDraft('#ffffff'); }}>{t('clearColor') || 'Wyczyść'}</button>
                    <button className="ghost" onClick={() => setColorPicker(null)}>Zamknij</button>
                  </label>
                </div>
              ) : (
                <div className="actions" style={{ margin: '12px 0 0 0', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setIsClearOpen(true)}>{t('clear') || 'Wyczyść interfejs'}</button>
                </div>
              )}

            </div>
          ) : (
            <>
              
<div
  

className="secHeaderBar"
  style={{
    position: 'sticky', top: 8, zIndex: 50,
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding: 0, margin: '4px 0 6px',
    background: 'transparent',
    border: 'none',
    borderRadius: 0
  }}
>


  <div className="secHeader" style={{ fontWeight: 600 }}>
    {(iface.sectionNumbers?.[activeSec] || String(activeSec * 10).padStart(3, '0'))} · {iface.sections[activeSec]}
  </div>

  <button
    type="button"
    aria-pressed={extended}
    onClick={() => setExtended(v => !v)}
    title={`${t('toggleExtended') || 'Toggle extended'} (Shift+E)`}
    


className="extToggle"
        onMouseEnter={() => setExtHover(true)}
        onMouseLeave={() => setExtHover(false)}
        style={{
          border: extHover ? '1px solid rgba(255,255,255,0.28)' : '1px solid var(--border, rgba(255,255,255,0.18))',
          background: extHover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
          color: 'var(--text, #e5f0f4)',
          borderRadius: 14,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 700,
          backdropFilter: 'blur(2px)',
          boxShadow: extHover ? '0 2px 10px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(0,0,0,0.25)' : 'inset 0 0 0 1px rgba(0,0,0,0.25)',
          transform: extHover ? 'translateY(-1px)' : 'none',
          transition: 'all 140ms ease'
        }}
      >


    {extended ? (t('extendedOn') || 'Extended: ON') : (t('extendedOff') || 'Extended: OFF')}
  </button>
</div>

<div
  className="grid"
      key={`grid-${iface?.id || 'iface'}-${activeSec}-${(typeof window !== 'undefined' ? (localStorage.getItem('tcf_genTabs_active_' + String(iface?.id)) || '') : '')}`}
      style={{ gridTemplateColumns: `${labelCol} ${valueCol} ${extraCol} ${extraCol} ${extraCol}`, columnGap: '12px', rowGap: '8px', transition: 'grid-template-columns 240ms ease' }}
>
{orderedInSec.map((fi, k) => (
                  <React.Fragment key={`${activeSec}-${fi}`}>
                    {(k > 0 && isDef(orderedInSec[k - 1]) && !isDef(fi)) && <div className="sep" style={{ gridColumn: '1 / -1' }}></div>}
                    {Array.isArray(iface.separators) && iface.separators.includes(fi) && <div className="sep" style={{ gridColumn: '1 / -1' }}></div>}
                    <FragmentRow label={<LabelBlock label={iface.labels[fi]} len={getLen(fi)} desc={iface.descriptions[fi]} req={!!iface.required[fi]} flex={isFlex(fi)} />}>
                      <input
                        className={`inputField ${iface.required[fi] ? 'reqBorder' : ''}`}
                        type="text"
                        value={values[fi] || ''}
                        maxLength={isFlex(fi) ? undefined : (getLen(fi) || undefined)}
                        onChange={e => (isSequenceField(fi) ? null : onChange(fi, e.target.value))} readOnly={isSequenceField(fi)}
                        placeholder={isSequenceField(fi) ? "auto" : undefined}
                        onBlur={() => onBlur(fi)} />
                    </FragmentRow>

<div style={{ opacity: extended ? 1 : 0, pointerEvents: extended ? 'auto' : 'none', transition: 'opacity 220ms ease' }}>
  <input
    className="inputField"
    type="text"
    value={extras?.[activeSec]?.[fi]?.origin ?? ''}
            onChange={e => setExtra(activeSec, fi, 'origin', e.target.value)}
    placeholder={t('egSource') || 'eg. ERP/SAP/Manual'}
  />
</div>
<div style={{ opacity: extended ? 1 : 0, pointerEvents: extended ? 'auto' : 'none', transition: 'opacity 220ms ease 40ms' }}>
  <input
    className="inputField"
    type="text"
    value={extras?.[activeSec]?.[fi]?.comment ?? ''}
            onChange={e => setExtra(activeSec, fi, 'comment', e.target.value)}
    placeholder={t('note') || 'Note…'}
  />
</div>
<div style={{ opacity: extended ? 1 : 0, pointerEvents: extended ? 'auto' : 'none', transition: 'opacity 220ms ease 80ms' }}>
  <input
    className="inputField"
    type="text"
    value={extras?.[activeSec]?.[fi]?.defaultValue ?? ''}
            onChange={e => setExtra(activeSec, fi, 'defaultValue', e.target.value)}
    placeholder={t('default') || 'Default…'}
  />
</div>

</React.Fragment>
                ))}
              </div>
              <div className="actions-split">
                <div className="actions">
                  <GeneratedTabs key={(iface?.id || 'iface') + ':' + String(activeSec)}
                    iface={iface}
                    activeSec={activeSec}
                    values={values}
                    valsMap={valsMap}
                    setValues={setValues}
                    setValsMap={setValsMap}
                    onSwitchSection={setActiveSecSafe}
                    onChange={bumpGenTabs}
                  >
                    {({ onGenerate }) => (
                      <button
                        type="button"
                        className="btn"
                        onClick={onGenerate}
                      >
                        Generuj
                      </button>
                    )}
                  </GeneratedTabs>
                </div>

                <div className="actions">
                  <button onClick={fillDefaultValues}>{t('fillDefaults') || 'Fill in default values'}</button>

                  <button onClick={() => { setClearSectionIdx(activeSec); setIsClearSectionOpen(true); }}>{t('clearSection')}</button>
                </div>

                {/* Additional information (section note) – place this BEFORE the buttons/actions container */}
                {iface.sectionNotesEnabled?.[activeSec] && (
                  <div className="card" style={{ padding: 12, marginTop: 16, marginBottom: 16, width: '100%' }}>
                    <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{t('additionalInfo')}</div>
                    <textarea
                      rows={10}
                      value={secNoteValue}
                      readOnly
                      aria-readonly="true"
                      // kluczowe: kursor strzałki + brak “caret”
                      style={{
                        width: '100%',
                        resize: 'vertical',
                        opacity: 0.95,
                        cursor: 'default',
                        caretColor: 'transparent',
                      }}
                      // opcjonalnie: nie pojawi się focus po tabie
                      tabIndex={-1}
                      title={t('additionalInfo')}
                    />
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </section>

      <div className={`result-dock ${dockOpen ? 'open' : 'closed'}`}>
        <div className="dock-head" ref={dockHeadRef} onMouseDown={handleDockMouseDown} onDoubleClick={handleDockReset}>
          <div className="dock-title">{segmentMode ? t('fill') : t('result')}</div>
          <button className="dock-toggle" id="btn-toggle-bottom-panel" onMouseDown={(e) => e.stopPropagation()} onClick={() => setDockOpen(o => !o)}>
            {dockOpen ? '⯆' : '⯅'}
          </button>
        </div>
        <div className="dock-body">
          <div className="inner">
            <label className="block">
              <span>{segmentMode ? t('fill') : t('result')}:</span>
              <textarea className={'result-area' + (templFlash ? ' template-flash' : '') + (copiedFlash ? ' copied-flash' : '')} readOnly={!segmentMode} value={segmentMode ? segmentTextStr : finalText} onChange={e => segmentMode && setSegmentTextStr(e.target.value)} style={{ height: dockH, transition: dockAnim ? 'height 180ms ease' : 'none', resize: 'none', outline: segmentMode ? '2px solid var(--ok, #16a34a)' : 'none', boxShadow: segmentMode ? '0 0 0 2px rgba(22,163,74,.25) inset' : 'none' }} />
            </label>


            <div className="dock-options" style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
                <input type="checkbox" checked={combineAll} onChange={e => {
                  const checked = e.target.checked;
                  setCombineAll(checked);
                  if (checked && (!combineOrder || !combineOrder.length)) {
                    try {
                      const seed = (usedIds && usedIds.length) ? usedIds : (iface ? [iface.id] : (cfg?.interfaces || []).map(i => i.id));
                      setCombineOrder(seed);
                    } catch (e) { }
                  }
                }} />
                <span>{t('combineAll') || 'Combine from all interfaces'}</span>
              </label>
              {/* CSV / JSON toggles */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
                <input type="checkbox" checked={csvMode} onChange={e => { setCsvMode(e.target.checked); if (e.target.checked) setJsonMode(false); }} />
                <span>{t('csvMode') || 'Zmień na CSV'}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
                <input type="checkbox" checked={jsonMode} onChange={e => { setJsonMode(e.target.checked); if (e.target.checked) setCsvMode(false); }} />
                <span>{t('jsonMode') || 'JSON mode'}</span>
              </label>
              <span aria-hidden="true"
                style={{ display: 'inline-block', width: 1, height: 16, background: 'var(--border, #ccc)', margin: '0 8px' }}></span>

              {csvMode && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
                    <input type="checkbox" checked={csvHeader} onChange={e => setCsvHeader(e.target.checked)} />
                    <span>{t('csvHeader') || 'Nagłówek CSV'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }} title={t('csvSeparator') || 'Separator CSV'}>
                    <span style={{ opacity: 0.8 }}>{t('csvSep') || 'Separator'}:</span>
                    <input type="text" value={csvSep} onChange={e => setCsvSep(e.target.value)} style={{ width: 40 }} />
                  </label>
                </>
              )}
              {jsonMode && (
                <>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }} title={t('jsonArray') || 'JSON jako tablica'}>
                    <input type="checkbox" checked={jsonArray} onChange={e => setJsonArray(e.target.checked)} />
                    <span>{t('jsonArray') || 'JSON jako tablica'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }} title={t('onlyFilled') || 'Tylko wypełnione pola'}>
                    <input type="checkbox" checked={skipEmpty} onChange={e => setSkipEmpty(e.target.checked)} />
                    <span>{t('onlyFilled') || 'Tylko wypełnione pola'}</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }} title={t('minified') || 'Minified JSON'}>
                    <input type="checkbox" checked={jsonMinified} onChange={e => setJsonMinified(e.target.checked)} />
                    <span>{t('minified') || 'Minified JSON'}</span>
                  </label>
                </>
              )}

              {combineAll && (
                <div className="combine-tiles" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0', alignItems: 'stretch', justifyContent: 'flex-start', flex: '1 1 auto' }}>
                  {(usedIds || []).map((id) => {
                    const itf = (cfg?.interfaces || []).find(i => i.id === id);
                    if (!itf) return null;
                    return (
                      <div
                        key={id}
                        className="combine-tile"
                        draggable
                        onDragStart={(e) => {
                          setDragId(id);
                          try { e.dataTransfer.setData('text/plain', id); } catch (e) { }
                          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const leftHalf = (e.clientX - rect.left) < rect.width / 2;
                          e.currentTarget.classList.toggle('drop-left', leftHalf);
                          e.currentTarget.classList.toggle('drop-right', !leftHalf);
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('drop-left', 'drop-right');
                        }}
                        onDrop={(e) => {

                          e.preventDefault();
                          const el = e.currentTarget;
                          const isLeft = el.classList.contains('drop-left');
                          el.classList.remove('drop-left', 'drop-right');
                          if (!dragId || dragId === id) return;
                          setCombineOrder(o => {
                            const base = (o || []).filter(x => x !== dragId);
                            let at = base.indexOf(id);
                            if (at < 0) { base.push(dragId); return base; }
                            if (!isLeft) at = at + 1; // drop after
                            base.splice(at, 0, dragId);
                            return base;
                          });
                          e.currentTarget.classList.add('snap'); setTimeout(() => e.currentTarget.classList.remove('snap'), 180);
                          setDragId(null);
                        }}
                        onDragEnd={() => setDragId(null)}
                        title={t('orderInterfaces') || 'Order'}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try { navigate(`/iface/${id}`); setActiveSec(0); } catch (e) { }
                        }}
                      >
                        <span className="combine-tile-title">{itf.name || id}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            <div className="seg-btns" style={{ display: 'inline-flex', gap: 8 }}>
              <button
                className="combine-tile button-action"
                style={{ background: segmentMode ? 'var(--accent, #2856e6)' : undefined, color: segmentMode ? '#fff' : undefined, cursor: 'pointer' }}
                onClick={onToggleSegmentation}
                title={t('segTooltip') || 'Wklej wynik i zsegmentuj do pól'}
              >
                <span className="icon-wrap" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M20 4L8.5 12"></path><path d="M8.5 12L20 20"></path><path d="M8.5 12H14"></path></svg></span><span className="combine-tile-title">{t('segmentation') || 'Segmentacja'}</span>
              </button>
              {segmentMode ? (
                <button
                  className="combine-tile button-action"
                  style={{ background: 'var(--ok, #16a34a)', color: '#fff', cursor: 'pointer' }}
                  onClick={segmentRun}
                  title={t('segRunTip') || 'Uruchom segmentację bieżącego tekstu'}
                >
                  <span className="icon-wrap" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><polygon points="6,4 20,12 6,20" /></svg></span><span className="combine-tile-title">{t('segRun') || 'Segmentuj'}</span>
                </button>
              ) : null}
            </div>

            <div className="actions" style={{ justifyContent: 'flex-end' }}>
              <button onClick={copyResult}>{t('copy')}</button>
              <button onClick={downloadResult}>{t('download')}</button>
              <button onClick={saveAsTemplate}>{t('saveAsTemplate') || 'Zapisz jako schemat'}</button>

              <button
                onClick={() => {
                  if (combineAll) { return; }
                  try {
                    const wb = createWorkbookNewFile(iface, valsMap, finalText);
                    downloadWorkbook(wb, 'mapping.xlsx');
                  } catch (e) {
                    console.error(e);
                    try { alert(t('excelExportError') || 'Export do Excel nie powiódł się.'); } catch (_e) { }
                  }
                }}
                disabled={!!combineAll}
                aria-disabled={combineAll ? 'true' : 'false'}
                style={{ opacity: combineAll ? 0.6 : undefined, cursor: combineAll ? 'not-allowed' : 'pointer' }}
                title={combineAll ? (t('onlySingleMode') || 'Opcja dostępna tylko w trybie pojedynczego interfejsu.') : (t('exportMapping') || 'Eksportuj mapowanie')}
                className="export-mapping-btn"
              >
                <span className="export-mapping-btn__content">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 3h9l5 5v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" opacity="0.15" />
                    <path d="M13 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8.5 9l3 6m0-6l-3 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <span>{t('exportMapping') || 'Eksportuj mapowanie'}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {!dockOpen && (
        <button className="dock-fab" onClick={() => setDockOpen(true)}  title={segmentMode ? t('fill') : t('result')}>⯅</button>
      )}
      <ConfirmClearModal
        open={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        onConfirm={() => { clearForm(true); setIsClearOpen(false); }}
      />
      <ConfirmClearModal
        open={isClearSectionOpen}
        onClose={() => setIsClearSectionOpen(false)}
        onConfirm={() => { clearSection(true, clearSectionIdx); setIsClearSectionOpen(false); }}
        title={t('clearSection')}
        message={t('confirmClearSection')}
        confirmText={t('clearSection')}
      />
      <SaveTemplateModal
        open={isSaveTemplateOpen}
        onClose={() => setIsSaveTemplateOpen(false)}
        onSubmit={(name) => { doSaveTemplate(name); setIsSaveTemplateOpen(false); }}
      />

      <DeleteTemplateModal
        open={!!isDeleteTplOpen}
        onClose={() => { setIsDeleteTplOpen(false); setTplToDelete(null); }}
        name={tplToDelete?.name}
        onConfirm={() => { try { tplToDelete?.onConfirm?.(); } finally { setIsDeleteTplOpen(false); setTplToDelete(null); } }}
      />
    </main>
  );
}

function LabelBlock({ label, len, desc, req, flex }) {
  return (
    <div className="labelBlock" style={{ overflow:'hidden' }}>
      <div className="labelRow" style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        <span className="name">{label}{req ? <span className="reqStar">*</span> : null}</span>
      </div>
      <div className="meta"><span className="small">{flex ? (t('maxLenFlex') || 'Max długość FLEX') : `${t('maxLen') || 'Max długość'}: ${len}`}</span></div>
      {desc ? <div className="desc">{desc}</div> : null}
    </div>
  );
}

function FragmentRow({ label, children }) {
  return (<><div>{label}</div><div>{children}</div></>);
}