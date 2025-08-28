import React, { useEffect, useMemo, useState } from 'react';
import LightModal from './LightModal';
import { t } from '../i18n.js';

/**
 * DeleteCategoryModal
 * Props:
 *  - open: boolean
 *  - onClose: fn()
 *  - onConfirm: fn({ id, mode: 'move'|'delete', destCategoryId?: string })
 *  - target: { id, name } | null
 *  - categories: array of {id,name}
 *  - interfacesInCategory: number
 */
export default function DeleteCategoryModal({ open, onClose, onConfirm, target, categories=[], interfacesInCategory=0 }) {
  const [mode, setMode] = useState('move');
  const otherCategories = useMemo(() => categories.filter(c => c.id !== (target?.id || '')), [categories, target]);
  const [dest, setDest] = useState(otherCategories[0]?.id || '');

  useEffect(() => {
    if (open) {
      setMode('move');
      const first = otherCategories[0]?.id || '';
      setDest(first);
    }
  }, [open, target, categories]);

  const footer = (
    <>
      <button type="button" className="ghost" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="danger" onClick={() => {
        const payload = { id: target?.id, mode, destCategoryId: mode==='move' ? dest : undefined };
        onConfirm?.(payload);
      }}>{t('delete')}</button>
    </>
  );

  return (
    <LightModal open={open} onClose={onClose} title={t('deleteCategory')} footer={footer}>
      {!target ? null : (
        <div className="grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
          <div className="muted">
            <div style={{marginBottom:6}}>{t('confirmDeleteCategory')}</div>
            <div style={{opacity:.85}}>
              <div><strong>ID:</strong> {target.id}</div>
              {target.name ? <div><strong>{t('nameLabel')||'Name'}:</strong> {target.name}</div> : null}
            </div>
            <div style={{marginTop:8}} className="muted">{t('cannotUndo')}</div>
          </div>

          {interfacesInCategory > 0 ? (
            <div className="card" style={{padding:12}}>
              <div style={{marginBottom:8}}>
                {t('categoryHasInterfaces').replace('{count}', String(interfacesInCategory))}
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {otherCategories.length > 0 && (
                  <label className="form-row" style={{display:'flex', alignItems:'center', gap:8}}>
                    <input type="radio" checked={mode==='move'} onChange={()=>setMode('move')} />
                    <span>{t('moveInterfacesTo')}</span>
                    <select disabled={mode!=='move'} value={dest} onChange={e=>setDest(e.target.value)}>
                      {otherCategories.map(o => <option key={o.id} value={o.id}>{o.name || o.id}</option>)}
                    </select>
                  </label>
                )}
                <label className="form-row" style={{display:'flex', alignItems:'center', gap:8}}>
                  <input type="radio" checked={mode==='delete'} onChange={()=>setMode('delete')} />
                  <span style={{color:'var(--danger,#ff6b6b)'}}>{t('alsoDeleteInterfaces')}</span>
                </label>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </LightModal>
  );
}
