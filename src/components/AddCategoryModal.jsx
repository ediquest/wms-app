import React, { useEffect, useMemo, useState } from 'react';
import LightModal from './LightModal';
import { t } from '../i18n.js';

/**
 * AddCategoryModal
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onSubmit: fn({ id, name })
 *  - categories: [{id,name}]
 */
export default function AddCategoryModal({ open, onClose, onSubmit, categories = [] }){
  const [id, setId] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    setId('');
    setName('');
  }, [open]);

  const takenIds = useMemo(() => new Set(categories.map(c => c.id)), [categories]);

  const idError = useMemo(() => {
    const v = id.trim();
    if (!v) return t('errCatIdRequired') || t('errIdRequired');
    if (!/^[a-z0-9_-]+$/i.test(v)) return t('errCatIdFormat') || t('errIdFormat');
    if (takenIds.has(v)) return t('errCatIdTaken') || t('errIdTaken');
    return '';
  }, [id, takenIds]);

  const nameError = useMemo(() => {
    if (!name.trim()) return t('errCatNameRequired') || t('errNameRequired');
    return '';
  }, [name]);

  const canSave = idError === '' && nameError === '';

  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button
        type="button"
        disabled={!canSave}
        onClick={() => {
          if (!canSave) return;
          onSubmit?.({ id: id.trim(), name: name.trim() });
          onClose?.();
        }}
      >
        {t('newCategoryTitle') || t('addCategory')}
      </button>
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={t('newCategoryTitle') || t('addCategory')} footer={footer}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label className="form-row" style={{ gridColumn: 'span 1' }}>
          <div className="muted">{t('idUnique')}</div>
          <input autoFocus value={id} onChange={e => setId(e.target.value)} placeholder={t('idPlaceholder')} />
          {idError ? <div className="muted" style={{ color: '#f99' }}>{idError}</div> : null}
        </label>

        <label className="form-row" style={{ gridColumn: 'span 1' }}>
          <div className="muted">{t('nameLabel')}</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('namePlaceholder')} />
          {nameError ? <div className="muted" style={{ color: '#f99' }}>{nameError}</div> : null}
        </label>
      </div>
    </LightModal>
  );
}
