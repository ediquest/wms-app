import React from 'react';
import * as XLSX from 'xlsx';
import { createWorkbookNewFile, applyMappingToWorkbook, applyMappingToWorkbookPreserveLayout, downloadWorkbook } from '../utils/excelMapping';

const ExcelIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 3h9l5 5v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" opacity="0.15"/>
    <path d="M13 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8.5 9l3 6m0-6l-3 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

export default function ExportExcelModal({ open, onClose, iface, valsMap, finalText, t = s => s }) {
  const [targetCol, setTargetCol] = React.useState('M');
  const [preserveLayout, setPreserveLayout] = React.useState(true);
  const [file, setFile] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const [animate, setAnimate] = React.useState(false);

  React.useEffect(() => setAnimate(!!open), [open]);
  React.useEffect(() => {
    if (!open) {
      setTargetCol('M');
      setPreserveLayout(true);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  if (!open) return null;

  const makeNewFile = () => {
    try {
      const wb = createWorkbookNewFile(iface, valsMap, finalText);
      downloadWorkbook(wb, 'mapping.xlsx');
      onClose?.();
    } catch (e) { console.error(e); alert(t('excelExportError') || 'Export to Excel failed.'); }
  };

  const onPickFile = (e) => setFile(e.target.files?.[0] || null);

  const exportToExisting = async () => {
    if (!file) { fileInputRef.current?.click(); return; }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      if (preserveLayout) {
        applyMappingToWorkbookPreserveLayout(wb, iface, valsMap, finalText, targetCol || 'M');
      } else {
        applyMappingToWorkbook(wb, iface, valsMap, finalText, targetCol || 'M');
      }
      downloadWorkbook(wb, file.name?.replace(/(\.xlsx?)?$/i, '_mapped.xlsx'));
      onClose?.();
    } catch (e) { console.error(e); alert(t('excelExportError') || 'Export to Excel failed.'); }
  };

  return (
    <div className={`exportExcelOverlay ${animate ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`exportExcelModal ${animate ? 'enter' : ''}`}>
        <div className="modalHeader">
          <div className="title"><ExcelIcon size={18} /><span>{t('excelExportTitle') || 'Eksport do pliku Excel'}</span></div>
          <button className="closeBtn" onClick={() => onClose?.()} aria-label="Close">✕</button>
        </div>

        <div className="modalGrid">
          <div className="card">
            <div className="cardTitle">{t('createNewFile') || 'Utwórz nowy plik'}</div>
            <div className="cardHint">{t('createNewFileHint') || 'Stwórz nowy plik, z arkuszem "Original Interface" i osobnymi arkuszami dla użytych sekcji.'}</div>
            <button className="primary" onClick={makeNewFile}><ExcelIcon /><span>{t('createNewFile') || 'Utwórz nowy plik'}</span></button>
          </div>

          <div className="card">
            <div className="cardTitle">{t('exportToMapping') || 'Wyeksportuj do mapowania Excel'}</div>
            <div className="mappingRow">
              <label className="colPicker">
                <span>{t('whichColumn') || 'Do jakiej kolumny wyeksportować'}</span>
                <input type="text" maxLength={3} value={targetCol} onChange={(e) => setTargetCol(e.target.value)} placeholder="M" />
              </label>
              <div className="fileButtons">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={onPickFile} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current?.click()} className="ghost">
                  <ExcelIcon /> <span>{file ? file.name : (t('chooseExcel') || 'Wybierz plik Excel…')}</span>
                </button>
                <button style={{ marginLeft: 8 }} onClick={exportToExisting} className="primary">
                  <ExcelIcon /> <span>{t('exportToMapping') || 'Wyeksportuj do mapowania Excel'}</span>
                </button>
              </div>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,marginTop:8}} className="preserveLayoutSwitch">
              <input type="checkbox" checked={preserveLayout} onChange={(e)=>setPreserveLayout(e.target.checked)} />
              <span>{t('preserveLayout') || 'Zachowaj układ (nie dodawaj arkusza "Original Interface")'}</span>
            </label>
            <div className="cardHint">{t('mappingHint') || 'Wypełnimy wskazaną kolumnę w arkuszach nazwanych np. 010, 110, 120; dopasowanie po nazwach pól w kolumnie B.'}</div>
          </div>
        </div>
      </div>
      <style>{`
        .exportExcelOverlay { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,0.0); transition: background 180ms ease; z-index: 9999; }
        .exportExcelOverlay.open { background: rgba(0,0,0,0.35); }
        .exportExcelModal { background: var(--bg, #101214); color: var(--fg, #fff); min-width: 420px; max-width: 720px; width: 90%; border-radius: 14px; padding: 18px; box-shadow: 0 18px 50px rgba(0,0,0,0.45); transform: translateY(8px) scale(0.98); opacity: 0; transition: transform 180ms ease, opacity 180ms ease; }
        .exportExcelModal.enter { transform: translateY(0) scale(1); opacity: 1; }
        .modalHeader { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .modalHeader .title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 18px; }
        .closeBtn { font-size: 18px; line-height: 1; padding: 4px 10px; background: transparent; border: 1px solid var(--border, #333); border-radius: 10px; }
        .closeBtn:hover { background: rgba(255,255,255,0.06); }
        .modalGrid { display: grid; gap: 14px; }
        .card { border: 1px solid var(--border, #2a2f34); border-radius: 12px; padding: 14px; }
        .cardTitle { font-weight: 600; margin-bottom: 8px; }
        .cardHint { color: var(--muted, #a6b0bb); font-size: 13px; }
        .primary, .ghost { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; cursor: pointer; border: 1px solid transparent; background: #2f7d32; color: #fff; transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease; }
        .primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(47,125,50,0.35); background: #2b7430; }
        .ghost { background: transparent; color: inherit; border-color: var(--border, #333); }
        .ghost:hover { background: rgba(255,255,255,0.06); }
        .mappingRow { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end; }
        .colPicker { display: flex; flex-direction: column; gap: 6px; }
        .colPicker input { padding: 6px 10px; width: 100px; border-radius: 8px; border: 1px solid var(--border, #333); background: transparent; color: inherit; }
        .fileButtons { display: flex; align-items: center; }
      `}</style>
    </div>
  );
}
