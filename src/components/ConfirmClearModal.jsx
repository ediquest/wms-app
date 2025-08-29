import React, { useEffect, useState } from 'react';
import LightModal from './LightModal';
import { t } from '../i18n.js';

export default function ConfirmClearModal({ open, onClose, onConfirm, title, message, confirmText, checkboxLabel, checkboxDefault = true }){
  const [checked, setChecked] = useState(checkboxDefault ?? true);
  useEffect(() => { if (open) setChecked(checkboxDefault ?? true); }, [open, checkboxDefault]);
  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="danger" onClick={() => onConfirm?.({ checked })}>{confirmText || t('clear')}</button>
    </>
  );
  return (
    <LightModal open={open} onClose={onClose} title={title || t('clear')} footer={footer}>
      <div className="muted" style={{lineHeight:1.5}}>
        {message || (t('confirmClearAll') || 'Clear all generated tabs and values for this interface?')}
      </div>
    {checkboxLabel ? (
        <label className="form-row" style={{ marginTop: 12, display:'flex', gap:8, alignItems:'center' }}>
          <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} />
          <span>{checkboxLabel}</span>
        </label>
      ) : null}
    </LightModal>
  );
}
