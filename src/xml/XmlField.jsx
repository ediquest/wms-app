import React from "react";

export default function XmlField({ field, value, error, onChange }) {
  const common = { className: "xml-input", value: value ?? "", onChange: (e)=>onChange(e.target.value) };

  switch (field.type) {
    case "boolean":
      return (
        <input className="xml-checkbox" type="checkbox" checked={String(value).toLowerCase()==="true" || value===true} onChange={(e)=>onChange(e.target.checked)} />
      );
    case "number":
      return <input type="number" {...common} />;
    case "date":
      return <input type="date" {...common} />;
    case "textarea":
      return <textarea rows={4} {...common} />;
    default:
      if (field.enum && Array.isArray(field.enum) && field.enum.length) {
        return (
          <select className="xml-select" value={value ?? ""} onChange={(e)=>onChange(e.target.value)}>
            <option value=""></option>
            {field.enum.map((opt)=> <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      }
      return <input type="text" {...common} />;
  }
}
