import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * useGenTabsStore(ifaceId)
 * - Trzyma i persystuje taby w LocalStorage pod kluczem per-interfejs.
 * - Zwraca { tabs, setTabs } kompatybilne z GeneratedTabs.jsx
 */
export default function useGenTabsStore(ifaceId) {
  const lsKey = useMemo(() => `tcf_genTabs_store:${ifaceId}`, [ifaceId]);
  const [tabs, setTabsState] = useState(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Re-hydrate kiedy zmienia się ifaceId (i tym samym klucz)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      setTabsState(raw ? JSON.parse(raw) : []);
    } catch {
      setTabsState([]);
    }
  }, [lsKey]);

  const setTabs = useCallback((next) => {
    setTabsState(next);
    try { localStorage.setItem(lsKey, JSON.stringify(next)); } catch {}
  }, [lsKey]);

  return { tabs, setTabs };
}
