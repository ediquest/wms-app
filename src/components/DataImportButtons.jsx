import React, { useRef, useState } from 'react';
import { saveConfig } from '../utils';
import LightModal from './LightModal';
import { parseInterfaceFromWorkbook, isValidXlsFileName, inferTypeFromName, suggestIdFromFilename } from '../utils/parseXlsInterface.js';
import * as XLSX from 'xlsx';

/** Ikony + modale do importu CSV/JSON; pola FLEX, wszystko w sekcji 1 */
export default function DataImportButtons({ cfg, setCfg, t }) {
  // refs
  const jsonDataFileRef = useRef(null);
  const csvDataFileRef  = useRef(null);
  const xlsInputRef = useRef(null);

  // XLS modal state
  const [showXlsModal, setShowXlsModal] = useState(false);
  const [xlsItems, setXlsItems] = useState([]); // {file, name, valid, reason, type, iface|null}

  // ----- helpers -----
  const baseNameOf = (fname) => String(fname||'').replace(/\.[^.]+$/, '');

  const slugifyId = (name) =>
    (String(name||'iface')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0,40)) ||
    (Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4));

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
      const key = prefix ? `${prefix}.${k}` : k;
      if (isPlainObject(v) && depth>0) flattenKeys(v, key, out, depth-1);
      else out.add(key);
    }
    return out;
  };
  const getAtPath = (obj, path) => {
    try { return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : '', obj); }
    catch { return ''; }
  };

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
      sections: ['Introduction', secName],
      sectionNumbers: ['000','010'],
      includedSections: [false, true],
      sectionColors: ['', ''],
      fieldSections: Array(n).fill(1),
      separators: [],
      flexFields: Array(n).fill(true), // FLEX dla wszystkich pól
    };
  }

  // ---------- JSON ----------
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonFile, setJsonFile] = useState(null);
  const [jsonDupWarn, setJsonDupWarn] = useState(false);
  const [jsonParseError, setJsonParseError] = useState('');

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

  function onImportJson(){
    setJsonParseError('');
    const f = jsonFile; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const obj = JSON.parse(String(reader.result||'{}'));
        const iface = jsonDataToInterface(obj, f.name);
        const next = { ...cfg, interfaces: (cfg.interfaces||[]).concat(iface) };
        setCfg(next); saveConfig(next);
        setShowJsonModal(false); setJsonFile(null);
        }catch(err){ console.error(err); setJsonParseError(t?.('invalidJson') || 'Nieprawidłowy JSON.'); }
    };
    reader.readAsText(f);
  }

  // ---------- CSV ----------
  const [showCsvModal, setShowCsvModal]   = useState(false);
  const [csvFile, setCsvFile]             = useState(null);
  const [csvSep, setCsvSep]               = useState('auto'); // 'auto' | ',' | ';' | '\t' | '|'
  const [csvHasHeader, setCsvHasHeader]   = useState(true);
  const [csvDupWarn, setCsvDupWarn]       = useState(false);
  const [csvError, setCsvError]           = useState('');

  const detectSep = (line) => {
    const cands = [',',';','\t','|'];
    let best=',', bestCount=0;
    for (const s of cands){ const cnt=(line.split(s).length-1); if (cnt>bestCount){ best=s; bestCount=cnt; } }
    return best;
  };

  function csvToInterfaceFromText(text, fname, opts={}){
    const lines = String(text).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if (!lines.length) throw new Error('Empty CSV');
    const sep = opts.sep && opts.sep !== 'auto'
      ? (opts.sep === '\t' ? '\t' : opts.sep)
      : detectSep(lines[0]);

    let header = opts.hasHeader ? lines.shift().split(sep) : [];
    if (!opts.hasHeader){
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
    const id   = ensureUniqueId(slugifyId(base || 'csv-interface'), cfg);
    const labels = header.map(h => String(h||'').trim() || 'Pole');

    return makeInterface({ id, name, labels, lengths, types });
  }

  function onImportCsv(){
    setCsvError('');
    const f = csvFile; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try{
        const iface = csvToInterfaceFromText(r.result, f.name, { hasHeader: csvHasHeader, sep: csvSep });
        const next = { ...cfg, interfaces: (cfg.interfaces||[]).concat(iface) };
        setCfg(next); saveConfig(next);
        setShowCsvModal(false); setCsvFile(null);
        }catch(err){ console.error(err); setCsvError(t?.('invalidCsv') || 'Nie udało się sparsować CSV.'); }
    };
    r.readAsText(f);
  }

  
  // ---------- XLS import ----------
  function validateXlsFile(f){
    const name = String(f?.name||'');
    if (!isValidXlsFileName(name)){
      const okExt = /\.xls$/i.test(name);
      const okPrefix = String(name).toUpperCase().startsWith('EN_INT_WB');
      return { ok:false, reason: !okPrefix ? (t?.('xlsInvalidPrefix') || 'Nazwa musi zaczynać się od \"EN_INT_WB\"') : (t?.('xlsInvalidExt') || 'Dozwolone tylko .xls') };
    }
    return { ok:true, reason:'' };
  }

  function addXlsFiles(files){
    const arr = Array.from(files||[]);
    if (!arr.length) return;
    const next = [...xlsItems];
    arr.forEach(f => {
      const v = validateXlsFile(f);
      const name = String(f.name||'');
      const type = inferTypeFromName(name);
      next.push({ file: f, name, valid: v.ok, reason: v.reason, type, iface: null, parsing: v.ok });
      if (v.ok){
        const reader = new FileReader();
        reader.onload = () => {
          try{
            const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array' });
            const stem = name.replace(/\.[^.]+$/, '');
            const iface = parseInterfaceFromWorkbook(wb, stem);
            iface.id = ensureUniqueId(suggestIdFromFilename(stem), cfg);
            iface.name = ensureUniqueName(stem, cfg);
            iface.ifaceType = type;
            // App will normalize later; keep sections as-is
            const idx = next.findIndex(it => it.file === f);
            if (idx >= 0){ next[idx] = { ...next[idx], iface, parsing: false }; setXlsItems([...next]); }
          }catch(err){
            console.error('XLS parse error', err);
            const idx = next.findIndex(it => it.file === f);
            if (idx >= 0){ next[idx] = { ...next[idx], parsing: false, valid: false, reason: t?.('xlsParseError') || 'Błąd parsowania pliku XLS' }; setXlsItems([...next]); }
          }
        };
        reader.readAsArrayBuffer(f);
      }
    });
    setXlsItems(next);
  }

  function resetXls(){
    setXlsItems([]);
  }

  function onImportXlsAll(){
    const good = xlsItems.filter(it => it.valid && it.iface);
    if (!good.length) return;
    const next = { ...cfg, interfaces: [...(cfg.interfaces||[]), ...good.map(it => it.iface)] };
    setCfg(next); saveConfig(next);
    setShowXlsModal(false); resetXls();
    }
  // ---------- UI ----------
  return (
    <>
      {/* Notice (po imporcie) */}{/* Modal: JSON */}
      <LightModal
        open={showJsonModal}
        onClose={()=>setShowJsonModal(false)}
        title={t?.('importJsonTitle') || 'Import JSON'}
        footer={
          <>
            <button className="btn" onClick={()=>setShowJsonModal(false)}>{t?.('cancel') || 'Anuluj'}</button>
            <button className="btn primary" disabled={!jsonFile} onClick={onImportJson}>{t?.('importJson') || 'Import JSON'}</button>
          </>
        }
      >
        <div className="row" style={{marginBottom:12}}>
          <div className="hint">{t?.('chooseJson') || 'Wybierz plik JSON do importu'}</div>
          <span className="spacer" />
          <button className="btn" onClick={()=>jsonDataFileRef.current?.click()}>{t?.('chooseFile') || 'Wybierz plik'}</button>
        </div>
        <div
          className="dropzone"
          onDragOver={(e)=>{e.preventDefault();}}
          onDrop={(e)=>{
            e.preventDefault();
            const f=e.dataTransfer.files?.[0]; if(!f) return;
            setJsonFile(f);
            setJsonDupWarn((cfg?.interfaces||[]).some(it => it.name === baseNameOf(f.name)));
            setJsonParseError('');
          }}
        >
          <div style={{marginBottom:6}}>{jsonFile ? jsonFile.name : (t?.('dropHere') || 'Przeciągnij plik tutaj lub kliknij „Wybierz plik”.')}</div>
          {jsonDupWarn    ? <div className="hint" style={{color:'var(--accent, #3aa1ff)'}}>{t?.('duplicateNameWarn') || 'Interfejs o tej nazwie już istnieje — zostanie dodana kopia.'}</div> : null}
          {jsonParseError ? <div className="hint" style={{color:'#ff7a7a'}}>{jsonParseError}</div> : null}
        </div>
        <input ref={jsonDataFileRef} type="file" accept=".json,application/json" style={{display:'none'}}
          onChange={(e)=>{ const f = e.target.files?.[0]; if (f){ setJsonFile(f); setJsonDupWarn((cfg?.interfaces||[]).some(it => it.name === baseNameOf(f.name))); setJsonParseError(''); } }} />
      </LightModal>

      {/* Modal: CSV */}
      <LightModal
        open={showCsvModal}
        onClose={()=>setShowCsvModal(false)}
        title={t?.('importCsvTitle') || 'Import CSV'}
        footer={
          <>
            <button className="btn" onClick={()=>setShowCsvModal(false)}>{t?.('cancel') || 'Anuluj'}</button>
            <button className="btn primary" disabled={!csvFile} onClick={onImportCsv}>{t?.('importCsv') || 'Import CSV'}</button>
          </>
        }
      >
        <div className="row" style={{marginBottom:12}}>
          <div className="hint">{t?.('chooseCsv') || 'Wybierz plik CSV do importu'}</div>
          <span className="spacer" />
          <button className="btn" onClick={()=>csvDataFileRef.current?.click()}>{t?.('chooseFile') || 'Wybierz plik'}</button>
        </div>

        <div className="row" style={{gap:12, marginBottom:12}}>
          <label className="row" style={{gap:6}}>
            <span className="hint" style={{minWidth:90}}>{t?.('csvSeparator') || 'Separator'}</span>
            <select value={csvSep} onChange={(e)=>setCsvSep(e.target.value)}>
              <option value="auto">Auto</option>
              <option value=",">,</option>
              <option value=";">;</option>
              <option value="\t">TAB</option>
              <option value="|">|</option>
            </select>
          </label>
          <label className="row" style={{gap:6}}>
            <input type="checkbox" checked={csvHasHeader} onChange={(e)=>setCsvHasHeader(e.target.checked)} />
            <span className="hint">{t?.('csvHasHeader') || 'Czy CSV ma nagłówek w 1. linii?'}</span>
          </label>
        </div>

        <div
          className="dropzone"
          onDragOver={(e)=>{e.preventDefault();}}
          onDrop={(e)=>{
            e.preventDefault();
            const f=e.dataTransfer.files?.[0]; if(!f) return;
            setCsvFile(f);
            setCsvDupWarn((cfg?.interfaces||[]).some(it => it.name === baseNameOf(f.name)));
            setCsvError('');
          }}
        >
          <div style={{marginBottom:6}}>{csvFile ? csvFile.name : (t?.('dropHere') || 'Przeciągnij plik tutaj lub kliknij „Wybierz plik”.')}</div>
          {csvDupWarn ? <div className="hint" style={{color:'var(--accent, #3aa1ff)'}}>{t?.('duplicateNameWarn') || 'Interfejs o tej nazwie już istnieje — zostanie dodana kopia.'}</div> : null}
          {csvError   ? <div className="hint" style={{color:'#ff7a7a'}}>{csvError}</div> : null}
        </div>
        <input ref={csvDataFileRef} type="file" accept=".csv,text/csv" style={{display:'none'}}
          onChange={(e)=>{ const f = e.target.files?.[0]; if (f){ setCsvFile(f); setCsvDupWarn((cfg?.interfaces||[]).some(it => it.name === baseNameOf(f.name))); setCsvError(''); } }} />
      </LightModal>


      {/* Modal: XLS */}
      <LightModal
        open={showXlsModal}
        onClose={()=>{ setShowXlsModal(false); resetXls(); }}
        title={t?.('importXlsTitle') || 'Import XLS (interfejs)'}
        footer={
          <>
            <button className="btn" onClick={()=>{ setShowXlsModal(false); resetXls(); }}>{t?.('cancel') || 'Anuluj'}</button>
            <button className="btn primary" disabled={!xlsItems.some(it => it.valid && it.iface)} onClick={onImportXlsAll}>{t?.('importAll') || 'Importuj wszystko'}</button>
          </>
        }
      >
        <div className="row" style={{marginBottom:12}}>
          <div className="hint">{t?.('chooseXls') || 'Wybierz plik(i) XLS do importu'}</div>
          <span className="spacer" />
          <button className="btn" onClick={()=>xlsInputRef.current?.click()}>{t?.('chooseFile') || 'Wybierz plik'}</button>
          <input ref={xlsInputRef} type="file" accept=".xls" multiple style={{display:'none'}}
            onChange={(e)=>{ addXlsFiles(e.target.files); e.currentTarget.value=''; }} />
        </div>
        <div
          className="dropzone"
          style={{ minHeight: 220, padding: 16 }}
          onDragOver={(e)=>{e.preventDefault();}}
          onDrop={(e)=>{ e.preventDefault(); addXlsFiles(e.dataTransfer.files); }}
        >
          <div className="hint">{t?.('xlsDropHint') || 'Przeciągnij pliki .xls tutaj (nazwa musi zaczynać się od EN_INT_WB)'}</div>
        </div>

        <div style={{marginTop:12, maxHeight:260, overflow:'auto'}}>
          {!xlsItems.length ? <div className="hint">{t?.('noFiles') || 'Brak plików.'}</div> : null}
          {xlsItems.map((it, idx) => (
            <div key={idx} className="row" style={{ gap: 8, alignItems:'center', borderBottom:'1px solid var(--border)', padding:'6px 0' }}>
              <div style={{minWidth:220}}><strong>{it.name}</strong></div>
              <div style={{minWidth:70}}>{t?.('xlsType') || 'Typ'}: <strong>{it.type}</strong></div>
              <div className="hint" style={{flex:1}}>
                {it.parsing ? (t?.('parsing') || 'Parsowanie…')
                  : it.valid ? (it.iface ? (t?.('xlsParsedOk') || 'OK') : (t?.('pending') || 'Oczekuje…'))
                  : <span style={{color:'#c33'}}>{it.reason || (t?.('invalidFile') || 'Niepoprawny plik')}</span>}
              </div>
            </div>
          ))}
        </div>
      </LightModal>

      {/* Przyciski w pasku */}
      <span style={{ display: 'inline-flex', gap: 8, marginLeft: 8 }}>
        <button className="btn iconOnly" title="Import CSV" onClick={() => { setShowCsvModal(true); setCsvFile(null); setCsvError(''); setCsvDupWarn(false); }} aria-label="Import CSV">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <path d="M4 10h16M4 14h16M10 4v16M14 4v16"/>
          </svg>
        </button>
        <button className="btn iconOnly" title="Import JSON (dane)" onClick={() => { setShowJsonModal(true); setJsonFile(null); setJsonParseError(''); setJsonDupWarn(false); }} aria-label="Import JSON">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 4c-3 0-4 2-4 4v2c0 1.1-.9 2-2 2 1.1 0 2 .9 2 2v2c0 2 1 4 4 4"/>
            <path d="M14 4c3 0 4 2 4 4v2c0 1.1.9 2 2 2-1.1 0-2 .9-2 2v2c0 2-1 4-4 4"/>
          </svg>
        </button>
        <button className="btn iconOnly" title="Import XLS (interfejs)" onClick={() => { setShowXlsModal(true); }} aria-label="Import XLS">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M4 9h16M8 3v18"/>
            <path d="M12 14l2 3 3-6"/>
          </svg>
        </button>
      </span>
    </>
  );
}
