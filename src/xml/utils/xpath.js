// Evaluate XPath with namespace support
export function evaluateXPath(doc, xpath) {
  const resolver = doc.createNSResolver(doc.documentElement);
  const result = doc.evaluate(xpath, doc, resolver, XPathResult.ANY_TYPE, null);
  return result;
}

export function setByXPath(doc, xpath, newValue) {
  if (xpath.includes("/@")) {
    // attribute target
    const attrPath = xpath.split("/@").pop();
    const nodePath = xpath.split("/@")[0];
    const node = doc.evaluate(nodePath, doc, doc.createNSResolver(doc.documentElement), XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (!node) return false;
    const [prefix, local] = attrPath.includes(":") ? attrPath.split(":") : [null, attrPath];
    if (prefix) {
      // namespaced attribute
      const ns = doc.lookupNamespaceURI(prefix);
      node.setAttributeNS(ns, attrPath, newValue);
    } else {
      node.setAttribute(local, newValue);
    }
    return true;
  } else {
    // element text target
    const el = doc.evaluate(xpath, doc, doc.createNSResolver(doc.documentElement), XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (!el) return false;
    // overwrite text content (simple case; CDATA not handled here)
    el.textContent = newValue;
    return true;
  }
}
