export function fmt(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${Number(v).toFixed(2)}%`;
}

export function clamp01to100(v) {
  return Math.max(0, Math.min(100, v));
}

export function fmtScore(v) {
  if (v == null || Number.isNaN(v)) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

export function toNumOrZero(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function inc18ToCompositeScore(inc18) {
  if (inc18 == null || Number.isNaN(inc18)) return null;
  const n = Number(inc18);
  if (!Number.isFinite(n)) return null;
  return clamp01to100((n / 18) * 100);
}

export function fmtCurrency(v) {
  if (v == null || Number.isNaN(v) || v === 0) return '—';
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtCurrencyForExport(v) {
  if (v == null || Number.isNaN(v)) return '0.00';
  const num = Number(v);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function todayDatePart() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
