// Segmentation parser: fixed-width header + fixed-width fields per section.
// Header per line: [7-digit sequence][4-char TYPE][3-digit SEC][payload...]
// - Sequence is virtually checked/corrected (+1). We don't modify the line; we only count fixes.
// - TYPE is matched against iface.ifaceType, then name, then id (case-insensitive, whitespace-insensitive).
// - SECTION index is resolved from iface.sectionNumbers (if present) or inferred from iface.sections text (NNN).
// - Data is sliced by per-field lengths (itf.lengths[i]) for fields whose fieldSections[i] belongs to the section.
// - Fields with length <= 0 are left untouched (not consumed).
// - First occurrence of a section writes into the base values; subsequent occurrences for the same section create tabs.

export function segmentText(text, cfg, activeIface, valsMap) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim().length > 0);

  const nextVals = { ...(valsMap || {}) };
  const tabsById = new Map();
  const involvedIfaceIds = [];
  const badLines = [];
  const baseWritten = new Set(); // key: ifaceId|secIx

  let readCount = 0;

  // Sequence auto-fix bookkeeping (virtual, only reported)
  let expectedSeq = null;
  let seqFixes = 0;
  const fixedSeqLines = []; // 1-based line numbers

  const allIfaces = Array.isArray(cfg?.interfaces) ? cfg.interfaces : [];

  const normStr = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');
  const findIfaceByType = (typeCode) => {
    const up = normStr(typeCode);
    // try iface.ifaceType (e.g., "HL0A"), then name, then id; finally includes
    let found = allIfaces.find(it => normStr(it.ifaceType) === up);
    if (!found) found = allIfaces.find(it => normStr(it.name) === up);
    if (!found) found = allIfaces.find(it => normStr(it.id) === up);
    if (!found) found = allIfaces.find(it => normStr(it.ifaceType || it.name || it.id).includes(up));
    return found || activeIface || null;
  };

  for (let li = 0; li < lines.length; li++) {
    const raw = String(lines[li] || '');

    if (raw.length < 14) { badLines.push(raw); continue; }

    const seqStr  = raw.slice(0, 7);
    const typeStr = raw.slice(7, 11);
    const secStr  = raw.slice(11, 14);
    const payload = raw.slice(14); // rest of the line; spaces are part of data

    // Validate minimal header shape
    if (!/^\d{7}$/.test(seqStr) || !/^[A-Za-z0-9]{4}$/.test(typeStr) || !/^\d{3}$/.test(secStr)) {
      badLines.push(raw);
      continue;
    }

    // Sequence auto-fix (virtual)
    const seqNum = parseInt(seqStr, 10);
    if (expectedSeq == null) {
      expectedSeq = seqNum;
    } else {
      const shouldBe = expectedSeq + 1;
      if (seqNum !== shouldBe) {
        seqFixes += 1;
        fixedSeqLines.push(li + 1);
        expectedSeq = shouldBe;
      } else {
        expectedSeq = seqNum;
      }
    }

    const itf = findIfaceByType(typeStr);
    if (!itf) { badLines.push(raw); continue; }

    const id = itf.id;
    if (!involvedIfaceIds.includes(id)) involvedIfaceIds.push(id);

    // Resolve section index by number (normalize to 3-digit string on both sides)
    const secNo = String(secStr).padStart(3, '0');
    let sectionNumbers = Array.isArray(itf.sectionNumbers)
      ? itf.sectionNumbers.map(x => String(x).padStart(3, '0'))
      : [];
    if (!sectionNumbers.length) {
      sectionNumbers = (itf.sections || []).map((nm, ix) => {
        const m = String(nm || '').match(/\b(\d{3})\b/);
        return m ? m[1] : String(ix * 10).padStart(3, '0');
        // fallback ix*10 ensures deterministic order if no numbers in labels
      });
    }
    const secIx = sectionNumbers.indexOf(secNo);
    if (secIx < 0) { badLines.push(raw); continue; }

    // Prepare base values for this interface
    const labels = Array.isArray(itf.labels) ? itf.labels : [];
    const totalFields = labels.length;
    const fieldSections = Array.isArray(itf.fieldSections) ? itf.fieldSections : [];
    const lengths = Array.isArray(itf.lengths) ? itf.lengths : [];

    const base = Array.isArray(nextVals[id]) ? [...nextVals[id]] : Array.from({ length: totalFields }, () => '');

    // --- NEW: map header (seq/type/section) into header fields if present ---
    const labelsH  = labels.map(x => String(x || ''));
    const lengthsH = lengths;
    const fsecH    = fieldSections;
    const inSec = (i) => ((fsecH[i] ?? -1) === secIx);

    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
    const findByLabelInSec = (key) => {
      const k = norm(key);
      for (let i = 0; i < labelsH.length; i++) {
        if (!inSec(i)) continue;
        const n = norm(labelsH[i]);
        if (n.includes(k)) return i;
      }
      return -1;
    };

    // Prefer strictly in-section fields; we do NOT populate header fields belonging to other sections.
    let seqIdx = findByLabelInSec('sequence');
    if (seqIdx < 0) {
      seqIdx = labelsH.findIndex((_, i) => inSec(i) && Number(lengthsH[i] || 0) >= 7);
    }

    let appIdx = findByLabelInSec('applicationcode');
    if (appIdx < 0) {
      appIdx = labelsH.findIndex((_, i) => inSec(i) && Number(lengthsH[i] || 0) === 2);
    }

    let ifcIdx = findByLabelInSec('interfacecode');
    if (ifcIdx < 0) {
      ifcIdx = labelsH.findIndex((_, i) => inSec(i) && Number(lengthsH[i] || 0) === 2);
    }

    let secFieldIdx = findByLabelInSec('section');
    if (secFieldIdx < 0) {
      secFieldIdx = labelsH.findIndex((_, i) => inSec(i) && Number(lengthsH[i] || 0) === 3);
    }

    if (seqIdx >= 0) base[seqIdx] = seqStr;
    if (appIdx >= 0) base[appIdx] = typeStr.slice(0, 2);
    if (ifcIdx >= 0) base[ifcIdx] = typeStr.slice(2, 4);
    if (secFieldIdx >= 0) base[secFieldIdx] = secStr;
const headerSet = new Set([seqIdx, appIdx, ifcIdx, secFieldIdx].filter(i => i >= 0));
// --- END header mapping ---

    // Collect field indices that belong to this section (in natural order).
    // Support both styles:
    //  A) fieldSections stores section INDEX (0-based)
    //  B) fieldSections stores section NUMBER (e.g. 111) or string '111'
    const idxs = [];
    for (let i = 0; i < totalFields; i++) {
      const fs = (fieldSections[i] ?? -1);
      let belongs = false;
      if (fs === secIx) belongs = true; // style A
      const fsStr = String(fs);
      if (!belongs && fsStr && fsStr !== '-1') {
        const fsNo = fsStr.padStart(3, '0');
        if (fsNo === secNo) belongs = true; // style B
      }
      if (belongs && !(headerSet && headerSet.has(i))) idxs.push(i);
    }
    // Brak pól przypisanych do sekcji nie robi z linii błędnej; po prostu nic nie wypełnimy.

    // Slice payload by lengths for each field in this section
    let pos = 0;
    let consumed = 0;
    for (const fi of idxs) {
      const L = Number(lengths[fi] || 0);
      if (!(L > 0)) {
        // Zero/missing length => nie nadpisujemy tego pola i nic nie konsumujemy
        continue;
      }
      let chunk = payload.slice(pos, pos + L);
      pos += L;
      consumed += L;
      // Trim only right padding; zachowujemy spacje wewnętrzne/leading
      chunk = chunk.replace(/\s+$/, '');
      base[fi] = chunk;
    }

    // First occurrence for (id,secIx) -> write to base; subsequent -> add as tab snapshot
    const key = String(id) + '|' + String(secIx);
    if (!baseWritten.has(key)) {
      baseWritten.add(key);
      nextVals[id] = base;
    } else {
      const list = tabsById.get(id) || [];
      list.push({
        id: (Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)),
        secIdx: secIx,
        snapshot: base.slice()
      });
      tabsById.set(id, list);
    }

    readCount += 1;
  }

  return { valsMap: nextVals, tabsById, readCount, badLines, involvedIfaceIds, seqFixes, fixedSeqLines };
}
