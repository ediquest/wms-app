
// src/data/migrateGenTabsToDexie.js
import { db, putSubVals, clearSubVals } from '../db/notesDB.js';

/**
 * One-time migration: replicate localStorage GeneratedTabs snapshots into IndexedDB (Dexie).
 * Safe to call multiple times (idempotent-ish): it will bulkPut the same keys.
 */
export async function migrateGenTabsToDexie() {
  try {
    const cfg = loadConfig();
    const ifaces = Array.isArray(cfg?.interfaces) ? cfg.interfaces : [];
    for (const itf of ifaces) {
      const ifaceId = String(itf.id || '');
      if (!ifaceId) continue;
      // Tabs meta (localStorage)
      let tabs = [];
      try { tabs = JSON.parse(localStorage.getItem('tcf_genTabs_' + ifaceId) || '[]') || []; } catch {}
      if (!Array.isArray(tabs) || tabs.length === 0) continue;
      // Field count (len of labels)
      const fieldCount = Array.isArray(itf.labels) ? itf.labels.length : 0;
      if (!fieldCount) continue;
      // Group tabs by section
      const bySec = new Map();
      for (const t of tabs) {
        const s = Number(t?.secIdx);
        if (!Number.isFinite(s)) continue;
        if (!bySec.has(s)) bySec.set(s, []);
        bySec.get(s).push(t);
      }
      // For each section, assign subIdx by order and persist snapshot to Dexie
      for (const [secIdx, arr] of bySec.entries()) {
        for (let k = 0; k < arr.length; k++) {
          const tab = arr[k];
          const subIdx = k;
          // Normalize snapshot to plain array of fieldCount length
          let snap = Array(fieldCount).fill('');
          const raw = tab?.snapshot;
          if (Array.isArray(raw)) {
            if (raw.length && typeof raw[0] === 'object' && raw[0] && ('i' in raw[0])) {
              // {i,v} pairs
              const map = new Map(raw.map(p => [Number(p.i), String(p.v ?? '')]));
              for (let i = 0; i < fieldCount; i++) if (map.has(i)) snap[i] = map.get(i);
            } else {
              snap = [...raw];
              if (snap.length > fieldCount) snap = snap.slice(0, fieldCount);
              while (snap.length < fieldCount) snap.push('');
            }
          }
          await putSubVals(ifaceId, Number(secIdx), Number(subIdx), snap);
        }
      }
    }
    return true;
  } catch (e) {
    console.warn('migrateGenTabsToDexie failed', e);
    return false;
  }
}
