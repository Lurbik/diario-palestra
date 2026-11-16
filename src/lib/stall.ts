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

export interface StallOptions {
  restTolerance?: number; minExposures?: number; minSpanDays?: number; rirRequired?: boolean;
  /**
   * Sedute in un contesto anomalo (notte molto breve, dolore, "ho meno tempo"): escluse dal confronto,
   * mai contate come prova di stallo. Chiave = sessionId, valore = motivo leggibile.
   */
  context?: Map<string, string>;
}

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
  // Indice solo se TUTTE le serie sono nel range della stima (1–12): altrimenti si confrontano carico e ripetizioni
  // direttamente. Un valore non calcolabile non diventa zero.
  const e1 = complete ? ws.map((s) => e1rmEpley(s.load, progressionReps(s))) : [];
  const idx = complete && e1.every((x) => x != null) ? Math.max(...(e1 as number[])) : null;
  const rir = ws.map((s) => s.rir);
  return { n: ws.length, complete, top, repsAtTop, idx, rirSum: rir.every((r) => r != null) ? (rir as number[]).reduce((a, b) => a + b, 0) : null, restMedian: rests.length ? median(rests) : null };
}

/** Punteggio confrontabile: stima e1RM se disponibile per tutta la finestra, altrimenti carico poi ripetizioni. */
const score = (x: ReturnType<typeof summary>, useIdx: boolean) => (useIdx ? x.idx! : x.top * 1000 + x.repsAtTop);

export function detectStall(exposures: Exposure[], opts: StallOptions = {}): StallResult {
  const tol = opts.restTolerance ?? 0.35;
  const minN = opts.minExposures ?? 4;
  const minSpan = opts.minSpanDays ?? 21;
  const all = exposures.map((e) => ({ e, s: summary(e) }));
  const excluded: string[] = [];
  // 1) Esclusioni per singola seduta (prima di scegliere la finestra): dati incompleti o contesto anomalo.
  let cand = all.filter(({ e, s }) => {
    if (!s.complete) { excluded.push(`${e.dateKey}: carico o ripetizioni valide mancanti`); return false; }
    const why = opts.context?.get(e.sessionId);
    if (why) { excluded.push(`${e.dateKey}: ${why}`); return false; }
    return true;
  });
  // 2) Recuperi: escluse solo le sedute con recupero molto diverso dalla mediana, non tutta la storia.
  const rests = cand.map((x) => x.s.restMedian).filter((x): x is number => x != null);
  // Con due sole sedute non si sa quale sia "fuori norma": nessun confronto.
  if (rests.length === 2 && Math.abs(rests[0] - rests[1]) / Math.max(rests[0], rests[1]) > tol) {
    return { status: 'not_comparable', title: 'Dati non confrontabili', reasons: ['I recuperi tra le serie variano molto tra le sedute: le prestazioni non sono confrontabili in modo affidabile.'], checklist: STALL_CHECKLIST };
  }
  if (rests.length >= 3) {
    const m = median(rests);
    cand = cand.filter(({ e, s }) => {
      if (s.restMedian != null && Math.abs(s.restMedian - m) / m > tol) { excluded.push(`${e.dateKey}: recuperi diversi dal solito`); return false; }
      return true;
    });
  }
  // 3) Numero di serie: si usano le esposizioni con il numero di serie più frequente.
  const counts = new Map<number, number>();
  for (const x of cand) counts.set(x.s.n, (counts.get(x.s.n) ?? 0) + 1);
  const modeN = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
  const pairs = cand.filter((x) => {
    if (x.s.n === modeN) return true;
    excluded.push(`${x.e.dateKey}: numero di serie diverso`); return false;
  });
  const exclNote = excluded.length ? [`Escluse dal confronto: ${excluded.join('; ')}.`] : [];

  if (pairs.length < minN) return { status: 'insufficient', title: 'Dati insufficienti', reasons: [`Servono almeno ${minN} esposizioni comparabili (ora ${pairs.length}).`, ...exclNote], checklist: [] };

  const lastKey = pairs[pairs.length - 1].e.dateKey;
  let startI = -1;
  for (let i = pairs.length - minN; i >= 0; i--) if (daysBetween(pairs[i].e.dateKey, lastKey) >= minSpan) { startI = i; break; }
  if (startI < 0) return { status: 'insufficient', title: 'Periodo troppo breve', reasons: [`Le esposizioni comparabili coprono ${daysBetween(pairs[0].e.dateKey, lastKey)} giorni: servono almeno ${minSpan} giorni (circa 4 settimane se l'esercizio è settimanale).`, ...exclNote], checklist: [] };
  const win = pairs.slice(startI).map((p) => p.s);
  const useIdx = win.every((x) => x.idx != null);
  const half = Math.floor(win.length / 2);
  const first = win.slice(0, half), second = win.slice(win.length - half);
  const m1 = median(first.map((x) => score(x, useIdx))), m2 = median(second.map((x) => score(x, useIdx)));
  const a = win[0], b = win[win.length - 1];
  const how = useIdx ? '' : ' (confronto diretto di carico e ripetizioni: alcune serie sono fuori dal range della stima)';

  // Carico maggiore ma crollo marcato delle ripetizioni (>40%): non è progresso automatico
  if (b.top > a.top && b.repsAtTop < a.repsAtTop * 0.6) {
    return { status: 'unclear', title: 'Andamento da verificare', reasons: ['Il carico è salito ma le ripetizioni valide sono crollate: controlla ROM, tecnica e confrontabilità prima di parlare di progresso.', ...exclNote], checklist: STALL_CHECKLIST };
  }
  const sameTop = b.top === a.top;
  if ((useIdx ? m2 > m1 * 1.01 : m2 > m1) || (sameTop && b.repsAtTop > a.repsAtTop)) {
    return { status: 'progressing', title: 'Progresso presente', reasons: [(sameTop && b.repsAtTop > a.repsAtTop ? 'A parità di carico sono aumentate le ripetizioni valide.' : 'Le prestazioni recenti (mediana) superano quelle iniziali della finestra.') + how, ...exclNote], checklist: [] };
  }
  if (sameTop && b.repsAtTop === a.repsAtTop && a.rirSum != null && b.rirSum != null && b.rirSum > a.rirSum) {
    return { status: 'progressing', title: 'Progresso presente', reasons: ['A parità di carico e ripetizioni il RIR dichiarato è più alto (stima, non misura perfetta).', ...exclNote], checklist: [] };
  }
  return {
    status: 'possible_stall', title: 'Possibile stallo (segnalazione euristica)',
    reasons: [`In ${win.length} esposizioni comparabili su ${daysBetween(pairs[startI].e.dateKey, lastKey)} giorni la mediana recente non supera quella iniziale${how}.`, 'Non è una diagnosi: segui l\'ordine dei controlli prima di cambiare qualcosa.', ...exclNote],
    checklist: STALL_CHECKLIST
  };
}
