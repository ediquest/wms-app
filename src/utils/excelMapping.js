import * as XLSX from 'xlsx';

export function colLetterToIndex(letter = 'M') {
  const s = String(letter || 'M').toUpperCase().trim();
  let n = 0; for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}

export function colIndexToLetter(n) {
  let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s || 'A';
}

export function loadTabsForInterface(ifaceId) {
  try {
    const raw = localStorage.getItem('tcf_genTabs_' + String(ifaceId));
    const arr = JSON.parse(raw || '[]') || [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function sectionCodeFor(iface, sIdx) {
  if (sIdx <= 0) return null;
  const s = iface?.sections?.[sIdx];
  if (!s) return String(sIdx).padStart(3, '0');
  if (typeof s === 'object' && (s.code || s.id || s.name)) {
    const cand = s.code || s.id || s.name;
    const m = String(cand).match(/\b\d{3}\b/);
    return m ? m[0] : String(sIdx).padStart(3, '0');
  }
  if (typeof s === 'string') {
    const m = s.match(/\b\d{3}\b/);
    return m ? m[0] : (s.length === 3 ? s : String(sIdx).padStart(3, '0'));
  }
  if (typeof s === 'number') return String(s).padStart(3, '0');
  return String(sIdx).padStart(3, '0');
}

export function buildUsedSectionsData(iface, valsMap) {
  const id = iface?.id;
  const labels = Array.isArray(iface?.labels) ? iface.labels : [];
  const fieldSections = Array.isArray(iface?.fieldSections) ? iface.fieldSections : [];
  const baseVals = Array.isArray(valsMap?.[id]) ? valsMap[id] : [];
  const tabs = loadTabsForInterface(id);
  const tabsBySec = new Map();
  for (const t of tabs) {
    const sec = t?.secIdx;
    if (typeof sec !== 'number') continue;
    if (!tabsBySec.has(sec)) tabsBySec.set(sec, []);
    tabsBySec.get(sec).push(t);
  }
  const result = [];
  const totalSecs = (iface?.sections?.length || 0);
  for (let s = 1; s < totalSecs; s++) {
    const idxs = fieldSections.map((sec, i) => (sec === s ? i : -1)).filter(i => i !== -1);
    const rows = idxs.map(i => {
      const base = baseVals[i] ?? '';
      const tabVals = (tabsBySec.get(s) || []).map(t => {
        const snap = Array.isArray(t.snapshot) ? t.snapshot : [];
        const hit = snap.find(x => x.i === i);
        return hit ? (hit.v ?? '') : '';
      }).filter(v => v !== '');
      const all = [base, ...tabVals].filter(v => String(v).trim() !== '');
      const value = all.length ? all.join('\n') : '';
      return { label: labels[i] ?? (`Field ${i}`), value };
    });
    const used = rows.some(r => String(r.value).trim() !== '');
    if (used) result.push({ code: sectionCodeFor(iface, s) || String(s).padStart(3, '0'), rows });
  }
  return result;
}

export function createWorkbookNewFile(iface, valsMap, finalText) {
  const wb = XLSX.utils.book_new();
  const s1 = XLSX.utils.aoa_to_sheet([[String(finalText || '')]]);
  XLSX.utils.book_append_sheet(wb, s1, 'Original Interface');
  const sections = buildUsedSectionsData(iface, valsMap);
  for (const sec of sections) {
    const aoa = [['Field', 'Value'], ...sec.rows.map(r => [r.label, r.value])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sec.code);
  }
  return wb;
}

export function applyMappingToWorkbook(wb, iface, valsMap, finalText, targetColLetter = 'M') {
  const origWS = XLSX.utils.aoa_to_sheet([[String(finalText || '')]]);
  wb.Sheets['Original Interface'] = origWS;
  const names = wb.SheetNames.filter(n => n !== 'Original Interface');
  wb.SheetNames = ['Original Interface', ...names];

  const sections = buildUsedSectionsData(iface, valsMap);
  const byCode = new Map(sections.map(s => [s.code, s]));

  const colLetterToIndex = (letter) => {
    const s = String(letter || 'M').toUpperCase().trim(); let n = 0;
    for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n;
  };

  const targetColIndex = colLetterToIndex(targetColLetter);
  const ignored = new Set(['sequence', 'application code', 'interface code', 'section', 'sekwencje', 'sekcja', 'kod aplikacji', 'kod interfejsu']);

  for (const sheetName of wb.SheetNames) {
    if (!/^\d{3}$/.test(sheetName)) continue;
    const sec = byCode.get(sheetName);
    if (!sec) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;
    const wanted = new Map();
    for (const r of sec.rows) {
      const key = String(r.label || '').trim().toLowerCase();
      if (!key || ignored.has(key)) continue;
      wanted.set(key, r.value ?? '');
    }
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
      const addrB = XLSX.utils.encode_cell({ r: R, c: 1 });
      const cellB = ws[addrB];
      if (!cellB || typeof cellB.v === 'undefined') continue;
      const label = String(cellB.v).trim().toLowerCase();
      if (!label || !wanted.has(label)) continue;
      const value = wanted.get(label) ?? '';
      const addrT = XLSX.utils.encode_cell({ r: R, c: targetColIndex - 1 });
      ws[addrT] = { t: 's', v: String(value) };
    }
    const newRange = XLSX.utils.decode_range(ws['!ref']);
    newRange.e.c = Math.max(newRange.e.c, targetColIndex - 1);
    ws['!ref'] = XLSX.utils.encode_range(newRange);
  }
  return wb;
}

export function downloadWorkbook(wb, filename = 'mapping.xlsx') {
  try {
    if (typeof XLSX?.writeFile === 'function') {
      XLSX.writeFile(wb, filename);
      return;
    }
  } catch (e) {}
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'mapping.xlsx';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}


export function applyMappingToWorkbookPreserveLayout(wb, iface, valsMap, finalText, targetColLetter = 'M') {
  const sections = buildUsedSectionsData(iface, valsMap);
  const byCode = new Map(sections.map(s => [s.code, s]));

  const colLetterToIndex = (letter) => {
    const s = String(letter || 'M').toUpperCase().trim(); let n = 0;
    for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n;
  };
  const targetColIndex = colLetterToIndex(targetColLetter);

  const ignored = new Set(['sequence','application code','interface code','section','sekwencje','sekcja','kod aplikacji','kod interfejsu']);

  for (const sheetName of wb.SheetNames) {
    if (!/^\d{3}$/.test(sheetName)) continue;
    const sec = byCode.get(sheetName);
    if (!sec) continue;
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const origCols = ws['!cols'];
    const origRows = ws['!rows'];
    const origRef  = ws['!ref'];

    const wanted = new Map();
    for (const r of sec.rows) {
      const key = String(r.label || '').trim().toLowerCase();
      if (!key || ignored.has(key)) continue;
      wanted.set(key, r.value ?? '');
    }

    if (origRef) {
      const range = XLSX.utils.decode_range(origRef);
      for (let R = range.s.r; R <= range.e.r; R++) {
        const addrB = XLSX.utils.encode_cell({ r: R, c: 1 });
        const cellB = ws[addrB];
        if (!cellB || typeof cellB.v === 'undefined') continue;
        const label = String(cellB.v).trim().toLowerCase();
        if (!label || !wanted.has(label)) continue;
        const value = wanted.get(label) ?? '';
        const addrT = XLSX.utils.encode_cell({ r: R, c: targetColIndex - 1 });
        ws[addrT] = { t: 's', v: String(value) };
      }
    } else {
      for (let R = 0; R < 500; R++) {
        const addrB = XLSX.utils.encode_cell({ r: R, c: 1 });
        const cellB = ws[addrB];
        if (!cellB || typeof cellB.v === 'undefined') continue;
        const label = String(cellB.v).trim().toLowerCase();
        if (!label || !wanted.has(label)) continue;
        const value = wanted.get(label) ?? '';
        const addrT = XLSX.utils.encode_cell({ r: R, c: targetColIndex - 1 });
        ws[addrT] = { t: 's', v: String(value) };
      }
    }

    if (typeof origRef !== 'undefined') ws['!ref'] = origRef;
    if (origCols) ws['!cols'] = origCols;
    if (origRows) ws['!rows'] = origRows;
  }
  return wb;
}

