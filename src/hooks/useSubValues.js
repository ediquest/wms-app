// src/hooks/useSubValues.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSubVals, setSubVal, clearSubVals, putSubVals } from '../db/notesDB';

/**
 * Hook per-podsekcyjny: [vals, setOne, reset, setMany, reload]
 */
export function useSubValues(ifaceId, secIdx, subIdx, fieldCount) {
  const [vals, setVals] = useState(() => Array(fieldCount || 0).fill(''));
  const loadSeq = useRef(0);

  const reload = useCallback(async () => {
    const mySeq = ++loadSeq.current;
    const v = await getSubVals(ifaceId, secIdx, subIdx, fieldCount);
    if (mySeq === loadSeq.current) setVals(v);
  }, [ifaceId, secIdx, subIdx, fieldCount]);

  useEffect(() => { reload(); }, [reload]);

  const setOne = useCallback(async (i, v) => {
    await setSubVal(ifaceId, secIdx, subIdx, i, v, fieldCount);
    setVals(prev => { const n = prev.slice(); n[i] = v; return n; });
  }, [ifaceId, secIdx, subIdx, fieldCount]);

  const reset = useCallback(async () => {
    await clearSubVals(ifaceId, secIdx, subIdx, fieldCount);
    setVals(Array(fieldCount || 0).fill(''));
  }, [ifaceId, secIdx, subIdx, fieldCount]);

  const setMany = useCallback(async (payload) => {
    let arr = Array(fieldCount || 0).fill('');
    if (Array.isArray(payload)) {
      arr = payload.slice(0, fieldCount);
      while (arr.length < fieldCount) arr.push('');
    } else if (payload && typeof payload === 'object') {
      Object.keys(payload).forEach(k => {
        const i = Number(k);
        if (!Number.isNaN(i) && i >= 0 && i < fieldCount) arr[i] = String(payload[k] ?? '');
      });
    }
    await putSubVals(ifaceId, secIdx, subIdx, arr);
    setVals(arr);
  }, [ifaceId, secIdx, subIdx, fieldCount]);

  return [vals, setOne, reset, setMany, reload];
}
