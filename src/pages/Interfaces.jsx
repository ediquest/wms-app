import { Link } from 'react-router-dom'
import React from 'react'
import { loadConfig, loadValues } from '../utils.js'
import { t } from '../i18n.js'

export default function Interfaces(){
  const cfg = loadConfig();
  
  const [valTick, setValTick] = React.useState(0);
  React.useEffect(() => {
    const onVals = () => setValTick(v => v + 1);
    window.addEventListener('tcf-values-changed', onVals);
    window.addEventListener('tcf-config-changed', onVals);
    return () => { window.removeEventListener('tcf-values-changed', onVals); window.removeEventListener('tcf-config-changed', onVals); };
  }, []);

  const usedIfaceIds = React.useMemo(() => {
    const used = new Set();
    const vals = loadValues() || {};
    (cfg.interfaces || []).forEach(it => {
      const arr = vals[it.id] || [];
      const hasVal = Array.isArray(arr) && arr.some(s => (s || '').trim().length > 0);
      const includes = Array.isArray(it.includedSections) && it.includedSections.some(Boolean);
      if (hasVal || includes) used.add(it.id);
    });
    return used;
  }, [cfg, valTick]);

const byCat = new Map();
  cfg.categories.forEach(c => byCat.set(c.id, { cat:c, items: [] }));
  cfg.interfaces.forEach(it => {
    const key = it.categoryId || cfg.categories[0]?.id;
    if (!byCat.has(key)) byCat.set(key, { cat: { id: key, name: key }, items: [] });
    byCat.get(key).items.push(it);
  });
  return (
    <main className="wrap">
      <section className="card">
        <h2>{(cfg.homeTitle||'').trim() || t('chooseInterface')}</h2>
        <p className="muted">{(cfg.homeSubtitle||'').trim() || t('clickToGo')}</p>
        {[...byCat.values()].map(group => (
          <div key={group.cat.id} style={{marginTop:10}}>
            <div className="catTitle">{group.cat.name}</div>
            <div className="ifaceGrid">
              {group.items.map(it => (
                <Link key={it.id} className="ifaceCard" data-name={it.name} data-type={(it.type || it.typeCode || "")} style={usedIfaceIds.has(it.id) ? { boxShadow: 'inset 0 0 0 2px #2ecc71', borderRadius: 12 } : undefined} to={`/iface/${it.id}`}>
                  <div className="ifaceTitle">
                    {/* subtle note icon */}
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
  <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
    <path d="M14 3v4h4M8 11h8M8 15h6M8 19h4"/>
  </g>
</svg>
                    <span>{it.name}</span>
                  </div>
                  {it.summary ? (<div className="ifaceSummary">{it.summary}</div>) : null}
                  <div className="ifaceMeta">
                    <span className="badge cat">{group.cat.name}</span>
                    <span>{it.labels.length} {t('fields')}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
