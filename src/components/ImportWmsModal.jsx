import React, { useMemo, useRef, useState } from 'react';
import LightModal from './LightModal';
import { t } from '../i18n.js';

/**
 * ImportWmsModal
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onImport: fn(data, mode, targetId)
 *  - interfaces: [{id,name}] // for overwrite selection
 *  - status: {kind:'success'|'error', key:string} | null
 */
export default function ImportWmsModal({ open, onClose, onImport, interfaces = [], status }){
  const [mode, setMode] = useState('add'); // 'add' | 'overwrite'
  const [targetId, setTargetId] = useState('');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return { ok:false, error:'', type:'', payload:null };
    try {
      const raw = String(text).replace(/^\uFEFF/, '');
      const obj = JSON.parse(raw);
      let type = 'unknown';
      if (obj && Array.isArray(obj.interfaces)) type = 'bundleInterfaces';
      else if (Array.isArray(obj) && obj.length && obj[0] && Array.isArray(obj[0].sections)) type = 'multipleInterfaces';
      else if (obj && Array.isArray(obj.sections)) type = 'singleInterface';
      return { ok:true, error:'', type, payload:obj };
    } catch (e) {
      return { ok:false, error:t('invalidJson') || 'Invalid JSON', type:'', payload:null };
    }
  }, [text]);

  const counts = useMemo(() => {
    if (!parsed.ok) return null;
    const o = parsed.payload;
    let i = 0;
    if (parsed.type === 'bundleInterfaces') i = Array.isArray(o.interfaces) ? o.interfaces.length : 0;
    else if (parsed.type === 'multipleInterfaces') i = Array.isArray(o) ? o.length : 0;
    else if (parsed.type === 'singleInterface') i = 1;
    return { i };
  }, [parsed]);

  const readFile = (f) => {
    const r = new FileReader();
    r.onload = () => { setText(String(r.result||'')); setFileName(f.name||''); };
    r.readAsText(f);
  };
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    const f = e.dataTransfer?.files?.[0];
    if (f) readFile(f);
  };

  const footer = (
    <>
      {status ? (
        <button type="button" onClick={onClose}>{t('close') || t('ok') || 'OK'}</button>
      ) : (
        <>
          <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
          <button type="button" disabled={!parsed.ok || (mode==='overwrite' && !targetId)} onClick={() => onImport?.(parsed.payload, mode, targetId)}>
            {t('import')}
          </button>
        </>
      )}
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={t('importWmsTitle') || t('import')} footer={footer}>
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div className="form-row" style={{gridColumn:'span 1'}}>
          <div className="muted">{t('importMode')}</div>
          <div style={{display:'flex',gap:12}}>
            <label style={{display:'flex',alignItems:'center',gap:8}}>
              <input type="radio" name="wmsMode" checked={mode==='add'} onChange={()=>setMode('add')} />
              <span>{t('importAddNew')}</span>
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8}}>
              <input type="radio" name="wmsMode" checked={mode==='overwrite'} onChange={()=>setMode('overwrite')} />
              <span>{t('importOverwriteSelected')}</span>
            </label>
          </div>
        </div>

        <div className="form-row" style={{gridColumn:'span 1'}}>
          <div className="muted">{t('chooseFile')}</div>
          <div
            onDragOver={e=>{e.preventDefault(); e.stopPropagation();}}
            onDrop={onDrop}
            style={{border:'1px dashed var(--border, #1b2447)', borderRadius:10, padding:16, textAlign:'center', userSelect:'none'}}
          >
            <div style={{opacity:.85, marginBottom:8}}>{t('dropJsonHere')}</div>
            <button className="ghost" type="button" onClick={()=>fileRef.current?.click()}>{t('chooseFile')}</button>
            <input ref={fileRef} type="file" accept="application/json" onChange={e=>{
              const f = e.target.files && e.target.files[0];
              if (f) readFile(f);
              e.target.value='';
            }} style={{display:'none'}}/>
            {fileName ? <div className="muted" style={{marginTop:8}}>{fileName}</div> : null}
          </div>
        </div>

        {mode==='overwrite' && (
          <label className="form-row" style={{gridColumn:'1 / -1'}}>
            <div className="muted">{t('chooseTargetInterface')}</div>
            <select value={targetId} onChange={e=>setTargetId(e.target.value)}>
              <option value="">{'—'}</option>
              {interfaces.map(i => <option key={i.id} value={i.id}>{i.name || i.id}</option>)}
            </select>
          </label>
        )}

        <label className="form-row" style={{gridColumn:'1 / -1'}}>
          <div className="muted">{t('orPasteJson')}</div>
          <textarea rows={6} value={text} onChange={e=>setText(e.target.value)} placeholder="{ /* JSON */ }" />
        </label>

        <div className="form-row" style={{gridColumn:'1 / -1'}}>
          <div className="muted">{t('detected')}</div>
          {!parsed.ok ? (
            <div className="muted" style={{color:'#f99'}}>{parsed.error || t('invalidJson')}</div>
          ) : (
            <div className="muted">
              <div style={{marginBottom:6}}>
                {parsed.type === 'bundleInterfaces' && (t('detectedBundle') || 'Interfaces bundle')}
                {parsed.type === 'multipleInterfaces' && (t('detectedBundle') || 'Multiple interfaces')}
                {parsed.type === 'singleInterface' && (t('detectedSingleInterface') || 'Single interface')}
                {parsed.type === 'unknown' && (t('invalidJson') || 'Invalid JSON')}
              </div>
              {counts && (
                <div>
                  <span style={{marginRight:12}}>{t('interfaces') || 'Interfaces'}: {counts.i}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {status && (
          <div className="form-row" style={{gridColumn:'1 / -1'}}>
            <div
              style={{
                border: '1px solid ' + (status.kind === 'success' ? 'rgba(56,176,0,.45)' : 'rgba(255,64,64,.45)'),
                background: status.kind === 'success' ? 'rgba(56,176,0,.12)' : 'rgba(255,64,64,.12)',
                color: status.kind === 'success' ? '#b8ffb8' : '#ffb8b8',
                borderRadius: 10,
                padding: 12
              }}
            >
              {t(status.key) || (status.kind==='success' ? 'Done.' : 'Error.')}
            </div>
          </div>
        )}
      </div>
    </LightModal>
  );
}
