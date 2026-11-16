// Ricerca locale comune a esercizi, schede, muscoli, alimenti, ricette e macchine.
// Normalizza accenti, trattini, maiuscole, singolare/plurale (it/en); usa alias e sinonimi.
// Ordine: nome esatto > alias esatto > prefisso del nome > prefisso di un alias > tutte le parole > tolleranza (1 errore).
// Non "scambia" voci simili: una corrispondenza tollerante non supera mai una esatta o per prefisso.

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`´]/g, ' ').replace(/[-_/.,()]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Radice semplice per singolare/plurale (alzata/alzate, romboide/romboidi, rhomboids/rhomboid). */
export function stem(t: string) {
  let x = t;
  if (x.length > 4 && x.endsWith('s')) x = x.slice(0, -1);
  if (x.length > 4 && /[aeio]$/.test(x)) x = x.slice(0, -1);
  return x;
}
const tokens = (s: string) => norm(s).split(' ').filter(Boolean).map(stem);

/** Sinonimi generali (pubblici). Gli alias privati arrivano dalle voci locali dell'utente. */
export const SYNONYMS: Record<string, string[]> = {
  rdl: ['stacco rumeno', 'romanian deadlift'], 'stacco rumeno': ['rdl'], 'romanian deadlift': ['rdl', 'stacco rumeno'],
  stacco: ['deadlift'], deadlift: ['stacco'],
  romboidi: ['rhomboid', 'romboide'], rhomboids: ['romboidi', 'romboide'], rhomboid: ['romboide'],
  lat: ['lat machine', 'pulldown', 'gran dorsale'], pulldown: ['lat machine', 'trazione al cavo'], 'gran dorsale': ['dorsali', 'lat'], dorsali: ['gran dorsale', 'lat'],
  panca: ['bench', 'distensioni'], bench: ['panca'], 'chest press': ['distensioni alla macchina'],
  squat: ['accosciata'], 'leg press': ['pressa'], pressa: ['leg press'],
  rematore: ['row', 'pulley'], row: ['rematore'], pulley: ['rematore al cavo basso', 'seated row'],
  scrollate: ['shrug', 'trapezio'], shrug: ['scrollate'], trapezio: ['trapezius', 'scrollate'],
  'alzate laterali': ['lateral raise', 'deltoide laterale'], 'lateral raise': ['alzate laterali'],
  military: ['lento avanti', 'shoulder press'], 'lento avanti': ['military'], 'shoulder press': ['military', 'lento avanti'],
  deltoide: ['spalla', 'delt'], spalla: ['deltoide'], delt: ['deltoide'],
  bicipiti: ['biceps', 'curl'], biceps: ['bicipiti'], tricipiti: ['triceps', 'pushdown'], triceps: ['tricipiti'],
  polpacci: ['calf', 'calves'], calf: ['polpacci'], glutei: ['glute', 'gluteus'], 'hip thrust': ['ponte glutei'],
  femorali: ['hamstring', 'ischiocrurali', 'leg curl'], hamstring: ['femorali'], quadricipiti: ['quadriceps', 'quad'], quad: ['quadricipiti'],
  addome: ['abs', 'addominali'], abs: ['addome'], affondi: ['lunge'], lunge: ['affondi'],
  pettorali: ['petto', 'chest'], petto: ['pettorale', 'chest'], chest: ['petto'],
  avambracci: ['forearm', 'avambraccio'], forearm: ['avambracci']
};

export interface Searchable { name: string; aliases?: string[]; extra?: string }

function lev1(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}

function scoreOne(e: Searchable, v: string): number {
  const n = norm(e.name);
  const al = (e.aliases ?? []).map(norm);
  if (n === v) return 100;
  if (al.includes(v)) return 95;
  if (n.startsWith(v)) return 85;
  if (al.some((a) => a.startsWith(v))) return 80;
  const vt = tokens(v);
  if (!vt.length) return 0;
  const nameT = tokens(e.name);
  const allT = [...nameT, ...al.flatMap((a) => a.split(' ').map(stem)), ...tokens(e.extra ?? '')];
  if (vt.every((q) => allT.some((t) => t.startsWith(q)))) return 60 + (vt.every((q) => nameT.some((t) => t.startsWith(q))) ? 8 : 0);
  if (vt.every((q) => allT.some((t) => t.startsWith(q) || (q.length >= 4 && lev1(q, t.slice(0, Math.max(q.length, Math.min(t.length, q.length + 1))))) || (q.length >= 4 && lev1(q, t))))) return 35;
  return 0;
}

/** Punteggio di un elemento per una query (0 = non trovato), considerando i sinonimi. */
export function score(e: Searchable, query: string): number {
  const q = norm(query);
  if (!q) return 1;
  const variants = [q, ...(SYNONYMS[q] ?? []).map(norm)];
  let best = 0;
  variants.forEach((v, i) => { const s = scoreOne(e, v); best = Math.max(best, i === 0 ? s : Math.min(s, 75)); });
  return best;
}

/** Filtra e ordina; a parità di punteggio ordine alfabetico stabile. */
export function search<T extends Searchable>(items: T[], query: string): T[] {
  return items.map((it) => ({ it, s: score(it, query) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.it.name.localeCompare(b.it.name, 'it')).map((x) => x.it);
}
