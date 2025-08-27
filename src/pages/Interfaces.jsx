import { Link } from 'react-router-dom'
import React from 'react'
import { loadConfig, loadValues } from '../utils.js'
import { t } from '../i18n.js'

// Bezpieczna zamiana na tekst (obsługuje: null, number, object, array)
const textify = (x) => {
  if (Array.isArray(x)) return x.flat().filter(Boolean).map(String).join(' ');
  if (x == null) return '';
  return typeof x === 'string' ? x : String(x);
};

export default function Interfaces(){
  const cfg = loadConfig();
  // --- Custom order (persisted) & drag state ---
  const [dragId, setDragId] = React.useState(null);
  const [dragOver, setDragOver] = React.useState({ catId: null, index: -1, side: 'right' });
  const [armDragId, setArmDragId] = React.useState(null); // long-press armed id
  const pressRef = React.useRef(null);

  const getOrder = () => {
    try { return JSON.parse(localStorage.getItem('tcf_iface_order') || '[]'); } catch { return []; }
  };
  const setOrder = (arr) => {
    try { localStorage.setItem('tcf_iface_order', JSON.stringify(arr)); } catch {}
    try { window.dispatchEvent(new CustomEvent('tcf-interfaces-order-changed')); } catch {}
  };

  // Order-aware list of interfaces
  const allIfaces = React.useMemo(() => {
    const order = getOrder();
    const byId = new Map((cfg.interfaces || []).map(i => [i.id, i]));
    const ordered = [];
    order.forEach(id => { if (byId.has(id)) { ordered.push(byId.get(id)); byId.delete(id); } });
    // append missing
    byId.forEach(v => ordered.push(v));
    return ordered;
  }, [cfg.interfaces]);

  // Group by category (respecting 'allIfaces' order)
  const byCat = new Map();
  (cfg.categories || []).forEach(c => byCat.set(c.id, { cat: c, items: [] }));
  allIfaces.forEach(it => {
    const key = it.categoryId || (cfg.categories?.[0]?.id || 'default');
    if (!byCat.has(key)) byCat.set(key, { cat: { id: key, name: key }, items: [] });
    byCat.get(key).items.push(it);
  });

  // Long-press handlers to enable native drag on a tile
  const armDrag = (id) => {
    clearTimeout(pressRef.current);
    pressRef.current = setTimeout(() => setArmDragId(id), 180);
  };
  const disarmDrag = () => { clearTimeout(pressRef.current); setArmDragId(null); };

  const handleDragStart = (id) => { setDragId(id); };
  const handleDragEnd = () => { setDragId(null); setDragOver({ catId:null, index:-1, side:'right' }); setArmDragId(null); };

  const handleDragEnter = (catId, index, side) => {
    if (!dragId) return;
    setDragOver({ catId, index, side });
  };
  const handleDragOver = (e) => { if (dragId) { try { e.preventDefault(); } catch {} } };

  const commitDrop = () => {
    if (!dragId || !dragOver.catId || dragOver.index < 0) return;
    // build new order: iterate categories in cfg order, but replace the drag target category item order
    const cur = allIfaces.slice();
    const fromIdx = cur.findIndex(x => x.id === dragId);
    if (fromIdx === -1) return;
    const item = cur.splice(fromIdx, 1)[0];

    // Restrict reordering within the same category
    const defCat = (cfg.categories?.[0]?.id || 'default');
    const dragCat = (item.categoryId || defCat);
    if (dragCat !== dragOver.catId) { return; }

    // find indices within the target category among current list
    const catId = dragOver.catId;
    const targetCatItems = cur.filter(x => (x.categoryId || (cfg.categories?.[0]?.id || 'default')) === catId);
    // compute insertion relative to target tile in that category
    let beforeIdx = targetCatItems.findIndex(x => x.id === (byCat.get(catId)?.items?.[dragOver.index]?.id));
    if (beforeIdx < 0) beforeIdx = targetCatItems.length - 1;
    // locate that target tile's absolute index in cur
    let targetAbs = -1; let count = -1;
    for (let k=0; k<cur.length; k++) {
      if ((cur[k].categoryId || (cfg.categories?.[0]?.id || 'default')) === catId) {
        count++;
        if (count === beforeIdx) { targetAbs = k; break; }
      }
    }
    let insertPos = targetAbs >= 0 ? (targetAbs + (dragOver.side === 'right' ? 1 : 0)) : cur.length;
    cur.splice(insertPos, 0, item);
    setOrder(cur.map(x => x.id));
    try { setArmDragId(null); } catch {}
  };
    
  
  const [valTick, setValTick] = React.useState(0);
  React.useEffect(() => {
    const onVals = () => setValTick(v => v + 1);
    window.addEventListener('tcf-values-changed', onVals);
    window.addEventListener('tcf-config-changed', onVals);
    window.addEventListener('storage', onVals);
    return () => { window.removeEventListener('tcf-values-changed', onVals); window.removeEventListener('tcf-config-changed', onVals); window.removeEventListener('storage', onVals); };
  }, []);

  const usedIfaceIds = React.useMemo(() => {
    const used = new Set();
    const vals = loadValues() || {};
    (cfg.interfaces || []).forEach(it => {
      const id = it.id;
      const arr = vals[id] || [];
      const hasVal = Array.isArray(arr) && arr.some(v => String(v ?? '').trim() !== '');
      let hasGen = false;
      try { const g = JSON.parse(localStorage.getItem('tcf_genTabs_' + String(id)) || '[]') || []; hasGen = Array.isArray(g) && g.length > 0; } catch {}
      const includes = Array.isArray(it.includedSections) && it.includedSections.some(Boolean);
      if (hasVal || hasGen || includes) used.add(id);
    });
    return used;
  }, [cfg, valTick]);

  return (
    <main className="wrap">
      <section className="card">
        <h2>{textify(cfg.homeTitle).trim() || t('chooseInterface')}</h2>
        <p className="muted">{textify(cfg.homeSubtitle).trim() || t('clickToGo')}</p>
        {[...byCat.values()].map(group => (
          <div key={group.cat.id} style={{marginTop:10}}>
            <div className="catTitle">{group.cat.name}</div>
            <div className={"ifaceGrid" + (dragId ? ' drag-active' : '')} onDragOver={handleDragOver} onDrop={commitDrop}>
              {group.items.map((it, i) => (
                <Link key={it.id} className={"ifaceCard" + (armDragId===it.id ? " armed" : "") + (dragId===it.id ? " dragging" : "") + (dragOver.catId===group.cat.id && dragOver.index===i ? (dragOver.side==="left"?" drop-left":" drop-right") : "")} data-name={it.name} data-type={String(it.type || it.typeCode || "")} style={usedIfaceIds.has(it.id) ? { boxShadow: 'inset 0 0 0 2px #2ecc71', borderRadius: 12 } : undefined} to={`/iface/${it.id}`} draggable={armDragId===it.id} onMouseDown={(e)=>armDrag(it.id)} onMouseUp={disarmDrag} onMouseLeave={disarmDrag} onTouchStart={(e)=>armDrag(it.id)} onTouchEnd={disarmDrag} onDragStart={(e)=>{handleDragStart(it.id);}} onDragEnd={(e)=>{handleDragEnd();}} onDragEnter={(e)=>{ const r=e.currentTarget.getBoundingClientRect(); const side=(e.clientX<(r.left+r.width/2))?'left':'right'; handleDragEnter(group.cat.id, i, side); }} onClick={(e)=>{ if(dragId){ e.preventDefault(); e.stopPropagation(); } }}>
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
                  {it.summary ? (<div className="ifaceSummary">{textify(it.summary)}</div>) : null}
                  <div className="ifaceMeta">
                    <span className="badge cat">{group.cat.name}</span>
                    <span>{(Array.isArray(it.labels) ? it.labels.length : 0)} {t('fields')}</span>
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
