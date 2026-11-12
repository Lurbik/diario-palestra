// Tutte le date "di calendario" sono calcolate nel fuso Europe/Rome,
// così il cambio dell'ora legale e la mezzanotte non spostano le registrazioni.
export const TZ = 'Europe/Rome';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtTime = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function dateKey(ms: number = Date.now()): string { return fmt.format(new Date(ms)); }
export function timeHM(ms: number = Date.now()): string { return fmtTime.format(new Date(ms)); }

/** Giorno della settimana ISO (1=lun..7=dom) per una dateKey. */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}
/** Somma giorni a una dateKey (aritmetica di calendario, immune all'ora legale). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
/** Lunedì della settimana che contiene key. */
export function weekStart(key: string): string { return addDays(key, 1 - weekdayOf(key)); }

export const WEEKDAYS = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
export const WEEKDAYS_SHORT = ['', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

export function formatDateIt(key: string, withYear = false): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
    .format(new Date(Date.UTC(y, m - 1, d)));
}
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

/** Offset (minuti) di Europe/Rome rispetto a UTC in un certo istante. */
function romeOffsetMin(ms: number): number {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms));
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(ms / 60000) * 60000) / 60000;
}
/** 'HH:MM' di un giorno a Roma → epoch ms (gestisce l'ora legale). */
export function romeLocalToEpoch(key: string, hm: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let t = naive - romeOffsetMin(naive) * 60000;
  t = naive - romeOffsetMin(t) * 60000;
  return t;
}
