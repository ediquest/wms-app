import Dexie from 'dexie';

export const notesDB = new Dexie('EdiLabsNotesDB');

notesDB.version(1).stores({
  notes: '++id, ifaceId, secKey, deletedAt, updatedAt'
});

const DEFAULT_SIZE = { w: 240, h: 140 };

export async function addNote({ ifaceId, secKey, x, y, content = '' }) {
  const now = Date.now();
  const note = {
    ifaceId, secKey, content, x, y,
    ...DEFAULT_SIZE,
    z: now, color: null,
    createdAt: now, updatedAt: now,
    deletedAt: null
  };
  const id = await notesDB.notes.add(note);
  return { ...note, id };
}

export async function updateNote(id, patch) {
  const now = Date.now();
  await notesDB.notes.update(id, { ...patch, updatedAt: now });
}

export async function getNotes(ifaceId, secKey) {
  return notesDB.notes
    .where({ ifaceId, secKey })
    .and(n => !n.deletedAt)
    .sortBy('z');
}

export async function getAllNotesInIface(ifaceId) {
  return notesDB.notes
    .where('ifaceId').equals(ifaceId)
    .and(n => !n.deletedAt)
    .toArray();
}

export async function softDeleteNote(id) {
  const now = Date.now();
  await notesDB.notes.update(id, { deletedAt: now, updatedAt: now });
}

export async function restoreNote(id, targetSecKey) {
  const now = Date.now();
  await notesDB.notes.update(id, { deletedAt: null, secKey: targetSecKey, updatedAt: now });
}

export async function hardDeleteNote(id) {
  await notesDB.notes.delete(id);
}

export async function emptyTrash(ifaceId) {
  const keys = await notesDB.notes
    .where('ifaceId').equals(ifaceId)
    .and(n => !!n.deletedAt)
    .primaryKeys();
  await notesDB.notes.bulkDelete(keys);
}

export async function getTrash(ifaceId) {
  return notesDB.notes
    .where('ifaceId').equals(ifaceId)
    .and(n => !!n.deletedAt)
    .reverse()
    .sortBy('updatedAt');
}

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));