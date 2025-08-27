// Segmentation parser: robust header + sectioned payload slicing + tabs snapshot
// Line format: [7 seq][4 TYPE][3 SEC][payload...]
// - Sequence: virtually checked for +1; we count fixes but don't modify input
// - TYPE matched against iface.ifaceType/name/id/code/key/short (case-insensitive, non-alphanums stripped)
// - SEC index resolved from itf.sectionNumbers (normalized) or derived from itf.sections labels (NNN)
// - Header fields (Sequence/Application/Interface/Section) are written only into fields of the current section
//   and are excluded from payload consumption
// - Payload is sliced by per-field lengths for fields of the section (length > 0)
// - First occurrence writes base; subsequent ones create tabs with snapshot: [{i,v}] only for fields of this section

export function segmentText(text, cfg, activeIface, valsMap) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim().length > 0);

  const nextVals = { ...(valsMap || {}) };
  const tabsById = new Map();
  const involvedIfaceIds = [];
  const badLines = [];
  const baseWritten = new Set(); // key: ifaceId|secIx
  let readCount = 0;

  // Sequence bookkeeping
  let expectedSeq = null;
  let seqFixes = 0;
  const fixedSeqLines = [];

  let firstTarget = null;

  const allIfaces = Array.isArray(cfg?.interfaces) ? cfg.interfaces : [];

  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const findIface = (typeCode) => {
    const up = norm(typeCode);
    if (!up) return null;
    const props = ['ifaceType','name','id','code','key','short'];
    const vals = (it) => props.map(p => norm(it && it[p]));
    // exact
    let f = allIfaces.find(it => vals(it).some(v => v === up));
    if (f) return f;
    // startsWith
    f = allIfaces.find(it => vals(it).some(v => v && v.startsWith(up)));
    if (f) return f;
    // includes
    f = allIfaces.find(it => vals(it).some(v => v && v.includes(up)));
    if (f) return f;
    return null;
  };

  for (let li = 0; li < lines.length; li++) {
    const raw = String(lines[li] || '');
    if (raw.length < 14) { badLines.push(raw); continue; }

    const seqStr  = raw.slice(0, 7);
    const typeStr = raw.slice(7, 11);
    const secStr  = raw.slice(11, 14);
    const payload = raw.slice(14);

    if (!/^\d{7}$/.test(seqStr) || !/^[A-Za-z0-9]{4}$/.test(typeStr) || !/^\d{3}$/.test(secStr)) {
      badLines.push(raw);
      continue;
    }

    // sequence virtual fix
    const seqNum = parseInt(seqStr, 10);
    if (expectedSeq == null) expectedSeq = seqNum;
    else {
      const should = expectedSeq + 1;
      if (seqNum !== should) { seqFixes++; fixedSeqLines.push(li+1); expectedSeq = should; }
      else expectedSeq = seqNum;
    }

    const itf = findIface(typeStr) || activeIface || null;
    if (!itf) { badLines.push(raw); continue; }

    const id = itf.id;
    if (!firstTarget) firstTarget = { id: id, secIx: -1 };
    if (!involvedIfaceIds.includes(id)) involvedIfaceIds.push(id);

    const labels = Array.isArray(itf.labels) ? itf.labels : [];
    const totalFields = labels.length;
    const fieldSections = Array.isArray(itf.fieldSections) ? itf.fieldSections : [];
    const lengths = Array.isArray(itf.lengths) ? itf.lengths : [];

    // resolve section index
    const secNo = String(secStr).padStart(3,'0');
    let sectionNumbers = Array.isArray(itf.sectionNumbers)
      ? itf.sectionNumbers.map(x => String(x).padStart(3,'0'))
      : [];
    if (!sectionNumbers.length) {
      sectionNumbers = (itf.sections || []).map((nm, ix) => {
        const m = String(nm || '').match(/\b(\d{3})\b/);
        return m ? m[1] : String(ix*10).padStart(3,'0');
      });
    }
    const secIx = sectionNumbers.indexOf(secNo);
    if (secIx < 0) { badLines.push(raw); continue; }

    if (firstTarget && firstTarget.secIx === -1) firstTarget.secIx = secIx;

    // base values
    const base = Array.isArray(nextVals[id]) ? [...nextVals[id]] : Array.from({length: totalFields}, () => '');

    // header mapping to fields IN THIS SECTION only
    const labelsH = labels.map(x => String(x||''));
    const lengthsH = lengths;
    const fsecH = fieldSections;
    const inSec = (i) => ((fsecH[i] ?? -1) === secIx);

    const normL = (s) => String(s||'').toLowerCase().replace(/\s+|\./g,'');
    const findBy = (key) => {
      const k = normL(key);
      for (let i=0;i<labelsH.length;i++){
        if (!inSec(i)) continue;
        const n = normL(labelsH[i]);
        if (n.includes(k)) return i;
      }
      return -1;
    };

    let seqIdx = findBy('sequence');
    if (seqIdx < 0) seqIdx = labelsH.findIndex((_,i)=> inSec(i) && Number(lengthsH[i]||0) >= 7);

    let appIdx = findBy('applicationcode');
    if (appIdx < 0) appIdx = labelsH.findIndex((_,i)=> inSec(i) && Number(lengthsH[i]||0) === 2);

    let ifcIdx = findBy('interfacecode');
    if (ifcIdx < 0) ifcIdx = labelsH.findIndex((_,i)=> inSec(i) && Number(lengthsH[i]||0) === 2);

    let secFieldIdx = findBy('section');
    if (secFieldIdx < 0) secFieldIdx = labelsH.findIndex((_,i)=> inSec(i) && Number(lengthsH[i]||0) === 3);

    if (seqIdx >= 0) base[seqIdx] = seqStr;
    if (appIdx >= 0) base[appIdx] = typeStr.slice(0,2);
    if (ifcIdx >= 0) base[ifcIdx] = typeStr.slice(2,4);
    if (secFieldIdx >= 0) base[secFieldIdx] = secStr;

    const headerSet = new Set([seqIdx, appIdx, ifcIdx, secFieldIdx].filter(i => i >= 0));

    // gather indices for this section excluding header fields
    const idxs = [];
    for (let i=0;i<totalFields;i++){
      const fs = (fieldSections[i] ?? -1);
      let belongs = false;
      if (fs === secIx) belongs = true; // A) fs has index
      const fsStr = String(fs);
      if (!belongs && fsStr && fsStr !== '-1') {
        const fsNo = fsStr.padStart(3,'0');
        if (fsNo === secNo) belongs = true; // B) fs stores section number
      }
      if (belongs && !headerSet.has(i)) idxs.push(i);
    }

    // slice payload into those fields by lengths (only L>0)
    let pos = 0;
    for (const fi of idxs) {
      const L = Number(lengths[fi] || 0);
      if (!(L > 0)) continue;
      let chunk = payload.slice(pos, pos + L);
      pos += L;
      chunk = chunk.replace(/\s+$/, ''); // trim right padding
      base[fi] = chunk;
    }

    // write base / tabs
    const key = String(id) + '|' + String(secIx);
let list = tabsById.get(id) || [];
if (!baseWritten.has(key)) {
  baseWritten.add(key);
  nextVals[id] = base;
} else {
  list.push({
    id: (Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7)),
    secIdx: secIx,
    snapshot: idxs.map(i => ({ i, v: base[i] }))
  });
}
tabsById.set(id, list);
readCount++;
  }

  try { if (firstTarget && firstTarget.id) { localStorage.setItem('tcf_seg_last', JSON.stringify(firstTarget)); } } catch {}
  return { valsMap: nextVals, tabsById, readCount, badLines, involvedIfaceIds, seqFixes, fixedSeqLines, firstTarget };
}
