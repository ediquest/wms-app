import { inferFieldMeta } from "./XmlSchemaInfer.js";

let _seq = 0;
const id = () => `f_${++_seq}`;

// Build a flat model with XPath, labels, and values
export function buildModel(doc) {
  _seq = 0;
  const out = [];
  const nsMap = collectNamespaces(doc);
  walkNode(doc.documentElement, `/${qName(doc.documentElement)}`, out, nsMap);
  // Infer meta (types, required, enum) – stub: heuristics only for now
  for (const f of out) Object.assign(f, inferFieldMeta(f));
  return out;
}

function walkNode(node, xpath, out, nsMap) {
  // attributes as fields
  if (node.attributes) {
    for (const attr of node.attributes) {
      const field = {
        id: id(),
        kind: "attribute",
        xpath: `${xpath}/@${qName(attr)}`,
        label: toLabel(attr.name),
        documentation: "",
        required: false,
        repeated: false,
        value: attr.value
      };
      out.push(field);
    }
  }
  // text content if element has text (and no element children)
  const elementChildren = [...node.childNodes].filter(n => n.nodeType === 1);
  const textNodes = [...node.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim().length);
  if (textNodes.length && elementChildren.length === 0) {
    const text = textNodes.map(n => n.nodeValue).join("").trim();
    out.push({
      id: id(),
      kind: "elementText",
      xpath,
      label: toLabel(node.nodeName),
      documentation: "",
      required: false,
      repeated: false,
      value: text
    });
  }
  // recurse into children with positional index
  const counts = new Map();
  for (const child of elementChildren) {
    const key = qName(child);
    const n = (counts.get(key) || 0) + 1;
    counts.set(key, n);
    walkNode(child, `${xpath}/${key}[${n}]`, out, nsMap);
  }
}

function qName(node) {
  return node.prefix ? `${node.prefix}:${node.localName}` : (node.localName || node.nodeName);
}

function toLabel(name) {
  // ex: "deliveryDate" -> "Delivery date", "ex:meta" -> "Meta"
  const n = name.includes(":") ? name.split(":")[1] : name;
  const spaced = n.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function collectNamespaces(doc) {
  const map = {};
  const attrs = doc.documentElement.attributes;
  for (const a of attrs) {
    if (a.name === "xmlns") map[""] = a.value;
    else if (a.name.startsWith("xmlns:")) map[a.name.split(":")[1]] = a.value;
  }
  return map;
}
