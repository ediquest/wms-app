// ===== Keys =====
export const KEY_CFG = 'tcf_config_v9_2_2';
export const KEY_VALS = 'tcf_values_v9_2_2';
export const KEY_ROLE = 'tcf_role_v9_2_2';

// ===== Themes =====
export const THEME_LIGHT = {
  bg:'#f7f8ff', card:'#ffffff', muted:'#4b5675', text:'#0b1020', accent:'#2856e6', border:'#d9def2',
  inputBg:'#ffffff', inputText:'#0b1020', btnBg:'#eef1ff', btnText:'#0b1020', btnBorder:'#c9cfee'
};
export const THEME_DARK = {
  bg:'#070912', card:'#0e132b', muted:'#9aa4bf', text:'#e8ecff', accent:'#7aa2ff', border:'#1b2447',
  inputBg:'#0e1530', inputText:'#e8ecff', btnBg:'#13235b', btnText:'#e8ecff', btnBorder:'#2a3a7a'
};
export const THEME_VS_DARK_PLUS = {
  bg:'#1e1e1e', card:'#252526', muted:'#9da3ae', text:'#d4d4d4', accent:'#569cd6', border:'#2d2d2d',
  inputBg:'#1f1f1f', inputText:'#d4d4d4', btnBg:'#2a2a2a', btnText:'#d4d4d4', btnBorder:'#3a3a3a'
};
export const THEME_VS_LIGHT_PLUS = {
  bg:'#ffffff', card:'#f3f3f3', muted:'#5f6368', text:'#1e1e1e', accent:'#007acc', border:'#e5e5e5',
  inputBg:'#ffffff', inputText:'#1e1e1e', btnBg:'#f3f3f3', btnText:'#1e1e1e', btnBorder:'#dcdcdc'
};
export const THEME_VS_DARK_VS = {
  bg:'#2d2d30', card:'#333337', muted:'#a9a9ad', text:'#dadada', accent:'#0097fb', border:'#3e3e42',
  inputBg:'#2f2f33', inputText:'#dadada', btnBg:'#3a3a3f', btnText:'#dadada', btnBorder:'#4a4a50'
};
export const THEME_VS_LIGHT_VS = {
  bg:'#ffffff', card:'#f5f5f5', muted:'#5f6368', text:'#000000', accent:'#007acc', border:'#e1e1e1',
  inputBg:'#ffffff', inputText:'#000000', btnBg:'#f0f0f0', btnText:'#000000', btnBorder:'#d9d9d9'
};
export const THEME_VS_ABYSS = {
  bg:'#000c18', card:'#001a2b', muted:'#96a8b9', text:'#d7e2ea', accent:'#33b3a6', border:'#073042',
  inputBg:'#001726', inputText:'#d7e2ea', btnBg:'#03243a', btnText:'#d7e2ea', btnBorder:'#0a3c5b'
};

export const THEMES = [
  { id:'light', name:'Light (Classic)', value: THEME_LIGHT },
  { id:'dark',  name:'Dark (Classic)',  value: THEME_DARK },
  { id:'vs-dark-plus',  name:'Dark+ (Default Dark)', value: THEME_VS_DARK_PLUS },
  { id:'vs-light-plus', name:'Light+ (Default Light)', value: THEME_VS_LIGHT_PLUS },
  { id:'vs-dark-vs',    name:'Dark (Visual Studio)', value: THEME_VS_DARK_VS },
  { id:'vs-light-vs',   name:'Light (Visual Studio)', value: THEME_VS_LIGHT_VS },
  { id:'vs-abyss',      name:'Abyss', value: THEME_VS_ABYSS }
];

function uid(){ return Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4) }

export function getThemeId(cfg){
  if (cfg && cfg.themeId) return cfg.themeId;
  const bg = (cfg && cfg.theme && cfg.theme.bg) ? cfg.theme.bg : THEME_DARK.bg;
  const found = THEMES.find(t => t.value.bg === bg);
  return found ? found.id : 'dark';
}

export function applyTheme(theme, themeId){
  const root=document.documentElement;
  try{ Object.entries(theme||{}).forEach(([k,v])=> root.style.setProperty(`--${k}`, v)); }catch{}
  // dark heuristic
  function hexToRgb(hex){ const h=String(hex||'').replace('#',''); const n=h.length===3? h.split('').map(c=>c+c).join('') : h; const int=parseInt(n||'000000',16); return { r:(int>>16)&255, g:(int>>8)&255, b:int&255 }; }
  function relLum({r,g,b}){ const c=[r,g,b].map(v=>{ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; }
  let isDark=false;
  try{
    const id=String(themeId||''); if(id){ isDark=/dark|abyss|midnight|dracula|dim|slate/i.test(id); }
    else if(theme && theme.bg){ const lum=relLum(hexToRgb(theme.bg)); isDark = lum < 0.5; }
  }catch{}
  try{
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.body.classList.toggle('theme-dark', isDark);
    document.body.classList.toggle('theme-light', !isDark);
  }catch{}
}

export function setThemeById(id){
  const cfg = loadConfig();
  const found = THEMES.find(t => t.id === id) || THEMES[1]; // default dark
  const next = { ...cfg, theme: found.value, themeId: found.id };
  saveConfig(next);
  applyTheme(found.value, found.id);
}
export function setThemeLight(){ const cfg=loadConfig(); const next={...cfg, theme:THEME_LIGHT, themeId:'light'}; saveConfig(next); applyTheme(THEME_LIGHT, 'light'); }
export function setThemeDark(){ const cfg=loadConfig(); const next={...cfg, theme:THEME_DARK, themeId:'dark'}; saveConfig(next); applyTheme(THEME_DARK, 'dark'); }

// ===== Defaults =====
const DEFAULT_CATS = [{ id:'inbound', name:'Inbound' }];
const DEFAULT_IFACES = [{
  summary:'Krótki opis demonstracyjny interfejsu testowego.',
  id:'test', name:'test', categoryId:'inbound', ifaceType:'',
  labels:['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'],
  descriptions:Array(12).fill(''),
  lengths:Array(12).fill(10),
  required:Array(12).fill(false),
  types:Array(12).fill('alphanumeric'),
  sections:['Introduction','Pierwsza sekcja'], sectionNumbers:['000','010'],
  fieldSections:Array(12).fill(0),
  separators:[],
  flexFields:Array(12).fill(false),

  sectionNotes:Array(2).fill(''),
  sectionNotesEnabled:[false, false],
}];
const DEFAULT_CFG = { siteTitle:'', homeTitle:'', homeSubtitle:'', theme:THEME_DARK, themeId:'dark', categories:DEFAULT_CATS, interfaces:DEFAULT_IFACES };

// ===== Storage helpers =====
function ensureDefault(){
  const raw = localStorage.getItem(KEY_CFG);
  if (!raw) localStorage.setItem(KEY_CFG, JSON.stringify(DEFAULT_CFG));
  if (!localStorage.getItem(KEY_ROLE)) localStorage.setItem(KEY_ROLE, 'admin');
  if (!localStorage.getItem(KEY_VALS)) localStorage.setItem(KEY_VALS, JSON.stringify({}));
}

export function loadConfig(){
  try{
    ensureDefault();
    const cfg = JSON.parse(localStorage.getItem(KEY_CFG) || '{}');
    cfg.siteTitle = cfg.siteTitle || '';
    cfg.homeTitle = typeof cfg.homeTitle==='string'? cfg.homeTitle : '';
    cfg.homeSubtitle = typeof cfg.homeSubtitle==='string'? cfg.homeSubtitle : '';
    cfg.theme = cfg.theme || THEME_DARK; cfg.themeId = cfg.themeId || getThemeId(cfg);
    cfg.categories = Array.isArray(cfg.categories)&&cfg.categories.length? cfg.categories : DEFAULT_CATS;

    // Normalize interfaces list
    cfg.interfaces = (cfg.interfaces||[]).map(i => ({
      id: String(i.id || uid()),
      name: i.name || 'iface',
      categoryId: i.categoryId || (cfg.categories[0]?.id || 'inbound'),
      ifaceType: typeof i.ifaceType === 'string' ? i.ifaceType : '',
      summary: typeof i.summary === 'string' ? i.summary : '',
      labels: Array.isArray(i.labels) ? i.labels : [],
      descriptions: Array.isArray(i.descriptions) ? i.descriptions : Array((i.labels || []).length).fill(''),
      lengths: Array.isArray(i.lengths) ? i.lengths : Array((i.labels || []).length).fill(10),
      required: Array.isArray(i.required) ? i.required : Array((i.labels || []).length).fill(false),
      types: Array.isArray(i.types) ? i.types : Array((i.labels || []).length).fill('alphanumeric'),
      sections: Array.isArray(i.sections) && i.sections.length ? i.sections : ['Pierwsza sekcja'],
      fieldSections: Array.isArray(i.fieldSections) ? i.fieldSections : Array((i.labels || []).length).fill(0),
      separators: Array.isArray(i.separators) ? i.separators : [],
      includedSections: Array.isArray(i.includedSections)
        ? (Array.isArray(i.sections) && i.includedSections.length === i.sections.length
            ? i.includedSections
            : i.sections.map(() => false))
        : (Array.isArray(i.sections) ? i.sections.map(() => false) : []),
      sectionColors: (Array.isArray(i.sectionColors) && Array.isArray(i.sections))
        ? (i.sectionColors.length === i.sections.length
            ? i.sectionColors
            : i.sections.map((_, ix) => i.sectionColors[ix] || ''))
        : (Array.isArray(i.sections) ? i.sections.map(() => '') : []),
      flexFields: Array.isArray(i.flexFields) ? i.flexFields :
        (i.mode === 'flex'
          ? Array((i.labels || []).length).fill(true)
          : Array((i.labels || []).length).fill(false)),
      sectionNotes: (Array.isArray(i.sectionNotes) && Array.isArray(i.sections))
        ? (i.sectionNotes.length === i.sections.length
            ? i.sectionNotes.map(x => String(x ?? ''))
            : i.sections.map((_, ix) => String(i.sectionNotes?.[ix] ?? '')))
        : (Array.isArray(i.sections) ? i.sections.map(() => '') : []),
      sectionNotesEnabled: (Array.isArray(i.sectionNotesEnabled) && Array.isArray(i.sections))
        ? (i.sectionNotesEnabled.length === i.sections.length
            ? i.sectionNotesEnabled.map(v => !!v)
            : i.sections.map((_, ix) => !!i.sectionNotesEnabled?.[ix]))
        : (Array.isArray(i.sections) ? i.sections.map((_, ix) => ix === 0 ? false : true) : []),

    }));
    return cfg;
  } catch (e) {
    console.error('[loadConfig] parse error', e);
    return JSON.parse(JSON.stringify(DEFAULT_CFG));
  }
}

export function saveConfig(next){
  try{
    localStorage.setItem(KEY_CFG, JSON.stringify(next || {}));
    // Notify
    try { localStorage.setItem(KEY_CFG + '_bump', String(Date.now())); } catch {}
    try { window.dispatchEvent(new Event('tcf-config-changed')); } catch {}
    return true;
  }catch(e){
    console.error('[saveConfig] error', e); return false;
  }
  try { persistProjectSnapshot(); } catch {}

}

export function loadValues(){
  try{
    ensureDefault();
    const raw = localStorage.getItem(KEY_VALS) || '{}';
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  }catch(e){ console.error('[loadValues] parse error', e); return {}; }
}

export function saveValues(map){
  try{
    localStorage.setItem(KEY_VALS, JSON.stringify(map || {}));
    try { window.dispatchEvent(new CustomEvent('tcf-values-changed', { detail: { source: 'saveValues' } })); } catch {}
    return true;
  }catch(e){ console.error('[saveValues] error', e); return false; }
  try { persistProjectSnapshot(); } catch {}

}

// ===== Small helpers =====
export function padToLen(s,len){ const raw=String(s??''); const trimmed=raw.slice(0,len); return trimmed.length>=len? trimmed : ' '.repeat(len-trimmed.length)+trimmed; }
export function isFilled(v){ return String(v||'').trim().length>0; }
export function onlyDigits(s){ return /^[0-9]*$/.test(String(s||'')); }
export function timestamp(){ const d=new Date(); const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`; }
export function getRole(){ return localStorage.getItem(KEY_ROLE) || 'admin'; }
export function setRole(r){ localStorage.setItem(KEY_ROLE, r); }

// ===== Interface normalizers =====

// ===== Workspace projects autosave (values + overlays only) =====
const WS_KEY = 'tcf_workspace_projects';
const WS_CUR = 'tcf_current_workspace';

function __wsId(){
  try { return localStorage.getItem(WS_CUR) || ''; } catch { return ''; }
}
function __wsMapRead(){
  try { return JSON.parse(localStorage.getItem(WS_KEY) || '{}') || {}; } catch { return {}; }
}
function __wsMapWrite(map){
  try { localStorage.setItem(WS_KEY, JSON.stringify(map || {})); } catch {}
}
function __buildOverlaysFromCfg(cfg){
  const overlays = {};
  try {
    (cfg.interfaces || []).forEach(it => {
      if (!it || !it.id) return;
      const ov = {};
      if (Array.isArray(it.includedSections)) ov.includedSections = it.includedSections;
      if (Array.isArray(it.sectionColors)) ov.sectionColors = it.sectionColors;
      if (Object.keys(ov).length) overlays[it.id] = ov;
    });
  } catch {}
  return overlays;
}

// Public: persist current project's pack (values + overlays). Config is global.
export function persistProjectSnapshot(){
  const wid = __wsId();
  if (!wid) return;
  const map = __wsMapRead();
  const cfg = loadConfig();
  const values = loadValues();
  const overlays = __buildOverlaysFromCfg(cfg);
  const name = (map[wid]?.name) || cfg.projectName || wid;
  map[wid] = { ...(map[wid]||{}), id: wid, name, data: { projectName: name, values, overlays } };
  __wsMapWrite(map);
}

export function ensureDefaultFields(iface){
  const df = Array.isArray(iface.defaultFields) ? iface.defaultFields.slice() : [];
  const pushIfMissing = (label, length, type, required, defVal, autoSection=false) => {
    if (!df.find(f => (f.label||'').toLowerCase() === label.toLowerCase())) {
      df.push({ label, length, type, required, defaultValue: defVal || '', autoSection });
    }
  };
  // Required defaults
  pushIfMissing('Sequence No.', 7, 'numeric', true, '');
  pushIfMissing('Application code', 2, 'alphanumeric', true, 'HL');
  pushIfMissing('Interface code', 2, 'numeric', true, '');
  pushIfMissing('Section', 3, 'numeric', true, '', true);
  return { ...iface, defaultFields: df };
}

export function normalizeInterface(iface){
  const out = { ...iface };
  if (!Array.isArray(out.sections) || out.sections.length===0) out.sections = ['Introduction'];
  if (!Array.isArray(out.sectionNumbers) || out.sectionNumbers.length !== out.sections.length) {
    out.sectionNumbers = out.sections.map((_,i) => i===0 ? '000' : String(i*10).padStart(3,'0'));
  } else {
    out.sectionNumbers = out.sectionNumbers.map((n,i) => String(n||'').replace(/\D/g,'').padStart(3,'0').slice(-3));
  }
  if (out.sections[0] !== 'Introduction') {
    out.sections = ['Introduction', ...out.sections];
    out.sectionNumbers = ['000', ...out.sectionNumbers];
    if (Array.isArray(out.fieldSections)) out.fieldSections = out.fieldSections.map(s => (Number.isInteger(s)? s+1 : 1));
  }
  if (!Array.isArray(out.includedSections)) out.includedSections = [];
  if (!Array.isArray(out.sectionColors)) out.sectionColors = [];
  if (out.includedSections.length !== out.sections.length) {
    const arr = new Array(out.sections.length).fill(false);
    for (let i=0;i<Math.min(arr.length, out.includedSections.length);i++) arr[i] = !!out.includedSections[i];
    out.includedSections = arr;
  }
  if (out.sectionColors.length !== out.sections.length) {
    const arr = new Array(out.sections.length).fill('');
    for (let i=0;i<Math.min(arr.length, out.sectionColors.length);i++) arr[i] = out.sectionColors[i]||'';
    out.sectionColors = arr;
  }
  out.separators = Array.isArray(out.separators)? out.separators : [];
  out.fieldSections = Array.isArray(out.fieldSections)? out.fieldSections : [];
  return ensureDefaultFields(out);
}

export function notifyCfgChange(){
  try{
    localStorage.setItem(KEY_CFG + '_bump', String(Date.now()));
    window.dispatchEvent(new Event('tcf-config-changed'));
  }catch(e){}
}

// ---- Projects API ----
export function loadProjects(){
  try{
    const s = localStorage.getItem('tcf_projects');
    const obj = s ? JSON.parse(s) : {};
    return (obj && typeof obj === 'object') ? obj : {};
  }catch(e){ return {}; }
}
export function saveProjects(map){
  localStorage.setItem('tcf_projects', JSON.stringify(map || {}));
}
export function newProjectId(){ return 'prj_' + Math.random().toString(36).slice(2,10); }
export function snapshotProject(iface, values){
  if (!iface) return null;
  return {
    _type: 'tcf_project',
    _version: '1',
    interfaceId: iface.id,
    interfaceName: iface.name || '',
    sectionColors: Array.isArray(iface.sectionColors) ? iface.sectionColors : [],
    includedSections: Array.isArray(iface.includedSections) ? iface.includedSections : [],
    values: Array.isArray(values) ? values.slice() : []
  };
}
export function applyProject(proj){
  if (!proj || !proj.interfaceId) return false;
  const cfg = loadConfig();
  const idx = (cfg.interfaces || []).findIndex(i => i.id === proj.interfaceId);
  if (idx === -1) return false;
  const iface = { ...cfg.interfaces[idx] };
  const nSec = Array.isArray(iface.sections) ? iface.sections.length : 0;
  iface.sectionColors = Array.from({ length: nSec }, (_, i) => (proj.sectionColors || [])[i] || '');
  iface.includedSections = Array.from({ length: nSec }, (_, i) => !!(proj.includedSections || [])[i]);
  if (nSec > 0) iface.includedSections[0] = false;
  cfg.interfaces[idx] = iface;
  saveConfig(cfg);
  const vals = loadValues();
  const L = Array.isArray(iface.labels) ? iface.labels.length : 0;
  const v = Array.from({ length: L }, (_, i) => (proj.values || [])[i] || '');
  vals[iface.id] = v;
  saveValues(vals);
  try { window.dispatchEvent(new Event('tcf-config-changed')); } catch {}
  function safeDispatch(name){
  try { setTimeout(() => window.dispatchEvent(new Event(name)), 0); } catch {}
}
// ...
safeDispatch('tcf-values-changed');
  return true;
}

// ---------------- Field Extras storage ----------------
export const KEY_FIELD_EXTRAS_PREFIX = 'tcf_field_extras_';
export const FIELD_EXTRA_KEYS = ['origin', 'comment', 'defaultValue'];

function readFieldExtras(ifaceId) {
  try {
    const raw = localStorage.getItem(KEY_FIELD_EXTRAS_PREFIX + String(ifaceId));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function writeFieldExtras(ifaceId, data) {
  try {
    localStorage.setItem(
      KEY_FIELD_EXTRAS_PREFIX + String(ifaceId),
      JSON.stringify(data)
    );
  } catch (e) {}
}

/**
 * Zwraca wartość extra dla pola:
 * @param {number|string} ifaceId  - ID interfejsu
 * @param {number} secIdx          - indeks sekcji
 * @param {number} fldIdx          - indeks pola (wiersza)
 * @param {'origin'|'comment'|'defaultValue'} key
 */
export function getFieldExtra(ifaceId, secIdx, fldIdx, key) {
  if (!FIELD_EXTRA_KEYS.includes(key)) return '';
  const data = readFieldExtras(ifaceId);
  return data?.[secIdx]?.[fldIdx]?.[key] ?? '';
}

/**
 * Ustawia wartość extra dla pola (zapis w localStorage).
 * Zwraca cały obiekt extras po zapisie.
 */
export function setFieldExtra(ifaceId, secIdx, fldIdx, key, value) {
  if (!FIELD_EXTRA_KEYS.includes(key)) return;
  const data = readFieldExtras(ifaceId);
  if (!data[secIdx]) data[secIdx] = {};
  if (!data[secIdx][fldIdx]) data[secIdx][fldIdx] = {};
  data[secIdx][fldIdx][key] = value ?? '';
  writeFieldExtras(ifaceId, data);
  return data;
}
