import React, { useEffect, useState } from 'react';
import LightModal from './LightModal.jsx';
import { t } from '../i18n.js';

/**
 * AddSectionModal
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onSubmit: fn({ num, name })
 *  - suggestNumber?: string (3-digit)
 */
export default function AddSectionModal({ open, onClose, onSubmit, suggestNumber = '010' }){
  const [num, setNum] = useState('010');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    const raw = String(suggestNumber || '010').replace(/\D/g, '').slice(0,3);
    setNum((raw ? raw : '010').padStart(3, '0'));
    setName('');
  }, [open, suggestNumber]);

  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button
        type="button"
        onClick={() => {
          const rawNum = String(num || '').replace(/\D/g, '').slice(0,3);
          const finalNum = (rawNum ? rawNum : '010').padStart(3, '0');
          const finalName = String(name || '').trim();
          if (!finalName) return;
          onSubmit?.({ num: finalNum, name: finalName });
        }}
      >
        {t('add')}
      </button>
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={t('addSection')} footer={footer}>
      <div className="form-grid" style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ minWidth: 140 }}>{t('sectionNumber')}:</span>
          <input
            type="text"
            value={num}
            maxLength={3}
            onChange={(e) => {
              const v = String(e.target.value || '').replace(/\D/g, '').slice(0,3);
              setNum(v);
            }}
            placeholder="010"
            style={{ width: 120 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ minWidth: 140 }}>{t('renameSection')}:</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('addSection')}
            style={{ flex: 1, minWidth: 220 }}
          />
        </label>
      </div>
    </LightModal>
  );
}
