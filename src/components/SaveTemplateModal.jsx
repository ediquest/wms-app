import React, { useState, useEffect } from 'react';
import LightModal from '../components/LightModal.jsx';
import { t } from '../i18n.js';

export default function SaveTemplateModal({ open, onClose, onSubmit }){
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  useEffect(()=>{ if(open){ setName(''); setErr(''); } }, [open]);

  const submit = () => {
    const trimmed = (name || '').trim();
    if (!trimmed) { setErr(t('templateNameRequired') || t('enterName') || 'Podaj nazwę.'); return; }
    onSubmit?.(trimmed);
  };

  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="primary" onClick={submit}>{t('save') || 'Zapisz'}</button>
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={t('saveAsTemplate') || 'Zapisz jako schemat'} footer={footer}>
      <label className="form-row" style={{display:'block'}}>
        <div className="label">{t('templateNameLabel') || t('templateNamePrompt') || 'Nazwa szablonu'}</div>
        <input
          type="text"
          value={name}
          onChange={e=>{ setName(e.target.value); if(err) setErr(''); }}
          placeholder={t('templateNamePrompt') || 'Nazwa szablonu'}
        />
        {err ? <div className="error">{err}</div> : null}
      </label>
    </LightModal>
  );
}
