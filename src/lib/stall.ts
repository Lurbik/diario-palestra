// Rilevazione euristica dello stallo. Non proclama stalli da due sedute identiche.
// Richiede ≥4 esposizioni comparabili in ≥3 settimane (≥4 se frequenza settimanale)
// con dati sufficienti su carico, ripetizioni valide e recupero.
import type { Exposure } from './progression';
import { progressionReps } from './progression';
import { daysBetween } from './dates';

export type StallStatus = 'insufficient' | 'not_comparable' | 'progressing' | 'possible_stall';

export interface StallResult { status: StallStatus; title: string; reasons: string[]; checklist: string[] }

export const STALL_CHECKLIST = [
  '1. Macchina, configurazione, unità del carico, ROM e conteggi sono davvero confrontabili?',
  '2. Ci sono dolore, malessere, problemi tecnici, cambi di ordine o recuperi più brevi?',
  '3. Il peggioramento riguarda uno o più esercizi? Sonno, stress e tempo disponibile sono cambiati?',
  '4. Peso e alimentazione sono coerenti con l\'obiettivo, con dati sufficienti?',
  '5. L\'incremento minimo disponibile è troppo grande? Valuta consolidamento, range o microcarichi appropriati.',
  '6. Solo dopo: una singola modifica (consolidare, ridurre intensificazione, ritoccare carico/volume o sostituire una variante), annotando motivo e data.'
];

function median(xs: number[]) { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function summary(e: Exposure) {
  const ws = e.sets.filter((s) => s.kind === 'working').sort((a, b) => a.order - b.order);
  const loads = ws.map((s) => s.load);
  const reps = ws.map(progressionReps);
  const rests = ws.slice(1).map((s) => s.restBeforeSec).filter((x): x is number => x != null);
  const rir = ws.map((s) => s.rir);
  return {
    ws, complete: ws.length > 0 && loads.every((l) => l != null) && reps.every((r) => r != null),
    topLoad: Math.max(...loads.map((l) => l ?? -Infinity)),
    repsAtTop: ws.filter((s) => s.load === Math.max(...loads.map((l) => l ?? -Infinity))).reduce((a, s) => a + (progressionReps(s) ?? 0), 0),
    rirSum: rir.every((r) => r != null) ? (rir as number[]).reduce((a, b) => a + b, 0) : null,
    restMedian: rests.length ? median(rests) : null
  };
}

export function detectStall(exposures: Exposure[], opts: { restTolerance?: number } = {}): StallResult {
  const tol = opts.restTolerance ?? 0.35;
  const sums = exposures.map(summary);
  const incomplete = sums.filter((s) => !s.complete).length;
  // Recuperi confrontabili?
  const rests = sums.map((s) => s.restMedian).filter((x): x is number => x != null);
  if (rests.length >= 2) {
    const m = median(rests);
    if (rests.some((r) => Math.abs(r - m) / m > tol)) {
      return { status: 'not_comparable', title: 'Dati non confrontabili', reasons: ['I recuperi tra le serie variano molto tra le sedute: le prestazioni non sono confrontabili in modo affidabile.'], checklist: STALL_CHECKLIST };
    }
  }
  if (incomplete) {
    return { status: 'not_comparable', title: 'Dati non confrontabili', reasons: [`${incomplete} sedute senza carico o ripetizioni valide complete.`], checklist: STALL_CHECKLIST };
  }
  if (exposures.length < 4) {
    return { status: 'insufficient', title: 'Dati insufficienti', reasons: [`Servono almeno 4 esposizioni comparabili (ora ${exposures.length}).`], checklist: [] };
  }
  // Finestra: le esposizioni più recenti che sono almeno 4 e coprono almeno 21 giorni.
  // Con frequenza settimanale significa 4 settimane di calendario; con frequenze maggiori ≥3 settimane.
  const MIN_SPAN = 21;
  const lastKey = exposures[exposures.length - 1].dateKey;
  let start = -1;
  for (let i = exposures.length - 4; i >= 0; i--) {
    if (daysBetween(exposures[i].dateKey, lastKey) >= MIN_SPAN) { start = i; break; }
  }
  if (start < 0) {
    const span = daysBetween(exposures[0].dateKey, lastKey);
    return { status: 'insufficient', title: 'Periodo troppo breve', reasons: [`Le esposizioni coprono ${span} giorni: servono almeno 3 settimane (4 settimane se l'esercizio è settimanale).`], checklist: [] };
  }
  const window = exposures.slice(start);
  const a = summary(window[0]), b = summary(window[window.length - 1]);
  const improvedLoad = b.topLoad > a.topLoad;
  const improvedReps = b.topLoad === a.topLoad && b.repsAtTop > a.repsAtTop;
  const easier = b.topLoad === a.topLoad && b.repsAtTop === a.repsAtTop && a.rirSum != null && b.rirSum != null && b.rirSum > a.rirSum;
  if (improvedLoad || improvedReps || easier) {
    return {
      status: 'progressing', title: 'Progresso presente',
      reasons: [improvedLoad ? 'Il carico è aumentato.' : improvedReps ? 'A parità di carico sono aumentate le ripetizioni valide.' : 'A parità di carico e ripetizioni, il RIR dichiarato è più alto (stima, non misura perfetta).'],
      checklist: []
    };
  }
  return {
    status: 'possible_stall', title: 'Possibile stallo (segnalazione euristica)',
    reasons: ['In almeno 4 esposizioni comparabili su più settimane non aumentano carico, ripetizioni valide né facilità percepita.', 'Non è una diagnosi: segui l\'ordine dei controlli prima di cambiare qualcosa.'],
    checklist: STALL_CHECKLIST
  };
}
