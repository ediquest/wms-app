
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";

/**
 * GeneratedTabs — DEBUG (console.log)
 * - On section entry: prefer last-edited (_last) > last-opened > newest(updatedAt).
 * - Switching tabs does NOT update _last (programmatic snapshot load is suppressed).
 * - Typing updates _last via persistActiveSnapshot. Auto-create/Add also set _last.
 * - Manual tab click isn't overridden by the section-entry effect.
 */

export default function GeneratedTabs({
  iface,
  activeSec,
  values,
  setValues,
  onSwitchSection,
  onChange,
}) {
  /* ------------------------ LocalStorage keys ------------------------ */
  const ifaceId = String(iface?.id ?? "");
  const key = `tcf_genTabs_${ifaceId}`;
  const baseActiveKey = `tcf_genTabs_active_${ifaceId}`;
  const activeKey = `${baseActiveKey}_${String(activeSec)}`;
  const lastEditedKey = `${baseActiveKey}_${String(activeSec)}_last`;

  /* ------------------------ Helpers ------------------------ */
  const readTabs = useCallback(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]") || []; } catch { return []; }
  }, [key]);

  const writeTabs = useCallback((arr) => {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
  }, [key]);

  // Mapowanie indeksów pól do sekcji — dopasuj pod swój iface; domyślnie: wszystkie
  const idxsFor = useCallback((itf, secIdx) => {
    const len = Array.isArray(values) ? values.length : 0;
    return Array.from({ length: len }, (_, i) => i);
  }, [values]);

  const pad3 = (s) => String(s ?? "").padStart(3, "0").slice(-3);
  const secNoFor = useCallback((secIdx) => {
    const raw = (iface?.sectionNumbers || [])[secIdx] ?? String(secIdx * 10);
    return pad3(raw);
  }, [iface]);

  const normalizeSnapshot = useCallback((snap, baseLen) => {
    if (!Array.isArray(snap)) return Array(baseLen).fill("");
    const out = Array(baseLen).fill("");
    for (let i = 0; i < Math.min(snap.length, baseLen); i++) out[i] = snap[i] ?? "";
    return out;
  }, []);

  /* ------------------------ State ------------------------ */
  const [tabs, setTabs] = useState(readTabs);
  useEffect(() => { setTabs(readTabs()); }, [readTabs]);

  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(activeKey) || null; } catch { return null; }
  });

  const suppressPersistRef = useRef(false);  // blokuje jeden cykl persist po programowym wczytaniu
  const prevSecRef = useRef(activeSec);      // wykrycie wejścia w nową sekcję
  const switchingRef = useRef(false);        // ręczne kliknięcie tab (żeby efekt sekcji nie nadpisywał)

  /* ------------------------ Snapshot utils ------------------------ */
  const applySnapshot = useCallback((tab) => {
    if (!tab) return;
    const idxs = idxsFor(iface, Number(tab.secIdx));
    const norm = normalizeSnapshot(tab.snapshot, (values || []).length);

    const equal = idxs.every(i => String(values?.[i] ?? "") === String(norm[i] ?? ""));
    if (equal) {
      console.log("[GT] applySnapshot -> equal, skip", { tabId: tab.id });
      return;
    }

    suppressPersistRef.current = true;
    console.log("[GT] applySnapshot -> setValues (suppress persist ON)", { tabId: tab.id });

    if (typeof setValues === "function") {
      setValues(prev => {
        const base = Array.isArray(prev) ? prev.slice() : Array(norm.length).fill("");
        for (const i of idxs) base[i] = norm[i];
        return base;
      });
    }
    setTimeout(() => {
      suppressPersistRef.current = false;
      console.log("[GT] applySnapshot -> suppress OFF");
    }, 0);
  }, [idxsFor, iface, normalizeSnapshot, setValues, values]);

  /* ------------------------ Persist on edit ------------------------ */
  const persistActiveSnapshot = useCallback((vals) => {
    try {
      const id = (typeof window !== "undefined")
        ? (localStorage.getItem(activeKey) || activeId)
        : activeId;
      console.log("[GT] persist -> active id", id);
      if (!id) return false;

      const idx = tabs.findIndex(t => t.id === id);
      if (idx === -1) {
        console.log("[GT] persist -> ACTIVE ID not found in tabs", { id });
        return false;
      }

      const snap = Array.isArray(vals) ? [...vals] : [];
      const prev = tabs[idx]?.snapshot || [];
      const same = Array.isArray(prev)
        && prev.length === snap.length
        && prev.every((v, i) => String(v) === String(snap[i]));
      if (same) {
        console.log("[GT] persist -> SAME snapshot, skip", { id });
        return false;
      }

      const next = tabs.slice();
      next[idx] = { ...next[idx], snapshot: snap, updatedAt: Date.now() };
      setTabs(next);
      writeTabs(next);

      try {
        localStorage.setItem(activeKey, id); // aktywna karta
        if (!suppressPersistRef.current) {
          localStorage.setItem(lastEditedKey, id); // _last tylko przy edycji
          console.log("[GT] persist -> set _last", { id });
        } else {
          console.log("[GT] persist -> suppressed, _last NOT updated", { id });
        }
      } catch {}

      if (typeof onChange === "function") onChange();
      return true;
    } catch (e) {
      console.log("[GT] persist -> error", e);
      return false;
    }
  }, [activeId, tabs, activeKey, lastEditedKey, writeTabs, onChange]);

  /* ------------------------ Auto-create on first typing ------------------------ */
  const autoCreateFromValues = useCallback(() => {
    const secIdx = activeSec;
    const idxs = idxsFor(iface, secIdx);
    if (!idxs.length) return false;

    const anyTyped = idxs.some(i => String(values?.[i] ?? "").trim().length > 0);
    if (!anyTyped) return false;

    const already = Array.isArray(tabs) && tabs.some(t => Number(t.secIdx) === Number(secIdx));
    if (already) return false;

    const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    const secNo = secNoFor(secIdx);
    const snapshot = Array.isArray(values) ? [...values] : [];
    const next = [...tabs, { id, secIdx, secNo, snapshot, updatedAt: Date.now() }];

    setTabs(next);
    writeTabs(next);
    setActiveId(id);

    try {
      localStorage.setItem(activeKey, id);
      localStorage.setItem(lastEditedKey, id);
    } catch {}

    if (typeof onChange === "function") onChange();
    console.log("[GT] autoCreate -> created & set _last", { secIdx, id });
    return true;
  }, [activeSec, iface, idxsFor, secNoFor, values, tabs, writeTabs, onChange, activeKey, lastEditedKey]);

  /* ------------------------ Handlers ------------------------ */
  const addTabForCurrent = useCallback(() => {
    const secIdx = activeSec;
    const secNo = secNoFor(secIdx);
    const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    const snapshot = Array.isArray(values) ? [...values] : [];
    const next = [...tabs, { id, secIdx, secNo, snapshot, updatedAt: Date.now() }];

    setTabs(next);
    writeTabs(next);
    setActiveId(id);

    try {
      localStorage.setItem(activeKey, id);
      localStorage.setItem(lastEditedKey, id);
    } catch {}

    if (typeof onChange === "function") onChange();
    console.log("[GT] addTab -> added & set _last", { secIdx, id });
  }, [activeSec, values, tabs, secNoFor, writeTabs, activeKey, lastEditedKey, onChange]);

  const onOpen = useCallback((tab) => {
    if (!tab) return;
    console.log("[GT] onOpen -> user click", { tabId: tab.id, secIdx: tab.secIdx });

    // jeśli klik przerzuca do innej sekcji — nie pozwól, by efekt 'section-entry' nadpisał ten wybór
    switchingRef.current = true;

    if (typeof onSwitchSection === "function") onSwitchSection(tab.secIdx);
    applySnapshot(tab);
    setActiveId(tab.id);
    try { localStorage.setItem(activeKey, tab.id); } catch {} // NIE ustawiamy _last
    if (typeof onChange === "function") onChange();

    setTimeout(() => { switchingRef.current = false; }, 0);
  }, [applySnapshot, onSwitchSection, onChange, activeKey]);

  const onRemove = useCallback((tab) => {
    console.log("[GT] onRemove", { tabId: tab.id });
    const next = tabs.filter(t => t.id !== tab.id);
    setTabs(next);
    writeTabs(next);

    try {
      const act = localStorage.getItem(activeKey);
      if (act === tab.id) localStorage.removeItem(activeKey);
      const last = localStorage.getItem(lastEditedKey);
      if (last === tab.id) localStorage.removeItem(lastEditedKey);
    } catch {}

    const inSec = next.filter(t => Number(t.secIdx) === Number(activeSec));
    const fallback = inSec.length ? inSec[inSec.length - 1] : null;
    if (fallback) {
      setActiveId(fallback.id);
      try { localStorage.setItem(activeKey, fallback.id); } catch {}
      applySnapshot(fallback);
    } else {
      setActiveId(null);
    }
    if (typeof onChange === "function") onChange();
  }, [tabs, activeSec, applySnapshot, writeTabs, activeKey, lastEditedKey, onChange]);

  /* ------------------------ Live persist on typing ------------------------ */
  const prevValsStrRef = useRef("");
  useEffect(() => {
    const s = JSON.stringify(values || []);
    if (s !== prevValsStrRef.current) {
      // Programowe wczytanie po kliknięciu? — omiń ten cykl
      if (suppressPersistRef.current) {
        console.log("[GT] values-effect -> suppressed (no persist)");
        suppressPersistRef.current = false;
        return;
      }
      prevValsStrRef.current = s;

      autoCreateFromValues();
      persistActiveSnapshot(values);
    }
  }, [values, autoCreateFromValues, persistActiveSnapshot]);

  /* ------------------------ Prefer _last on section entry ------------------------ */
  useEffect(() => {
    const secChanged = prevSecRef.current !== activeSec;
    prevSecRef.current = activeSec;
    if (!secChanged) return;
    if (switchingRef.current) {
      console.log("[GT] section-entry -> blocked by switchingRef (manual click)");
      return;
    }

    try {
      const inSec = Array.isArray(tabs)
        ? tabs.filter(t => Number(t.secIdx) === Number(activeSec))
        : [];

      const last  = localStorage.getItem(lastEditedKey);
      const saved = localStorage.getItem(activeKey);

      let chosen = null;
      if (last)  chosen = inSec.find(t => t.id === last) || null;
      if (!chosen && saved) chosen = inSec.find(t => t.id === saved) || null;
      if (!chosen && inSec.length) {
        chosen = inSec.reduce((best, t) => {
          const bu = Number(best?.updatedAt || 0);
          const tu = Number(t?.updatedAt || 0);
          return tu >= bu ? t : best;
        }, inSec[0]);
      }

      console.log("[GT] section-entry", { activeSec, last, saved, chosenId: chosen?.id, inSecIds: inSec.map(t => t.id) });

      if (chosen && chosen.id !== activeId) {
        setActiveId(chosen.id);
        try { localStorage.setItem(activeKey, chosen.id); } catch {}
      }
    } catch (e) {
      console.log("[GT] section-entry -> error", e);
    }
  }, [activeSec, tabs, lastEditedKey, activeKey, activeId]);

  /* ------------------------ View ------------------------ */
  const labeledTabs = useMemo(() => {
    const counts = {};
    return (tabs || []).map(t => {
      const k = String(t.secNo ?? secNoFor(t.secIdx));
      const n = (counts[k] = (counts[k] || 0) + 1);
      return { ...t, label: `${k}-${String(n).padStart(2, "0")}` };
    });
  }, [tabs, secNoFor]);

  const tabsInSection = useMemo(
    () => labeledTabs.filter(t => Number(t.secIdx) === Number(activeSec)),
    [labeledTabs, activeSec]
  );

  const activeLabel = useMemo(
    () => tabsInSection.find(t => t.id === activeId)?.label || null,
    [tabsInSection, activeId]
  );

  return (
    <>
      <div className="tabs-bottom">
        {tabsInSection.map((t) => {
          const isActive = t.id === activeId;
          return (
            <div key={t.id} className={`tab-bottom${isActive ? " active" : ""}`}>
              <button className="tab" onClick={() => onOpen(t)}>{t.label}</button>
              <button className="close" onClick={() => onRemove(t)} aria-label="Usuń">×</button>
            </div>
          );
        })}

        <div className="tab-bottom tab-bottom--add">
          <button className="tab" onClick={addTabForCurrent} title="Dodaj podsekcję">
            + Dodaj sekcje
          </button>
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
