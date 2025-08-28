import React, { useState } from 'react';
import LightModal from './LightModal';
import { t } from '../i18n.js';

/**
 * DeleteInterfaceModal
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onConfirm: fn({ removeValues: boolean })
 *  - target: { id, name } | null
 */
export default function DeleteInterfaceModal({ open, onClose, onConfirm, target }){
  const [removeValues, setRemoveValues] = useState(true);

  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="danger" onClick={() => onConfirm?.({ removeValues })}>
        {t('delete')}
      </button>
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={t('deleteInterface')} footer={footer}>
      {!target ? null : (
        <div className="grid" style={{gridTemplateColumns:'1fr', gap:12}}>
          <div className="muted">
            <div style={{marginBottom:6}}>{t('confirmDeleteInterface')}</div>
            <div style={{opacity:.85}}>
              <div><strong>ID:</strong> {target.id}</div>
              {target.name ? <div><strong>{t('nameLabel')||'Name'}:</strong> {target.name}</div> : null}
            </div>
            <div style={{marginTop:8, color:'var(--danger, #ff9ea3)'}}>{t('cannotUndo')}</div>
          </div>

          <label className="form-row" style={{display:'flex', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={removeValues} onChange={e=>setRemoveValues(e.target.checked)} />
            <span>{t('alsoDeleteValues')}</span>
          </label>
        </div>
      )}
    </LightModal>
  );
}
