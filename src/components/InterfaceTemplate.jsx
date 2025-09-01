// src/components/InterfaceTemplate.jsx
import React, { useEffect, useState } from 'react';
import UXVectorCore from './UXVectorCore.jsx';

export default function InterfaceTemplate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      const isCombo = (e.ctrlKey || e.metaKey) && e.shiftKey;
      const isStar = e.key === '*' || (e.key === '8' && e.shiftKey) || e.code === 'NumpadMultiply';
      if (isCombo && isStar) { e.preventDefault(); e.stopPropagation(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  return <UXVectorCore open={open} onClose={() => setOpen(false)} />;
}
