// src/utils/fixedWidth.js

/**
 * Dopasuj wartość do stałej długości:
 * - alphanumeric: padStart spacją (z LEWEJ)
 * - numeric:      padStart '0'   (z LEWEJ)
 * - flex === true: nie dotykamy (bez przycinania i paddingu)
 *
 * Przycinanie: zachowujemy PRAWĄ część (bo wyrównujemy do prawej).
 */
export function fitToLength(value, len, type = 'alphanumeric', opts = {}) {
  const { truncate = true, flex = false } = opts;

  if (!Number.isFinite(len) || len <= 0) return String(value ?? '');
  if (flex) return String(value ?? '');

  let s = String(value ?? '').replace(/\r?\n/g, ' ');

  // przycinanie: zostaw prawą część
  if (truncate && s.length > len) {
    s = s.slice(-len);
  }

  const padChar = String(type).toLowerCase() === 'numeric' ? '0' : ' ';
  if (s.length < len) {
    s = s.padStart(len, padChar);
  }
  return s;
}

/**
 * Przydatne gdy masz interfejs z równoległymi tablicami (labels, lengths, types, flexFields) i rekord jako tablicę.
 */
export function normalizeRecordToFixedWidth(iface, record) {
  const L = (iface?.labels || []).length;
  const out = new Array(L);
  for (let i = 0; i < L; i++) {
    const len  = iface?.lengths?.[i] ?? 0;
    const type = iface?.types?.[i] ?? 'alphanumeric';
    const flex = !!(iface?.flexFields?.[i]);
    out[i] = fitToLength(record?.[i], len, type, { flex, truncate: true });
  }
  return out;
}
