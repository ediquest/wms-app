import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { buildModel } from "../XmlModel.js";
import { validateAll } from "../XmlValidator.js";
import { exportXmlWithOverlay } from "../XmlExporter.js";

const XmlCtx = createContext(null);

export function XmlProvider({ children }) {
  const [state, setState] = useState({
    rawXml: "",
    doc: null,
    fileName: "",
    model: [],      // array of fields
    values: {},     // id -> value (or array)
    errors: {},     // id -> string | null
    pinned: new Set()
  });

  const loadXml = useCallback((rawXml, fileName="document.xml") => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawXml, "application/xml");
      // Parse error detection
      const pe = doc.getElementsByTagName("parsererror")[0];
      if (pe) throw new Error(pe.textContent || "Invalid XML");
      const model = buildModel(doc);
      // Current values from doc (default)
      const values = {};
      for (const f of model) values[f.id] = f.value;
      const errors = validateAll(model, values);
      setState(s => ({ ...s, rawXml, doc, fileName, model, values, errors }));
    } catch (e) {
      alert(e.message || "Invalid XML");
    }
  }, []);

  const setValue = useCallback((id, val) => {
    setState(s => {
      const values = { ...s.values, [id]: val };
      const errors = validateAll(s.model, values);
      return { ...s, values, errors };
    });
  }, []);

  const togglePin = useCallback((id) => {
    setState(s => {
      const pinned = new Set(s.pinned);
      if (pinned.has(id)) pinned.delete(id); else pinned.add(id);
      return { ...s, pinned };
    });
  }, []);

  const reset = useCallback(() => {
    setState(s => {
      const values = {};
      for (const f of s.model) values[f.id] = f.value;
      const errors = validateAll(s.model, values);
      return { ...s, values, errors };
    });
  }, []);

  const exportXml = useCallback(() => {
    try {
      const out = exportXmlWithOverlay(state.rawXml, state.model, state.values);
      const blob = new Blob([out], { type:"application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = state.fileName || "document.xml";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message || "Export failed");
    }
  }, [state.rawXml, state.model, state.values, state.fileName]);

  const value = useMemo(() => ({
    state, loadXml, setValue, reset, exportXml, togglePin
  }), [state, loadXml, setValue, reset, exportXml, togglePin]);

  return <XmlCtx.Provider value={value}>{children}</XmlCtx.Provider>;
}

export function useXmlCtx() {
  const ctx = useContext(XmlCtx);
  if (!ctx) throw new Error("useXmlCtx must be used inside <XmlProvider>");
  return ctx;
}
