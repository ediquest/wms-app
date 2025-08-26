
import React from 'react';
import ScrollTabs from './ScrollTabs.jsx';

export default function GeneratedTabs({
  iface,
  activeSec,
  values,
  valsMap,
  setValues,
  setValsMap,
  onSwitchSection, onChange }){
  if (!iface) return null;
  const key = 'tcf_genTabs_' + String(iface.id);
  const activeKey = 'tcf_genTabs_active_' + String(iface.id);
const writeTabs = (arr) => { try { localStorage.setItem(key, JSON.stringify(arr)); } catch {} };

  const [tabs, setTabs] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch { return []; }
  });

  // Reload when iface changes
  React.useEffect(() => {
    try { setTabs(JSON.parse(localStorage.getItem(key) || '[]') || []); } catch { setTabs([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iface?.id]);

  // Persist
  React.useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(tabs)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, iface?.id]);

  const takeSnapshot = (secIdx) => {
    const idxs = (iface.fieldSections || []).map((s,i)=>s===secIdx?i:-1).filter(i=>i!==-1);
    return idxs.map(i => ({ i, v: values[i] ?? '' }));
  };

  const applySnapshot = (snap) => {
    const arr = (valsMap[iface.id] ?? Array.from({ length: (iface.labels || []).length }, () => '')).slice();
    (snap || []).forEach(({i, v}) => { arr[i] = v; });
    setValues(arr);
    const map = { ...valsMap, [iface.id]: arr }; setValsMap(map);
    try { localStorage.setItem('tcf_values', JSON.stringify(map)); } catch {}
  };

  const onGenerate = () => {
    const secIdx = activeSec;
    const secNo = ((()=>{ const fromTitle = (((iface.sections?.[secIdx]||'').match(/\b(\d{3})\b/)||[])[1]); const raw = fromTitle ?? (iface.sectionNumbers||[])[secIdx] ?? String(secIdx*10); const s=String(raw??''); return s.padStart(3,'0').slice(-3); })());
    const snapshot = takeSnapshot(secIdx);
    const id = Date.now().toString(36) + '_' + String(secNo) + '_' + Math.random().toString(36).slice(2,7);
    const next = [...tabs, { id, secIdx, secNo, snapshot }];
    setTabs(next);
      writeTabs(next);
      try { localStorage.setItem(activeKey, id); } catch {}
      if (typeof onChange === 'function') onChange();
  };

  const onOpen = (tab) => {
    applySnapshot(tab.snapshot);
    if (typeof onSwitchSection === 'function') onSwitchSection(tab.secIdx);
    try { localStorage.setItem(activeKey, tab.id); } catch {}
  };

  const onRemove = (tab) => {
    const next = tabs.filter(t => t.id !== tab.id);
    setTabs(next);
    writeTabs(next);
    try { const a = localStorage.getItem(activeKey); if (a === tab.id) localStorage.removeItem(activeKey); } catch {}
    if (typeof onChange === 'function') onChange();
  };

  // UI: left-aligned button + tabs bar
  return (
    <div className="genTabsBar" style={{ display:'flex', alignItems:'center', gap:8 }}>
      <button onClick={onGenerate}>
        { /* i18n key optional: 'generateSection' */ }
        Generuj
      </button>
      <div style={{ minWidth: 200, flex:1 }}>
        <ScrollTabs height={38}>
          <div className="tabs">
            {tabs.map((t) => (
              <div key={t.id} className="tab" onClick={() => onOpen(t)} title={"Sekcja " + t.secNo}>
                {t.secNo}
                <button className="close" style={{ marginLeft:8 }} onClick={(e)=>{ e.stopPropagation(); onRemove(t); }}>×</button>
              </div>
            ))}
          </div>
        </ScrollTabs>
      </div>
    </div>
  );
}
