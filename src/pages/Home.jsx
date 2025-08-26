import React, { useEffect, useMemo, useState , useRef} from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { loadConfig, saveConfig, loadValues, saveValues, padToLen, timestamp, loadProjects, saveProjects, snapshotProject, applyProject } from '../utils.js';
import { t } from '../i18n.js';
import ScrollTabs from '../components/ScrollTabs.jsx';
import GeneratedTabs from '../components/GeneratedTabs.jsx';

export default function Home() {
  // Router info (declare ONCE inside the component)
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // ===== Export modes (CSV / JSON) =====
  // CSV
  const [csvMode, setCsvMode] = useState(() => { try { return localStorage.getItem('tcf_csv_mode') === '1'; } catch { return false; } });
  const [csvSep, setCsvSep] = useState(() => { try { return localStorage.getItem('tcf_csv_sep') || ';'; } catch { return ';'; } });
  // Generated tabs change counter (textarea auto-refresh)
  const [genTabsVersion, setGenTabsVersion] = useState(0);
  const bumpGenTabs = () => setGenTabsVersion(v => v + 1);
  useEffect(() => { try { localStorage.setItem('tcf_csv_mode', csvMode ? '1' : '0'); } catch {} }, [csvMode]);
  useEffect(() => { try { localStorage.setItem('tcf_csv_sep', csvSep || ';'); } catch {} }, [csvSep]);

  const [csvHeader, setCsvHeader] = useState(() => { try { const v = localStorage.getItem('tcf_csv_header'); return v == null ? true : v === '1'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('tcf_csv_header', csvHeader ? '1' : '0'); } catch {} }, [csvHeader]);

  // JSON
  const [jsonMode, setJsonMode] = useState(() => { try { return localStorage.getItem('tcf_json_mode') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('tcf_json_mode', jsonMode ? '1' : '0'); } catch {} }, [jsonMode]);

  const [skipEmpty, setSkipEmpty] = useState(() => { try { return localStorage.getItem('tcf_skip_empty') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('tcf_skip_empty', skipEmpty ? '1' : '0'); } catch {} }, [skipEmpty]);

  const [jsonMinified, setJsonMinified] = useState(() => { try { return localStorage.getItem('tcf_json_min') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('tcf_json_min', jsonMinified ? '1' : '0'); } catch {} }, [jsonMinified]);
  // JSON array/object toggle
  const [jsonArray, setJsonArray] = useState(() => { try { const v = localStorage.getItem('tcf_json_array'); return v == null ? true : v === '1'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('tcf_json_array', jsonArray ? '1' : '0'); } catch {} }, [jsonArray]);



  
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
  const getLen = (i, fallback=10) => {
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

        } catch {}
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
  const [iface, setIface] = useState(null);
  const [valsMap, setValsMap] = useState(loadValues());
  const [values, setValues] = useState([]);
  const [activeSec, setActiveSec] = useState(0);
  const [colorPickerFor, setColorPicker] = useState(null);
  const [colorDraft, setColorDraft] = useState('#ffffff');

  
  // Combine mode: collect lines from multiple interfaces into the result
  const [combineAll, setCombineAll] = useState(() => { try { return localStorage.getItem('tcf_combine_all') === '1'; } catch { return false; } });
  const [combineOrder, setCombineOrder] = useState(() => { try { return JSON.parse(localStorage.getItem('tcf_combine_order')||'[]')||[]; } catch { return []; } }); // array of interface IDs

  useEffect(() => { try { localStorage.setItem('tcf_combine_all', combineAll ? '1' : '0'); } catch {} }, [combineAll]);

  // keep order in sync with current cfg (first-time populate or when interfaces change)
  useEffect(() => {
    const ids = (cfg?.interfaces || []).map(i => i.id);
    setCombineOrder(prev => {
      const keep = prev.filter(id => ids.includes(id));
      const add = ids.filter(id => !keep.includes(id));
      return keep.concat(add);
    });
  }, [cfg?.interfaces?.length]);
  useEffect(() => { try { localStorage.setItem('tcf_combine_order', JSON.stringify(combineOrder||[])); } catch {} }, [combineOrder]);


  // helper to compute length for arbitrary interface
  const getLenFor = (ifc, i, fallback=10) => {
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
  }, [combineOrder, cfg?.interfaces]);


  // Workspace-aware keys for persistence
  const wsIdForPersist = useMemo(() => {
    try {
      let id = localStorage.getItem('tcf_ws_current');
      if (!id) {
        const meta = JSON.parse(localStorage.getItem('tcf_workspace')||'null');
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
    const idxs = (itf.fieldSections || []).map((s,i) => s === sectionIx ? i : -1).filter(i => i !== -1);
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
    const idxs = (iface.fieldSections || []).map((s,i)=>s===sectionIndex?i:-1).filter(i=>i!==-1);
    if (!Array.isArray(idxs) || idxs.length < 4) return;

    const typeStr = String((iface.ifaceType || '')).replace(/\s+/g, '');
    const appCode = typeStr.slice(0, 2);
    const ifCode  = typeStr.slice(2, 4);

    const secRaw = (iface.sectionNumbers && iface.sectionNumbers[sectionIndex])
      || ((((iface.sections?.[sectionIndex] || '').match(/\b(\d{3})\b/) || [])[1]))
      || String(sectionIndex * 10);
    const secNum = String(secRaw || '').toString().padStart(3, '0').slice(-3);

    setValues(curr => {
      const next = curr.slice();
      // NIE ustawiamy Sequence tutaj — liczy się globalnie w finalText
      // Zakładamy kolejność pól w sekcji: [Sequence, Application, Interface, Section]
      if (idxs.length >= 2) next[idxs[1]] = appCode || '';
      if (idxs.length >= 3) next[idxs[2]] = ifCode  || '';
      if (idxs.length >= 4) next[idxs[3]] = secNum  || '';
      const map = { ...valsMap, [iface.id]: next };
      setValsMap(map); saveValues(map);
      return next;
    });
  };


  const dockHeadRef = useRef(null);

  // Load per-workspace persisted states
  useEffect(() => {
    try {
      const h = localStorage.getItem(`tcf_${wsIdForPersist}_dock_h`);
      if (h) setDockH(Math.max(120, Math.min(window.innerHeight-120, parseInt(h,10)||dockDefaultH)));
      const ca = localStorage.getItem(`tcf_${wsIdForPersist}_combine_all`);
      if (ca != null) setCombineAll(ca === '1');
      const co = JSON.parse(localStorage.getItem(`tcf_${wsIdForPersist}_combine_order`)||'[]');
      if (Array.isArray(co) && co.length) setCombineOrder(co);
    } catch {}
  }, [wsIdForPersist]);

  useEffect(() => { try { localStorage.setItem(`tcf_${wsIdForPersist}_dock_h`, String(Math.round(dockH))); } catch {} }, [dockH, wsIdForPersist]);
  useEffect(() => { try { localStorage.setItem(`tcf_${wsIdForPersist}_combine_all`, combineAll ? '1':'0'); } catch {} }, [combineAll, wsIdForPersist]);
  useEffect(() => { try { localStorage.setItem(`tcf_${wsIdForPersist}_combine_order`, JSON.stringify(combineOrder||[])); } catch {} }, [combineOrder, wsIdForPersist]);

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
      try{
        const projMap = loadProjects();
        if (!projMap || !projMap[pid]) return;
        const snap = snapshotProject(iface, values);
        if (!snap) return;
        snap.projectName = projMap[pid].name || snap.interfaceName || 'Project';
        projMap[pid] = { id: pid, name: snap.projectName, data: snap };
        saveProjects(projMap);
        try {
          queueMicrotask?.(() => window.dispatchEvent(new Event('tcf-project-changed')));

        } catch {}
      }catch(e){ console.warn('autosave failed', e); }
    }, 400);
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
    if (needPersist){
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

  const isSequenceField = (i) => /^sequence(\s*no\.?)?$/i.test(String((iface.labels||[])[i]||''));

  const perSectionJoined = useMemo(() => {
    if (!iface) return [];
    const gen = getGenTabsFor(iface.id);
    if (Array.isArray(gen) && gen.length > 0) {
      return gen.map(tab => {
        const sIx = tab.secIdx;
        const idxs = (iface.fieldSections || []).map((s,i)=>s===sIx?i:-1).filter(i=>i!==-1);
        let activeId = null; try { activeId = localStorage.getItem('tcf_genTabs_active_' + String(iface.id)) || null; } catch {}
const snap = Array.isArray(tab.snapshot) ? tab.snapshot : values;
let rowVals;
if (tab.id && activeId && tab.id === activeId) {
  rowVals = idxs.map(i => String((values[i] ?? '')).trim());
} else if (snap && typeof snap[0] === 'object' && snap[0] && snap[0].i !== undefined) {
  const map = new Map(snap.map(p => [p.i, p.v]));
  rowVals = idxs.map(i => String((map.has(i) ? map.get(i) : (values[i] ?? ''))).trim());
} else {
  rowVals = idxs.map(i => String((snap[i] ?? '')).trim());
}
return idxs.map((i, k) => padToLen(rowVals[k], getLen(i))).join('');
      });
    }
    const included = (Array.isArray(iface.includedSections) && iface.includedSections.length === iface.sections.length)
      ? iface.includedSections
      : (iface.sections || []).map((_, ix) => false);
    const lines = (iface.sections || []).map((_, secIdx) => {
      if (secIdx > 0 && !included[secIdx]) return '';
      const idxs = iface.fieldSections.map((s, i) => s === secIdx ? i : -1).filter(i => i !== -1);
      return idxs.map(i => padToLen(values[i] ?? '', getLen(i))).join('');
    });
    return lines;
  }, [values, iface]);

  const finalText = useMemo(() => {
  // Helper to get field indexes for a section
  const idxsFor = (itf, sectionIx) => (itf.fieldSections || [])
    .map((sec,i)=>sec===sectionIx?i:-1).filter(i=>i!==-1);

  let seq = 1; // Global sequence counter (start from 1)

  const buildForOne = (itf, vals) => {
    
    const lines = [];

    // Prefer generated tabs (per-interface), if any
    let gen = [];
    try { gen = JSON.parse(localStorage.getItem('tcf_genTabs_' + String(itf.id)) || '[]') || []; } catch {}
    if (Array.isArray(gen) && gen.length > 0) {
      let activeId = null; try { activeId = localStorage.getItem('tcf_genTabs_active_' + String(itf.id)) || null; } catch {}
      for (const tab of gen) {
        const sIx = tab.secIdx;
        const idxs = (itf.fieldSections || []).map((sec,i)=>sec===sIx?i:-1).filter(i=>i!==-1);
        if (!idxs.length) continue;
        const snap = Array.isArray(tab.snapshot) ? tab.snapshot : vals;
        let rowVals;
        if (tab.id && activeId && tab.id === activeId) {
          rowVals = idxs.map(i => String((vals[i] ?? '')).trim());
        } else if (snap && typeof snap[0] === 'object' && snap[0] && snap[0].i !== undefined) {
          const map = new Map(snap.map(p => [p.i, p.v]));
          rowVals = idxs.map(i => String((map.has(i) ? map.get(i) : (vals[i] ?? ''))).trim());
        } else {
          rowVals = idxs.map(i => String((snap[i] ?? '')).trim());
        }
        const seqIdx = findSeqIndex(itf, sIx);
        if (seqIdx != null) {
          const posInRow = idxs.indexOf(seqIdx);
          if (posInRow !== -1) {
            const fieldLen = Math.max(1, getLenFor(itf, seqIdx) || 7);
            const seqStr = String(seq).padStart(fieldLen, '0').slice(-fieldLen);
            rowVals[posInRow] = seqStr;
          }
        }
        const padded = rowVals.map((v, k) => padToLen(v, getLenFor(itf, idxs[k])));
        lines.push(padded.join(''));
        seq += 1;
      }
      return lines;
    }

    // Fallback to legacy includedSections if no generated tabs
    const included = (Array.isArray(itf.includedSections) && itf.includedSections.length === itf.sections.length)
      ? itf.includedSections
      : (itf.sections || []).map(() => false);
    for (let sIx = 0; sIx < (itf.sections?.length || 0); sIx++) {
      if (!included[sIx]) continue;
      const idxs = (itf.fieldSections || []).map((sec,i)=>sec===sIx?i:-1).filter(i=>i!==-1);
      if (!idxs.length) continue;
      const row = idxs.map(i => String((vals[i] ?? '')).trim());
      const seqIdx = findSeqIndex(itf, sIx);
      if (seqIdx != null) {
        const posInRow = idxs.indexOf(seqIdx);
        if (posInRow !== -1) {
          const fieldLen = Math.max(1, getLenFor(itf, seqIdx) || 7);
          const seqStr = String(seq).padStart(fieldLen, '0').slice(-fieldLen);
          row[posInRow] = seqStr;
        }
      }
      const padded = row.map((v, k) => padToLen(v, getLenFor(itf, idxs[k])));
      lines.push(padded.join(''));
      seq += 1;
    }

    return lines;
  };

  if (!iface) return '';

  const outLines = [];
  if (combineAll) {
    const order = (Array.isArray(combineOrder) && combineOrder.length ? combineOrder : [iface.id])
      .filter(id => (cfg.interfaces || []).some(i => i.id === id));
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
      const gen = (function(){ try { return JSON.parse(localStorage.getItem('tcf_genTabs_' + String(itf.id)) || '[]') || []; } catch { return []; } })();
      if (Array.isArray(gen) && gen.length > 0) {
        for (const tab of gen) {
          const sIx = tab.secIdx;
          const idxs = idxsFor(itf, sIx);
          if (!idxs.length) continue;
          let activeId = null; try { activeId = localStorage.getItem('tcf_genTabs_active_' + String(itf.id)) || null; } catch {}
const snap = Array.isArray(tab.snapshot) ? tab.snapshot : vals;
let rowVals;
if (tab.id && activeId && tab.id === activeId) {
  rowVals = idxs.map(i => String((vals[i] ?? '')).trim());
} else if (snap && typeof snap[0] === 'object' && snap[0] && snap[0].i !== undefined) {
  const map = new Map(snap.map(p => [p.i, p.v]));
  rowVals = idxs.map(i => String((map.has(i) ? map.get(i) : (vals[i] ?? ''))).trim());
} else {
  rowVals = idxs.map(i => String((snap[i] ?? '')).trim());
}

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
            obj[label] = rowVals[k];
          });
          rows.push(obj);
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
          obj[label] = rowVals[k];
        });
        rows.push(obj);
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
    const joinRow = (arr) => arr.map(esc).join(csvSep);
    const emitRowsFor = (itf, vals) => {
      const gen = (function(){ try { return JSON.parse(localStorage.getItem('tcf_genTabs_' + String(itf.id)) || '[]') || []; } catch { return []; } })();
      if (Array.isArray(gen) && gen.length > 0) {
        for (const tab of gen) {
          const sIx = tab.secIdx;
          const idxs = idxsFor(itf, sIx);
          if (!idxs.length) continue;
          let activeId = null; try { activeId = localStorage.getItem('tcf_genTabs_active_' + String(itf.id)) || null; } catch {}
const snap = Array.isArray(tab.snapshot) ? tab.snapshot : vals;
let rowVals;
if (tab.id && activeId && tab.id === activeId) {
  rowVals = idxs.map(i => String((vals[i] ?? '')).trim());
} else if (snap && typeof snap[0] === 'object' && snap[0] && snap[0].i !== undefined) {
  const map = new Map(snap.map(p => [p.i, p.v]));
  rowVals = idxs.map(i => String((map.has(i) ? map.get(i) : (vals[i] ?? ''))).trim());
} else {
  rowVals = idxs.map(i => String((snap[i] ?? '')).trim());
}

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
            obj[label] = rowVals[k];
          });
          rows.push(obj);
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
          obj[label] = rowVals[k];
        });
        rows.push(obj);
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
    if (csvHeader && header) out.push(joinRow(header));
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
      const map = { ...valsMap, [iface.id]: next }; setValsMap(map); saveValues(map);
      return next;
    });
  };
  const onBlur = (i) => {
    if (!iface) return;
    const max = getLen(i);
    if (isFlex(i)) {
    setValues(curr => {
      const next = curr.slice();
      const map = { ...valsMap, [iface.id]: next }; setValsMap(map); saveValues(map);
      return next;
    });
    return;
  }
  setValues(curr => {
      const next = curr.slice(); next[i] = padToLen(next[i] ?? '', max);
      const map = { ...valsMap, [iface.id]: next }; setValsMap(map); saveValues(map);
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
    if (!iface) return { ok:true };
    const included = (Array.isArray(iface.includedSections) && iface.includedSections.length === iface.sections.length)
      ? iface.includedSections : (iface.sections || []).map((_, ix) => false);
    for (let s = 1; s < (iface.sections?.length || 1); s++){
      if (!included[s]) continue;
      const idxs = iface.fieldSections.map((sec, i) => sec === s ? i : -1).filter(i => i !== -1);
      for (const i of idxs){
        if (isSequenceField && isSequenceField(i)) { /* auto */ } else if (iface.required[i] && !String(values[i] || '').trim()) return { ok:false, reason:'required' };
        if (iface.types[i] === 'numeric' && /\\D/.test(String(values[i] || ''))) return { ok:false, reason:'invalidNumeric' };
      }
    }
    return { ok:true };
  };

  const copyResult = async () => {
    const g = guard();
    if (!g.ok) { alert(g.reason==='required'? t('notAllRequired') : t('invalidNumeric')); return; }
    try { await navigator.clipboard.writeText(finalText); }
    catch { window.prompt('Skopiuj ręcznie:', finalText); }
  };
  const downloadResult = async () => {
    const g = guard();
    if (!g.ok) { alert(g.reason==='required'? t('notAllRequired') : t('invalidNumeric')); return; }
    const name = iface?.name?.trim() || 'interface';
    const fileName = `${name}_${timestamp()}.txt`.replace(/\\s+/g,'_');
    const blob = new Blob([finalText], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.style.display='none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1500);
  };
  const clearForm = () => {
  if (!iface) return;
  // 1) Clear all field values (existing behavior)
  const empties = Array.from({ length: (iface.labels?.length || 0) }, () => '');
  setValues(empties);
  const map = { ...valsMap, [iface.id]: empties };
  setValsMap(map); 
  saveValues(map);

  // 2) EXTRA: uncheck all section checkboxes (Introduction table)
  try {
    const next = { ...iface };
    next.includedSections = Array.isArray(next.includedSections) && next.includedSections.length === (next.sections?.length || 0)
      ? next.includedSections.map(() => false)
      : (next.sections || []).map(() => false);

    // 3) EXTRA: clear colors for Introduction & all section tabs
    next.sectionColors = Array.isArray(next.sectionColors) && next.sectionColors.length === (next.sections?.length || 0)
      ? next.sectionColors.map(() => '')
      : (next.sections || []).map(() => '');

    setIface(next);
    const nextCfg = { ...cfg, interfaces: (cfg?.interfaces || []).map(i => i.id === next.id ? next : i) };
    setCfg(nextCfg);
    saveConfig(nextCfg);
  } catch (e) {
    console.warn('clearForm extras failed', e);
  }

  // 4) Reset active section & UI helpers
  setActiveSec(0);
  setColorPicker(null);
};

const clearSection = () => {
    if (!iface) return;
    const arr = (valsMap[iface.id] ?? Array.from({ length: iface.labels.length }, () => '')).slice();
    const idxs = iface.fieldSections.map((s, i) => s === activeSec ? i : -1).filter(i => i !== -1);
    idxs.forEach(i => { arr[i] = ''; });
    setValues(arr);
    const map = { ...valsMap, [iface.id]: arr }; setValsMap(map); saveValues(map);
  };


  // --- Auto-sync after config/values changes (e.g., New Project) ---
  const syncingRef = useRef(false);

  useEffect(() => {
    const syncFromEvents = () => {
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
        <p className="muted"><Link className="link" to="/admin">{t('editInAdmin')}</Link></p>

        <ScrollTabs><div className="tabs-admin">
          {(iface.sections || []).map((name, idx) => (
            <button
              key={idx}
              className={`tab-admin ${idx===activeSec?'active':''}`}
              style={{ backgroundColor: iface.sectionColors?.[idx] || undefined }}
              onClick={() => setActiveSec(idx)}
            >
              {idx===0 ? 'Introduction' : ((((iface.sections[idx]||'').match(/\b(\d{3})\b/)||[])[1] || iface.sectionNumbers?.[idx] || String(idx*10).padStart(3,'0')))}
            </button>
          ))}
        </div></ScrollTabs>

        <div>
          {activeSec===0 ? (
            <div className="card" style={{padding:12}}>
              <h3>Introduction</h3>
              <table className="table">
                <thead><tr><th>{t('number')}</th><th>{t('desc')}</th><th>{t('include')}</th></tr></thead>
                <tbody>
                  {(iface.sections || []).map((nm, ix) => ix>0 && (
                    <tr key={ix} style={{ backgroundColor: iface.sectionColors?.[ix] || 'transparent' }}>
                      <td
                        className="numCell"
                        style={{ backgroundColor: iface.sectionColors?.[ix] || 'transparent' }}
                        onClick={() => { setColorPicker(ix); setColorDraft(iface.sectionColors?.[ix] || '#ffffff'); }}
                        title={t('sectionNumber')}
                      >
                        {(((iface.sections[ix]||'').match(/\b(\d{3})\b/)||[])[1] || iface.sectionNumbers?.[ix] || String(ix*10).padStart(3,'0'))}
                      </td>
                      <td
                        className="clickCell"
                        style={{ backgroundColor: iface.sectionColors?.[ix] || 'transparent' }}
                        onClick={() => setActiveSec(ix)}
                        title={t('desc')}
                      >
                        {nm}
                      </td>
                      <td style={{ backgroundColor: iface.sectionColors?.[ix] || 'transparent' }}>
                        <input type="checkbox" checked={!!(iface.includedSections?.[ix] ?? false)} onChange={e => toggleInclude(ix, e.target.checked)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {colorPickerFor !== null ? (
                <div className="colorPanel">
                  <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <span>{t('sectionNumber')}: {(iface.sectionNumbers?.[colorPickerFor] || String(colorPickerFor*10).padStart(3,'0'))}</span>
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
              <div className="actions" style={{margin:'12px 0 0 0', display:'flex', justifyContent:'flex-end'}}>
                <button onClick={clearForm}>{t('clear') || 'Wyczyść interfejs'}</button>
              </div>
              )}

</div>
          ) : (
            <>
              <div className="secHeader" style={{margin:'8px 0 6px 0', fontWeight:600}}>
                {(iface.sectionNumbers?.[activeSec] || String(activeSec*10).padStart(3,'0'))} · {iface.sections[activeSec]}
              </div>
              <div className="grid">
                {orderedInSec.map((fi, k) => (
                  <React.Fragment key={fi}>
                    {(k>0 && isDef(orderedInSec[k-1]) && !isDef(fi)) && <div className="sep" style={{gridColumn:'1 / -1'}}></div>}
                    {Array.isArray(iface.separators) && iface.separators.includes(fi) && <div className="sep" style={{gridColumn:'1 / -1'}}></div>}
                    <FragmentRow label={<LabelBlock label={iface.labels[fi]} len={getLen(fi)} desc={iface.descriptions[fi]} req={!!iface.required[fi]} flex={isFlex(fi)} />}>
                      <input
                        className={`inputField ${iface.required[fi] ? 'reqBorder' : ''}`}
                        type="text"
                        value={values[fi] || ''}
                        maxLength={isFlex(fi) ? undefined : (getLen(fi) || undefined)}
                        onChange={e => (isSequenceField(fi) ? null : onChange(fi, e.target.value))} readOnly={isSequenceField(fi)}
                        placeholder={isSequenceField(fi) ? "auto" : undefined}
                       onBlur={() => onBlur(fi)}/>
                    </FragmentRow>
                  </React.Fragment>
                ))}
              </div>
              <div className="actions-split">
                <div className="actions">
                  <GeneratedTabs
                    iface={iface}
                    activeSec={activeSec}
                    values={values}
                    valsMap={valsMap}
                    setValues={setValues}
                    setValsMap={setValsMap}
                    onSwitchSection={(ix)=>setActiveSec(ix)}
                   onChange={bumpGenTabs}>
  {({ onGenerate }) => (
    <button onClick={onGenerate}>Generuj</button>
  )}
</GeneratedTabs>
                </div>
                <div className="actions">
                  <button onClick={fillDefaultValues}>{t('fillDefaults') || 'Fill in default values'}</button>

                  <button onClick={clearSection}>{t('clearSection')}</button>
</div>
              </div>
            </>
          )}
        </div>
      </section>

      <div className={`result-dock ${dockOpen ? 'open' : 'closed'}`}>
        <div className="dock-head" ref={dockHeadRef} onMouseDown={handleDockMouseDown} onDoubleClick={handleDockReset}>
          <div className="dock-title">{t('result')}</div>
          <button className="dock-toggle" onMouseDown={(e) => e.stopPropagation()} onClick={() => setDockOpen(o => !o)}>
            {dockOpen ? '⯆' : '⯅'}
          </button>
        </div>
        <div className="dock-body">
          <div className="inner">
            <label className="block">
              <span>{t('result')}:</span>
              <textarea readOnly value={finalText} style={{height: dockH, transition: dockAnim ? "height 180ms ease" : "none", resize: "none"}} />
            </label>
            
            
            <div className="dock-options" style={{display:'flex',alignItems:'center',gap:16,justifyContent:'flex-start',flexWrap:'wrap'}}>
              <label style={{display:'flex',alignItems:'center',gap:8,marginRight:4}}>
                <input type="checkbox" checked={combineAll} onChange={e => setCombineAll(e.target.checked)} />
                <span>{t('combineAll') || 'Combine from all interfaces'}</span>
              </label>
              {/* CSV / JSON toggles */}
              <label style={{display:'flex',alignItems:'center',gap:8,marginRight:4}}>
                <input type="checkbox" checked={csvMode} onChange={e => { setCsvMode(e.target.checked); if (e.target.checked) setJsonMode(false); }} />
                <span>{t('csvMode') || 'Zmień na CSV'}</span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,marginRight:4}}>
                <input type="checkbox" checked={jsonMode} onChange={e => { setJsonMode(e.target.checked); if (e.target.checked) setCsvMode(false); }} />
                <span>{t('jsonMode') || 'JSON mode'}</span>
              </label>
              <span aria-hidden="true"
                    style={{display:'inline-block', width:1, height:16, background:'var(--border, #ccc)', margin:'0 8px'}}></span>

              {csvMode && (
                <>
                  <label style={{display:'flex',alignItems:'center',gap:8,marginRight:4}}>
                    <input type="checkbox" checked={csvHeader} onChange={e => setCsvHeader(e.target.checked)} />
                    <span>{t('csvHeader') || 'Nagłówek CSV'}</span>
                  </label>
                  <label style={{display:'flex',alignItems:'center',gap:6,marginRight:8}} title={t('csvSeparator') || 'Separator CSV'}>
                    <span style={{opacity:0.8}}>{t('csvSep') || 'Separator'}:</span>
                    <input type="text" value={csvSep} onChange={e => setCsvSep(e.target.value)} style={{width:40}} />
                  </label>
                </>
              )}
              {jsonMode && (
                <>

                  <label style={{display:'flex',alignItems:'center',gap:8,marginRight:4}} title={t('jsonArray') || 'JSON jako tablica'}>
                    <input type="checkbox" checked={jsonArray} onChange={e => setJsonArray(e.target.checked)} />
                    <span>{t('jsonArray') || 'JSON jako tablica'}</span>
                  </label>
                  <label style={{display:'flex',alignItems:'center',gap:8,marginRight:4}} title={t('onlyFilled') || 'Tylko wypełnione pola'}>
                    <input type="checkbox" checked={skipEmpty} onChange={e => setSkipEmpty(e.target.checked)} />
                    <span>{t('onlyFilled') || 'Tylko wypełnione pola'}</span>
                  </label>
                  <label style={{display:'flex',alignItems:'center',gap:8,marginRight:4}} title={t('minified') || 'Minified JSON'}>
                    <input type="checkbox" checked={jsonMinified} onChange={e => setJsonMinified(e.target.checked)} />
                    <span>{t('minified') || 'Minified JSON'}</span>
                  </label>
                </>
              )}

              {combineAll && (
                <div className="combine-tiles" style={{display:'flex',gap:8,overflowX:'auto',padding:'4px 0',alignItems:'stretch',justifyContent:'flex-start',flex:'1 1 auto'}}>
                  {(usedIds || []).map((id) => {
                    const itf = (cfg?.interfaces||[]).find(i => i.id === id);
                    if (!itf) return null;
                    return (
                      <div
                        key={id}
                        className="combine-tile"
                        draggable
                        onDragStart={(e) => {
                          setDragId(id);
                          try { e.dataTransfer.setData('text/plain', id); } catch {}
                          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const leftHalf = (e.clientX - rect.left) < rect.width/2;
                          e.currentTarget.classList.toggle('drop-left', leftHalf);
                          e.currentTarget.classList.toggle('drop-right', !leftHalf);
                        }}
                        onDragLeave={(e) => {
                          e.currentTarget.classList.remove('drop-left','drop-right');
                        }}
                        onDrop={(e) => {

                          e.preventDefault();
                          const el = e.currentTarget;
                          const isLeft = el.classList.contains('drop-left');
                          el.classList.remove('drop-left','drop-right');
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
                      >
                        <span className="combine-tile-title">{itf.name || id}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        
<div className="actions" style={{justifyContent:'flex-end'}}>
              <button onClick={copyResult}>{t('copy')}</button>
              <button onClick={downloadResult}>{t('download')}</button>
            </div>
          </div>
        </div>
      </div>
      {!dockOpen && (
        <button className="dock-fab" onClick={() => setDockOpen(true)} title={t('result')}>⯅</button>
      )}
    </main>
  );
}

function LabelBlock({ label, len, desc, req, flex }){
  return (
    <div className="labelBlock">
      <div className="labelRow">
        <span className="name">{label}{req ? <span className="reqStar">*</span> : null}</span>
      </div>
      <div className="meta"><span className="small">{flex ? (t('maxLenFlex') || 'Max długość FLEX') : `${t('maxLen') || 'Max długość'}: ${len}`}</span></div>
      {desc ? <div className="desc">{desc}</div> : null}
    </div>
  );
}

function FragmentRow({ label, children }){
  return (<><div>{label}</div><div>{children}</div></>);
}