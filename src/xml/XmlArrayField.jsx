import React from "react";
import XmlField from "./XmlField.jsx";

export default function XmlArrayField({ field, value, error, onChange }) {
  const arr = Array.isArray(value) ? value : (value ? [value] : []);
  const setItem = (i, v) => {
    const next = [...arr];
    next[i] = v;
    onChange(next);
  };
  const add = () => onChange([...arr, ""]);
  const remove = (i) => onChange(arr.filter((_, idx)=> idx!==i));

  return (
    <div className="xml-array">
      {arr.map((v, i)=> (
        <div key={i} className="xml-array-item">
          <XmlField field={field} value={v} error={null} onChange={(val)=>setItem(i, val)} />
          <button className="xml-btn" onClick={()=>remove(i)}>-</button>
        </div>
      ))}
      <div><button className="xml-btn" onClick={add}>+</button></div>
    </div>
  );
}
