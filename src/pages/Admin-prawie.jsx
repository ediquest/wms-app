import DataImportButtons from '../components/DataImportButtons.jsx';




import SortableFields from "../components/SortableFields.jsx";
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loadConfig, saveConfig, loadValues, saveValues, timestamp } from '../utils.js'
import { t } from '../i18n.js'
import ScrollTabs from '../components/ScrollTabs.jsx'

import GeneratedTabs from '../components/GeneratedTabs.jsx';
import AddInterfaceModal from '../components/AddInterfaceModal.jsx';
import AddCategoryModal from '../components/AddCategoryModal.jsx';
import DeleteCategoryModal from '../components/DeleteCategoryModal.jsx';
import RenameCategoryModal from '../components/RenameCategoryModal.jsx';
import ImportBackupModal from '../components/ImportBackupModal.jsx';
import ImportWmsModal from '../components/ImportWmsModal.jsx';
import DeleteInterfaceModal from '../components/DeleteInterfaceModal.jsx';
// --- helpers: wykrywanie i normalizacja pojedynczego interfejsu ---
function isSingleInterface(obj) {
  if (!obj || !Array.isArray(obj.sections)) return false;
  const hasFlat = Array.isArray(obj.labels)
    && Array.isArray(obj.lengths)
    && Array.isArray(obj.required)
    && Array.isArray(obj.types)
    && Array.isArray(obj.fieldSections);
  const hasNested = Array.isArray(obj.fields);
  return hasFlat || hasNested;
}

function normalizeSingleInterface(incoming) {
  const out = { ...incoming };
  if (!out.id || typeof out.id !== 'string') {
    const base = (out.name || 'iface')
      .toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    out.id = base || ('iface-' + Math.random().toString(36).slice(2, 8));
  }
  if (!out.name || typeof out.name !== 'string') out.name = out.id;
  const n = Array.isArray(out.sections) ? out.sections.length : 0;
  if (!Array.isArray(out.includedSections)) out.includedSections = Array(n).fill(false);
  if (!Array.isArray(out.sectionColors)) out.sectionColors = Array(n).fill('');
  if (!Array.isArray(out.separators)) out.separators = [];
  out.fields = Array.isArray(out.fields) ? out.fields.slice(0, n) : [];
  while (out.fields.length < n) out.fields.push([]);
  return out;
}
// --- expandFieldsToFlat: converts { fields: Field[][] } to flat arrays used by UI
function expandFieldsToFlat(iface) {
  if (!iface) return iface;
  // Ensure arrays exist
  iface.sections = Array.isArray(iface.sections) ? iface.sections.slice() : [];
  iface.sectionNumbers = Array.isArray(iface.sectionNumbers) ? iface.sectionNumbers.slice() : [];
  iface.sectionColors = Array.isArray(iface.sectionColors) ? iface.sectionColors.slice() : [];
  // Ensure Introduction at index 0
  if (!(typeof iface.sections[0] === 'string' && iface.sections[0].toLowerCase() === 'introduction')) {
    iface.sections = ['Introduction'].concat(iface.sections);
    iface.sectionNumbers = ['000'].concat(iface.sectionNumbers || []);
    iface.sectionColors = [''].concat(iface.sectionColors || []);
    if (Array.isArray(iface.fields)) iface.fields = [[]].concat(iface.fields);
    if (Array.isArray(iface.includedSections)) iface.includedSections = [false].concat(iface.includedSections);
  }
  const n = iface.sections.length;

  // Build flat arrays from fields if provided
  if (!Array.isArray(iface.labels) && Array.isArray(iface.fields) && iface.fields.length === n) {
    const labels = [], descriptions = [], lengths = [], required = [], types = [], fieldSections = [];
    let separators = Array.isArray(iface.separators) ? iface.separators.slice() : [];
    for (let s = 0; s < n; s++) {
      if (s === 0) continue; // Introduction
      const arr = Array.isArray(iface.fields[s]) ? iface.fields[s] : [];
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i] || {};
        labels.push(String(f.label ?? `Field ${i + 1}`));
        descriptions.push(String(f.description ?? ''));
        const rawLen = (f.length ?? f.maxLen ?? f.maxlen ?? f.len ?? f.size);
        const len = Math.max(1, Math.min(200, parseInt(rawLen, 10) || 10));
        lengths.push(len);
        const _t = String(f.type || '').toLowerCase();
        const typ = (_t === 'numeric' || _t === 'num') ? 'numeric' : 'alphanumeric';
        types.push(typ);
        required.push(!!f.required);
        fieldSections.push(s);
        if (f.separator) separators.push(labels.length - 1);
      }
    }
    iface.labels = labels;
    iface.descriptions = descriptions;
    iface.lengths = lengths;
    iface.required = required;
    iface.types = types;
    iface.fieldSections = fieldSections;
    iface.separators = separators;
    delete iface.fields;
  }

  // Safety: align lengths
  if (!Array.isArray(iface.includedSections) || iface.includedSections.length !== n) {
    iface.includedSections = Array(n).fill(false);
  } else {
    iface.includedSections[0] = false;
  }
  if (!Array.isArray(iface.sectionNumbers) || iface.sectionNumbers.length !== n) {
    iface.sectionNumbers = iface.sections.map((_, ix) => ix === 0 ? '000' : String(ix * 10).padStart(3, '0'));
  } else {
    iface.sectionNumbers[0] = '000';
  }
  if (!Array.isArray(iface.sectionColors) || iface.sectionColors.length !== n) {
    iface.sectionColors = Array(n).fill('');
  }

  // --- ensure sectionNotes & sectionNotesEnabled are aligned with sections ---
  {
    const count = Array.isArray(iface.sections) ? iface.sections.length : 0;
    if (!Array.isArray(iface.sectionNotes)) iface.sectionNotes = Array(count).fill('');
    if (iface.sectionNotes.length !== count) {
      iface.sectionNotes = Array.from({ length: count }, (_, ix) => String(iface.sectionNotes[ix] || ''));
    }
    if (!Array.isArray(iface.sectionNotesEnabled)) {
      // default: intro disabled, others enabled
      iface.sectionNotesEnabled = Array.from({ length: count }, (_, ix) => ix !== 0);
    }
    if (iface.sectionNotesEnabled.length !== count) {
      iface.sectionNotesEnabled = Array.from(
        { length: count },
        (_, ix) => !!(iface.sectionNotesEnabled[ix] ?? (ix !== 0))
      );
    }
  }
  return iface;
}



// --- autodetekcja importu z górnego przycisku ---
function importFromJsonTop(obj, cfg, setCfg, t) {
  const isBackup = obj && Array.isArray(obj.interfaces) && Array.isArray(obj.categories);
  if (isBackup) {
    const next = { ...cfg, categories: [...cfg.categories], interfaces: [...cfg.interfaces] };
    const have = new Set(next.categories.map(c => c.id));
    obj.categories.forEach(c => { if (!have.has(c.id)) next.categories.push({ id: c.id, name: c.name }); });
    const byId = new Map(next.interfaces.map(i => [i.id, i]));
    obj.interfaces.forEach(i => {
      let norm = normalizeSingleInterface(i); norm = expandFieldsToFlat(norm);
      byId.set(norm.id, norm);
    });
    next.interfaces = Array.from(byId.values());
    setCfg(next); saveConfig(next);
    alert(t('importDone') || 'Import zakończony.');
    return;
  }
  if (isSingleInterface(obj)) {
    let incoming = normalizeSingleInterface(obj); incoming = expandFieldsToFlat(incoming);
    const catId = incoming.categoryId || 'inbound';
    let next = { ...cfg };
    if (!next.categories.some(c => c.id === catId)) {
      const catName = catId.charAt(0).toUpperCase() + catId.slice(1);
      next = { ...next, categories: next.categories.concat({ id: catId, name: catName }) };
    }
    const choice = window.prompt((t('importSinglePrompt') || 'Import pojedynczego interfejsu. Wpisz: nadpisz / dodaj'), 'dodaj');
    if (!choice) return;
    const ch = choice.trim().toLowerCase();
    if (ch.startsWith('nadpisz') || ch.startsWith('overwrite')) {
      const exists = next.interfaces.some(i => i.id === incoming.id);
      next = {
        ...next,
        interfaces: exists
          ? next.interfaces.map(i => (i.id === incoming.id ? incoming : i))
          : next.interfaces.concat(incoming)
      };
    } else if (ch.startsWith('dodaj') || ch.startsWith('add')) {
      const used = new Set(next.interfaces.map(i => i.id));
      let base = incoming.id, acc = base, n = 1;
      while (used.has(acc)) { n += 1; acc = (base + '-' + n).slice(0, 48); }
      incoming.id = acc;
      next = { ...next, interfaces: next.interfaces.concat(incoming) };
    } else {
      alert(t('importCancelled') || 'Import przerwany.');
      return;
    }
    setCfg(next); saveConfig(next);
    alert(t('importDone') || 'Import zakończony.');
    return;
  }
  alert(t('invalidJson') || 'Nieprawidłowy plik JSON.');
}


// --- helpers: wykrywanie i normalizacja pojedynczego interfejsu ---



// --- autodetekcja importu z górnego przycisku ---




// --- helpers: wykrywanie i normalizacja pojedynczego interfejsu ---



// --- autodetekcja importu z górnego przycisku ---



// Detect-and-import: accepts either full backup {interfaces,categories} || single interface object





function normalizeInterface(i) {
  let iface = { ...i }
  if (!Array.isArray(iface.sections) || iface.sections.length === 0) iface.sections = ['Introduction']
  if (iface.sections[0] !== 'Introduction') {
    iface.sections = ['Introduction', ...iface.sections]
    if (Array.isArray(iface.fieldSections)) iface.fieldSections = iface.fieldSections.map(s => Number.isInteger(s) ? s + 1 : 1)
  }
  if (!Array.isArray(iface.sectionNumbers) || iface.sectionNumbers.length !== iface.sections.length) {
    iface.sectionNumbers = iface.sections.map((_, ix) => ix === 0 ? '000' : String(ix * 10).padStart(3, '0'))
  } else {
    iface.sectionNumbers = iface.sectionNumbers.map(n => String((n ?? '').toString().replace(/\D/g, '')).padStart(3, '0').slice(-3))
  }
  // arrays
  const arrs = ['separators', 'fieldSections', 'labels', 'descriptions', 'lengths', 'required', 'types', 'flexFields']; arrs.forEach(k => { iface[k] = Array.isArray(iface[k]) ? iface[k] : [] });
  // default fields
  const df = Array.isArray(iface.defaultFields) ? iface.defaultFields.slice() : []
  const pushIfMissing = (label, length, type, required, defVal, autoSection = false) => {
    if (!df.find(f => (f.label || '').toLowerCase() === label.toLowerCase())) {
      df.push({ label, length, type, required, defaultValue: defVal || '', autoSection })
    }
  }
  pushIfMissing('Sequence No.', 7, 'numeric', true, '')
  pushIfMissing('Application code', 2, 'alphanumeric', true, 'HL')
  pushIfMissing('Interface code', 2, 'numeric', true, '')
  pushIfMissing('Section', 3, 'numeric', true, '', true)
  iface.includedSections = Array.isArray(iface.includedSections) && iface.includedSections.length === iface.sections.length
    ? iface.includedSections.map((v, ix) => !!v && ix > 0)
    : iface.sections.map((_, ix) => false);  // 0=Introduction not included
  iface.defaultFields = df
  // align flexFields length to labels
  if (!Array.isArray(iface.flexFields)) iface.flexFields = [];
  if (iface.flexFields.length !== iface.labels.length) {
    const ff = new Array(iface.labels.length).fill(false);
    for (let i = 0; i < Math.min(ff.length, iface.flexFields.length); i++) { ff[i] = !!iface.flexFields[i]; }
    iface.flexFields = ff;
  }
  return iface
}

function normalizeConfig(cfg) {
  const out = { ...cfg }
  out.interfaces = (out.interfaces || []).map(normalizeInterface)
  return out
}

export default function Admin({ role }) {
  function openImportBackupModal() {
    try {


      // alert(t('importBackup') || 'Import Backup');
    } catch (e) { }
    setIsBackupOpen(true);
    try { } catch (e) { }
  }

  // --- Add Interface modal state ---
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isDeleteCatOpen, setIsDeleteCatOpen] = useState(false);
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);
  const [deleteCatCount, setDeleteCatCount] = useState(0);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isWmsOpen, setIsWmsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [wmsStatus, setWmsStatus] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const applyBackupData = (data, mode = 'merge') => {

    try {
      if (data && data._type === 'tcf_full_backup' && data.config && data.values) {
        if (mode === 'replace') {
          saveConfig(data.config);
          saveValues(data.values);
          setCfg(normalizeConfig(data.config));
          setImportStatus({ kind: 'success', key: 'backupOk' });
        } else {
          const newCfg = normalizeConfig(data.config);
          const merged = { ...cfg, categories: [...cfg.categories], interfaces: [...cfg.interfaces] };
          const catIds = new Set(merged.categories.map(c => c.id));
          for (const c of newCfg.categories || []) if (!catIds.has(c.id)) merged.categories.push(c);
          const ifIds = new Set(merged.interfaces.map(i => i.id));
          for (const it of newCfg.interfaces || []) if (!ifIds.has(it.id)) merged.interfaces.push(normalizeInterface(it));
          saveConfig(merged);
          setCfg(merged);
          const valsCur = loadValues();
          const valsNew = data.values || {};
          saveValues({ ...valsCur, ...valsNew });
          setImportStatus({ kind: 'success', key: 'importOk' });
        }
        return;
      }
      if (data && data.config && data.values) {
        return applyBackupData({ _type: 'tcf_full_backup', ...data }, mode);
      }
      if (Array.isArray(data?.interfaces) || Array.isArray(data?.categories)) {
        if (mode === 'replace') {
          const next = normalizeConfig({ ...cfg, interfaces: data.interfaces || [], categories: data.categories || [] });
          saveConfig(next); setCfg(next);
        } else {
          const next = { ...cfg, categories: [...cfg.categories], interfaces: [...cfg.interfaces] };
          const catIds = new Set(next.categories.map(c => c.id));
          for (const c of (data.categories || [])) if (!catIds.has(c.id)) next.categories.push(c);
          const ifIds = new Set(next.interfaces.map(i => i.id));
          for (const it of (data.interfaces || [])) if (!ifIds.has(it.id)) next.interfaces.push(normalizeInterface(it));
          saveConfig(next); setCfg(next);
        }
        setImportStatus({ kind: 'success', key: 'importOk' });
        return;
      }
      if (isSingleInterface(data)) {
        const next = { ...cfg, categories: [...cfg.categories], interfaces: [...cfg.interfaces] };
        const idx = next.interfaces.findIndex(i => i.id === data.id);
        if (mode === 'replace' && idx >= 0) {
          next.interfaces = next.interfaces.slice();
          next.interfaces[idx] = normalizeInterface(data);
        } else if (idx === -1) {
          next.interfaces = next.interfaces.concat(normalizeInterface(data));
        }
        saveConfig(next); setCfg(next);
        setImportStatus({ kind: 'success', key: 'importOk' });
        return;
      }
      setImportStatus({ kind: 'error', key: 'invalidJson' });
    } catch (err) {
      console.error(err);
      setImportStatus({ kind: 'error', key: 'invalidJson' });
    }
  };

  function applyWmsData(data, mode = 'add', targetId = '') {
    try {
      let list = [];
      if (data && Array.isArray(data.interfaces)) list = data.interfaces;
      else if (Array.isArray(data) && data.length) list = data;
      else if (data && Array.isArray(data.sections)) list = [data];
      else { setWmsStatus({ kind: 'error', key: 'invalidJson' }); return; }

      const next = { ...cfg, interfaces: [...cfg.interfaces] }


      if (mode === 'overwrite' && targetId) {
        const prepared = normalizeInterface(list[0]);
        prepared.id = targetId;
        const idx = next.interfaces.findIndex(i => i.id === targetId);
        if (idx >= 0) { next.interfaces = next.interfaces.slice(); next.interfaces[idx] = prepared; }
        else { next.interfaces = next.interfaces.concat(prepared); }
        saveConfig(next); setCfg(next);
        setWmsStatus({ kind: 'success', key: 'importOk' });
        return;
      }

      // add mode
      const taken = new Set(next.interfaces.map(i => i.id));
      const uniqueId = (baseId) => {
        let id = String(baseId || 'ifc'); let n = 1;
        while (taken.has(id)) { id = baseId + '-' + (++n); }
        taken.add(id);
        return id;
      };
      for (const raw of list) {
        const prepared = normalizeInterface(raw);
        if (!prepared.id || taken.has(prepared.id)) prepared.id = uniqueId(prepared.id || 'ifc');
        next.interfaces.push(prepared);
      }
      saveConfig(next); setCfg(next);
      setWmsStatus({ kind: 'success', key: 'importOk' });
    } catch (e) {
      console.error(e);
      setWmsStatus({ kind: 'error', key: 'invalidJson' });
    }
  };

  const createCategoryFromModal = ({ id, name }) => {
    const next = { ...cfg, categories: [...cfg.categories] };
    if (next.categories.some(c => c.id === id)) return; // guard
    next.categories.push({ id, name });
    saveConfig(next);
    setCfg(next);
  };
  const renameCategoryFromModal = ({ id, name }) => {
    const next = { ...cfg, categories: [...cfg.categories] };
    const idx = next.categories.findIndex(c => c.id === id);
    if (idx === -1) return;
    next.categories = next.categories.slice();
    next.categories[idx] = { ...next.categories[idx], name };
    saveConfig(next);
    setCfg(next);
  };
  const deleteCategoryFromModal = ({ id, mode, destCategoryId }) => {
    const impacted = cfg.interfaces.filter(i => i.categoryId === id).map(i => i.id);
    let next = { ...cfg, categories: cfg.categories.filter(c => c.id !== id), interfaces: [...cfg.interfaces] };

    if (impacted.length) {
      if (mode === 'move' && destCategoryId) {
        next.interfaces = next.interfaces.map(i => i.categoryId === id ? { ...i, categoryId: destCategoryId } : i);
      } else if (mode === 'delete') {
        next.interfaces = next.interfaces.filter(i => i.categoryId !== id);
        // also delete values of removed interfaces
        const vals = loadValues();
        for (const iid of impacted) { delete vals[iid]; }
        saveValues(vals);
      } else {
        // neither move nor delete properly selected; do nothing
        return;
      }
    }

    saveConfig(next);
    setCfg(next);
  };



  const createInterfaceFromModal = ({ id, name, categoryId, cloneId }) => {
    let nextIface;
    if (cloneId) {
      const base = cfg.interfaces.find(i => i.id === cloneId);
      if (!base) { alert('Wybrany interfejs do skopiowania nie istnieje.'); return; }
      nextIface = JSON.parse(JSON.stringify(base));
      nextIface.id = id;
    } else {
      nextIface = normalizeInterface({
        id,
        name: name.trim(),
        categoryId: categoryId || (cfg.categories[0]?.id || 'inbound'),
        summary: '',
        labels: [], descriptions: [], lengths: [], required: [], types: [], flexFields: [],
        sections: ['Introduction'], sectionNumbers: ['000'], fieldSections: [], separators: [],
        defaultFields: (cfg.defaultFields || [])
      });
    }
    const next = { ...cfg, interfaces: cfg.interfaces.concat(nextIface) };
    setCfg(next); saveConfig(next);
    const vals = loadValues(); vals[id] = []; saveValues(vals);
    setSelectedId(id); setCurrentId(id); setMode('edit'); setActiveSec(0);
  };

  const [cfg, setCfg] = useState(normalizeConfig(loadConfig()))
  const [mode, setMode] = useState(role === 'editor' ? 'edit' : 'overview')
  const [currentId, setCurrentId] = useState(cfg.interfaces[0]?.id || '')
  const [activeSec, setActiveSec] = useState(0)

  // overview state
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [selectedId, setSelectedId] = useState(cfg.interfaces[0]?.id || '')
  const [importMode, setImportMode] = useState('add') // add | overwrite
  const fileInputRef = useRef(null);
  const backupFileRef = useRef(null);
  const [sortKey, setSortKey] = useState(() => (localStorage.getItem('tcf_iface_order') ? 'custom' : 'name'))
  const [sortDir, setSortDir] = useState('asc')
  const rowFileRef = useRef(null);
  const [pendingImportId, setPendingImportId] = useState(null)
  const fileInputOneRef = useRef(null);
  const location = useLocation()
  const navigate = useNavigate();

  // Read & clear jump from Home -> Admin
  const readJump = () => {
    try { return JSON.parse(localStorage.getItem('intgen_admin_jump') || 'null'); } catch { return null; }
  };
  const clearJump = () => { try { localStorage.removeItem('intgen_admin_jump'); } catch {} };

  // Clear stale jump when user is on admin overview (so Back is always to list next time)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search || '');
      const view = sp.get('view') || 'overview';
      if (view === 'overview') clearJump();
    } catch {}
  }, [location.search]);

  const handleTopBack = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const sp = new URLSearchParams(location.search || '');
    const jump = readJump();

    // Case 1: came from Home -> return to exact iface & section
    if (jump && jump.ifaceId != null) {
      const id = String(jump.ifaceId);
      const secFromJump = Number.isFinite(+jump.sec) ? String(+jump.sec) : null;
      const sec = secFromJump || (sp.get('sec') ?? '0');
      clearJump();
      navigate({ pathname: `/iface/${encodeURIComponent(id)}`, search: `?sec=${sec}` }, { replace: true });
      return;
    }

    // Case 2: admin context -> ensure UI flips to overview and navigate there
    try { setMode && setMode('overview'); } catch {}
    navigate({ pathname: '/admin', search: '?view=overview' }, { replace: true });
  };


  useEffect(() => {
    const fresh = normalizeConfig(loadConfig())
    setCfg(fresh)
    if (!currentId && fresh.interfaces[0]) setCurrentId(fresh.interfaces[0].id)
  }, [])

  useEffect(() => { if (role === 'editor') setMode('edit') }, [role])

  useEffect(() => {
    const qs = new URLSearchParams(location.search)
    const view = qs.get('view')
    if (view === 'overview') setMode('overview')
    if (view === 'edit') setMode('edit')
  }, [location.search])

  // --- helper: normalize and compare interface id/name (dashes/underscores/spaces/case) ---
  const matchIface = (it, wanted) => {
    const norm = (s) => String(s || '')
      .toLowerCase()
      .replace(/[\s_]+/g, '-')      // spaces/underscores -> '-'
      .replace(/[^a-z0-9-]/g, '')    // strip other chars
      .replace(/-+/g, '-')           // collapse dashes
      .replace(/^-+|-+$/g, '');      // trim dashes
    const w = norm(wanted);
    return it?.id === wanted
        || it?.name === wanted
        || norm(it?.id) === w
        || norm(it?.name) === w;
  };

  // --- deep-link: read iface/sec from URL (or hash), set current interface & section ---
  useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search || '');
      let ifaceId = sp.get('iface');
      let sec = Number.parseInt(sp.get('sec') || '0', 10);
      if (!Number.isFinite(sec)) sec = 0;

      // also support #...?... style (in case of anchors)
      if (!ifaceId) {
        const h = String(location.hash || window.location.hash || '');
        const qpos = h.indexOf('?');
        if (qpos !== -1) {
          const hp = new URLSearchParams(h.slice(qpos + 1));
          ifaceId = hp.get('iface') || ifaceId;
          const s2 = Number.parseInt(hp.get('sec') || '0', 10);
          if (Number.isFinite(s2)) sec = s2;
        }
      }

      if (!ifaceId) return;

      const it = (cfg.interfaces || []).find(i => matchIface(i, ifaceId));
      if (!it) return;

      if (currentId !== it.id) setCurrentId(it.id);
      const total = Array.isArray(it.sections) ? it.sections.length : 1;
      setActiveSec(Math.max(0, Math.min(total - 1, sec || 0)));
      setMode('edit');
    } catch (e) {
      // noop
    }
  }, [cfg?.interfaces?.length, location.search, location.hash]);



  const current = useMemo(() => cfg.interfaces.find(i => i.id === currentId) || cfg.interfaces[0], [cfg, currentId])

  const filteredInterfaces = useMemo(() => {
    const s = search.trim().toLowerCase()
    return cfg.interfaces.filter(i => (!s || i.name.toLowerCase().includes(s)) && (!catFilter || i.categoryId === catFilter))
  }, [cfg.interfaces, search, catFilter])

  const toggleSort = (key) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc') } }


  const deleteOne = (id, removeValues = true) => {
    const it = cfg.interfaces.find(x => x.id === id);
    if (!it) { alert('Interfejs nie znaleziony'); return; }
    const next = { ...cfg, interfaces: cfg.interfaces.filter(x => x.id !== id) };
    saveConfig(next); setCfg(next);
    if (currentId === id) {
      setMode('overview');
      setSelectedId(null);
      setCurrentId(null);
    }
  };
  const exportOne = (id) => {
    const it = cfg.interfaces.find(x => x.id === id);
    if (!it) { alert('Interfejs nie znaleziony'); return; }
    const blob = new Blob([JSON.stringify(it, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const dt = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    a.href = URL.createObjectURL(blob);
    a.download = (it.name || id) + "_" + dt + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };
  const sortedInterfaces = useMemo(() => {
    const arr = filteredInterfaces.slice()
    const getCat = id => cfg.categories.find(c => c.id === id)?.name || id
    arr.sort((a, b) => {
      if (sortKey === 'custom') {
        try {
          const ord = JSON.parse(localStorage.getItem('tcf_iface_order') || '[]');
          const pos = (id) => { const i = ord.indexOf(id); return i < 0 ? 1e9 : i; };
          return pos(a.id) - pos(b.id);
        } catch { return 0; }
      }

      let av, bv
      if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase() }
      else if (sortKey === 'category') { av = getCat(a.categoryId).toLowerCase(); bv = getCat(b.categoryId).toLowerCase() }
      else { av = a.labels.length; bv = b.labels.length }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filteredInterfaces, sortKey, sortDir, cfg.categories])

  // ===== helpers to mutate current interface =====
  const applyIface = (nextIface) => {
    const next = { ...cfg, interfaces: cfg.interfaces.map(i => i.id === currentId ? nextIface : i) }
    setCfg(next); saveConfig(next)
  }
  const cloneIface = () => ({
    ...current,
    labels: current.labels.slice(),
    descriptions: current.descriptions.slice(),
    lengths: current.lengths.slice(),
    required: current.required.slice(),
    types: current.types.slice(),
    sections: current.sections.slice(),
    sectionNumbers: (current.sectionNumbers || current.sections.map((_, ix) => ix === 0 ? '000' : String(ix * 10).padStart(3, '0'))).slice(),
    fieldSections: current.fieldSections.slice(),
    separators: (current.separators || []).slice(),
    defaultFields: (current.defaultFields || []).slice(),
    flexFields: (current.flexFields || []).slice()
    ,sectionNotes: (current.sectionNotes || Array(current.sections.length).fill('')).slice()
    ,sectionNotesEnabled: (current.sectionNotesEnabled || current.sections.map((_, ix) => ix !== 0)).slice()
  })

  const injectDefaultsIntoSection = (iface, secIdx) => {
    const n = {
      ...iface,
      labels: iface.labels.slice(), descriptions: iface.descriptions.slice(), lengths: iface.lengths.slice(),
      required: iface.required.slice(), types: iface.types.slice(), fieldSections: iface.fieldSections.slice(),
      separators: (iface.separators || []).slice(), defaultFields: (iface.defaultFields || []).slice()
    }
    if (secIdx === 0) return n
    const defaults = n.defaultFields || []
    const vals = loadValues(); const arr = (vals[n.id] ?? []).slice()
    defaults.forEach(df => {
      const exists = n.labels.some((lab, idx) => (lab || '').toLowerCase() === (df.label || '').toLowerCase() && n.fieldSections[idx] === secIdx)
      if (exists) return
      n.labels.push(df.label)
      n.descriptions.push('')
      const len = Math.max(1, Math.min(200, Number(df.length) || 10))
      n.lengths.push(len)
      n.required.push(!!df.required)
      n.types.push(df.type === 'numeric' ? 'numeric' : 'alphanumeric')
      n.fieldSections.push(secIdx); n.flexFields = Array.isArray(n.flexFields) ? n.flexFields.slice() : []; n.flexFields.push(false)
      let initial = df.defaultValue || ''
      if (df.autoSection) {
        const num = (n.sectionNumbers?.[secIdx] || String(secIdx * 10).padStart(3, '0'))
        initial = String(num).replace(/\D/g, '').padStart(len, '0').slice(-len)
      }
      arr.push(initial)
    })
    vals[n.id] = arr; saveValues(vals)
    return n
  }

  // ===== CRUD interfejsów + import/eksport =====
  const addInterface = () => {
    const id = prompt('Podaj numer/ID interfejsu (unikalny):'); if (!id || !id.trim()) return;
    if (cfg.interfaces.some(i => i.id === id.trim())) { alert('Interfejs o takim ID już istnieje.'); return; }
    const name = prompt('Podaj nazwę interfejsu:');
    if (!name || !name.trim()) return;
    const cat = cfg.categories[0]?.id || 'inbound';
    const nextIface = normalizeInterface({
      id, name: name.trim(), categoryId: cat, summary: '',
      labels: [], descriptions: [], lengths: [], required: [], types: [], flexFields: [],
      sections: ['Introduction'], sectionNumbers: ['000'], fieldSections: [], separators: [], defaultFields: (cfg.defaultFields || [])
    });
    const next = { ...cfg, interfaces: cfg.interfaces.concat(nextIface) };
    setCfg(next); saveConfig(next);
    const vals = loadValues(); vals[id] = []; saveValues(vals);
    setSelectedId(id); setCurrentId(id); setMode('edit'); setActiveSec(0);
  };

  const deleteInterface = (id) => {
    if (cfg.interfaces.length === 1) { alert('Musi pozostać przynajmniej jeden interfejs.'); return; }
    if (!confirm(t('delete') + '?')) return;
    const nextInterfaces = cfg.interfaces.filter(i => i.id !== id);
    const next = { ...cfg, interfaces: nextInterfaces };
    setCfg(next); saveConfig(next);
    const vals = loadValues(); delete vals[id]; saveValues(vals);
    if (currentId === id && nextInterfaces[0]) setCurrentId(nextInterfaces[0].id);
    if (selectedId === id) setSelectedId(nextInterfaces[0]?.id || '');
  };

  const download = (name, text, type = 'application/json') => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1200);
  };

  const schemaValidate = (obj) => {
    const err = (m) => ({ ok: false, message: m })
    if (!obj || typeof obj !== 'object') return err('Brak obiektu JSON.')
    const req = ['labels', 'lengths', 'required', 'types', 'sections', 'fieldSections', 'sectionNumbers']
    for (const k of req) if (!Array.isArray(obj[k])) return err('Brak lub zły typ: ' + k)
    const n = obj.labels.length
    const descLen = Array.isArray(obj.descriptions) ? obj.descriptions.length : n
    if (![descLen, obj.lengths.length, obj.required.length, obj.types.length, obj.fieldSections.length].every(x => x === n)) return err('Długości tablic nie są zgodne.')
    if (obj.sections.length < 1) return err('Musi istnieć przynajmniej jedna sekcja.')
    if (!obj.sectionNumbers || obj.sectionNumbers.length !== obj.sections.length) return err('sectionNumbers ≠ sections.')
    if (!obj.sectionNumbers.every(s => /^\d{3}$/.test(String(s)))) return err('Każdy sectionNumber musi być 3-cyfrowy.')
    if (!obj.fieldSections.every(s => Number.isInteger(s) && s >= 0 && s < obj.sections.length)) return err('fieldSections: złe indeksy.')
    if (!obj.lengths.every(x => Number.isInteger(x) && x >= 1 && x <= 200)) return err('lengths: 1..200.')
    if (!obj.types.every(t => t === 'alphanumeric' || t === 'numeric')) return err('types: tylko alphanumeric/numeric.')
    if (obj.separators && !obj.separators.every(i => Number.isInteger(i) && i >= 0 && i < n)) return err('separators: złe indeksy.')
    return { ok: true }
  }

  const exportById = (id) => {
    const i = cfg.interfaces.find(x => x.id === id); if (!i) return
    const data = {
      id: i.id, name: i.name, categoryId: i.categoryId, summary: i.summary || '',
      labels: i.labels, descriptions: i.descriptions, lengths: i.lengths, required: i.required, types: i.types,
      sections: i.sections, sectionNumbers: i.sectionNumbers || i.sections.map((_, ix) => ix === 0 ? '000' : String(ix * 10).padStart(3, '0')),
      fieldSections: i.fieldSections, separators: i.separators || [],
      defaultFields: i.defaultFields || []
    }
    download(`${i.name.replace(/\s+/g, '_')}.json`, JSON.stringify(data, null, 2))
  }

  const exportAll = () => {
    const fresh = { ...loadConfig() };
    const vals = loadValues();
    const payload = { _type: 'tcf_full_backup', _version: '1', config: fresh, values: vals, meta: { exportedAt: timestamp() } };
    const name = `backup_${timestamp()}.json`;
    download(name, JSON.stringify(payload, null, 2));
  };

  const importOneFromFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const v = schemaValidate(obj); if (!v.ok) { alert('Błąd walidacji: ' + v.message); return; }
      const targetId = pendingImportId;
      let nextCfg = { ...cfg };
      if (obj.categoryId && !nextCfg.categories.find(c => c.id === obj.categoryId)) {
        nextCfg.categories = nextCfg.categories.concat({ id: obj.categoryId, name: obj.categoryId });
      }
      if (confirm('Nadpisać zaznaczony interfejs? (Anuluj = dodaj jako nowy)')) {
        const idx = nextCfg.interfaces.findIndex(x => x.id === targetId);
        if (idx === -1) { alert('Nie znaleziono interfejsu.'); return; }
        const keepId = targetId;
        const newIface = normalizeInterface({
          id: keepId,
          name: obj.name || nextCfg.interfaces[idx].name,
          categoryId: obj.categoryId || nextCfg.interfaces[idx].categoryId,
          summary: typeof obj.summary === 'string' ? obj.summary : '',
          labels: obj.labels, descriptions: obj.descriptions || Array((obj.labels || []).length).fill(''),
          lengths: obj.lengths, required: obj.required, types: obj.types,
          sections: obj.sections, sectionNumbers: obj.sectionNumbers,
          fieldSections: obj.fieldSections, separators: obj.separators || [],
          defaultFields: obj.defaultFields || nextCfg.interfaces[idx].defaultFields
        });
        nextCfg.interfaces[idx] = newIface;
        setCfg(nextCfg); saveConfig(nextCfg);
        setCurrentId(keepId); setMode('edit'); setActiveSec(0);
        alert('Interfejs nadpisany z importu.');
      } else {
        const newId = 'imp-' + Math.random().toString(36).slice(2, 8);
        const newIface = normalizeInterface({
          id: newId,
          name: obj.name || ('imported-' + newId),
          categoryId: obj.categoryId || nextCfg.categories[0]?.id,
          summary: typeof obj.summary === 'string' ? obj.summary : '',
          labels: obj.labels, descriptions: obj.descriptions || Array((obj.labels || []).length).fill(''),
          lengths: obj.lengths, required: obj.required, types: obj.types,
          sections: obj.sections, sectionNumbers: obj.sectionNumbers,
          fieldSections: obj.fieldSections, separators: obj.separators || [],
          defaultFields: obj.defaultFields || []
        });
        nextCfg.interfaces = nextCfg.interfaces.concat(newIface);
        setCfg(nextCfg); saveConfig(nextCfg);
        setCurrentId(newId); setSelectedId(newId); setMode('edit'); setActiveSec(0);
        alert('Dodano nowy interfejs z importu.');
      }
    } catch (err) {
      console.error(err); alert('Nie udało się zaimportować.');
    } finally {
      if (e?.target) e.target.value = '';
      setPendingImportId(null);
    }
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
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (isEditable(document.activeElement)) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const total = Array.isArray(current?.sections) ? current.sections.length : 0;
      if (total <= 1) return;
      setActiveSec((prev) => {
        const next = e.key === 'ArrowRight' ? prev + 1 : prev - 1;
        return (next + total) % total;
      });
    }
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [current?.sections?.length, setActiveSec]);


  const importInterfaceAdvanced = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Full backup?
      if (data && data._type === 'tcf_full_backup' && data.config && data.values) {
        if (confirm('Wykryto pełną kopię zapasową. Nadpisać CAŁĄ konfigurację? (Anuluj = spróbuj scalić)')) {
          saveConfig(data.config);
          saveValues(data.values);
          setCfg(data.config);
          alert('Zaimportowano pełną kopię (nadpisano całość).');
        } else {
          // merge: add missing categories; add interfaces (rename on conflict); merge values by id
          let fresh = { ...cfg };
          // categories
          const incomingCats = data.config.categories || [];
          incomingCats.forEach(c => {
            if (!fresh.categories.find(x => x.id === c.id))
              fresh.categories = fresh.categories.concat({ id: c.id, name: c.name || c.id });
          });
          // interfaces
          const incomingIfaces = data.config.interfaces || [];
          const vals = loadValues();
          incomingIfaces.forEach(ii => {
            let id = ii.id;
            if (fresh.interfaces.find(x => x.id === id)) {
              const newId = id + '-imp-' + Math.random().toString(36).slice(2, 6);
              ii = { ...ii, id: newId, name: (ii.name || id) + ' (import)' };
              id = newId;
            }
            let norm = normalizeSingleInterface ? normalizeSingleInterface(ii) : normalizeInterface(ii);
            norm = expandFieldsToFlat(norm);
            fresh.interfaces = fresh.interfaces.concat(norm);
            // values
            if (Array.isArray(data.values[ii.id])) vals[id] = data.values[ii.id];
          });
          saveConfig(fresh); setCfg(fresh); saveValues(vals);
          alert('Zaimportowano kopię – scalono z istniejącą konfiguracją.');
        }
        return;
      }

      // Single interface import (existing behavior)
      const obj = data;
      const v = schemaValidate(obj); if (!v.ok) { alert('Błąd walidacji: ' + v.message); return; }
      let nextCfg = { ...cfg };
      if (obj.categoryId && !nextCfg.categories.find(c => c.id === obj.categoryId)) {
        nextCfg.categories = nextCfg.categories.concat({ id: obj.categoryId, name: obj.categoryId });
      }
      if (importMode === 'overwrite') {
        if (!selectedId) { alert('Wybierz interfejs do nadpisania.'); return; }
        const idx = nextCfg.interfaces.findIndex(x => x.id === selectedId); if (idx === -1) { alert('Nie znaleziono interfejsu.'); return; }
        const keepId = nextCfg.interfaces[idx].id;
        const newIface = normalizeInterface({
          id: keepId,
          name: obj.name || nextCfg.interfaces[idx].name,
          categoryId: obj.categoryId || nextCfg.interfaces[idx].categoryId,
          summary: typeof obj.summary === 'string' ? obj.summary : '',
          labels: obj.labels, descriptions: obj.descriptions || Array((obj.labels || []).length).fill(''),
          lengths: obj.lengths, required: obj.required, types: obj.types,
          sections: obj.sections, sectionNumbers: obj.sectionNumbers,
          fieldSections: obj.fieldSections, separators: obj.separators || [],
          defaultFields: obj.defaultFields || nextCfg.interfaces[idx].defaultFields
        });
        nextCfg.interfaces[idx] = newIface;
        setCfg(nextCfg); saveConfig(nextCfg);
        setCurrentId(keepId); setMode('edit'); setActiveSec(0);
        alert('Interfejs nadpisany z importu.');
      } else {
        const newId = 'imp-' + Math.random().toString(36).slice(2, 8);
        const newIface = normalizeInterface({
          id: newId,
          name: obj.name || ('imported-' + newId),
          categoryId: obj.categoryId || nextCfg.categories[0]?.id,
          summary: typeof obj.summary === 'string' ? obj.summary : '',
          labels: obj.labels, descriptions: obj.descriptions || Array((obj.labels || []).length).fill(''),
          lengths: obj.lengths, required: obj.required, types: obj.types,
          sections: obj.sections, sectionNumbers: obj.sectionNumbers,
          fieldSections: obj.fieldSections, separators: obj.separators || [],
          defaultFields: obj.defaultFields || []
        });
        nextCfg.interfaces = nextCfg.interfaces.concat(newIface);
        setCfg(nextCfg); saveConfig(nextCfg);
        setCurrentId(newId); setSelectedId(newId); setMode('edit'); setActiveSec(0);
        alert('Dodano nowy interfejs z importu.');
      }
    } catch (err) {
      console.error(err); alert('Nie udało się zaimportować.');
    } finally {
      e.target.value = '';
    }
  }

  // === Dedicated handler for full project backups (clean, single source of truth) ===
  const handleBackupImport = async (e) => {
    const file = e && e.target && e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(String(text).replace(/^\uFEFF/, ''));

      let handled = false;

      // A) Full backup {_type:'tcf_full_backup', config, values}
      if (data && data._type === 'tcf_full_backup' && data.config && data.values) {
        if (confirm('Wykryto pełną kopię. Nadpisać CAŁĄ konfigurację? (Anuluj = scal)')) {
          saveConfig(data.config);
          saveValues(data.values);
          setCfg(normalizeConfig(data.config));
          alert('Zaimportowano kopię.');
        } else {
          let fresh = normalizeConfig(loadConfig());

          // categories
          const have = new Set(fresh.categories.map(c => c.id));
          (data.config.categories || []).forEach(c => {
            if (c && c.id && !have.has(c.id)) fresh.categories.push({ id: c.id, name: c.name || c.id });
          });

          // interfaces + values
          const byId = new Map(fresh.interfaces.map(i => [i.id, i]));
          const vals = loadValues() || {};

          (data.config.interfaces || []).forEach(ii => {
            let id = ii.id;
            let norm = expandFieldsToFlat(normalizeSingleInterface(ii));

            if (byId.has(id)) {
              let base = id, acc = base, k = 2;
              while (byId.has(acc)) acc = `${base}-${k++}`;
              norm = { ...norm, id: acc, name: (norm.name || base) + ' (import)' };
              id = acc;
            }
            byId.set(id, norm);

            if (data.values && Array.isArray(data.values[ii.id])) {
              vals[id] = data.values[ii.id].slice();
            }
          });

          fresh.interfaces = Array.from(byId.values());
          saveConfig(fresh); setCfg(fresh); saveValues(vals);
          alert('Zaimportowano kopię – scalono z istniejącą konfiguracją.');
        }
        handled = true;
      }

      // B) Backup-like {interfaces, categories}
      if (!handled && data && Array.isArray(data.interfaces) && Array.isArray(data.categories)) {
        importFromJsonTop(data, cfg, setCfg, t);
        handled = true;
      }

      if (!handled) {
        alert(t('invalidJson') || 'Nieprawidłowy plik JSON.');
      }
    } catch (err) {
      console.error(err);
      alert(t('invalidJson') || 'Nieprawidłowy plik JSON.');
    } finally {
      try { if (e && e.target) e.target.value = ''; } catch { }
    }
  };



  // ===== RENDER =====
  if (mode === 'overview' && role !== 'editor') {
    return (
      <main className="wrap wide">
        <section className="card">
          <h2>{t('adminTitle')} · <span className="pill">{t('overview')}</span></h2>

          <div className="actions" style={{ justifyContent: 'space-between' }}>
            <div className="actions">
              <input type="text" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 260 }} />
              <div className="filterBlock" style={{ display: 'flex', alignItems: 'center', gap: 8, width: "min(520px, 100%)" }}>
                <span>{t('filterCat')}:</span>
                <select style={{ flex: 1 }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                  <option value="">—</option>
                  {cfg.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="actions">
              <button type="button" onClick={() => setIsAddOpen(true)}>{t('newInterfaceTitle')}</button>
              <button type="button" onClick={exportAll}>{t('exportBackup')}</button>
              <button type="button" onClick={() => setIsBackupOpen(true)}>{t('importBackup') || 'Import Backup'}</button>
              <button type="button" onClick={() => setIsWmsOpen(true)}>{t('import')}</button>
              <DataImportButtons cfg={cfg} setCfg={setCfg} t={t} />

              <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const txt = String(r.result).replace(/^\uFEFF/, ''); const obj = JSON.parse(txt); importFromJsonTop(obj, cfg, setCfg, t); } catch (err) { console.error('[import] parse error', err); alert(t('invalidJson') || 'Nieprawidłowy plik JSON.'); } }; r.readAsText(f); e.target.value = ''; }} />

              <input ref={backupFileRef} type="file" accept="application/json" onChange={handleBackupImport} style={{ display: 'none' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="importMode" value="add" checked={importMode === 'add'} onChange={() => setImportMode('add')} />
                <span>{t('importAddNew')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="radio" name="importMode" value="overwrite" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} />
                <span>{t('importOverwriteSelected')}</span>
              </label>
              {importMode === 'overwrite' && (
                <select value={selectedId || ''} onChange={e => setSelectedId(e.target.value)}>
                  <option value="" disabled>— wybierz interfejs —</option>
                  {cfg.interfaces.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              )}
            </div>
          </div>



          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                  {t('interface')} {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>{t('ifaceType')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('category')}>
                  {t('category')} {sortKey === 'category' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('count')}>
                  {t('fieldsCount') || 'Liczba pól'} {sortKey === 'count' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>{t('io') || 'Import/Export'}</th>
                <th>{t('deleteInterface')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedInterfaces.map(i => (
                <tr key={i.id}>
                  <td>
                    <a href="#" className="link" onClick={(e) => { e.preventDefault(); setSelectedId(i.id); setCurrentId(i.id); setActiveSec(0); setMode('edit'); }}>
                      {i.name}
                    </a>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={i.ifaceType || ''}
                      onChange={(e) => {
                        const next = { ...cfg, categories: [...cfg.categories], interfaces: [...cfg.interfaces] };
                        const x = next.interfaces.find(x => x.id === i.id);
                        if (x) x.ifaceType = e.target.value;
                        saveConfig(next); setCfg(next);
                      }}
                      placeholder="np. Batch / Online"
                    />
                  </td>
                  <td>
                    <select value={i.categoryId} onChange={(e) => {
                      const next = { ...cfg, categories: [...cfg.categories], interfaces: [...cfg.interfaces] };
                      const x = next.interfaces.find(x => x.id === i.id);
                      if (x) x.categoryId = e.target.value;
                      saveConfig(next); setCfg(next);
                    }}>
                      {cfg.categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>{Array.isArray(i.labels) ? i.labels.length : 0}</td>
                  <td>
                    <button className="btn small" onClick={(e) => { e.preventDefault(); exportOne(i.id); }}>{t('export')}</button>
                    <button className="btn small" onClick={(e) => { e.preventDefault(); setPendingImportId(i.id); rowFileRef.current?.click(); }} style={{ marginLeft: 8 }}>{t('import')}</button>
                  </td>
                  <td>
                    <button className="btn small danger" onClick={(e) => { e.preventDefault(); setDeleteTarget({ id: i.id, name: i.name }); setIsDeleteOpen(true); }}>{t('deleteInterface')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="card-head"><h3>Kategorie</h3></div>
          <table className="table" style={{ width: '100%' }}>
            <thead><tr><th>ID</th><th>Nazwa</th><th>Interfejsy</th><th>Akcje</th></tr></thead>
            <tbody>
              {cfg.categories.map(c => {
                const count = cfg.interfaces.filter(i => i.categoryId === c.id).length;
                return (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.name}</td>
                    <td>{count}</td>
                    <td className="table-actions">
                      <button onClick={() => { setRenameTarget({ id: c.id, name: c.name }); setIsRenameOpen(true); }}>{t('renameCategory')}</button>
                      <button className="danger" onClick={() => { const count = cfg.interfaces.filter(i => i.categoryId === c.id).length; setDeleteCatTarget({ id: c.id, name: c.name }); setDeleteCatCount(count); setIsDeleteCatOpen(true); }}>{t('delete')}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="actions" style={{ marginTop: 8 }}>
            <button onClick={() => setIsAddCategoryOpen(true)}>{t('addCategory')}</button>
          </div>
        </section>

        <input ref={rowFileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const txt = String(r.result).replace(/^\uFEFF/, ''); const obj = JSON.parse(txt); importFromJsonTop(obj, cfg, setCfg, t); } catch (err) { console.error('[import] parse error', err); alert(t('invalidJson') || 'Nieprawidłowy plik JSON.'); } }; r.readAsText(f); e.target.value = ''; }} />

        <AddInterfaceModal
          open={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          categories={cfg.categories}
          interfaces={cfg.interfaces}
          onSubmit={createInterfaceFromModal}
        />

        <ImportBackupModal status={importStatus}
          open={isBackupOpen}
          onClose={() => { setIsBackupOpen(false); setImportStatus(null); }}
          onImport={applyBackupData}
        />

        <ImportWmsModal
          open={isWmsOpen}
          status={wmsStatus}
          interfaces={cfg.interfaces}
          onClose={() => { setIsWmsOpen(false); setWmsStatus(null); }}
          onImport={applyWmsData}
        />

        <DeleteInterfaceModal
          open={isDeleteOpen}
          target={deleteTarget}
          onClose={() => { setIsDeleteOpen(false); setDeleteTarget(null); }}
          onConfirm={({ removeValues }) => { if (deleteTarget) { deleteOne(deleteTarget.id, removeValues); } setIsDeleteOpen(false); setDeleteTarget(null); }}
        />


        <AddCategoryModal
          open={isAddCategoryOpen}
          categories={cfg.categories}
          onClose={() => setIsAddCategoryOpen(false)}
          onSubmit={(payload) => { createCategoryFromModal(payload); }}
        />


        <RenameCategoryModal
          open={isRenameOpen}
          target={renameTarget}
          onClose={() => { setIsRenameOpen(false); setRenameTarget(null); }}
          onSubmit={renameCategoryFromModal}
        />

        <DeleteCategoryModal
          open={isDeleteCatOpen}
          target={deleteCatTarget}
          categories={cfg.categories}
          interfacesInCategory={deleteCatCount}
          onClose={() => { setIsDeleteCatOpen(false); setDeleteCatTarget(null); }}
          onConfirm={(payload) => { if (deleteCatTarget) { deleteCategoryFromModal(payload); } setIsDeleteCatOpen(false); setDeleteCatTarget(null); }}
        />
      </main>
    )
  }

  // ===== EDIT MODE =====
  return (
    <main className="wrap wide">
      <section className="card">
        <h2>{t('editInterface')} · <span className="pill">{current?.name}</span></h2>
        {role !== 'editor' && (
          <div className="actions" style={{ justifyContent: 'space-between' }}>
            <a className="link" href="/admin?view=overview" onClick={handleTopBack}>← {t('back')}</a>
          </div>

        )}


        {/* Tabs */}

        <ScrollTabs height={44}>
          <div className="tabs-admin">
            {current.sections.map((s, idx) => (
              <div key={idx} className={`tab-admin ${idx === activeSec ? 'active' : ''}`} onClick={() => setActiveSec(idx)} title={`${(((current.sections[idx] || '').match(/\b(\d{3})\b/) || [])[1] || (((current.sections[idx] || '').match(/\b(\d{3})\b/) || [])[1] || (((current.sections[idx] || '').match(/\b(\d{3})\b/) || [])[1] || current.sectionNumbers?.[idx] || String(idx * 10).padStart(3, '0'))))} · ${s}`}>
                <span>{idx === 0 ? 'Introduction' : ((((current.sections[idx] || '').match(/\b(\d{3})\b/) || [])[1] || (((current.sections[idx] || '').match(/\b(\d{3})\b/) || [])[1] || current.sectionNumbers?.[idx] || String(idx * 10).padStart(3, '0'))))}</span>
                {idx > 0 && role !== 'editor' && (
                  <button className="close" onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t('delete') + '?')) {
                      const n = { ...current };
                      n.sections = n.sections.filter((_, ix) => ix !== idx);
                      n.sectionNumbers = (n.sectionNumbers || []).filter((_, ix) => ix !== idx);
                      n.includedSections = (n.includedSections || n.sections.map((_, j) => j > 0)).filter((_, ix2) => ix2 !== idx);
                      n.fieldSections = n.fieldSections.map(v => v === idx ? 0 : (v > idx ? v - 1 : v));
                      n.sectionColors = (n.sectionColors || n.sections.map(() => "")).filter((_, ix2) => ix2 !== idx);
                      applyIface(n); setActiveSec(0);
                    }
                  }}>×</button>
                )}
              </div>
            ))}
            <div className="tab-admin" title={t('addSection')} onClick={() => {
              let num = prompt(t('sectionNumber') + ' (np. 010)'); if (num === null) return;
              num = String(num).replace(/\D/g, '').slice(0, 3); if (!num) num = '010'; num = num.padStart(3, '0');
              const name = prompt(t('addSection')); if (!name || !name.trim()) return;
              let n = cloneIface(); if (!Array.isArray(n.sectionNumbers)) n.sectionNumbers = n.sections.map((_, i) => i === 0 ? '000' : String(i * 10).padStart(3, '0'));
              n.sections.push(name.trim()); n.sectionNumbers.push(num); n.includedSections = Array.isArray(n.includedSections) ? n.includedSections.slice() : n.sections.map((_, j) => j > 0); n.includedSections.push(false);
              n = injectDefaultsIntoSection(n, n.sections.length - 1);
              applyIface(n); setActiveSec(n.sections.length - 1);
            }}>
              <span style={{ fontWeight: 700 }}>＋</span> {t('addSection')}
            </div>
          </div>
        </ScrollTabs>

        <div className="adminPanel">
          <h3>{t('fieldsTitle')} — {current.sections[activeSec]}</h3>

          {/* Intro (TOC) */}
          {activeSec === 0 ? (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4 style={{ marginTop: 0 }}>{t('tableOfContents')}</h4>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr><th>{t('number')}</th><th>{t('desc')}</th></tr>
                </thead>
                <tbody>
                  {current.sections.map((nm, ix) => ix > 0 && (
                    <tr key={ix}>
                      <td>{current.sectionNumbers?.[ix] || String(ix * 10).padStart(3, '0')}</td>
                      <td>
                        <a href="#" className="link" onClick={(e) => { e.preventDefault(); setActiveSec(ix); }}>{nm}</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
            <div className="actions" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{t('sectionNumber')}:</span>
                <input type="text" value={current.sectionNumbers?.[activeSec] || ''} maxLength={3}
                  onChange={e => { const val = (e.target.value || '').replace(/\D/g, '').slice(0, 3).padStart(3, '0'); const n = { ...current }; n.sectionNumbers = (n.sectionNumbers || current.sections.map((_, i) => i === 0 ? '000' : String(i * 10).padStart(3, '0'))).slice(); n.sectionNumbers[activeSec] = val; applyIface(n); }} style={{ width: 80 }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  minWidth: 120,   // możesz zmienić np. na 180/200
                  marginRight: 2
                }}>{t('renameSection')}:</span>
                <input type="text" value={current.sections[activeSec]} onChange={e => { const n = cloneIface(); n.sections[activeSec] = e.target.value; applyIface(n); }} />
              </label>
            </div>
         
            </>
          )}

          {/* Fields for non-intro sections */}
          {activeSec !== 0 && (
            <>
              <div className="labels">
                {(() => {
                  // Indeksy pól należących do aktywnej sekcji (bez dodatkowego sortowania)
                  const indicesInSec = current.fieldSections.map((s, i) => s === activeSec ? i : -1).filter(i => i !== -1);
                  const ordered = indicesInSec.slice();                 // to wyświetlamy i przeciągamy
                  const secSlots = indicesInSec.slice().sort((a, b) => a - b); // docelowe sloty (rosnąco w globalnych tablicach)

                  return (
                    <SortableFields
                      items={ordered}
                      getId={(fi) => String(fi)}
                      showDefaultHandle={false}  // uchwyt wstawiamy ręcznie na początku wiersza
                      setItems={(next) => {
                        const old = cloneIface();
                        const n = { ...old };

                        // Upewnij się, że flexFields ma odpowiednią długość
                        n.flexFields = Array.isArray(n.flexFields) ? n.flexFields.slice() : [];
                        while (n.flexFields.length < n.labels.length) n.flexFields.push(false);

                        // Mapowanie: dla k-tego slotu w sekcji używamy elementu z indeksu next[k]
                        const slotToSource = new Map();
                        for (let k = 0; k < secSlots.length; k++) {
                          slotToSource.set(secSlots[k], next[k]); // slot globalny -> źródłowy indeks (przed zmianą)
                        }

                        // Zbuduj nowe tablice, przepisując spoza sekcji 1:1, a w sekcji wg slotToSource
                        const labs = [], desc = [], lens = [], req = [], typ = [], fsec = [], flex = [];
                        for (let i = 0; i < n.labels.length; i++) {
                          const src = slotToSource.has(i) ? slotToSource.get(i) : i;
                          labs.push(n.labels[src]);
                          desc.push(n.descriptions[src] ?? '');
                          lens.push(n.lengths[src]);
                          req.push(!!n.required[src]);
                          typ.push(n.types[src]);
                          fsec.push(n.fieldSections[src]);
                          flex.push(!!n.flexFields[src]);
                        }

                        // Przenieś separatory razem z wierszem (oldIndex -> newIndex)
                        const mappingOldToNew = new Map(); // tylko dla pól z aktywnej sekcji
                        for (let k = 0; k < secSlots.length; k++) {
                          mappingOldToNew.set(next[k], secSlots[k]); // pole z oldIndex next[k] trafiło do newIndex secSlots[k]
                        }
                        const newSeps = (n.separators || []).map(s => mappingOldToNew.has(s) ? mappingOldToNew.get(s) : s);
                        const uniqSeps = Array.from(new Set(newSeps)).sort((a, b) => a - b);

                        // Przenieś również values[currentId] – zachowaj zgodność pozycji z polami
                        try {
                          const vals = loadValues() || {};
                          const arr = (vals[currentId] ?? []).slice();
                          const arr2 = new Array(labs.length);
                          for (let i = 0; i < labs.length; i++) {
                            const src = slotToSource.has(i) ? slotToSource.get(i) : i;
                            arr2[i] = arr[src];
                          }
                          vals[currentId] = arr2;
                          saveValues(vals);
                        } catch (_e) { }

                        const out = {
                          ...n,
                          labels: labs, descriptions: desc, lengths: lens, required: req,
                          types: typ, fieldSections: fsec, flexFields: flex, separators: uniqSeps
                        };
                        applyIface(out);
                      }}
                      row={(fi, k, handleProps, isDragging) => {
                        const gridStyle = {
                          display: 'grid',
                          gridTemplateColumns: '42px minmax(240px,1fr) minmax(240px,1fr) 120px 88px 120px 170px max-content',
                          alignItems: 'center',
                          gap: '12px'
                        };
                        const btnColStyle = { display: 'flex', flexDirection: 'column', gap: 8, width: 112, justifySelf: 'end' };

                        return (
                          <React.Fragment key={fi}>
                            {current.separators.includes(fi) && <div className="sep-admin"></div>}

                            <div
                              className="rowSec"
                              style={{
                                position: 'relative',                     // <— klucz
                                border: '1px dashed var(--border)',
                                borderRadius: '10px',
                                padding: '10px 12px',
                                paddingRight: 300,                        // rezerwa na 2 przyciski (128+128+8+~28)
                                boxSizing: 'border-box',
                                width: '100%'
                              }}
                            >
                              {/* LEWA CZĘŚĆ — siatka pól */}
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns:
                                    '42px minmax(240px,1fr) minmax(240px,1fr) 120px 88px 120px minmax(150px,1fr)',
                                  alignItems: 'center',
                                  gap: 12,
                                  minWidth: 0
                                }}
                              >
                                {/* UCHWYT */}
                                <button
                                  {...handleProps}
                                  className="h-8 w-8 grid place-items-center rounded-md border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 cursor-grab active:cursor-grabbing"
                                  aria-label="Przeciągnij wiersz"
                                  title="Przeciągnij, aby zmienić kolejność"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  </svg>
                                </button>

                                {/* Label */}
                                <input
                                  type="text"
                                  value={current.labels[fi]}
                                  onChange={e => { const n = cloneIface(); n.labels[fi] = e.target.value; applyIface(n); }}
                                  style={{ width: '100%', minWidth: 0 }}
                                />

                                {/* Description */}
                                <input
                                  type="text"
                                  placeholder={t('description')}
                                  value={current.descriptions[fi] || ''}
                                  onChange={e => { const n = cloneIface(); n.descriptions[fi] = e.target.value; applyIface(n); }}
                                  style={{ width: '100%', minWidth: 0 }}
                                />

                                {/* Length */}
                                <input
                                  type="number" min="1" max="200"
                                  value={current.lengths[fi] || 10}
                                  disabled={!!(current.flexFields && current.flexFields[fi])}
                                  onChange={e => {
                                    const n = cloneIface();
                                    n.lengths[fi] = Math.max(1, Math.min(200, Number(e.target.value) || 1));
                                    applyIface(n);
                                  }}
                                  style={{ width: '100%', opacity: (current.flexFields && current.flexFields[fi]) ? 0.5 : 1 }}
                                />

                                {/* Flex */}
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!(current.flexFields && current.flexFields[fi])}
                                    onChange={e => {
                                      const n = cloneIface();
                                      n.flexFields = Array.isArray(n.flexFields) ? n.flexFields.slice() : [];
                                      while (n.flexFields.length < n.labels.length) n.flexFields.push(false);
                                      n.flexFields[fi] = !!e.target.checked;
                                      applyIface(n);
                                    }}
                                  />
                                  <span>Flex</span>
                                </label>

                                {/* Required */}
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!current.required[fi]}
                                    onChange={e => { const n = cloneIface(); n.required[fi] = !!e.target.checked; applyIface(n); }}
                                  />
                                  <span>{t('required')}</span>
                                </label>

                                {/* Type */}
                                <select
                                  value={current.types[fi] || 'alphanumeric'}
                                  onChange={e => { const n = cloneIface(); n.types[fi] = (e.target.value === 'numeric' ? 'numeric' : 'alphanumeric'); applyIface(n); }}
                                  style={{ width: '100%', minWidth: 0 }}
                                >
                                  <option value="alphanumeric">{t('alphanumeric')}</option>
                                  <option value="numeric">{t('numeric')}</option>
                                </select>
                              </div>

                              {/* PRAWA CZĘŚĆ — absolutnie przy prawej krawędzi */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  right: 12,                 // wewnętrzny odstęp od ramki
                                  transform: 'translateY(-50%)',
                                  display: 'flex',
                                  gap: 8,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <button
                                  onClick={() => {
                                    const n = cloneIface();
                                    if (n.separators.includes(fi)) n.separators = n.separators.filter(x => x !== fi);
                                    else n.separators = n.separators.concat(fi).sort((a, b) => a - b);
                                    applyIface(n);
                                  }}
                                  style={{ minWidth: 128 }}
                                >
                                  {current.separators.includes(fi) ? t('removeSeparator') : t('addSeparator')}
                                </button>

                                <button
                                  onClick={() => {
                                    const n = cloneIface();
                                    n.labels.splice(fi, 1);
                                    n.descriptions.splice(fi, 1);
                                    n.lengths.splice(fi, 1);
                                    n.required.splice(fi, 1);
                                    n.types.splice(fi, 1);
                                    n.fieldSections.splice(fi, 1);
                                    n.flexFields = (n.flexFields || []).slice();
                                    n.flexFields.splice(fi, 1);
                                    n.separators = n.separators.filter(s => s !== fi).map(s => s > fi ? s - 1 : s);
                                    applyIface(n);
                                    const vals = loadValues();
                                    const arr = (vals[currentId] ?? []).slice();
                                    arr.splice(fi, 1);
                                    vals[currentId] = arr;
                                    saveValues(vals);
                                  }}
                                  style={{ minWidth: 128 }}
                                >
                                  {t('delete')}
                                </button>
                              </div>
                            </div>



                          </React.Fragment>
                        );
                      }}

                    />
                  );
                })()}
              </div>

              <div className="actions" style={{ justifyContent: 'space-between' }}>
                <div><button onClick={() => { const n = cloneIface(); n.labels.push(`Pole ${n.labels.length + 1}`); n.descriptions.push(''); n.lengths.push(10); n.required.push(false); n.types.push('alphanumeric'); n.fieldSections.push(activeSec); n.flexFields = Array.isArray(n.flexFields) ? n.flexFields.slice() : []; n.flexFields.push(false); applyIface(n); const vals = loadValues(); const arr = vals[currentId] ?? []; arr.push(''); vals[currentId] = arr; saveValues(vals); }}>{t('addField')}</button></div>
                <div><a className="link" href="/admin?view=overview">← {t('backToList')}</a></div>
              </div>
            </>
          )}
        </div>
           {/* Section Additional information toggle + default text */}
            <div className="card" style={{ padding: 12, marginTop: 12 }}>
              <label style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:8 }} title={t('showAdditionalInfo')}>
                <input
                  type="checkbox"
                  checked={(current.sectionNotesEnabled?.[activeSec] ?? (activeSec!==0))}
                  onChange={e => {
                    const n = cloneIface();
                    if (!Array.isArray(n.sectionNotesEnabled) || n.sectionNotesEnabled.length !== n.sections.length) {
                      n.sectionNotesEnabled = n.sections.map((_, ix) => ix !== 0);
                    }
                    n.sectionNotesEnabled[activeSec] = !!e.target.checked;
                    applyIface(n);
                  }}
                />
                <span>{t('showAdditionalInfo')}</span>
              </label>

              <div style={{ fontSize: 12, opacity: .8, marginBottom: 6 }}>{t('additionalInfo')}</div>

              <textarea
                rows={10}
                style={{ width: '100%', resize: 'vertical' }}
                value={(current.sectionNotes && typeof current.sectionNotes[activeSec] === 'string') ? current.sectionNotes[activeSec] : ''}
                onChange={e => {
                  const n = cloneIface();
                  if (!Array.isArray(n.sectionNotes) || n.sectionNotes.length !== n.sections.length) {
                    n.sectionNotes = n.sections.map(() => '');
                  }
                  n.sectionNotes[activeSec] = e.target.value;
                  applyIface(n);
                }}
                placeholder={t('additionalInfo')}
              />
            </div>
      </section>

      <section className="card">
        <div className="card-head"><h3>Kategorie</h3></div>
        <table className="table" style={{ width: '100%' }}>
          <thead><tr><th>ID</th><th>Nazwa</th><th>Interfejsy</th><th>Akcje</th></tr></thead>
          <tbody>
            {cfg.categories.map(c => {
              const count = cfg.interfaces.filter(i => i.categoryId === c.id).length;
              return (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>{count}</td>
                  <td className="table-actions">
                    <button onClick={() => { setRenameTarget({ id: c.id, name: c.name }); setIsRenameOpen(true); }}>{t('renameCategory')}</button>
                    <button className="danger" onClick={() => { const count = cfg.interfaces.filter(i => i.categoryId === c.id).length; setDeleteCatTarget({ id: c.id, name: c.name }); setDeleteCatCount(count); setIsDeleteCatOpen(true); }}>{t('delete')}</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="actions" style={{ marginTop: 8 }}>
          <button onClick={() => setIsAddCategoryOpen(true)}>{t('addCategory')}</button>
        </div>
      </section>

      <input ref={rowFileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const txt = String(r.result).replace(/^\uFEFF/, ''); const obj = JSON.parse(txt); importFromJsonTop(obj, cfg, setCfg, t); } catch (err) { console.error('[import] parse error', err); alert(t('invalidJson') || 'Nieprawidłowy plik JSON.'); } }; r.readAsText(f); e.target.value = ''; }} />

      <AddInterfaceModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        categories={cfg.categories}
        interfaces={cfg.interfaces}
        onSubmit={createInterfaceFromModal}
      />

      <ImportBackupModal status={importStatus}
        open={isBackupOpen}
        onClose={() => { setIsBackupOpen(false); setImportStatus(null); }}
        onImport={applyBackupData}
      />

      <ImportWmsModal
        open={isWmsOpen}
        status={wmsStatus}
        interfaces={cfg.interfaces}
        onClose={() => { setIsWmsOpen(false); setWmsStatus(null); }}
        onImport={applyWmsData}
      />

      <DeleteInterfaceModal
        open={isDeleteOpen}
        target={deleteTarget}
        onClose={() => { setIsDeleteOpen(false); setDeleteTarget(null); }}
        onConfirm={({ removeValues }) => { if (deleteTarget) { deleteOne(deleteTarget.id, removeValues); } setIsDeleteOpen(false); setDeleteTarget(null); }}
      />


      <AddCategoryModal
        open={isAddCategoryOpen}
        categories={cfg.categories}
        onClose={() => setIsAddCategoryOpen(false)}
        onSubmit={(payload) => { createCategoryFromModal(payload); }}
      />

    </main>
  )
}