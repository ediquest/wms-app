// Very light heuristics for now; place for XSD-driven inference
export function inferFieldMeta(field) {
  const meta = { type: "string", required: false, enum: null };
  const v = Array.isArray(field.value) ? "" : (field.value ?? "");

  // boolean
  if (/^(true|false|0|1)$/i.test(v)) meta.type = "boolean";
  // number
  if (v !== "" && /^-?\d+(\.\d+)?$/.test(v)) meta.type = "number";
  // date (yyyy-mm-dd)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) meta.type = "date";
  // long text
  if (typeof v === "string" && v.length > 120) meta.type = "textarea";

  return meta;
}
