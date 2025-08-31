import Dexie from 'dexie';

// === Unified DB (notes + forms) ===
export const db = new Dexie('intgen'); // single database for the whole app

// v1: define ALL stores used across the app
db.version(1).stores({
  // Notes Dock tables
  tabs: '++id, name, order, createdAt',
  elements: '++id, tabId, type, zIndex, createdAt, updatedAt',
  blobs: '++id',
  meta: 'id',

  // Forms tables
  // key = `${ifaceId}|${secIdx}|${subIdx}`
  subValues: 'key, ifaceId, secIdx, subIdx, [ifaceId+secIdx], [ifaceId+secIdx+subIdx]',
  // Primary key = ifaceId
  ifaceValues: '&ifaceId'
});

// --- One-time migration from legacy DBs (notes/forms) into unified DB ---
export async function migrateFromLegacyIfNeeded() {
  // Try to copy from 'intgen_notes' and 'intgen_forms' if target tables are empty
  try {
    const notes = new Dexie('intgen_notes');
    notes.version(1).stores({
      tabs: '++id, name, order, createdAt',
      elements: '++id, tabId, type, zIndex, createdAt, updatedAt',
      blobs: '++id',
      meta: 'id'
    });
    await notes.open();
    if (await db.table('tabs').count() === 0) {
      const rows = await notes.table('tabs').toArray();
      if (rows.length) await db.table('tabs').bulkPut(rows);
    }
    if (await db.table('elements').count() === 0) {
      const rows = await notes.table('elements').toArray();
      if (rows.length) await db.table('elements').bulkPut(rows);
    }
    if (await db.table('blobs').count() === 0) {
      const rows = await notes.table('blobs').toArray();
      if (rows.length) await db.table('blobs').bulkPut(rows);
    }
    if (await db.table('meta').count() === 0) {
      const rows = await notes.table('meta').toArray();
      if (rows.length) await db.table('meta').bulkPut(rows);
    }
    try { await notes.close(); } catch {}
  } catch {}

  try {
    const forms = new Dexie('intgen_forms');
    forms.version(1).stores({
      subValues: 'key, ifaceId, secIdx, subIdx, [ifaceId+secIdx], [ifaceId+secIdx+subIdx]',
      ifaceValues: '&ifaceId'
    });
    await forms.open();
    if (await db.table('subValues').count() === 0) {
      const rows = await forms.table('subValues').toArray();
      if (rows.length) await db.table('subValues').bulkPut(rows);
    }
    if (await db.table('ifaceValues').count() === 0) {
      const rows = await forms.table('ifaceValues').toArray();
      if (rows.length) await db.table('ifaceValues').bulkPut(rows);
    }
    try { await forms.close(); } catch {}
  } catch {}
}
