// Simple validators; place to extend with XSD constraints
export function validateAll(model, values) {
  const errors = {};
  for (const f of model) {
    const v = values[f.id];
    let err = null;
    if (f.required) {
      if (f.type === "array") {
        if (!Array.isArray(v) || v.length === 0) err = "Required";
      } else if (v === undefined || v === null || v === "") {
        err = "Required";
      }
    }
    if (!err && f.type === "number" && v !== "" && v !== null && v !== undefined) {
      if (isNaN(Number(v))) err = "Not a number";
    }
    if (!err && f.type === "date" && v) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) err = "Invalid date";
    }
    errors[f.id] = err;
  }
  return errors;
}
