import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { emitSubIdxChange } from "../utils/subIndexBus";
import { db, putSubVals, clearSubVals } from '../db/notesDB';

/**
 * GeneratedTabs — dolne zakładki
 * - Auto: tworzy podsekcję gdy użytkownik zaczyna wypełniać pola w bieżącej sekcji
 * - „+ Dodaj sekcje” na końcu dodaje nową podsekcję dla aktualnie oglądanej sekcji
 * - Snapshot wartości per-podsekcja (localStorage)
 * - Natychmiastowe odświeżenie textarea przez onChange()
 * - Drag & Drop: zmiana kolejności zakładek z delikatnym rozsunięciem
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
  // Skip first persist right after entering a section
  const enteredSecRef = React.useRef(0);
  const firstRunRef = React.useRef(true);

  const key = `tcf_genTabs_${String(iface?.id ?? "")}`;
  const baseActiveKey = `tcf_genTabs_active_${String(iface?.id ?? "")}`;
  const activeKey = `${baseActiveKey}_${String(activeSec)}`;
  const legacyActiveKey = baseActiveKey;
  const lastEditedKey = `${baseActiveKey}_${String(activeSec)}_last`;

// Normalize tab.snapshot to a flat array of fieldCount length
const normalizeSnap = (tab, fieldCount) => {
  let snap = Array(fieldCount).fill('');
  const raw = tab?.snapshot;
  if (Array.isArray(raw)) {
    if (raw.length && typeof raw[0] === 'object' && raw[0] && ('i' in raw[0])) {
      const map = new Map(raw.map(p => [Number(p.i), String(p.v ?? '')]));
      for (let i = 0; i < fieldCount; i++) if (map.has(i)) snap[i] = map.get(i);
    } else {
      snap = raw.slice();
      if (snap.length > fieldCount) snap = snap.slice(0, fieldCount);
      while (snap.length < fieldCount) snap.push('');
    }
  }
  return snap;
};

// Sync whole section's tabs to Dexie (overwrite Dexie state for that section)
const syncSectionToDexie = async (sectionIx, nextTabs) => {
  try {
    const ifaceId = String(iface?.id || '');
    if (!ifaceId) return;
    const fieldCount = Array.isArray(iface?.labels) ? iface.labels.length : 0;
    if (!Number.isFinite(sectionIx) || sectionIx < 0) return;
    const base = Array.isArray(nextTabs) ? nextTabs : (tabs || []);
    const secTabs = base.filter(t => Number(t.secIdx) === Number(sectionIx));
    await db.table('subValues').where('[ifaceId+secIdx]').equals([ifaceId, Number(sectionIx)]).delete();
    const records = secTabs.map((t, idx) => [idx, normalizeSnap(t, fieldCount)]);
    if (records.length) // put each row
      for (const [i, vals] of records) { await putSubVals(ifaceId, Number(sectionIx), i, vals); }
  } catch (e) {
    console.warn('syncSectionToDexie failed', e);
  }
};

  const readTabs = () => { return []; };
  const writeTabs = (arr) => { /* no-op: moved to IndexedDB */ };
  const [tabs, setTabs] = useState(readTabs);

// Hydrate tabs state from Dexie on mount / iface change
useEffect(() => {
  (async () => {
    try {
      const ifaceId = String(iface?.id || '');
      if (!ifaceId) return;
      const rows = await db.table('subValues').where('ifaceId').equals(ifaceId).toArray();
      const tabsFromDexie = rows.map(r => ({
        id: `${r.ifaceId}_${r.secIdx}_${r.subIdx}`,
        secIdx: Number(r.secIdx),
        secNo: String(r.secIdx).padStart(3,'0'),
        snapshot: Array.isArray(r.vals) ? r.vals : []
      }));
      setTabs(tabsFromDexie);
    } catch (e) {
      console.warn('hydrate tabs from Dexie failed', e);
    }
  })();
}, [iface?.id]);


  const [activeId, setActiveId] = useState(() => { try { return localStorage.getItem(activeKey) || null; } catch { return null; } });





// Compute ordinal (0-based) of a tab inside its section (based on current order in `tabs`)
const subIdxForTab = useCallback((tabId, secIdx, list) => { const _list = (list ?? tabs ?? []);
  try {
    const inSec = (_list || []).filter(t => Number(t.secIdx) === Number(secIdx));
    const pos = inSec.findIndex(t => t.id === tabId);
    return pos >= 0 ? pos : 0;
  } catch { return 0; }
}, [tabs]);
useEffect(() => {
    // mark that we just entered this section; first live sync will be ignored
    try { enteredSecRef.current = (enteredSecRef.current || 0) + 1; } catch {}
  }, [activeSec]);

  
  // Ensure we select or restore active tab scoped per section (prefer last edited)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(activeKey);
      const last = localStorage.getItem(lastEditedKey);
      const prefer = last || saved || null;
      const inSec = Array.isArray(tabs) ? tabs.filter(t => Number(t.secIdx) === Number(activeSec)) : [];
      let chosen = null;
      if (prefer) chosen = inSec.find(t => t.id === prefer) || null;
      if (!chosen && inSec.length) {
        chosen = inSec.reduce((best, t) => {
          const bu = Number(best?.updatedAt || 0);
          const tu = Number(t?.updatedAt || 0);
          return (tu >= bu) ? t : best;
        }, inSec[inSec.length - 1]);
      }
      if (chosen && activeId !== chosen.id) { setActiveId(chosen.id); try { emitSubIdxChange(subIdxForTab(chosen.id, activeSec)); } catch {} }
      if (!last && !saved) {
        const legacy = localStorage.getItem(legacyActiveKey);
        if (legacy) {
          const legacyTab = inSec.find(t => t.id === legacy) || null;
          if (legacyTab) {
            try { localStorage.setItem(activeKey, legacy); localStorage.setItem(lastEditedKey, legacy); } catch {}
            if (activeId !== legacy) setActiveId(legacy);
          }
        }
      }
    } catch {}
  }, [tabs, activeSec, activeKey, lastEditedKey, activeId]);


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

  const applySnapshot = (tab) => {
    if (!tab) return;
    const snap = tab.snapshot;
    const secIx = Number(tab.secIdx);
    const norm = normalizeSnapshot(snap, (values || []).length);
    const idxs = idxsFor(iface, secIx);
    if (!Array.isArray(norm) || !idxs?.length) return;
    if (typeof setValues === "function") {
      setValues(prev => {
        const base = Array.isArray(prev) ? prev.slice() : new Array(norm.length).fill('');
        for (const i of idxs) base[i] = norm[i];
        return base;
      });
    }
  };

  // Zapis bieżących wartości do aktywnej zakładki, jeśli się zmieniły
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
      
      
      // Keep Dexie in sync with this section
      try { syncSectionToDexie(Number(next[idx]?.secIdx), next); } catch {}
// Snapshot mirrored via syncSectionToDexie above.
return true;
    } catch { return false; }
  }, [activeId, tabs, key]);

  // Auto-utworzenie pierwszej zakładki po wpisaniu w bieżącej sekcji
  const autoCreateFromValues = useCallback(() => {
    const secIdx = activeSec;
    const idxs = idxsFor(iface, secIdx);
    if (!idxs.length) return false;
    const has = idxs.some(i => String(values?.[i] ?? "").trim().length > 0);
    if (!has) return false;
    // If any generated tab already exists for this section, do NOT auto-create another one.
    if (Array.isArray(tabs) && tabs.some(t => Number(t.secIdx) === Number(secIdx))) return false;

    const activeIdLS = (typeof window !== "undefined") ? (localStorage.getItem(activeKey) || activeId) : activeId;
    const activeTab = tabs.find(t => t.id === activeIdLS);
    if (activeTab && activeTab.secIdx === secIdx) return false;
    const secNo = secNoFor(secIdx);
    const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
    const snapshot = (Array.isArray(iface?.labels)? new Array(iface.labels.length).fill('') : []);
    const next = [...tabs, { id, secIdx, secNo, snapshot }];
    setTabs(next);
    writeTabs(next);
    setActiveId(id);
    try { const idx = subIdxForTab(id, secIdx, next); emitSubIdxChange(idx); } catch {}
    try { localStorage.setItem(activeKey, id); } catch {}
    if (typeof onChange === "function") onChange();
    return true;
  }, [values, activeSec, iface, tabs, activeId, key, onChange]);

  // Ręczne dodanie nowej podsekcji dla bieżącej sekcji (przycisk +)
  const addTabForCurrent = useCallback(() => {
    const secIdx = activeSec;
    const secNo = secNoFor(secIdx);
    const id = Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
    const snapshot = (Array.isArray(iface?.labels)? new Array(iface.labels.length).fill('') : []);
    const next = [...tabs, { id, secIdx, secNo, snapshot }];
    setTabs(next);
    writeTabs(next);
    setActiveId(id);
    try { const idx = subIdxForTab(id, secIdx, next); emitSubIdxChange(idx); } catch {}
    try { localStorage.setItem(activeKey, id); } catch {}
    if (typeof onChange === "function") onChange();
  }, [activeSec, values, tabs, key, onChange]);

  // Otwieranie / usuwanie
  const onOpen = useCallback((tab) => {
    // no persist on navigation
    if (typeof onSwitchSection === "function") onSwitchSection(tab.secIdx);
    applySnapshot(tab);
    setActiveId(tab.id);
    try { emitSubIdxChange(subIdxForTab(tab.id, tab.secIdx)); } catch {}
    try { localStorage.setItem(activeKey, tab.id);
    localStorage.setItem(lastEditedKey, tab.id);
    try { const idx = tabs.findIndex(t => t.id === tab.id); if (idx !== -1) { const next = tabs.slice(); next[idx] = { ...next[idx], updatedAt: Date.now() }; setTabs(next); writeTabs(next); } } catch {}
 } catch {}
    if (typeof onChange === "function") onChange();
  }, [persistActiveSnapshot, values, onSwitchSection, onChange]);

  const onRemove = useCallback((tab) => { const next = tabs.filter(t => t.id !== tab.id); setTabs(next); writeTabs(next); try { syncSectionToDexie(Number(tab.secIdx), next); } catch {}
    const a = (typeof window !== "undefined") ? (localStorage.getItem(activeKey) || activeId) : activeId;
    if (a === tab.id) {
      setActiveId(null);
      // keep last known; do not remove to avoid bounce
    }
    if (typeof onChange === "function") onChange();
  }, [tabs, activeId, key, onChange]);

  // Live synchronizacja textarea podczas pisania
  const prevValsStrRef = useRef("");
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    const s = JSON.stringify(values || []);
    if (s !== prevValsStrRef.current) {
      prevValsStrRef.current = s;
      const changed = persistActiveSnapshot(values);
      if (changed && typeof onChange === "function") onChange();
    }
  }, [values, persistActiveSnapshot]);
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

  /* --------------------- DRAG & DROP --------------------- */
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [overPos, setOverPos] = useState(null); // 'before' | 'after'

  const reorder = useCallback((fromId, toId, place) => {
    if (!fromId || !toId || fromId === toId) return;
    const cur = [...tabs];
    const from = cur.findIndex(t => t.id === fromId);
    const to   = cur.findIndex(t => t.id === toId);
    if (from === -1 || to === -1) return;

    const item = cur.splice(from, 1)[0];
    let insertAt = to;
    if (place === "after") insertAt = to + (from < to ? 0 : 1);
    if (place === "before") insertAt = to + (from < to ? -1 : 0);
    if (insertAt < 0) insertAt = 0;
    if (insertAt > cur.length) insertAt = cur.length;
    cur.splice(insertAt, 0, item);

    setTabs(cur);
    writeTabs(cur);
    try { if (activeId) emitSubIdxChange(subIdxForTab(activeId, activeSec, cur)); } catch {}
    if (typeof onChange === "function") onChange();
  }, [tabs, onChange]);

  const onDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch {}
  };
  const onDragOver = (e, id) => {
    e.preventDefault();
    if (!dragId || dragId === id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    setOverId(id);
    setOverPos(e.clientX < mid ? "before" : "after");
  };
  const onDrop = (e, id) => {
    e.preventDefault();
    if (dragId && id) reorder(dragId, id, overPos || "after");
    setOverId(null); setOverPos(null); setDragId(null);
  };
  const onDragEnd = () => { setOverId(null); setOverPos(null); setDragId(null); };

  // drop na końcu (na „+”)
  const onDropToAdd = (e) => {
    e.preventDefault();
    if (!dragId) return;
    const cur = [...tabs];
    const from = cur.findIndex(t => t.id === dragId);
    if (from === -1) return;
    const item = cur.splice(from, 1)[0];
    cur.push(item);
    setTabs(cur);
    writeTabs(cur);
    try { if (activeId) emitSubIdxChange(subIdxForTab(activeId, activeSec, cur)); } catch {}
    if (typeof onChange === "function") onChange();
    setOverId(null); setOverPos(null); setDragId(null);
  };

// Keep subIdx bus in sync if activeId changes
useEffect(() => {
  if (!activeId) return;
  try { emitSubIdxChange(subIdxForTab(activeId, activeSec)); } catch {}
}, [activeId, activeSec, subIdxForTab]);

  return (
    <>
      {/* Dolne zakładki */}
      <div className={`tabs-bottom${dragId ? " is-dragging" : ""}`}>
        {(labeledTabs || []).map((t) => {
          const isActive = t.id === activeId;
          const isDragOver = overId === t.id;
          const overCls = isDragOver ? (overPos === "before" ? " drag-over-before" : " drag-over-after") : "";
          return (
            <div
              key={t.id}
              className={`tab-bottom${isActive ? " active" : ""}${overCls}`}
              draggable
              onDragStart={(e) => onDragStart(e, t.id)}
              onDragOver={(e) => onDragOver(e, t.id)}
              onDrop={(e) => onDrop(e, t.id)}
              onDragEnd={onDragEnd}
            >
              <button className="tab" onClick={() => onOpen(t)}>{t.label}</button>
              <button className="close" onClick={() => onRemove(t)} aria-label="Usuń">×</button>
            </div>
          );
        })}

        {/* + dodaj / drop na koniec */}
        <div
          className="tab-bottom tab-bottom--add"
          onDragOver={(e) => { e.preventDefault(); setOverId("ADD"); setOverPos("after"); }}
          onDrop={onDropToAdd}
          onDragEnd={onDragEnd}
        >
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