import React, { useEffect, useState } from 'react';
import LightModal from './LightModal';
import { t } from '../i18n.js';

/**
 * RenameCategoryModal
 * Props:
 *  - open: boolean
 *  - target: { id, name } | null
 *  - onClose: fn()
 *  - onSubmit: fn({ id, name })
 */
export default function RenameCategoryModal({ open, target, onClose, onSubmit }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open && target) setName(target.name || '');
  }, [open, target]);

  const nameError = !name.trim() ? (t('errCatNameRequired') || t('errNameRequired')) : '';

  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button type="button" disabled={!!nameError} onClick={() => {
        if (nameError) return;
        onSubmit?.({ id: target?.id, name: name.trim() });
        onClose?.();
      }}>{t('renameCategory') || t('rename') || 'Rename'}</button>
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={t('renameCategory')} footer={footer}>
      {!target ? null : (
        <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
          <div className="muted">
            <div><strong>ID:</strong> {target.id}</div>
          </div>
          <label className="form-row">
            <div className="muted">{t('nameLabel')}</div>
            <input value={name} onChange={(e)=>setName(e.target.value)} placeholder={t('namePlaceholder')} />
            {nameError ? <div className="muted" style={{ color: '#f99' }}>{nameError}</div> : null}
          </label>
        </div>
      )}
    </LightModal>
  );
}
