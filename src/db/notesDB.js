import Dexie from 'dexie';

export const notesDB = new Dexie('intgen_notes');
notesDB.version(1).stores({
  tabs: '++id, name, order, createdAt',
  elements: '++id, tabId, type, zIndex, createdAt, updatedAt',
  blobs: '++id',
  meta: 'id'
});

async function ensureFirstTab() {
  const count = await notesDB.tabs.count();
  if (!count) {
    const id = await notesDB.tabs.add({
      name: 'Notatki',
      order: 0,
      createdAt: Date.now()
    });
    await notesDB.meta.put({ id: 'activeTabId', value: id });
  }
}

export async function initNotesDB() {
  await notesDB.open();
  await ensureFirstTab();
}

export async function getUI() {
  const v = await notesDB.meta.get('dockUI');
  return v?.value ?? { open: false, widthPct: 0.6, heightPct: 0.6 };
}
export async function setUI(next) {
  await notesDB.meta.put({ id: 'dockUI', value: next });
}

export async function getActiveTabId() {
  const v = await notesDB.meta.get('activeTabId');
  return v?.value;
}
export async function setActiveTabId(id) {
  await notesDB.meta.put({ id: 'activeTabId', value: id });
}

export async function listTabs() {
  return notesDB.tabs.orderBy('order').toArray();
}

export async function addTab(name='Nowa zakładka') {
  const order = await notesDB.tabs.count();
  const id = await notesDB.tabs.add({ name, order, createdAt: Date.now() });
  await setActiveTabId(id);
  return id;
}

export async function renameTab(id, name) {
  await notesDB.tabs.update(id, { name });
}

export async function deleteTab(id) {
  const elems = await notesDB.elements.where({ tabId: id }).toArray();
  const blobIds = elems.filter(e => e.type === 'image' && e.blobId).map(e => e.blobId);
  await notesDB.transaction('rw', notesDB.elements, notesDB.blobs, notesDB.tabs, async () => {
    if (blobIds.length) await notesDB.blobs.bulkDelete(blobIds);
    await notesDB.elements.where({ tabId: id }).delete();
    await notesDB.tabs.delete(id);
  });
  const tabs = await listTabs();
  if (tabs.length) await setActiveTabId(tabs[0].id);
}

export async function listElements(tabId) {
  return notesDB.elements.where({ tabId }).sortBy('zIndex');
}

export async function newTextElement(tabId, x, y) {
  const z = await notesDB.elements.count();
  const id = await notesDB.elements.add({
    tabId, type: 'text', x, y, width: 240, height: 120,
    content: '', zIndex: z, createdAt: Date.now(), updatedAt: Date.now()
  });
  return await notesDB.elements.get(id);
}

export async function saveTextContent(id, content) {
  await notesDB.elements.update(id, { content, updatedAt: Date.now() });
}

export async function moveResizeElement(id, patch) {
  await notesDB.elements.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteElement(id) {
  const el = await notesDB.elements.get(id);
  if (el?.type === 'image' && el.blobId) {
    await notesDB.blobs.delete(el.blobId);
  }
  await notesDB.elements.delete(id);
}

export async function addImageElement(tabId, fileOrBlob, x, y) {
  const blob = fileOrBlob instanceof Blob ? fileOrBlob : new Blob([fileOrBlob], { type: fileOrBlob.type || 'image/png' });
  const blobId = await notesDB.blobs.add({ data: blob, mime: blob.type });
  const z = await notesDB.elements.count();

  let width = 260, height = 180;
  try {
    const url = URL.createObjectURL(blob);
    await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { width = img.naturalWidth; height = img.naturalHeight; URL.revokeObjectURL(url); res(); };
      img.onerror = rej;
      img.src = url;
    });
    const maxW = Math.min(520, window.innerWidth * 0.55);
    const maxH = Math.min(360, window.innerHeight * 0.5);
    const scale = Math.min(maxW / width, maxH / height, 1);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  } catch {}

  const id = await notesDB.elements.add({
    tabId, type: 'image', x, y, width, height, blobId, zIndex: z,
    createdAt: Date.now(), updatedAt: Date.now()
  });
  return await notesDB.elements.get(id);
}

export async function getBlobUrl(blobId) {
  const row = await notesDB.blobs.get(blobId);
  if (!row?.data) return null;
  return URL.createObjectURL(row.data);
}