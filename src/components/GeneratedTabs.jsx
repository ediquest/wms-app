import React, { useEffect, useMemo, useState } from "react";

/**
 * GeneratedTabs — bottom tabs manager (auto-expanding, stable numbering)
 * Immediate textarea refresh: writes to localStorage synchronously and calls onChange()
 */
export default function GeneratedTabs({
  iface,
  activeSec,
  values,
  valsMap,
  setValues,
  setValsMap,
  onSwitchSection,
  onChange,
  children,
}) {
  const key = useMemo(() => `tcf_genTabs_${String(iface?.id ?? "")}`, [iface?.id]);

  const readTabs = () => {
    try { const raw = localStorage.getItem(key); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; }
    catch { return []; }
  };
  const writeTabs = (arr) => { try { localStorage.setItem(key, JSON.stringify(arr)); } catch {} };

  const [tabs, setTabs] = useState(() => readTabs());
  const [activeId, setActiveId] = useState(null);

  useEffect(() => { setTabs(readTabs()); }, [key]);  // resync when iface changes

  const takeSnapshot = () => {
    const src = Array.isArray(valsMap?.[iface?.id]) ? valsMap[iface.id] : values;
    return Array.isArray(src) ? [...src] : [];
  };
  const restoreSnapshot = (snap) => {
    if (!iface) return;
    const map = { ...(valsMap || {}), [iface.id]: Array.isArray(snap) ? [...snap] : [] };
    setValsMap(map);
    setValues(map[iface.id] || []);
  };

  const computeSecNo = (secIdx) => {
    const fromTitle = (((iface?.sections?.[secIdx] || '').match(/\b(\d{3})\b/) || [])[1]);
    const raw = fromTitle ?? iface?.sectionNumbers?.[secIdx] ?? String(secIdx * 10);
    const s = String(raw ?? "");
    return s.padStart(3, "0").slice(-3);
  };

  const onGenerate = () => {
    if (!iface) return;
    const secIdx = activeSec;
    const secNo = computeSecNo(secIdx);
    const snapshot = takeSnapshot();
    const id = Math.random().toString(36).slice(2);
    const ord = tabs.filter(x => String(x.secNo) == String(secNo)).length + 1;
    const next = [...tabs, { id, secIdx, secNo, ord, snapshot, createdAt: Date.now() }];
    setTabs(next);
    writeTabs(next);     // <-- sync persist so Home's builder sees it immediately
    setActiveId(id);
    onChange?.();        // <-- tell parent to recompute textarea
  };

  const onOpen = (tab) => {
    restoreSnapshot(tab.snapshot);
    onSwitchSection?.(tab.secIdx);
    setActiveId(tab.id);
  };

  const onRemove = (tab) => {
    const next = tabs.filter(t => t.id !== tab.id);
    setTabs(next);
    writeTabs(next);     // <-- sync persist
    if (activeId === tab.id) setActiveId(null);
    onChange?.();        // <-- recompute textarea
  };

  const externalBtn = typeof children === "function" ? children({ onGenerate }) : (
    <button onClick={onGenerate}>Generuj</button>
  );

  const labeledTabs = useMemo(() => {
    // if some older tabs have no 'ord', compute stable labels on the fly
    const counts = {};
    return tabs.map(t => {
      const k = String(t.secNo);
      const ord = t.ord ?? ((counts[k] = (counts[k] || 0) + 1), counts[k]);
      return { ...t, label: `${k}-${ord}`, ord };
    });
  }, [tabs]);

  const activeLabel = useMemo(() => labeledTabs.find(t => t.id === activeId)?.label || null, [labeledTabs, activeId]);

  return (
    <>
      {/* put the button next to other actions */}
      {externalBtn}

      {/* bottom tabs (auto-wrap) */}
      <div className="tabs-bottom">
        {labeledTabs.map((t) => {
          const isActive = t.id === activeId;
          return (
            <div
              key={t.id}
              className={`tab-bottom ${isActive ? "active" : ""}`}
              onClick={() => onOpen(t)}
              title={`Podsekcja ${t.label}`}
            >
              <span>{t.label}</span>
              <button
                className="close close--small"
                onClick={(e) => { e.stopPropagation(); onRemove(t); }}
                aria-label={`Usuń ${t.label}`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {activeLabel ? (
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          Aktywna podsekcja: <b>{activeLabel}</b>
        </div>
      ) : null}
    </>
  );
}
