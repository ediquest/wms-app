import React, { useMemo, useRef, useState } from 'react';
import LightModal from './LightModal';
import { t } from '../i18n.js';

/**
 * ImportBackupModal
 * UI-only: reads JSON (drop/file/paste), shows a summary, lets user choose mode (merge/replace),
 * and calls onImport(data, mode).
 *
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onImport: fn(data, mode) // mode: 'merge' | 'replace'
 */
export default function ImportBackupModal({ open, onClose, onImport, status }){
  const [mode, setMode] = useState('merge');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const parsed = useMemo(() => {
    if (!text.trim()) return { ok:false, error:'', type:'', payload:null };
    try {
      const obj = JSON.parse(String(text).replace(/^\uFEFF/, ''));
      // Detect type
      let type = 'unknown';
      if (obj && obj._type === 'tcf_full_backup' && obj.config && obj.values) type = 'full';
      else if (obj && obj.config && obj.values) type = 'fullLike';
      else if (Array.isArray(obj?.interfaces) || Array.isArray(obj?.categories)) type = 'bundle';
      else if (obj && Array.isArray(obj.sections)) type = 'singleInterface';
      return { ok:true, error:'', type, payload:obj };
    } catch (e) {
      return { ok:false, error:t('invalidJson') || 'Invalid JSON', type:'', payload:null };
    }
  }, [text]);

  const counts = useMemo(() => {
    if (!parsed.ok) return null;
    const o = parsed.payload || {};
    // Choose root depending on detected type
    const root = (parsed.type === 'full' || parsed.type === 'fullLike') ? (o.config || {}) : o;
    let i = 0;
    let c = 0;
    if (Array.isArray(root.interfaces)) i = root.interfaces.length;
    else if (Array.isArray(o.sections)) i = 1; // single interface format
    if (Array.isArray(root.categories)) c = root.categories.length;
    const hasVals = !!(o.values);
    return { i, c, hasVals };
  }, [parsed]);

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    readFile(f);
  };
  const readFile = (f) => {
    const r = new FileReader();
    r.onload = () => {
      setText(String(r.result||''));
      setFileName(f.name||'');
    };
    r.readAsText(f);
  };

  const footer = (
    <>
      {status ? (
        <button type="button" onClick={onClose}>{t('close') || t('ok') || 'OK'}</button>
      ) : (
        <>
          <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
          <button type="button" disabled={!parsed.ok} onClick={() => onImport?.(parsed.payload, mode)}>
            {t('import')}
          </button>
        </>
      )}
    </>
  );
return (
    <LightModal open={open} onClose={onClose} title={t('importBackupTitle') || t('importBackup')} footer={footer}>
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div className="form-row" style={{gridColumn:'span 1'}}>
          <div className="muted">{t('importMode')}</div>
          <div style={{display:'flex', gap:12}}>
            <label style={{display:'flex',alignItems:'center',gap:8}}>
              <input type="radio" name="bkMode" checked={mode==='merge'} onChange={()=>setMode('merge')} />
              <span>{t('mergeWithCurrent')}</span>
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8}}>
              <input type="radio" name="bkMode" checked={mode==='replace'} onChange={()=>setMode('replace')} />
              <span>{t('replaceAllConfig')}</span>
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
                {parsed.type === 'full' && (t('detectedFullBackup') || 'Full backup')}
                {parsed.type === 'fullLike' && (t('detectedConfigValues') || 'Config + values')}
                {parsed.type === 'bundle' && (t('detectedBundle') || 'Interfaces + categories')}
                {parsed.type === 'singleInterface' && (t('detectedSingleInterface') || 'Single interface')}
                {parsed.type === 'unknown' && (t('invalidJson') || 'Invalid JSON')}
              </div>
              {counts && (
                <div>
                  <span style={{marginRight:12}}>{t('interfaces')}: {counts.i}</span>
                  <span style={{marginRight:12}}>{t('categories') || t('kategorie') || 'Categories'}: {counts.c}</span>
                  <span>{t('values') || 'Values'}: {counts.hasVals ? (t('yes')||'yes') : (t('no')||'no')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      
        {/*STATUS_PANEL*/}
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
