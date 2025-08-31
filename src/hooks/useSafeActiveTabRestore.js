import { useEffect, useMemo, useRef } from "react";

/**
 * Safely restores an active tab's snapshot once per section without causing render loops.
 * Call inside GeneratedTabs (or similar) after you have ifaceId/activeSec/activeId.
 *
 * Example usage in GeneratedTabs.jsx:
 *   const activeKey      = `tcf_genTabs_active:${ifaceId}:${activeSec}`;
 *   const lastEditedKey  = `tcf_genTabs_last:${ifaceId}:${activeSec}`;
 *   const legacyActiveKey= `tcf_active:${ifaceId}:${activeSec}`; // optional fallback
 *   useSafeActiveTabRestore({ tabs, activeSec, activeId, setActiveId, activeKey, lastEditedKey, legacyActiveKey, applySnapshot });
 */
export default function useSafeActiveTabRestore({
  tabs,
  activeSec,
  activeId,
  setActiveId,
  activeKey,
  lastEditedKey,
  legacyActiveKey,
  applySnapshot,
}) {
  const restoreOnceRef = useRef({ sec: null, id: null });

  // Minimal "signature" so effect doesn't retrigger on changing object references.
  const tabsSig = useMemo(() => {
    const arr = Array.isArray(tabs) ? tabs.map(t => `${t.secIdx}:${t.id}`) : [];
    return arr.join("|") + "|" + arr.length;
  }, [tabs]);

  useEffect(() => {
    const sec = Number(activeSec);
    const inSec = Array.isArray(tabs) ? tabs.filter(t => Number(t.secIdx) === sec) : [];
    if (!inSec.length) return;

    const getLS = (k) => {
      try { return localStorage.getItem(k) || null; } catch { return null; }
    };

    const savedId = activeKey ? getLS(activeKey) : null;
    const lastId  = lastEditedKey ? getLS(lastEditedKey) : null;
    let chosen = inSec.find(t => t.id === (lastId || savedId)) || inSec[0];

    // optional legacy key support
    if (!lastId && !savedId && legacyActiveKey) {
      const legacy = getLS(legacyActiveKey);
      const legacyTab = inSec.find(t => t.id === legacy);
      if (legacyTab) chosen = legacyTab;
    }

    // guard: do nothing if we already restored this exact (sec, tabId)
    const was = restoreOnceRef.current;
    if (was.sec === sec && was.id === chosen.id) return;

    // set newly chosen active tab id only if changed
    if (activeId !== chosen.id) setActiveId(chosen.id);

    // persist choices (best-effort)
    try {
      if (activeKey) localStorage.setItem(activeKey, chosen.id);
      if (lastEditedKey) localStorage.setItem(lastEditedKey, chosen.id);
    } catch {}

    // restore snapshot exactly once for this pair
    if (typeof applySnapshot === "function") {
      try { applySnapshot(chosen); } catch {}
    }

    restoreOnceRef.current = { sec, id: chosen.id };
  }, [activeSec, tabsSig, activeId, setActiveId, activeKey, lastEditedKey, legacyActiveKey, applySnapshot]);
}
