import React, { useState } from "react";
import { useXmlCtx } from "./hooks/useXmlDoc.jsx";

export default function XmlImporter({ t }) {
  const { loadXml } = useXmlCtx();
  const [text, setText] = useState("");

  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const txt = await f.text();
    loadXml(txt, f.name);
  };

  const onPaste = () => {
    if (!text.trim()) return;
    loadXml(text, "pasted.xml");
  };

  const sample = `<?xml version="1.0" encoding="UTF-8"?>
<order id="SO-123" xmlns:ex="http://example.com/ns">
  <customer>
    <name>Jan Kowalski</name>
    <email>jan@example.com</email>
    <vip>true</vip>
  </customer>
  <lines>
    <line sku="ABC-001" qty="2">
      <desc>Widget</desc>
      <price currency="PLN">19.99</price>
    </line>
    <line sku="XYZ-777" qty="1">
      <desc>Gadget</desc>
      <price currency="PLN">99.00</price>
    </line>
  </lines>
  <ex:meta>
    <ex:note>Przykładowy dokument</ex:note>
  </ex:meta>
  <deliveryDate>2025-09-30</deliveryDate>
</order>`;

  return (
    <div style={{maxWidth:880, margin:"0 auto", display:"grid", gap:12}}>
      <div className="xml-toolbar">
        <label className="xml-btn">
          {t("importXml")}
          <input className="xml-file" type="file" accept=".xml" onChange={onFile} style={{display:"none"}} />
        </label>
        <button className="xml-btn" onClick={() => { setText(sample); }}>
          {t("loadSample")}
        </button>
      </div>
      <textarea
        className="xml-input"
        rows={18}
        placeholder={t("pasteXml")}
        value={text}
        onChange={(e)=>setText(e.target.value)}
      />
      <div className="xml-controls">
        <button className="xml-btn primary" onClick={onPaste}>{t("pasteXml")}</button>
      </div>
    </div>
  );
}
