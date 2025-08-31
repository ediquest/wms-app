
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";

/**
 * GeneratedTabs — FINAL: force-sync from textarea to FIELDS **and** TAB SNAPSHOT on entry
 *
 * - On section entry: we DO NOT apply any tab snapshot (to avoid overwrites).
 * - Then we run a short retry loop to find the "generator" <textarea> and, if its text
 *   differs from current section fields, we:
 *     (1) set section fields from the textarea (suppressed persist), and
 *     (2) write the same into the active UI tab's snapshot in localStorage (without _last),
 *         so any later "applySnapshot" of that tab is already consistent.
 * - Clicking tabs: loads that tab's snapshot with suppression (so _last doesn't change).
 * - _last only updates on real edits (persist) or create/add.
 * - First values-effect after mount is skipped.
 *
 * Optional props you can pass to improve targeting of the textarea:
 *   - textAreaRef?: React.RefObject<HTMLTextAreaElement>
 *   - textAreaSelector?: string (fallback CSS selector, default '#gen-textarea')
 *   - getTextareaText?: () => string | null  // strongest signal if you can provide it
 *   - toText?: (allValues: string[], secIdx: number, idxs: number[]) => string
 *   - fromText?: (text: string, baseSectionValues: string[], secIdx: number, idxs: number[]) => string[]
 */

export default function GeneratedTabs({
  iface,
  activeSec,
  values,
  setValues,
  onSwitchSection,
  onChange,
  textAreaRef,
  textAreaSelector = "#gen-textarea",
  getTextareaText,              // strongest source if parent can provide
  toText,
  fromText,
}) {
  /* ------------------------ Keys ------------------------ */
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

  const defaultToText = useCallback((allVals, secIdx, idxs) => {
    return (idxs || []).map(i => String(allVals?.[i] ?? "")).join("\n");
  }, []);

  const defaultFromText = useCallback((text, baseSectionVals, secIdx, idxs) => {
    const lines = String(text ?? "").split(/\r?\n/);
    const out = Array(idxs.length).fill("");
    for (let k = 0; k < idxs.length; k++) out[k] = lines[k] ?? baseSectionVals?.[k] ?? "";
    return out;
  }, []);

  // Heuristic DOM scan for the generator textarea if no ref/selector works.
  const scanTextareaCandidates = useCallback(() => {
    const cands = [];
    try {
      const list = Array.from(document.querySelectorAll('textarea'));
      for (const el of list) {
        const val = typeof el.value === "string" ? el.value : "";
        const score =
          (el.id && /gen|generator|text|output/i.test(el.id) ? 4 : 0) +
          (el.name && /gen|generator|text|output/i.test(el.name) ? 3 : 0) +
          (el.className && /gen|generator|text|output/i.test(String(el.className)) ? 2 : 0) +
          (val.length > 0 ? Math.min(5, Math.floor(val.length / 1000)) : 0);
        cands.push({ el, val, score });
      }
      cands.sort((a, b) => b.score - a.score);
    } catch {}
    return cands;
  }, []);

  const getTextareaValue = useCallback(() => {
    if (typeof getTextareaText === "function") {
      try { const v = getTextareaText(); if (typeof v === "string") return v; } catch {}
    }
    if (textAreaRef && textAreaRef.current && typeof textAreaRef.current.value === "string") {
      return textAreaRef.current.value;
    }
    try {
      const primary = document.querySelector(textAreaSelector);
      if (primary && typeof primary.value === "string") return primary.value;
    } catch {}
    const cands = scanTextareaCandidates();
    if (cands.length) return cands[0].val;
    return null;
  }, [getTextareaText, textAreaRef, textAreaSelector, scanTextareaCandidates]);

  /* ------------------------ State & Refs ------------------------ */
  const [tabs, setTabs] = useState(readTabs);
  useEffect(() => { setTabs(readTabs()); }, [readTabs]);

  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(activeKey) || null; } catch { return null; }
  });

  const suppressPersistRef = useRef(false);
  const prevSecRef = useRef(activeSec);
  const mountSkipRef = useRef(true);
  const switchingRef = useRef(false);
  const syncTimerRef = useRef(null);
  const prevValsStrRef = useRef("");

  /* ------------------------ Snapshot utils ------------------------ */
  const applySnapshot = useCallback((tab) => {
    if (!tab) return;
    const idxs = idxsFor(iface, Number(tab.secIdx));
    const norm = normalizeSnapshot(tab.snapshot, (values || []).length);
    if (!idxs?.length) return;
    const equal = idxs.every(i => String(values?.[i] ?? "") === String(norm[i] ?? ""));
    if (equal) return;
    suppressPersistRef.current = true;
    if (typeof setValues === "function") {
      setValues(prev => {
        const base = Array.isArray(prev) ? prev.slice() : Array(norm.length).fill("");
        for (const i of idxs) base[i] = norm[i];
        return base;
      });
    }
    setTimeout(() => { suppressPersistRef.current = false; }, 0);
  }, [idxsFor, iface, normalizeSnapshot, setValues, values]);

  /* ------------------------ Persist on edit ------------------------ */
  const persistActiveSnapshot = useCallback((vals) => {
    try {
      const id = (typeof window !== "undefined")
        ? (localStorage.getItem(activeKey) || activeId)
        : activeId;
      if (!id) return false;
      const idx = tabs.findIndex(t => t.id === id);
      if (idx === -1) return false;
      const snap = Array.isArray(vals) ? [...vals] : [];
      const prev = tabs[idx]?.snapshot || [];
      const same = Array.isArray(prev) && prev.length === snap.length && prev.every((v, i) => String(v) === String(snap[i]));
      if (same) return false;
      const next = tabs.slice();
      next[idx] = { ...next[idx], snapshot: snap, updatedAt: Date.now() };
      setTabs(next);
      writeTabs(next);
      try {
        localStorage.setItem(activeKey, id);
        if (!suppressPersistRef.current) localStorage.setItem(lastEditedKey, id);
      } catch {}
      if (typeof onChange === "function") onChange();
      return true;
    } catch { return false; }
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
    setTabs(next); writeTabs(next); setActiveId(id);
    try { localStorage.setItem(activeKey, id); localStorage.setItem(lastEditedKey, id); } catch {}
    if (typeof onChange === "function") onChange();
    return true;
  }, [activeSec, iface, idxsFor, secNoFor, values, tabs, writeTabs, onChange, activeKey, lastEditedKey]);

  /* ------------------------ Handlers ------------------------ */
  const addTabForCurrent = useCallback(() => {
    const secIdx = activeSec;
    const secNo = secNoFor(secIdx);
    const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    const snapshot = Array.isArray(values) ? [...values] : [];
    const next = [...tabs, { id, secIdx, secNo, snapshot, updatedAt: Date.now() }];
    setTabs(next); writeTabs(next); setActiveId(id);
    try { localStorage.setItem(activeKey, id); localStorage.setItem(lastEditedKey, id); } catch {}
    if (typeof onChange === "function") onChange();
  }, [activeSec, values, tabs, secNoFor, writeTabs, activeKey, lastEditedKey, onChange]);

  const onOpen = useCallback((tab) => {
    if (!tab) return;
    switchingRef.current = true;
    if (typeof onSwitchSection === "function") onSwitchSection(tab.secIdx);
    applySnapshot(tab);
    setActiveId(tab.id);
    try { localStorage.setItem(activeKey, tab.id); } catch {}
    if (typeof onChange === "function") onChange();
    setTimeout(() => { switchingRef.current = false; }, 0);
  }, [applySnapshot, onSwitchSection, onChange, activeKey]);

  const onRemove = useCallback((tab) => {
    const next = tabs.filter(t => t.id !== tab.id);
    setTabs(next); writeTabs(next);
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
    } else { setActiveId(null); }
    if (typeof onChange === "function") onChange();
  }, [tabs, activeSec, applySnapshot, writeTabs, activeKey, lastEditedKey, onChange]);

  /* ------------------------ Live persist on typing ------------------------ */
  useEffect(() => {
    const s = JSON.stringify(values || []);
    if (s !== prevValsStrRef.current) {
      if (mountSkipRef.current) { prevValsStrRef.current = s; mountSkipRef.current = false; return; }
      if (suppressPersistRef.current) { suppressPersistRef.current = false; prevValsStrRef.current = s; return; }
      prevValsStrRef.current = s;
      autoCreateFromValues();
      persistActiveSnapshot(values);
    }
  }, [values, autoCreateFromValues, persistActiveSnapshot]);

  /* ------------------------ Section entry: set UI ONLY, then force-sync from textarea ------------------------ */
  useEffect(() => {
    const secChanged = prevSecRef.current !== activeSec;
    prevSecRef.current = activeSec;
    if (!secChanged) return;
    if (switchingRef.current) return;

    // 1) UI = saved -> newest (no apply)
    try {
      const inSec = Array.isArray(tabs) ? tabs.filter(t => Number(t.secIdx) === Number(activeSec)) : [];
      const saved = localStorage.getItem(activeKey);
      let ui = null;
      if (activeId && inSec.some(t => t.id === activeId)) ui = inSec.find(t => t.id === activeId) || null;
      if (!ui && saved) ui = inSec.find(t => t.id === saved) || null;
      if (!ui && inSec.length) {
        ui = inSec.reduce((best, t) => {
          const bu = Number(best?.updatedAt || 0);
          const tu = Number(t?.updatedAt || 0);
          return tu >= bu ? t : best;
        }, inSec[0]);
      }
      if (ui && ui.id !== activeId) {
        setActiveId(ui.id);
        try { localStorage.setItem(activeKey, ui.id); } catch {}
      }
    } catch {}

    // 2) Retry syncing from textarea to fields **and** to active UI tab snapshot
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    let tries = 0;
    syncTimerRef.current = setInterval(() => {
      tries += 1;
      try {
        if (switchingRef.current) { clearInterval(syncTimerRef.current); return; }
        const textNow = getTextareaValue();
        if (textNow == null || textNow.length === 0) { if (tries >= 12) clearInterval(syncTimerRef.current); return; }

        const idxs = idxsFor(iface, activeSec);
        const toTextFn = toText || defaultToText;
        const fromTextFn = fromText || defaultFromText;

        const sectionAsText = toTextFn(values || [], activeSec, idxs);
        const norm = (s) => String(s ?? "").replace(/\r/g, "").trimEnd();

        if (norm(textNow) !== norm(sectionAsText)) {
          const sectionVals = (idxs || []).map(i => String(values?.[i] ?? ""));
          const updatedSectionVals = fromTextFn(textNow, sectionVals, activeSec, idxs);

          // (A) Update fields (suppressed persist) + prev snapshot string
          const baseLen = Array.isArray(values) ? values.length : Math.max(...idxs, 0) + 1;
          const nextVals = Array(baseLen).fill("");
          for (let i = 0; i < baseLen; i++) nextVals[i] = String(values?.[i] ?? "");
          for (let k = 0; k < idxs.length; k++) {
            const i = idxs[k];
            nextVals[i] = updatedSectionVals[k] ?? "";
          }
          prevValsStrRef.current = JSON.stringify(nextVals);
          suppressPersistRef.current = true;
          if (typeof setValues === "function") setValues(() => nextVals);
          setTimeout(() => { suppressPersistRef.current = false; }, 0);

          // (B) Update active UI tab snapshot to match textarea, so future applySnapshot is consistent
          try {
            const arr = readTabs();
            const actId = localStorage.getItem(activeKey) || activeId;
            const idx = arr.findIndex(t => t.id === actId && Number(t.secIdx) === Number(activeSec));
            if (idx !== -1) {
              const prevSnap = Array.isArray(arr[idx]?.snapshot) ? arr[idx].snapshot.slice() : Array(nextVals.length).fill("");
              const newSnap = prevSnap.slice(0, nextVals.length);
              for (let kk = 0; kk < idxs.length; kk++) {
                const i = idxs[kk];
                newSnap[i] = nextVals[i];
              }
              arr[idx] = { ...arr[idx], snapshot: newSnap, updatedAt: Date.now() };
              setTabs(arr);
              writeTabs(arr);
            }
          } catch {}

          clearInterval(syncTimerRef.current);
        } else {
          if (tries >= 12) clearInterval(syncTimerRef.current);
        }
      } catch {
        if (tries >= 12) clearInterval(syncTimerRef.current);
      }
    }, 80);

    return () => { if (syncTimerRef.current) clearInterval(syncTimerRef.current); };
  }, [activeSec, tabs, activeKey, activeId, getTextareaValue, idxsFor, values, toText, fromText, readTabs, writeTabs]);

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
