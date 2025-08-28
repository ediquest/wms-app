
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lightweight modal with dimmed backdrop + small animation.
 * Props: open, onClose, title, children, footer
 */
export default function LightModal({ open, onClose, title, children, footer }){
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="lm-backdrop" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div className="lm-dialog" role="dialog" aria-modal="true" aria-labelledby="lm-title">
        {title ? <div className="lm-header"><h3 id="lm-title">{title}</h3></div> : null}
        <div className="lm-body">{children}</div>
        {footer ? <div className="lm-footer">{footer}</div> : null}
        <button className="lm-close" aria-label="Close" onClick={onClose}>×</button>
      </div>
    </div>,
    document.body
  );
}
