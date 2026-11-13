// Rilevazione euristica dello stallo (soglie modificabili, non tempi universali di adattamento).
// - Usa solo esposizioni comparabili e recenti: stessa configurazione (garantita dal chiamante),
//   stesso numero di serie allenanti della maggioranza, dati completi, recuperi simili.
// - Valuta l'andamento di più osservazioni con mediane della prima e della seconda metà della finestra,
//   non solo i due estremi.
// - Un carico maggiore con forte crollo delle ripetizioni non è considerato progresso automatico.
import type { Exposure } from './progression';
import { progressionReps, e1rmEpley } from './progression';
import { daysBetween } from './dates';

export type StallStatus = 'insufficient' | 'not_comparable' | 'progressing' | 'possible_stall' | 'unclear';

export interface StallResult { status: StallStatus; title: string; reasons: string[]; checklist: string[] }

export const STALL_CHECKLIST = [
  '1. Macchina, configurazione, unità del carico, ROM e conteggi sono davvero confrontabili?',
  '2. Ci sono dolore, malessere, problemi tecnici, cambi di ordine o recuperi più brevi?',
  '3. Il peggioramento riguarda uno o più esercizi? Sonno, stress e tempo disponibile sono cambiati?',
  '4. Peso e alimentazione sono coerenti con l\'obiettivo, con dati sufficienti?',
  '5. L\'incremento minimo disponibile è troppo grande? Valuta consolidamento, range o microcarichi appropriati.',
  '6. Solo dopo: una singola modifica (consolidare, ridurre intensificazione, ritoccare carico/volume o sostituire una variante), annotando motivo e data.'
];

export interface StallOptions { restTolerance?: number; minExposures?: number; minSpanDays?: number; rirRequired?: boolean }

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function summary(e: Exposure) {
  const ws = e.sets.filter((s) => s.kind === 'working').sort((a, b) => a.order - b.order);
  const loads = ws.map((s) => s.load);
  const reps = ws.map(progressionReps);
  const complete = ws.length > 0 && loads.every((l) => l != null) && reps.every((r) => r != null);
  const rests = ws.slice(1).map((s) => s.restBeforeSec).filter((x): x is number => x != null);
  const top = complete ? Math.max(...(loads as number[])) : NaN;
  const repsAtTop = complete ? ws.filter((s) => s.load === top).reduce((a, s) => a + (progressionReps(s) ?? 0), 0) : NaN;
  // Indice di lettura dell'andamento (stima Epley sulla serie migliore entro 12 ripetizioni): solo per confronti interni
  const idx = complete ? Math.max(...ws.map((s) => e1rmEpley(s.load, progressionReps(s)) ?? 0)) : NaN;
  const rir = ws.map((s) => s.rir);
  return { n: ws.length, complete, top, repsAtTop, idx, rirSum: rir.every((r) => r != null) ? (rir as number[]).reduce((a, b) => a + b, 0) : null, restMedian: rests.length ? median(rests) : null };
}

export function detectStall(exposures: Exposure[], opts: StallOptions = {}): StallResult {
  const tol = opts.restTolerance ?? 0.35;
  const minN = opts.minExposures ?? 4;
  const minSpan = opts.minSpanDays ?? 21;
  const sums = exposures.map(summary);
  const incomplete = sums.filter((s) => !s.complete).length;

  const rests = sums.map((s) => s.restMedian).filter((x): x is number => x != null);
  if (rests.length >= 2) {
    const m = median(rests);
    if (rests.some((r) => Math.abs(r - m) / m > tol)) return { status: 'not_comparable', title: 'Dati non confrontabili', reasons: ['I recuperi tra le serie variano molto tra le sedute: le prestazioni non sono confrontabili in modo affidabile.'], checklist: STALL_CHECKLIST };
  }
  if (incomplete) return { status: 'not_comparable', title: 'Dati non confrontabili', reasons: [`${incomplete} sedute senza carico o ripetizioni valide complete.`], checklist: STALL_CHECKLIST };

  // Numero di serie: si usano solo le esposizioni con il numero di serie più frequente
  const counts = new Map<number, number>();
  for (const s of sums) counts.set(s.n, (counts.get(s.n) ?? 0) + 1);
  const modeN = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const pairs = exposures.map((e, i) => ({ e, s: sums[i] })).filter((p) => p.s.n === modeN);
  const dropped = exposures.length - pairs.length;

  if (pairs.length < minN) return { status: 'insufficient', title: 'Dati insufficienti', reasons: [`Servono almeno ${minN} esposizioni comparabili (ora ${pairs.length}${dropped ? `, ${dropped} escluse per numero di serie diverso` : ''}).`], checklist: [] };

  const lastKey = pairs[pairs.length - 1].e.dateKey;
  let start = -1;
  for (let i = pairs.length - minN; i >= 0; i--) if (daysBetween(pairs[i].e.dateKey, lastKey) >= minSpan) { start = i; break; }
  if (start < 0) return { status: 'insufficient', title: 'Periodo troppo breve', reasons: [`Le esposizioni comparabili coprono ${daysBetween(pairs[0].e.dateKey, lastKey)} giorni: servono almeno ${minSpan} giorni (circa 4 settimane se l'esercizio è settimanale).`], checklist: [] };
  const win = pairs.slice(start).map((p) => p.s);
  const half = Math.floor(win.length / 2);
  const first = win.slice(0, half), second = win.slice(win.length - half);
  const mIdx1 = median(first.map((s) => s.idx)), mIdx2 = median(second.map((s) => s.idx));
  const a = win[0], b = win[win.length - 1];

  // Carico maggiore ma crollo marcato delle ripetizioni (>40%): non è progresso automatico
  if (b.top > a.top && b.repsAtTop < a.repsAtTop * 0.6) {
    return { status: 'unclear', title: 'Andamento da verificare', reasons: ['Il carico è salito ma le ripetizioni valide sono crollate: controlla ROM, tecnica e confrontabilità prima di parlare di progresso.'], checklist: STALL_CHECKLIST };
  }
  const sameTop = b.top === a.top;
  if (mIdx2 > mIdx1 * 1.01 || (sameTop && b.repsAtTop > a.repsAtTop)) {
    return { status: 'progressing', title: 'Progresso presente', reasons: [sameTop && b.repsAtTop > a.repsAtTop ? 'A parità di carico sono aumentate le ripetizioni valide.' : 'Le prestazioni recenti (mediana) superano quelle iniziali della finestra.'], checklist: [] };
  }
  if (sameTop && b.repsAtTop === a.repsAtTop && a.rirSum != null && b.rirSum != null && b.rirSum > a.rirSum) {
    return { status: 'progressing', title: 'Progresso presente', reasons: ['A parità di carico e ripetizioni il RIR dichiarato è più alto (stima, non misura perfetta).'], checklist: [] };
  }
  return {
    status: 'possible_stall', title: 'Possibile stallo (segnalazione euristica)',
    reasons: [`In ${win.length} esposizioni comparabili su ${daysBetween(pairs[start].e.dateKey, lastKey)} giorni la mediana recente non supera quella iniziale.`, 'Non è una diagnosi: segui l\'ordine dei controlli prima di cambiare qualcosa.'],
    checklist: STALL_CHECKLIST
  };
}
