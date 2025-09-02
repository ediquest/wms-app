import React, { useEffect, useState } from 'react';
import { getFieldExtra, setFieldExtra } from '../utils.js';

export default function FieldExtras({ ifaceId, secIdx, fldIdx, hidden = false, disabled = false }) {
  const [origin, setOrigin]   = useState('');
  const [comment, setComment] = useState('');
  const [defVal, setDefVal]   = useState('');

  useEffect(() => {
    const { origin: o = '', comment: c = '', defaultValue: d = '' } =
      getFieldExtra(ifaceId, secIdx, fldIdx);
    setOrigin(o); setComment(c); setDefVal(d);
  }, [ifaceId, secIdx, fldIdx]);

  if (hidden) return null;

  const baseStyle = {
    minWidth: 0,
    height: 32,
    padding: '6px 8px',
    border: '1px solid #D1D5DB',
    borderRadius: 6,
    outline: 'none',
  };

  return (
    <>
      <input
        type="text"
        placeholder="Origin"
        value={origin}
        disabled={disabled}
        onChange={(e) => { const v = e.target.value; setOrigin(v); setFieldExtra(ifaceId, secIdx, fldIdx, { origin: v }); }}
        style={baseStyle}
      />
      <input
        type="text"
        placeholder="Comment"
        value={comment}
        disabled={disabled}
        onChange={(e) => { const v = e.target.value; setComment(v); setFieldExtra(ifaceId, secIdx, fldIdx, { comment: v }); }}
        style={baseStyle}
      />
      <input
        type="text"
        placeholder="Default value"
        value={defVal}
        disabled={disabled}
        onChange={(e) => { const v = e.target.value; setDefVal(v); setFieldExtra(ifaceId, secIdx, fldIdx, { defaultValue: v }); }}
        style={baseStyle}
      />
    </>
  );
}

export function FieldExtrasHeader({ hidden = false }) {
  if (hidden) return null;
  const headStyle = { fontSize: 12, color: '#6B7280', fontWeight: 600, paddingBottom: 4 };
  return (
    <>
      <div style={headStyle}>Origin</div>
      <div style={headStyle}>Comment</div>
      <div style={headStyle}>Default value</div>
    </>
  );
}
