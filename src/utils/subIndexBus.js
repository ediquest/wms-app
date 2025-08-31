// src/utils/subIndexBus.js
import { useEffect, useState } from 'react';

export function emitSubIdxChange(i) {
  try { window.dispatchEvent(new CustomEvent('subidx-change', { detail: Number(i) || 0 })); } catch {}
}

export function useSubIdxFromBus(initial = 0) {
  const [subIdx, setSubIdx] = useState(Number(initial) || 0);
  useEffect(() => {
    const handler = (e) => { try { setSubIdx(Number(e.detail) || 0); } catch {} };
    window.addEventListener('subidx-change', handler);
    return () => window.removeEventListener('subidx-change', handler);
  }, []);
  return [subIdx, setSubIdx];
}
