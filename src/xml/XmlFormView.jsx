import React, { useMemo, useState } from "react";
import { useXmlCtx } from "./hooks/useXmlDoc.jsx";
import XmlField from "./XmlField.jsx";
import XmlArrayField from "./XmlArrayField.jsx";

export default function XmlFormView({ t }) {
  const { state, setValue, reset, exportXml, togglePin } = useXmlCtx();
  const [query, setQuery] = useState("");
  const [onlyReq, setOnlyReq] = useState(false);
  const [onlyAttrs, setOnlyAttrs] = useState(false);
  const [onlyElems, setOnlyElems] = useState(false);
  const [onlyErrs, setOnlyErrs] = useState(false);

  const filtered = useMemo(()=> {
    return state.model.filter(f => {
      if (onlyReq && !f.required) return false;
      if (onlyAttrs && f.kind !== "attribute") return false;
      if (onlyElems && f.kind !== "elementText") return false;
      if (onlyErrs && !state.errors[f.id]) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (f.label.toLowerCase().includes(q) || f.xpath.toLowerCase().includes(q));
    });
  }, [state.model, state.errors, onlyReq, onlyAttrs, onlyElems, onlyErrs, query]);

  const rows = useMemo(()=> {
    // pin on top
    const pinnedIds = state.pinned;
    const pinned = filtered.filter(f => pinnedIds.has(f.id));
    const rest = filtered.filter(f => !pinnedIds.has(f.id));
    return [...pinned, ...rest];
  }, [filtered, state.pinned]);

  if (!state.doc) return <div>{t("noDoc")}</div>;

  return (
    <div style={{display:"grid", gap:12}}>
      <div className="xml-toolbar">
        <input className="xml-input" style={{maxWidth:360}} placeholder={t("search")} value={query} onChange={(e)=>setQuery(e.target.value)} />
        <label><input type="checkbox" checked={onlyReq} onChange={(e)=>setOnlyReq(e.target.checked)} /> {t("requiredOnly")}</label>
        <label><input type="checkbox" checked={onlyAttrs} onChange={(e)=>setOnlyAttrs(e.target.checked)} /> {t("attrsOnly")}</label>
        <label><input type="checkbox" checked={onlyElems} onChange={(e)=>setOnlyElems(e.target.checked)} /> {t("elemsOnly")}</label>
        <label><input type="checkbox" checked={onlyErrs} onChange={(e)=>setOnlyErrs(e.target.checked)} /> {t("errorsOnly")}</label>
        <div style={{flex:1}} />
        <button className="xml-btn" onClick={reset}>{t("reset")}</button>
        <button className="xml-btn primary" onClick={exportXml}>{t("exportXml")}</button>
      </div>

      <div>
        {rows.map(f => {
          const val = state.values[f.id];
          const err = state.errors[f.id];
          const FieldComp = f.repeated ? XmlArrayField : XmlField;
          return (
            <div key={f.id} className="xml-row">
              <div>
                <div className="xml-label">{f.label}</div>
                <div className="xml-hint" title={f.xpath}>{t("xpath")}: <code>{f.xpath}</code></div>
                <div className="xml-hint">{t("type")}: <code>{f.type}</code></div>
                {f.enum ? <div className="xml-hint">{t("enum")}: {f.enum.join(", ")}</div> : null}
              </div>
              <div>
                <FieldComp field={f} value={val} error={err} onChange={(v)=>setValue(f.id, v)} />
                {err ? <div className="xml-error">{err}</div> : null}
              </div>
              <div className="xml-controls">
                <button className="xml-chip" onClick={()=>togglePin(f.id)}>📌 {t("pinned")}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
