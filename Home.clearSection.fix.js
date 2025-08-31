// ZAMIENIĆ ten fragment w clearSection():
// try {
//   const ifaceId = String(iface.id);
//   const sIx = Number(targetSec);
//   await db.table('subValues').where({ ifaceId, secIdx: sIx }).delete();
// } catch (e) { console.warn('Dexie clearSection delete failed', e); }

// NA TO (IIFE bez await w funkcji nie-async):
(async () => {
  try {
    const ifaceId = String(iface.id);
    const sIx = Number(targetSec);
    await db.table('subValues').where({ ifaceId, secIdx: sIx }).delete();
  } catch (e) {
    console.warn('Dexie clearSection delete failed', e);
  }
})();
