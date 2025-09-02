
import * as XLSX from 'xlsx';

/** Helpers (ported from Python) */
const SHEET_NAME_3DIG = /^\d{3}$/;

const toStr = (v) => (v == null ? '' : String(v).trim());

function parseLengthCell(raw){
  let s = toStr(raw);
  if (!s) return null;
  if (s.toLowerCase().includes('lg')) return 'SKIP_LG';
  s = s.replace(',', ' ');
  const m = /^\s*(\d+)/.exec(s);
  if (!m) return null;
  try { return parseInt(m[1], 10) || null; } catch { return null; }
}

function splitLines(val){
  const s = toStr(val);
  if (!s) return [];
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(x => x.trim());
}

function makeField(label, maxLen, required=false, defaultVal=null, type='alnum', desc=''){
  const f = {
    label: String(label || ''),
    maxLen: parseInt(maxLen, 10),
    required: !!required,
    type,
    description: String(desc || ''),
  };
  if (defaultVal !== undefined && defaultVal !== null && String(defaultVal) !== '') f.value = defaultVal;
  return f;
}

function decode(ws, addr){
  const cell = ws[addr];
  return cell ? cell.v : '';
}

function maxRow(ws){
  try {
    const ref = ws['!ref'];
    if (!ref) return 2000;
    const range = XLSX.utils.decode_range(ref);
    return range.e.r + 1; // 1-based
  } catch { return 2000; }
}


export function parseInterfaceFromWorkbook(wb, fileStem){
  const labels = [];
  const lengths = [];
  const requiredArr = [];
  const types = [];
  const descriptions = [];
  const fieldSections = [];

  const sections = ['Introduction'];
  labels.push('Application code');
  lengths.push(2);
  requiredArr.push(true);
  types.push('alphanumeric');
  descriptions.push('');
  fieldSections.push(0);

  labels.push('Interface code');
  lengths.push(2);
  requiredArr.push(true);
  types.push('numeric');
  descriptions.push('');
  fieldSections.push(0);

  labels.push('Section');
  lengths.push(3);
  requiredArr.push(true);
  types.push('numeric');
  descriptions.push('');
  fieldSections.push(0);

  const sectionNumbers = ['000'];
  const includedSections = [true];
  const sectionColors = [''];

  const is3Digit = (name) => /^\d{3}$/.test(String(name||''));

  const decode = (ws, addr) => {
    const cell = ws[addr];
    return cell ? cell.v : '';
  };
  const toStr = (v) => (v == null ? '' : String(v).trim());
  const parseLengthCell = (raw) => {
    let s = toStr(raw);
    if (!s) return null;
    if (s.toLowerCase().includes('lg')) return 'SKIP_LG';
    s = s.replace(',', ' ');
    const m = /^\s*(\d+)/.exec(s);
    if (!m) return null;
    try { return parseInt(m[1], 10) || null; } catch { return null; }
  };
  const splitLines = (val) => {
    const s = toStr(val);
    if (!s) return [];
    return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(x => x.trim());
  };
  const maxRow = (ws) => {
    try {
      const ref = ws['!ref'];
      if (!ref) return 2000;
      const range = XLSX.utils.decode_range(ref);
      return range.e.r + 1;
    } catch { return 2000; }
  };

  wb.SheetNames.forEach(name => {
    if (!is3Digit(name)) return;
    const ws = wb.Sheets[name];
    const secNo = String(name);
    const a2 = toStr(decode(ws, 'A2'));
    let secName = a2;
    const dashIdx = a2.indexOf('-');
    if (dashIdx >= 0) { secName = a2.slice(dashIdx + 1).trim(); }
    if (!secName) secName = `Section ${secNo}`;

    const secIndex = sections.length;
    sections.push(`Section ${secNo} - ${secName}`);
    sectionNumbers.push(secNo);
    includedSections.push(true);
    sectionColors.push('');
    // Insert 4 default fields at the beginning of each section (visible in editor)
    labels.push('Sequence No.'); lengths.push(7); requiredArr.push(true); types.push('numeric'); descriptions.push(''); fieldSections.push(secIndex);
    labels.push('Application code'); lengths.push(2); requiredArr.push(true); types.push('alphanumeric'); descriptions.push(''); fieldSections.push(secIndex);
    labels.push('Interface code'); lengths.push(2); requiredArr.push(true); types.push('numeric'); descriptions.push(''); fieldSections.push(secIndex);
    labels.push('Section'); lengths.push(3); requiredArr.push(true); types.push('numeric'); descriptions.push(''); fieldSections.push(secIndex);
    

    let blankStreak = 0;
    const startRow = 10;
    const mr = Math.max(startRow, maxRow(ws));
    for (let r = startRow; r <= mr; r++){
      const b = toStr(decode(ws, `B${r}`));
      const cRaw = decode(ws, `C${r}`);
      const h = toStr(decode(ws, `H${r}`));
      const mVal = toStr(decode(ws, `M${r}`));
      const length = parseLengthCell(cRaw);

      const bEmpty = !b;
      const lengthEmpty = (length === null);
      if ((bEmpty && lengthEmpty) || length === null){
        blankStreak++;
        if (blankStreak >= 20) break;
        continue;
      } else {
        blankStreak = 0;
      }

      if (length === 'SKIP_LG') continue;
      if (length === 256 && b === 'Data') continue;

      const bLines = splitLines(decode(ws, `B${r}`));
      const cLines = splitLines(decode(ws, `C${r}`));
      const needSplit = (bLines.length > 1 || cLines.length > 1);
      if (needSplit){
        const n = Math.min(bLines.length, cLines.length);
        for (let i=0;i<n;i++){
          const subLen = parseLengthCell(cLines[i]);
          if (subLen === null || subLen === 'SKIP_LG') continue;
          labels.push(bLines[i]);
          lengths.push(subLen);
          requiredArr.push((h.toUpperCase()==='M'));
          types.push('alphanumeric');
          descriptions.push('');
          fieldSections.push(secIndex);
        }
      } else {
        labels.push(b);
        lengths.push(length);
        requiredArr.push((h.toUpperCase()==='M'));
        types.push('alphanumeric');
        descriptions.push('');
        fieldSections.push(secIndex);
      }
    }
  });

  const n = labels.length;
const defaultFields = [
    { label: 'Sequence No.', length: 7, type: 'numeric', required: true, defaultValue: '' },
    { label: 'Application code', length: 2, type: 'alphanumeric', required: true, defaultValue: 'HL' },
    { label: 'Interface code', length: 2, type: 'numeric', required: true, defaultValue: '' },
    { label: 'Section', length: 3, type: 'numeric', required: true, defaultValue: '', autoSection: true }
  ];

  return {
    id: suggestIdFromFilename(String(fileStem||'')),
    name: String(fileStem || ''),
    summary: '',
    categoryId: 'inbound',
    ifaceType: '',
    labels,
    descriptions,
    lengths,
    required: requiredArr,
    types,
    sections,
    sectionNumbers,
    includedSections,
    sectionColors,
    fieldSections,
    separators: [],
    flexFields: Array(n).fill(false),
    defaultFields
  };

}
export function suggestIdFromFilename(stem){
  let s = String(stem || 'iface').toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^-+|-+$/g,'');
  if (!s) s = 'iface';
  return s.slice(0,40);
}

export function inferTypeFromName(name){
  const stem = String(name||'').replace(/\.[^.]+$/, '');
  if (stem.length >= 12){
    const a = stem[10] || '?', b = stem[11] || '?';
    return 'HL' + String(a) + String(b);
  }
  return 'HL??';
}

export function isValidXlsFileName(fileName){
  const up = String(fileName||'').toUpperCase();
  const okPrefix = up.startsWith('EN_INT_WB');
  const okExt = /\.xls$/i.test(fileName);
  return okPrefix && okExt;
}
