// src/utils.autosave.js
import { getActiveMode } from './utils.mode.js';
import { getCurrentWorkspaceId } from './utils.workspace.js';

const keyForProject = () => 'tcf_autosave_project';
const keyForWorkspace = (wsId) => wsId ? `tcf_autosave_ws:${wsId}` : 'tcf_autosave';

export function autosaveKeyFor(activeMode = getActiveMode(), wsId = getCurrentWorkspaceId()){
  return activeMode === 'project' ? keyForProject() : keyForWorkspace(wsId);
}
export const autosaveKey = autosaveKeyFor; // back-compat

function readRaw(key){
  try { const v = localStorage.getItem(key); return v == null ? true : v === '1'; }
  catch { return true; } // domyślnie ON
}

function writeRaw(key){
  try { localStorage.setItem(key, '1'); } catch {}
}

// Public
export function readAutosave(activeMode = getActiveMode(), wsId = getCurrentWorkspaceId()){
  return readRaw(autosaveKeyFor(activeMode, wsId));
}

export function setAutosave(on, activeMode = getActiveMode(), wsId = getCurrentWorkspaceId()){
  // wymuszamy ON
  writeRaw(autosaveKeyFor(activeMode, wsId));
  mirrorToGlobal();
  try { window.dispatchEvent(new Event('tcf-autosave-changed')); } catch {}
}

// Back-compat alias
export function writeAutosave(on, activeMode = getActiveMode(), wsId = getCurrentWorkspaceId()){
  setAutosave(true, activeMode, wsId);
}

// Global legacy mirror
function mirrorToGlobal(){
  try { localStorage.setItem('tcf_autosave', '1'); } catch {}
}

// Pause autosave during critical transitions (e.g., switching project/workspace)
export function withAutosavePaused(fn){
  const prev = window.__TFC_AS_PAUSED === true;
  window.__TFC_AS_PAUSED = true;
  try { fn(); }
  finally { setTimeout(() => { window.__TFC_AS_PAUSED = prev; }, 0); }
}
export function isAutosavePaused(){ return window.__TFC_AS_PAUSED === true; }

export function onAutosaveChange(cb){
  const handler = () => { try { cb(true); } catch {} mirrorToGlobal(); };
  window.addEventListener('tcf-autosave-changed', handler);
  window.addEventListener('tcf-workspace-changed', handler);
  window.addEventListener('tcf-mode-changed', handler);
  try { handler(); } catch {}
  return () => {
    window.removeEventListener('tcf-autosave-changed', handler);
    window.removeEventListener('tcf-workspace-changed', handler);
    window.removeEventListener('tcf-mode-changed', handler);
  };
}

// Ensure ON at startup
try { mirrorToGlobal(); } catch {}
