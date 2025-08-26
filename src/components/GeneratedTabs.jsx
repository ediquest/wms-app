import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";

/**
 * GeneratedTabs — dolne zakładki
 * - Auto: tworzy podsekcję gdy użytkownik zaczyna wypełniać pola w bieżącej sekcji
 * - „+” na końcu dodaje nową podsekcję dla aktualnie oglądanej sekcji
 * - Snapshot wartości per-podsekcja (trwałość w localStorage)
 * - Natychmiastowe odświeżenie textarea przez onChange()
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
}) {
  const key = `tcf_genTabs_${String(iface?.id ?? "")}`;
  const activeKey = `tcf_genTabs_active_${String(iface?.id ?? "")}`;

  const readTabs = () => {
    try { return JSON.parse(localStorage.getItem(key) || "[]") || []; } catch { return []; }
  };
  const writeTabs = (arr) => { try { localStorage.setItem(key, JSON.stringify(arr)); } catch {} };

  const [tabs, setTabs] = useState(readTabs);
  const [activeId, setActiveId] = useState(() => { try { return localStorage.getItem(activeKey) || null; } catch { return null; } });

  useEffect(() => { setTabs(readTabs()); }, [key]);

  const idxsFor = useCallback((itf, sIx) => {
    const arr = (itf?.fieldSections || []);
    const idxs = [];
    for (let i = 0; i < arr.length; i++) if (arr[i] === sIx) idxs.push(i);
    return idxs;
  }, []);

  const pad3 = (s) => String(s ?? "").padStart(3, "0").slice(-3);
  const secNoFor = (secIdx) => {
    const fromTitle = (((iface?.sections?.[secIdx] || "").match(/\b(\d{3})\b/) || [])[1]);
    const raw = fromTitle ?? (iface?.sectionNumbers || [])[secIdx] ?? String(secIdx * 10);
    return pad3(raw);
  };

  const normalizeSnapshot = (snap, baseLen) => {
    if (!Array.isArray(snap)) return Array.isArray(values) ? [...values] : [];
    if (snap.length && typeof snap[0] === "object" && snap[0] && "i" in snap[0]) {
      const arr = Array.isArray(values) ? [...values] : Array(baseLen).fill("");
      const map = new Map(snap.map(p => [p.i, p.v]));
      for (let i = 0; i < arr.length; i++) if (map.has(i)) arr[i] = map.get(i);
      return arr;
    }
    return [...snap];
  };

  const applySnapshot = (snap) => {
    const norm = normalizeSnapshot(snap, (values || []).length);
    if (typeof setValues === "function") setValues(norm);
  };

  // Zapisuje bieżące 'values' do aktywnej zakładki (jeśli się zmieniły)
  const persistActiveSnapshot = useCallback((vals) => {
    try {
      const id = (typeof window !== "undefined") ? (localStorage.getItem(activeKey) || activeId) : activeId;
      if (!id) return false;
      const idx = tabs.findIndex(t => t.id === id);
      if (idx === -1) return false;
      const snap = Array.isArray(vals) ? [...vals] : [];
      const prev = tabs[idx]?.snapshot;
      const same = Array.isArray(prev) && prev.length === snap.length && prev.every((v,i)=>String(v)===String(snap[i]));
      if (same) return false;
      const next = tabs.slice();
      next[idx] = { ...next[idx], snapshot: snap };
      setTabs(next);
      writeTabs(next);
      return true;
    } catch { return false; }
  }, [activeId, tabs, key]);

  // Automatycznie tworzy zakładkę po pierwszym wpisaniu w polu aktualnej sekcji
  const autoCreateFromValues = useCallback(() => {
    const secIdx = activeSec;
    const idxs = idxsFor(iface, secIdx);
    if (!idxs.length) return false;
    const has = idxs.some(i => String(values?.[i] ?? "").trim().length > 0);
    if (!has) return false;
    const activeIdLS = (typeof window !== "undefined") ? (localStorage.getItem(activeKey) || activeId) : activeId;
    const activeTab = tabs.find(t => t.id === activeIdLS);
    if (activeTab && activeTab.secIdx === secIdx) return false;
    // create
    const secNo = secNoFor(secIdx);
    const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
    const snapshot = Array.isArray(values) ? [...values] : [];
    const next = [...tabs, { id, secIdx, secNo, snapshot }];
    setTabs(next);
    writeTabs(next);
    setActiveId(id);
    try { localStorage.setItem(activeKey, id); } catch {}
    if (typeof onChange === "function") onChange();
    return true;
  }, [values, activeSec, iface, tabs, activeId, key, onChange]);

  // „+” – dodaj nową zakładkę dla aktualnej sekcji
  const addTabForCurrent = useCallback(() => {
    const secIdx = activeSec;
    const secNo = secNoFor(secIdx);
    const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
    const snapshot = Array.isArray(values) ? [...values] : [];
    const next = [...tabs, { id, secIdx, secNo, snapshot }];
    setTabs(next);
    writeTabs(next);
    setActiveId(id);
    try { localStorage.setItem(activeKey, id); } catch {}
    if (typeof onChange === "function") onChange();
  }, [activeSec, values, tabs, key, onChange]);

  // Otwieranie zakładki (zapamiętaj bieżącą, przełącz sekcję i przywróć dane)
  const onOpen = useCallback((tab) => {
    try { persistActiveSnapshot(values); } catch {}
    if (typeof onSwitchSection === "function") onSwitchSection(tab.secIdx);
    applySnapshot(tab.snapshot);
    setActiveId(tab.id);
    try { localStorage.setItem(activeKey, tab.id); } catch {}
    if (typeof onChange === "function") onChange();
  }, [persistActiveSnapshot, values, onSwitchSection, onChange]);

  // Usuwanie zakładki
  const onRemove = useCallback((tab) => {
    const next = tabs.filter(t => t.id !== tab.id);
    setTabs(next);
    writeTabs(next);
    const a = (typeof window !== "undefined") ? (localStorage.getItem(activeKey) || activeId) : activeId;
    if (a === tab.id) {
      setActiveId(null);
      try { localStorage.removeItem(activeKey); } catch {}
    }
    if (typeof onChange === "function") onChange();
  }, [tabs, activeId, key, onChange]);

  // Live synchronizacja textarea podczas pisania
  const prevValsStrRef = useRef("");
  useEffect(() => {
    const s = JSON.stringify(values || []);
    if (s !== prevValsStrRef.current) {
      prevValsStrRef.current = s;
      autoCreateFromValues();                 // utwórz pierwszą zakładkę jeśli trzeba
      const changed = persistActiveSnapshot(values); // zapisz do aktywnej
      if (changed && typeof onChange === "function") onChange();
    }
  }, [values, autoCreateFromValues, persistActiveSnapshot, onChange]);

  // Etykiety 010-1, 010-2, ...
  const labeledTabs = useMemo(() => {
    const counts = {};
    return (tabs || []).map(t => {
      const k = String(t.secNo ?? secNoFor(t.secIdx));
      const ord = t.ord ?? ((counts[k] = (counts[k] || 0) + 1), counts[k]);
      return { ...t, label: `${k}-${ord}`, ord };
    });
  }, [tabs]);

  const activeLabel = useMemo(() => labeledTabs.find(t => t.id === activeId)?.label || null, [labeledTabs, activeId]);

  return (
    <>
      {/* Dolne zakładki */}
      <div className="tabs-bottom">
        {(labeledTabs || []).map((t) => {
          const isActive = t.id === activeId;
          return (
            <div key={t.id} className={`tab-bottom${isActive ? " active" : ""}`}>
              <button className="tab" onClick={() => onOpen(t)}>
                {t.label}
              </button>
              <button className="close" onClick={() => onRemove(t)} aria-label="Usuń">×</button>
            </div>
          );
        })}
        {/* + dodaj */}
        <div className="tab-bottom tab-bottom--add">
          <button className="tab" onClick={addTabForCurrent} title="Dodaj podsekcję">+</button>
        </div>
      </div>

      {activeLabel ? (
        <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
          Aktywna podsekcja: <b>{activeLabel}</b>
        </div>
      ) : null}
    </>
  );
}
