import React, { useEffect, useMemo, useState } from 'react';
import LightModal from './LightModal';
import { t } from '../i18n.js';

/**
 * AddInterfaceModal
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - categories: [{id,name}]
 *  - interfaces: [{id,name}]
 *  - onSubmit: fn({ id, name, categoryId, cloneId|null })
 */
export default function AddInterfaceModal({ open, onClose, categories=[], interfaces=[], onSubmit }){
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [cloneId, setCloneId] = useState('');

  useEffect(() => {
    if (!open) return;
    setId('');
    setName('');
    setCategoryId(categories[0]?.id || '');
    setCloneId('');
  }, [open, categories]);

  const takenIds = useMemo(() => new Set(interfaces.map(i => i.id)), [interfaces]);
  const idError = useMemo(() => {
    if (!id.trim()) return t('errIdRequired');
    if (!/^[a-z0-9_-]+$/i.test(id.trim())) return t('errIdFormat');
    if (takenIds.has(id.trim())) return t('errIdTaken');
    return '';
  }, [id, takenIds]);

  const nameError = useMemo(() => {
    if (!name.trim()) return t('errNameRequired');
    return '';
  }, [name]);
  const categoryError = useMemo(() => {
    if (!categoryId) return t('errCategoryRequired');
    return '';
  }, [categoryId]);


  const canSave = idError === '' && nameError === '' && categoryError === '';

  const footer = (
    <>
      <button className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button disabled={!canSave} onClick={() => {
        if (!canSave) return;
        onSubmit?.({ id: id.trim(), name: name.trim(), categoryId, cloneId: cloneId || null });
        onClose?.();
      }}>{t('newInterfaceTitle')}</button>
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={t('newInterfaceTitle')} footer={footer}>
      <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
        <label className="form-row" style={{gridColumn:'span 1'}}>
          <div className="muted">{t('idUnique')}</div>
          <input autoFocus value={id} onChange={e=>setId(e.target.value)} placeholder={t('idPlaceholder')} />
          {idError ? <div className="muted" style={{color:'#f99'}}>{idError}</div> : null}
        </label>
        <label className="form-row" style={{gridColumn:'span 1'}}>
          <div className="muted">{t('nameLabel')}</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder={t('namePlaceholder')} />
          {nameError ? <div className="muted" style={{color:'#f99'}}>{nameError}</div> : null}
        </label>
        <label className="form-row" style={{gridColumn:'span 1'}}>
          <div className="muted">{t('categoryLabel')}</div>
          <select value={categoryId} onChange={e=>setCategoryId(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
          </select>

        </label>
        <label className="form-row" style={{gridColumn:'span 1'}}>
          <div className="muted">{t('copyFromExisting')}</div>
          <select value={cloneId} onChange={e=>setCloneId(e.target.value)}>
            <option value="">{'— ' + t('none' || 'None') + ' —'}</option>
            {interfaces.map(it => <option key={it.id} value={it.id}>{it.id} – {it.name}</option>)}
          </select>

        </label>
      </div>
    </LightModal>
  );
}
