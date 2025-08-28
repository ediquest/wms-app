import React from 'react';
import LightModal from './LightModal';
import { t } from '../i18n.js';

export default function ConfirmClearModal({ open, onClose, onConfirm }){
  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="danger" onClick={onConfirm}>{t('clear')}</button>
    </>
  );
  return (
    <LightModal open={open} onClose={onClose} title={t('clear')} footer={footer}>
      <div className="muted" style={{lineHeight:1.5}}>
        {t('confirmClearAll') || 'Clear all generated tabs and values for this interface?'}
      </div>
    </LightModal>
  );
}
