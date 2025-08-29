import React from 'react';
import LightModal from './LightModal.jsx';
import { t } from '../i18n.js';

export default function DeleteTemplateModal({ open, onClose, onConfirm, template, title, message }){
  const name = (template && (template.name || template.title || template.id)) ? (template.name || template.title || String(template.id)) : '';
  const finalTitle = title || t('deleteTemplateTitle') || t('delete') || 'Usuń schemat';
  const finalMsg = message || ((t('deleteTemplateConfirmWithName') || 'Czy na pewno usunąć schemat „{name}”?').replace('{name}', name));

  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel') || 'Anuluj'}</button>
      <button type="button" className="danger" onClick={onConfirm}>{t('delete') || 'Usuń'}</button>
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={finalTitle} footer={footer}>
      <p style={{margin:0}}>{finalMsg}</p>
    </LightModal>
  );
}
