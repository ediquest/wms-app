// src/utils.mode.js
const MODE_KEY = 'tcf_active_mode'; // 'project' | 'workspace'

export function getActiveMode() {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'project' || m === 'workspace') return m;
    // Heuristic fallback: if current project set => 'project', else 'workspace'
    const hasProject = !!(localStorage.getItem('tcf_current_project') || '').trim();
    const hasWs = !!(localStorage.getItem('tcf_current_workspace') || '').trim();
    if (hasProject && !hasWs) return 'project';
    return 'workspace';
  } catch {
    return 'workspace';
  }
}

export function setActiveMode(mode) {
  const v = mode === 'project' ? 'project' : 'workspace';
  try {
    localStorage.setItem(MODE_KEY, v);
    window.dispatchEvent(new Event('tcf-mode-changed'));
  } catch {}
}
