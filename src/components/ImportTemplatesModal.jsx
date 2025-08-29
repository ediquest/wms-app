import React, { useMemo, useRef, useState } from 'react';
import LightModal from './LightModal.jsx';
import { t } from '../i18n.js';

export default function ImportTemplatesModal({ open, onClose, onParsed, onError, onImport, existing=[] }){
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const inputRef = useRef(null);
  const pillStyle = { borderRadius: 6 };

  const extractTemplates = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.templates)) return data.templates;
    if (Array.isArray(data.items)) return data.items;
    const candidates = ['list','records','schemas','schemes','data','payload','templatesList'];
    for (const k of candidates) {
      const v = data[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v==='object' && Array.isArray(v.templates)) return v.templates;
      if (v && typeof v==='object' && Array.isArray(v.items)) return v.items;
    }
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v) && v.some(x => x && typeof x==='object')) return v;
      if (v && typeof v==='object') {
        for (const [kk, vv] of Object.entries(v)) {
          if (Array.isArray(vv) && vv.some(x => x && typeof x==='object')) return vv;
        }
      }
    }
    return [];
  };

  const list = useMemo(() => {
    if (!parsed) return [];
    const arr = extractTemplates(parsed);
    const safe = Array.isArray(arr) ? arr : [];
    return safe;
  }, [parsed]);

  const previewNames = useMemo(() => {
    return (list || []).map(x => (x && (x.name || x.title || x.id)) ? (x.name || x.title || String(x.id)) : t('unnamed'));
  }, [list]);

  const stats = useMemo(() => {
    const ex = Array.isArray(existing) ? existing : [];
    const byId = new Map();
    const byName = new Map();
    ex.forEach(x => {
      const id = x && x.id; if (id) byId.set(String(id), true);
      const nm = (x && (x.name||x.title)) ? String(x.name||x.title).trim().toLowerCase() : '';
      if (nm) byName.set(nm, true);
    });
    let dupId=0, dupName=0, willAdd=0, willOverwrite=0;
    (list||[]).forEach(x => {
      const id = x && x.id ? String(x.id) : '';
      const nm = (x && (x.name||x.title)) ? String(x.name||x.title).trim().toLowerCase() : '';
      const idDup = id && byId.has(id);
      const nameDup = nm && byName.has(nm);
      if (idDup) dupId++;
      if (nameDup) dupName++;
      const isDup = idDup || nameDup;
      if (isDup && replaceMode) willOverwrite++;
      else willAdd++;
    });
    return { dupId, dupName, willAdd, willOverwrite, total: (list||[]).length };
  }, [list, existing, replaceMode]);

  const handleText = (tx) => {
    try {
      const data = JSON.parse(tx);
      setParsed(data);
      onParsed?.(data);
    } catch (e) {
      try { console.error('[ImportTemplatesModal] parse error', e); } catch {}
      setParsed(null);
      onError?.(t('importInvalid') || 'Invalid file');
    }
  };

  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    setFileName(f.name || '');
    const tx = await f.text();
    handleText(tx);
  };

  const onPick = async (e) => {
    const f = e.target?.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFileName(f.name || '');
    const tx = await f.text();
    handleText(tx);
  };

  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button type="button" disabled={!parsed} onClick={()=> onImport?.(parsed, { replace: replaceMode })}>
        {t('import') || 'Importuj'}
      </button>
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={t('importTemplatesTitle') || (t('importTemplates')||'Importuj schematy')} footer={footer}>
      <div
        onDragEnter={(e)=>{e.preventDefault(); setDragOver(true);}}
        onDragOver={(e)=>{e.preventDefault(); setDragOver(true);}}
        onDragLeave={(e)=>{e.preventDefault(); setDragOver(false);}}
        onDrop={onDrop}
        className={"dropzone" + (dragOver ? " over" : "")}
        style={{border:'1px dashed var(--hairline)', borderRadius:12, padding:16, textAlign:'center', marginBottom:12}}
      >
        <div className="muted" style={{marginBottom:8}}>{t('dropJsonHere') || 'Upuść plik JSON tutaj lub'}</div>
        <button type="button" className="ghost" onClick={()=> inputRef.current?.click()}>{t('chooseFile') || 'Wybierz plik'}</button>
        <input ref={inputRef} type="file" accept="application/json" style={{display:'none'}} onChange={onPick} />
        {fileName ? <div style={{marginTop:8}} className="muted">{fileName}</div> : null}
      </div>

      <div className="stats" style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:8}}>
        <div className="pill" style={pillStyle}>{(t('detectedTemplates')||'Wykryte schematy') + ': ' + (stats.total || 0)}</div>
        <div className="pill" style={pillStyle}>{(t('willAdd')||'Doda') + ': ' + (stats.willAdd || 0)}</div>
        <div className="pill" style={pillStyle}>{(t('willOverwrite')||'Nadpisze') + ': ' + (stats.willOverwrite || 0)}</div>
        <div className="pill warn" style={pillStyle}>{(t('idDuplicates')||'Duplikaty ID') + ': ' + (stats.dupId || 0)}</div>
        <div className="pill warn" style={pillStyle}>{(t('nameDuplicates')||'Duplikaty nazw') + ': ' + (stats.dupName || 0)}</div>
      </div>

      <label style={{display:'flex',alignItems:'center',gap:8, marginBottom:10}}>
        <input type="checkbox" checked={replaceMode} onChange={e=>setReplaceMode(e.target.checked)} />
        <span>{t('replaceExisting') || 'Zastąp istniejące (po ID/nazwie)'}</span>
      </label>

      {previewNames.length ? (
        <div className="card" style={{maxHeight:180, overflow:'auto', padding:12}}>
          <div className="muted" style={{marginBottom:6}}>{t('previewTemplates') || 'Podgląd nazw schematów'}</div>
          <ul style={{display:'grid', gap:6, listStyle:'none', padding:0, margin:0}}>
            {previewNames.slice(0, 30).map((name, idx) => (
              <li key={idx} className="row" style={{display:'flex', alignItems:'center', gap:8}}>
                <span className="pill" style={{minWidth:22, textAlign:'center', borderRadius:6}}>{idx+1}</span>
                <span>{name}</span>
              </li>
            ))}
          </ul>
          {previewNames.length>30 ? <div className="muted" style={{marginTop:8}}>{((t('andMore')||'+{count} more…')).replace('{count}', String(previewNames.length-30))}</div> : null}
        </div>
      ) : null}
    </LightModal>
  );
}
