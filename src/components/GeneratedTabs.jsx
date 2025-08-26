
import React from 'react';
import ScrollTabs from './ScrollTabs.jsx';

/**
 * GeneratedTabs (bottom tabs)
 * Props:
 *  - iface: { id, sections, sectionNumbers, fieldSections, labels, ... }
 *  - activeSec: number (current section index)
 *  - values: string[] (current values array for iface)
 *  - valsMap: Record<ifaceId, string[]>
 *  - setValues(next: string[])
 *  - setValsMap(next: Record)
 *  - onSwitchSection(idx: number)
 */
export default function GeneratedTabs({
  iface,
  activeSec,
  values,
  valsMap,
  setValues,
  setValsMap,
  onSwitchSection
}) {
  if (!iface) return null;
  const storageKey = React.useMemo(() => `tcf_genTabs_${String(iface.id)}`, [iface.id]);

  // ---- state (hooks must stay at top-level and in fixed order) ----
  const [tabs, setTabs] = React.useState(() => readTabs(storageKey));
  const [activeId, setActiveId] = React.useState(null);

  // (re)load when iface changes
  React.useEffect(() => {
    setTabs(readTabs(storageKey));
    setActiveId(null);
  }, [storageKey]);

  // persist on change
  React.useEffect(() => {
    writeTabs(storageKey, tabs);
  }, [storageKey, tabs]);

  // ---- helpers ----
  const idxsFor = React.useCallback((secIdx) => {
    const fs = iface.fieldSections || [];
    const out = [];
    for (let i = 0; i < fs.length; i++) if (fs[i] === secIdx) out.push(i);
    return out;
  }, [iface]);

  const takeSnapshot = React.useCallback((secIdx) => {
    const src = (valsMap && valsMap[iface.id]) ? valsMap[iface.id] : values;
    const idxs = idxsFor(secIdx);
    return idxs.map(i => ({ i, v: String(src?.[i] ?? '') }));
  }, [valsMap, iface, values, idxsFor]);

  const applySnapshot = React.useCallback((snap) => {
    const base = (valsMap && valsMap[iface.id]) ? [...valsMap[iface.id]] : [...values];
    for (const { i, v } of (snap || [])) base[i] = v;
    setValues(base);
    const map = { ...(valsMap || {}), [iface.id]: base };
    setValsMap(map);
  }, [valsMap, iface, values, setValues, setValsMap]);

  // ---- button handlers ----
  const onGenerate = React.useCallback(() => {
    const secIdx = activeSec;
    const secNo = (iface.sectionNumbers || [])[secIdx] ?? secIdx;
    const snapshot = takeSnapshot(secIdx);
    const id = `${Date.now().toString(36)}_${secNo}_${Math.random().toString(36).slice(2,7)}`;
    const next = [...tabs, { id, secIdx, secNo, snapshot }];
    setTabs(next);
    setActiveId(id);
  }, [activeSec, iface, takeSnapshot, tabs]);

  const onOpen = React.useCallback((tab) => {
    applySnapshot(tab.snapshot);
    if (typeof onSwitchSection === 'function') onSwitchSection(tab.secIdx);
    setActiveId(tab.id);
  }, [applySnapshot, onSwitchSection]);

  const onRemove = React.useCallback((tab) => {
    setTabs(prev => prev.filter(t => t.id !== tab.id));
    setActiveId(prev => (prev === tab.id ? null : prev));
  }, []);

  // ---- label enumeration (110-1, 110-2…) ----
  const numberedTabs = React.useMemo(() => {
    const counts = new Map();
    return tabs.map(t => {
      const k = String(t.secNo);
      const n = (counts.get(k) || 0) + 1;
      counts.set(k, n);
      return { ...t, label: `${k}-${n}` };
    });
  }, [tabs]);

  // ---- render ----
  return (
    <div className="genTabs">
      <div className="genTabsBar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={onGenerate}>
          Generuj
        </button>
      </div>

      <div className="genTabsList" style={{ marginTop: 6 }}>
        <ScrollTabs height={38}>
          <div className="tabs tabs-bottom">
            {numberedTabs.map((t) => {
              const isActive = t.id === activeId;
              return (
                <div
                  key={t.id}
                  className={`tab tab-bottom ${isActive ? 'active' : ''}`}
                  onClick={() => onOpen(t)}
                  title={`Sekcja ${t.label}`}
                  style={{
                    position: 'relative',
                    minWidth: 96,
                    paddingRight: 20,
                    borderTop: '2px solid var(--border)',
                    borderRadius: '0 0 8px 8px'
                  }}
                >
                  <span>{t.label}</span>
                  <button
                    type="button"
                    className="close"
                    aria-label={`Usuń ${t.label}`}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
                    onClick={(e) => { e.stopPropagation(); onRemove(t); }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </ScrollTabs>
        {activeId && (
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
            Aktywna podsekcja: <b>{(numberedTabs.find(nt => nt.id === activeId) || {}).label}</b>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- storage utils ----
function readTabs(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function writeTabs(key, arr) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
}
