
import React, { useRef } from 'react';
import { saveConfig } from '../utils';

/** Icon-only buttons that import CSV/JSON and append a new interface */
export default function DataImportButtons({ cfg, setCfg, t }) {
  const csvFileRef = useRef(null);
  const jsonDataFileRef = useRef(null);

  // ---------- helpers ----------
  const baseNameOf = (fname) => String(fname||'').replace(/\.[^.]+$/, '');

  const slugifyId = (name) =>
    (String(name||'iface')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0,40)) || (Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4));

  const ensureUniqueId = (baseId, cfg) => {
    const exists = new Set((cfg?.interfaces||[]).map(it => it.id));
    if (!exists.has(baseId)) return baseId;
    let n = 2;
    while (exists.has(`${baseId}-${n}`)) n++;
    return `${baseId}-${n}`;
  };

  const ensureUniqueName = (baseName, cfg) => {
    const exists = new Set((cfg?.interfaces||[]).map(it => it.name));
    if (!exists.has(baseName)) return baseName;
    let n = 2;
    while (exists.has(`${baseName} (${n})`)) n++;
    return `${baseName} (${n})`;
  };

  const detectSep = (line) => {
    const cands = [',',';','\t','|'];
    let best=',', bestCount=0;
    for (const s of cands){ const cnt=(line.split(s).length-1); if (cnt>bestCount){ best=s; bestCount=cnt; } }
    return best;
  };

  const isPlainObject = (x) => x && typeof x === 'object' && !Array.isArray(x);

  const findArrayOfObjects = (input, maxDepth=4) => {
    if (Array.isArray(input)) return (input.length && isPlainObject(input[0])) ? input : null;
    if (!isPlainObject(input) || maxDepth<=0) return null;
    for (const v of Object.values(input)){ const found = findArrayOfObjects(v, maxDepth-1); if (found) return found; }
    return null;
  };

  const flattenKeys = (obj, prefix='', out=new Set(), depth=2) => {
    if (!isPlainObject(obj) || depth<0) return out;
    for (const [k, v] of Object.entries(obj)){
      const key = prefix ? prefix + '.' + k : k;
      if (isPlainObject(v) && depth>0) flattenKeys(v, key, out, depth-1);
      else out.add(key);
    }
    return out;
  };

  const getAtPath = (obj, path) => {
    try { return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : '', obj); }
    catch { return ''; }
  };

  // ---------- builders ----------
  function makeInterface({ id, name, labels, lengths, types }){
    const n = labels.length;
    const secName = name || 'Imported';
    return {
      id,
      name,
      summary: '',
      categoryId: 'inbound',
      ifaceType: '',
      labels,
      descriptions: Array(n).fill(''),
      lengths,
      required: Array(n).fill(false),
      types,
      // show fields under a dedicated second section; Introduction stays as overview
      sections: ['Introduction', secName],
      sectionNumbers: ['000','010'],
      includedSections: [false, true],
      sectionColors: ['', ''],
      fieldSections: Array(n).fill(1),
      separators: [],
      flexFields: Array(n).fill(true)
    };
  }

  function csvToInterface(text, fname){
    const lines = String(text).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if (!lines.length) throw new Error('Empty CSV');
    const sep = detectSep(lines[0]);
    const hasHeader = window.confirm((t?.('csvHasHeader') || 'Czy CSV ma nagłówek w 1. linii?'));
    let header = hasHeader ? lines.shift().split(sep) : [];
    if (!hasHeader){
      const cols = lines[0].split(sep).length;
      header = Array.from({length: cols}, (_,i)=>`Pole ${i+1}`);
    }
    const rows = lines.map(l => l.split(sep));
    const n = header.length;

    const lengths = Array(n).fill(1);
    const types = Array(n).fill('alphanumeric');
    for (const r of rows){
      for (let i=0;i<n;i++){
        const v = String(r[i] ?? '');
        lengths[i] = Math.max(lengths[i], Math.min(200, v.length || 1));
      }
    }
    for (let i=0;i<n;i++){
      const allNumeric = rows.every(r => /^\d+$/.test(String(r[i]??'')) && String(r[i]??'')!=='');
      types[i] = allNumeric ? 'numeric' : 'alphanumeric';
    }

    const base = baseNameOf(fname);
    const name = ensureUniqueName(base || (t?.('importedFromCsv') || 'CSV import'), cfg);
    const id = ensureUniqueId(slugifyId(base || 'csv-interface'), cfg);
    const labels = header.map(h => String(h||'').trim() || 'Pole');
    return makeInterface({ id, name, labels, lengths, types });
  }

  function jsonDataToInterface(obj, fname){
    let data = null;
    if (Array.isArray(obj)) data = obj;
    else if (isPlainObject(obj)) data = findArrayOfObjects(obj, 4) || obj;
    else data = [obj];

    let rows = [];
    if (Array.isArray(data)){
      if (data.length && isPlainObject(data[0])) rows = data;
      else rows = data.map(v => ({ value: v }));
    } else if (isPlainObject(data)) {
      const arr = findArrayOfObjects(data, 2);
      rows = arr ? arr : [data];
    } else {
      rows = [{ value: data }];
    }

    const keys = new Set();
    const sampleCount = Math.min(rows.length, 5);
    for (let i=0;i<sampleCount;i++){
      const r = rows[i] || {};
      if (isPlainObject(r)){ flattenKeys(r, '', keys, 2); }
      else { keys.add('value'); }
    }
    let labels = Array.from(keys);
    if (!labels.length) labels = ['value'];

    const one = rows[0] || {};
    const lengths = labels.map(k => {
      const v = isPlainObject(one) ? String(getAtPath(one, k) ?? '') : String(one ?? '');
      return Math.max(1, Math.min(200, v.length || 10));
    });
    const types = labels.map(k => {
      const v = isPlainObject(one) ? String(getAtPath(one, k) ?? '') : String(one ?? '');
      return (/^\d+$/.test(v) ? 'numeric' : 'alphanumeric');
    });

    const base = baseNameOf(fname);
    const name = ensureUniqueName(base || (t?.('importedFromJson') || 'JSON import'), cfg);
    const id = ensureUniqueId(slugifyId(base || 'json-interface'), cfg);
    return makeInterface({ id, name, labels, lengths, types });
  }

  // ---------- handlers ----------
  const handleCsvDataImport = (e) => {
    try{
      const f = e.target.files && e.target.files[0]; if (!f) return;
      // guard: duplicate by base name
      const base = baseNameOf(f.name);
      if ((cfg?.interfaces||[]).some(it => it.name === base)){
        const ok = window.confirm('Interfejs o tej nazwie już istnieje. Dodać kopię?');
        if (!ok) { return; }
      }
      const r = new FileReader();
      r.onload = () => {
        try{
          const iface = csvToInterface(r.result, f.name);
          const next = { ...cfg, interfaces: (cfg.interfaces||[]).concat(iface) };
          setCfg(next); saveConfig(next);
          alert(t?.('importDone') || 'Import zakończony.');
        }catch(err){ console.error(err); alert('Nie udało się sparsować CSV.'); }
      };
      r.readAsText(f);
    } finally { if (e && e.target) e.target.value=''; }
  };

  const handleJsonDataImport = (e) => {
    try{
      const f = e.target.files && e.target.files[0]; if (!f) return;
      // guard: duplicate by base name
      const base = baseNameOf(f.name);
      if ((cfg?.interfaces||[]).some(it => it.name === base)){
        const ok = window.confirm('Interfejs o tej samej nazwie pliku już istnieje. Dodać kopię?');
        if (!ok) { return; }
      }
      const r = new FileReader();
      r.onload = () => {
        try{
          const obj = JSON.parse(String(r.result||'{}'));
          const iface = jsonDataToInterface(obj, f.name);
          const next = { ...cfg, interfaces: (cfg.interfaces||[]).concat(iface) };
          setCfg(next); saveConfig(next);
          alert(t?.('importDone') || 'Import zakończony.');
        }catch(err){ console.error(err); alert('Nieprawidłowy JSON.'); }
      };
      r.readAsText(f);
    } finally { if (e && e.target) e.target.value=''; }
  };

  // ---------- UI ----------
  return (
    <span style={{ display: 'inline-flex', gap: 8, marginLeft: 8 }}>
      <button className="btn iconOnly" title="Import CSV" onClick={() => csvFileRef.current?.click()} aria-label="Import CSV">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
          <path d="M4 10h16M4 14h16M10 4v16M14 4v16"/>
        </svg>
      </button>
      <button className="btn iconOnly" title="Import JSON (dane)" onClick={() => jsonDataFileRef.current?.click()} aria-label="Import JSON">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 4c-3 0-4 2-4 4v2c0 1.1-.9 2-2 2 1.1 0 2 .9 2 2v2c0 2 1 4 4 4"/>
          <path d="M14 4c3 0 4 2 4 4v2c0 1.1.9 2 2 2-1.1 0-2 .9-2 2v2c0 2-1 4-4 4"/>
        </svg>
      </button>
      <input ref={csvFileRef} type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={handleCsvDataImport} />
      <input ref={jsonDataFileRef} type="file" accept=".json,application/json" style={{display:'none'}} onChange={handleJsonDataImport} />
    </span>
  );
}
