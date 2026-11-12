export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
/** Numeri con virgola italiana: "12,5" → 12.5; vuoto/non valido → null. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits }).format(n);
}
export function round(n: number, d = 1): number { const f = 10 ** d; return Math.round(n * f) / f; }
