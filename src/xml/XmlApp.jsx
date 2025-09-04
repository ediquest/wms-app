import React from "react";
import { XmlProvider, useXmlCtx } from "./hooks/useXmlDoc.jsx";
import XmlImporter from "./XmlImporter.jsx";
import XmlFormView from "./XmlFormView.jsx";
import "./styles.css";
import en from "./i18n/en.json";
import pl from "./i18n/pl.json";

// Tiny local i18n (avoids coupling with app i18n)
const dict = { en, pl };
function useT() {
  const lang = (navigator.language || "en").startsWith("pl") ? "pl" : "en";
  const table = dict[lang] || dict.en;
  return (k) => table[k] || k;
}

function Shell() {
  const t = useT();
  const { state } = useXmlCtx();
  return (
    <div className="xml-shell">
      <div className="xml-header">
        <span className="xml-badge">{t("xmlMode")}</span>
        {state.fileName ? <span className="xml-badge">{state.fileName}</span> : null}
      </div>
      <div className="xml-main">
        {!state.doc ? <XmlImporter t={t} /> : <XmlFormView t={t} />}
      </div>
    </div>
  );
}

export default function XmlApp() {
  return (
    <XmlProvider>
      <Shell />
    </XmlProvider>
  );
}
