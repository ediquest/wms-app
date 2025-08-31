// src/components/GeneratedTabs.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../data/notesDB.js"; // jedna, wspólna baza
import { emitSubIdxChange } from "../utils/subIndexBus";

export default function GeneratedTabs({
  iface,
  activeSec,          // numer indeksu sekcji (0-based)
  values,             // snapshot bieżących pól sekcji (array stringów)
  setValues,          // setter z Home — używamy TYLKO przy przełączaniu kart i starcie
  onSwitchSection,    // opcjonalnie: przeskok do sekcji
}) {
  const ifaceId = String(iface?.id ?? "");
  const [tabs, setTabs] = useState([]);        // [{id, secIdx, secNo, snapshot, updatedAt}]
  const [activeId, setActiveId] = useState(null);

  // flaga: dla danej sekcji czy mamy już jakiekolwiek zakładki
  const hasTabsRef = useRef(Object.create(null));     // key: `${ifaceId}|${secIdx}` -> boolean
  // flaga: czy utworzyliśmy „pierwszą” zakładkę po wpisaniu (żeby nie pętlić)
  const firstCreatedRef = useRef(Object.create(null));

  // Ile pól ma sekcja (dopasowujemy długość snapshotu)
  const fieldCount = useMemo(() => {
    if (Array.isArray(iface?.labels)) return iface.labels.length;
    if (Array.isArray(values)) return values.length;
    return 0;
  }, [iface?.labels, values]);

  const makeEmpty = useCallback(() => new Array(fieldCount).fill(""), [fieldCount]);

  const anyNonEmpty = useCallback(
    (arr) => Array.isArray(arr) && arr.some(v => String(v ?? "").trim() !== ""),
    []
  );

  const secNoFor = useCallback((secIdx) => {
    const ix = Number(secIdx);
    if (!Number.isFinite(ix)) return 1;
    try {
      const s = iface?.sections?.[ix];
      if (s && (s.no || s.number)) return Number(s.no || s.number);
    } catch {}
    return ix + 1;
  }, [iface]);

  const normalizeSnapshot = useCallback((snap) => {
    const out = makeEmpty();
    if (!Array.isArray(snap)) return out;
    // wspieramy dawne formy typu [{i,v}]
    if (snap.length && typeof snap[0] === "object" && snap[0] && "i" in snap[0]) {
      for (const it of snap) {
        const i = Number(it?.i);
        if (Number.isFinite(i) && i >= 0 && i < out.length) out[i] = String(it?.v ?? "");
      }
      return out;
    }
    for (let i = 0; i < Math.min(out.length, snap.length); i++) out[i] = String(snap[i] ?? "");
    return out;
  }, [makeEmpty]);

  const newId = () =>
    Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);

  /**
   * Zapis wyłącznie dla JEDNEJ sekcji.
   * — Czyścimy wszystkie rzędy dla [ifaceId, secIdx]
   * — Wrzucamy zbulkowane rekordy z poprawnym kluczem głównym `key`
   */
  const syncSectionToDexie = useCallback(async (secIdx, list) => {
    const sIx = Number(secIdx);
    try {
      // wyczyść sekcję
      await db.table("subValues")
        .where("[ifaceId+secIdx]").equals([ifaceId, sIx])
        .delete();

      // zapisz tylko te z danej sekcji
      const secTabs = (list || []).filter(t => Number(t.secIdx) === sIx);
      if (!secTabs.length) return;

      // budujemy rekordy ZAWSZE z kluczem `key` -> zgodnie z Twoim schematem
      const payload = secTabs.map((t, subIdx) => ({
        key: `${ifaceId}|${sIx}|${subIdx}`,
        ifaceId,
        secIdx: sIx,
        subIdx,
        vals: Array.isArray(t.snapshot) ? t.snapshot : [],
        updatedAt: Number(t.updatedAt || Date.now()),
      }));

      await db.table("subValues").bulkPut(payload);
      // (brak setState tutaj -> zero pętli)
    } catch (e) {
      console.warn("syncSectionToDexie failed", e);
    }
  }, [ifaceId]);

  const subIdxForTab = useCallback((id, secIdx) => {
    const secTabs = tabs.filter(t => Number(t.secIdx) === Number(secIdx));
    const found = secTabs.findIndex(t => t.id === id);
    return found >= 0 ? found : 0;
  }, [tabs]);

  // 1) Wczytaj istniejące podsekcje z IndexedDB (dla aktywnej sekcji)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sIx = Number(activeSec);
        const key = `${ifaceId}|${sIx}`;

        const rows = await db.table("subValues")
          .where("[ifaceId+secIdx]").equals([ifaceId, sIx])
          .toArray();

        const secNo = secNoFor(sIx);
        const next = (rows || [])
          .sort((a,b) => (a.subIdx ?? 0) - (b.subIdx ?? 0))
          .map((r) => ({
            id: `${ifaceId}_${sIx}_${Number(r.subIdx ?? 0)}`,
            secIdx: sIx,
            secNo,
            snapshot: normalizeSnapshot(r?.vals),
            updatedAt: Number(r?.updatedAt || 0),
          }));

        if (cancelled) return;

        setTabs(next);
        setActiveId(next[0]?.id ?? null);
        hasTabsRef.current[key] = next.length > 0;
        firstCreatedRef.current[key] = next.length > 0;

        // jeśli coś w DB było – ustawiamy snapshot w polach
        if (next[0]?.snapshot && typeof setValues === "function") {
          setValues(next[0].snapshot);
        }
        try { emitSubIdxChange(0); } catch {}
      } catch (e) {
        if (!cancelled) {
          setTabs([]);
          setActiveId(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [ifaceId, activeSec, secNoFor, normalizeSnapshot, setValues]);

  // 2) Utwórz PIERWSZĄ zakładkę dopiero gdy user zacznie pisać (raz na sekcję)
  useEffect(() => {
    if (!Array.isArray(values)) return;
    const sIx = Number(activeSec);
    const key = `${ifaceId}|${sIx}`;

    if (hasTabsRef.current[key]) return;        // już są (z DB albo wcześniej)
    if (firstCreatedRef.current[key]) return;   // już zrobiliśmy „pierwszą”
    if (!anyNonEmpty(values)) return;           // w polach pusto – nic nie rób

    firstCreatedRef.current[key] = true;
    hasTabsRef.current[key] = true;

    const id = newId();
    const secNo = secNoFor(sIx);
    const snap = normalizeSnapshot(values);

    setTabs(prev => {
      const next = [...prev, {
        id, secIdx: sIx, secNo, snapshot: snap, updatedAt: Date.now()
      }];
      // zapis tylko przy UTWORZENIU – bez onChange -> brak pętli
      syncSectionToDexie(sIx, next);
      return next;
    });
    setActiveId(id);
    try { emitSubIdxChange(subIdxForTab(id, sIx)); } catch {}
  }, [ifaceId, activeSec, values, anyNonEmpty, secNoFor, normalizeSnapshot, syncSectionToDexie, subIdxForTab]);

  // --- Akcje użytkownika ---
  const onOpen = useCallback((tab) => {
    if (!tab) return;
    if (typeof onSwitchSection === "function") onSwitchSection(tab.secIdx);
    setActiveId(tab.id);
    if (Array.isArray(tab.snapshot) && typeof setValues === "function") {
      setValues(tab.snapshot); // tylko przy przełączaniu
    }
    try { emitSubIdxChange(subIdxForTab(tab.id, tab.secIdx)); } catch {}
  }, [onSwitchSection, setValues, subIdxForTab]);

  const addTabForCurrent = useCallback(() => {
    const sIx = Number(activeSec);
    const key = `${ifaceId}|${sIx}`;
    const id = newId();
    const secNo = secNoFor(sIx);
    const snap = makeEmpty();

    hasTabsRef.current[key] = true;
    firstCreatedRef.current[key] = true;

    setTabs(prev => {
      const next = [...prev, { id, secIdx: sIx, secNo, snapshot: snap, updatedAt: Date.now() }];
      syncSectionToDexie(sIx, next);
      return next;
    });
    setActiveId(id);
    try { emitSubIdxChange(subIdxForTab(id, sIx)); } catch {}
  }, [activeSec, ifaceId, secNoFor, makeEmpty, syncSectionToDexie, subIdxForTab]);

  const removeTab = useCallback((tabId) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;

    const sIx = Number(tabs[idx].secIdx);
    const key = `${ifaceId}|${sIx}`;

    const next = tabs.filter(t => t.id !== tabId);
    setTabs(next);

    const secTabs = next.filter(t => Number(t.secIdx) === sIx);
    const fallback = secTabs[Math.min(idx, Math.max(0, secTabs.length - 1))] || null;
    if (fallback) onOpen(fallback); else setActiveId(null);

    hasTabsRef.current[key] = secTabs.length > 0;
    syncSectionToDexie(sIx, next);
  }, [tabs, ifaceId, onOpen, syncSectionToDexie]);

  // label w formacie 010-1, 010-2, ...
  const labeledTabs = useMemo(() => {
    const counts = {};
    return (tabs || []).map(t => {
      const k = String(t.secNo);
      counts[k] = (counts[k] || 0) + 1;
      const ord = counts[k];
      return { ...t, label: `${k.padStart(3, "0")}-${ord}`, ord };
    });
  }, [tabs]);

  const activeLabel = useMemo(
    () => labeledTabs.find(t => t.id === activeId)?.label || null,
    [labeledTabs, activeId]
  );

  return (
    <div className="tabs-bottom">
      <div className="tabs-list">
        {(labeledTabs || [])
          .filter(t => Number(t.secIdx) === Number(activeSec))
          .map((t) => (
            <button
              key={t.id}
              className={"tab" + (t.id === activeId ? " is-active" : "")}
              onClick={() => onOpen(t)}
              title={t.label}
            >
              <span className="tab-label">{t.label}</span>
              <span
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); removeTab(t.id); }}
              >
                ×
              </span>
            </button>
          ))}
        <button className="tab add" onClick={addTabForCurrent}>+ Dodaj podsekcję</button>
      </div>
      <div className="tab-active-label">{activeLabel || ""}</div>
    </div>
  );
}
