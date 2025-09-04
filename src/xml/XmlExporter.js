import { setByXPath } from "./utils/xpath.js";

export function exportXmlWithOverlay(rawXml, model, values) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawXml, "application/xml");
  const pe = doc.getElementsByTagName("parsererror")[0];
  if (pe) throw new Error(pe.textContent || "Invalid XML");
  for (const f of model) {
    const v = values[f.id];
    if (Array.isArray(v)) {
      // Simple approach: join array items with comma for single node targets
      // Real implementation would clone nodes per item (future work)
      setByXPath(doc, f.xpath, v.join(", "));
    } else if (v !== undefined) {
      setByXPath(doc, f.xpath, v);
    }
  }
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}
