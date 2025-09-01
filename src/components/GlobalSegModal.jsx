// File: src/components/GlobalSegModal.jsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import LightModal from './LightModal.jsx'
import { t } from '../i18n.js'
import { loadConfig, loadValues, saveValues } from '../utils.js'
import { segmentText } from '../segmentation.js'

export default function GlobalSegModal({ open, onClose }){
  const [text, setText] = React.useState('')
  const [fileName, setFileName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const fileRef = React.useRef(null)
  const nav = useNavigate()

  const readFile = (file) => {
    if (!file) return
    try { setFileName(file.name || '') } catch {}
    const fr = new FileReader()
    fr.onload = () => { try { setText(String(fr.result || '')) } catch {} }
    fr.onerror = () => setErr('Read error')
    try { fr.readAsText(file) } catch (e) { setErr(String(e?.message || e) || 'Error') }
  }

  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    try{
      const f = e.dataTransfer?.files?.[0]
      if (f) readFile(f)
    }catch{}
  }

  const run = () => {
    const raw = String(text || '').trim()
    if (!raw) { alert(t('segEmpty') || 'Wklej najpierw tekst do segmentacji.'); return }
    setBusy(true); setErr('')
    try {
      const cfg = loadConfig()
      const valsMap = loadValues()
      const res = segmentText(raw, cfg, null, valsMap)
      const { valsMap: nextVals, tabsById, involvedIfaceIds = [] } = res || {}

      // zapisz zakładki wygenerowane przez segmentację – zgodnie z panelem dolnym
      ;(cfg?.interfaces || []).forEach((it) => {
        const id = it.id
        let arr
        try {
          if (tabsById && typeof tabsById.get === 'function') arr = tabsById.has(id) ? (tabsById.get(id) || []) : undefined
          else if (tabsById && typeof tabsById === 'object') arr = Object.prototype.hasOwnProperty.call(tabsById, id) ? (tabsById[id] || []) : undefined
        } catch {}
        if (typeof arr !== 'undefined') {
          try { localStorage.setItem('tcf_genTabs_' + String(id), JSON.stringify(arr || [])) } catch {}
        }
      })

      if (nextVals) saveValues(nextVals)

      // nawiguj do pierwszego interfejsu, którego dotknęła segmentacja (jak w użyciu w trybie roboczym)
      let goId = involvedIfaceIds && involvedIfaceIds[0]
      if (!goId && tabsById && typeof tabsById.forEach === 'function') {
        try { tabsById.forEach((arr, id) => { if (!goId && Array.isArray(arr) && arr.length > 0) goId = id }) } catch {}
      }

      setBusy(false)
      onClose?.()
      setText(''); setFileName('')
      if (goId) nav('/iface/' + String(goId))
      else alert(t('segSummary') || 'Segmentacja zakończona. Brak dopasowanych interfejsów do otwarcia.')
    } catch (e) {
      console.error(e)
      setErr(String(e?.message || e) || 'Error')
      setBusy(false)
    }
  }

  return (
    <LightModal open={!!open} onClose={() => (!busy && onClose?.())} width={720} title={t('segmentation') || 'Segmentacja'}>
      <div className="form-grid" style={{ gridTemplateColumns: '1fr', rowGap: 16 }}>
        <div className="form-row">
          <div className="muted">{t('chooseFile') || 'Wybierz plik'}</div>
          <div
            onDragOver={(e)=>{e.preventDefault(); e.stopPropagation();}}
            onDrop={onDrop}
            style={{ border: '1px dashed var(--border, #1b2447)', borderRadius: 10, padding: 16, textAlign: 'center', userSelect: 'none' }}
          >
            <div style={{ opacity: .85, marginBottom: 8 }}>{t('dropHere') || 'Upuść plik tutaj lub kliknij “Wybierz plik”.'}</div>
            <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>{t('chooseFile') || 'Wybierz plik'}</button>
            <input ref={fileRef} type="file" accept=".txt,.log,.csv,text/plain" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) readFile(f); e.target.value=''; }} style={{ display: 'none' }} />
            {fileName ? <div className="muted" style={{ marginTop: 8 }}>{fileName}</div> : null}
          </div>
        </div>

        <label className="form-row">
          <div className="muted">{t('orPasteText') || 'Albo wklej tekst'}</div>
          <textarea rows={8} value={text} onChange={(e)=>setText(e.target.value)} placeholder="Wklej linie do segmentacji..." />
        </label>

        {err ? <div className="muted" style={{ color: '#ff6b6b' }}>{err}</div> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="ghost" disabled={busy} onClick={() => onClose?.()}>{t('cancel') || 'Anuluj'}</button>
          <button type="button" onClick={run} disabled={busy} style={{ background: '#16a34a', color: '#fff', padding: '10px 16px', borderRadius: 10, fontWeight: 600 }}>
            {t('segRun') || 'Uruchom segmentację'}
          </button>
        </div>
      </div>
    </LightModal>
  )
}


