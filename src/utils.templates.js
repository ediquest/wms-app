
// src/utils.templates.js — Templates (Schematy) storage & import/export/apply/rename
const KEY = 'tcf_templates_v1';
const nowIso = () => new Date().toISOString();
const uid = () => 'tpl_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);

export const loadTemplates = () => {
  try { const raw = localStorage.getItem(KEY); const arr = JSON.parse(raw || '[]'); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
};
const persist = (arr) => { try { localStorage.setItem(KEY, JSON.stringify(arr)); window.dispatchEvent(new CustomEvent('tcf-templates-changed')); } catch(e){ console.error(e);} };
export const saveTemplate = (name, payload) => {
  const items = loadTemplates(); const id = uid();
  const item = { id, name: String(name || 'Template'), createdAt: nowIso(), data: payload };
  items.unshift(item); persist(items); return id;
};
export const deleteTemplate = (id) => { const items = loadTemplates().filter(x => x && x.id !== id); persist(items); };
export const exportTemplatesBlob = () => {
  const items = loadTemplates(); const obj = { _type: 'tcf_templates', _version: '1', items, exportedAt: nowIso() };
  return new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
};
export const importTemplatesText = (text) => {
  const items = loadTemplates();
  try {
    const obj = JSON.parse(text);
    const list = Array.isArray(obj?.items) ? obj.items : (Array.isArray(obj) ? obj : []);
    for (const it of list) { if (it && typeof it === 'object') items.push({ ...it, id: uid() }); }
    persist(items); return true;
  } catch(e) { console.error('importTemplates failed', e); return false; }
};

import { loadConfig, saveConfig, loadValues, saveValues } from './utils.js';

/** Apply a template by id: sets values, includedSections, gen tabs, combine flags */
export const applyTemplate = (id) => {
  const items = loadTemplates();
  const tpl = items.find(x => x && x.id === id);
  if (!tpl) return false;
  const data = tpl.data || {};
  try {
    // combine flags & order
    try { localStorage.setItem('tcf_combine_all', data.multi ? '1' : '0'); } catch {}
    try { localStorage.setItem('tcf_combine_order', JSON.stringify(Array.isArray(data.order)?data.order:[])); } catch {}
    // gen tabs per iface
    if (data.snapshot && typeof data.snapshot === 'object') {
      for (const [iid, snap] of Object.entries(data.snapshot)) {
        try { localStorage.setItem('tcf_genTabs_' + String(iid), JSON.stringify(snap.genTabs || [])); } catch {}
      }
    }
    // values map
    const vals = loadValues();
    if (data.snapshot && typeof data.snapshot === 'object') {
      for (const [iid, snap] of Object.entries(data.snapshot)) {
        if (Array.isArray(snap.values)) vals[iid] = snap.values;
      }
    }
    saveValues(vals);
    // included sections inside config
    const cfg = loadConfig();
    if (cfg && Array.isArray(cfg.interfaces) && data.snapshot) {
      cfg.interfaces = cfg.interfaces.map((it) => {
        const snap = data.snapshot[it.id];
        if (snap && Array.isArray(snap.includedSections)) {
          const n = Array.isArray(it.sections) ? it.sections.length : (Array.isArray(it.labels) ? it.labels.length : 0);
          const arr = Array.from({ length: n }, (_, i) => !!(snap.includedSections || [])[i]);
          return { ...it, includedSections: arr };
        }
        return it;
      });
      saveConfig(cfg);
    }
    try { window.dispatchEvent(new Event('tcf-values-changed')); } catch {}
    try { window.dispatchEvent(new Event('tcf-config-changed')); } catch {}
    return true;
  } catch(e) {
    console.error('applyTemplate failed', e);
    return false;
  }
};

/** Rename template by id */
export const renameTemplate = (id, name) => {
  const items = loadTemplates();
  const idx = items.findIndex(x => x && x.id === id);
  if (idx === -1) return false;
  items[idx] = { ...items[idx], name: String(name || '') };
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  try { window.dispatchEvent(new CustomEvent('tcf-templates-changed')); } catch {}
  return true;
};
