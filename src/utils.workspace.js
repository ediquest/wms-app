// src/utils.workspace.js
import { loadConfig, saveConfig, loadValues, saveValues } from './utils.js';

const WS_KEY = 'tcf_workspace_projects';
const WS_CUR = 'tcf_current_workspace';

export function loadWorkspaceProjects() {
  try { return JSON.parse(localStorage.getItem(WS_KEY) || '{}') || {}; }
  catch { return {}; }
}

export function saveWorkspaceProjects(map) {
  localStorage.setItem(WS_KEY, JSON.stringify(map || {}));
}

export function getCurrentWorkspaceId() {
  return localStorage.getItem(WS_CUR) || '';
}

export function setCurrentWorkspaceId(id) {
  if (id) localStorage.setItem(WS_CUR, id);
  else localStorage.removeItem(WS_CUR);
  try { window.dispatchEvent(new Event('tcf-workspace-changed')); } catch {}
}

export function newWorkspaceId() {
  return 'ws_' + Math.random().toString(36).slice(2, 9);
}

export function snapshotWorkspace() {
  const cfg = loadConfig();
  const vals = loadValues();
  const pack = { interfaces: {}, meta: { exportedAt: new Date().toISOString() } };

  (cfg.interfaces || []).forEach(it => {
    const id = it.id;
    const labelsLen = (it.labels || []).length;
    pack.interfaces[id] = {
      interfaceId: id,
      interfaceName: it.name,
      values: Array.isArray(vals[id]) ? vals[id].slice() : Array.from({ length: labelsLen }, () => ''),
      sectionColors: Array.isArray(it.sectionColors) ? it.sectionColors.slice() : [],
      includedSections: Array.isArray(it.includedSections) ? it.includedSections.slice() : []
    };
  });
  return pack;
}

export function applyWorkspace(pack) {
  if (!pack || !pack.interfaces) return false;
  const cfg = loadConfig();
  const vals = loadValues();
  let touched = false;

  Object.keys(pack.interfaces).forEach(id => {
    const item = pack.interfaces[id];

    if (Array.isArray(item.values)) {
      vals[id] = item.values.slice();
      touched = true;
    }

    const idx = (cfg.interfaces || []).findIndex(x => x.id === id);
    if (idx >= 0) {
      const next = { ...(cfg.interfaces[idx] || {}) };
      if (Array.isArray(item.sectionColors)) next.sectionColors = item.sectionColors.slice();
      if (Array.isArray(item.includedSections)) next.includedSections = item.includedSections.slice();
      cfg.interfaces[idx] = next;
      touched = true;
    }
  });

  if (touched) {
    saveValues(vals);
    saveConfig(cfg);
    try { window.dispatchEvent(new Event('tcf-config-changed')); } catch {}
  }
  return touched;
}

export function exportWorkspaceBlob(pack, fileName = 'workspace.json') {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 300);
}
