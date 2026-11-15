// Motore deterministico di suggerimenti di progressione. Policy iniziale prudente e configurabile,
// NON un algoritmo clinicamente validato. Ogni risultato riporta dati usati, motivo e limiti.
import type { SetEntry, RirTarget } from '../db/types';

export interface Exposure { sessionId: string; dateKey: string; startedAt: number; sets: SetEntry[] }

export interface ProgressionTarget {
  sets: number | null;
  repMin: number | null;
  repMax: number | null;
  rirTargets: (RirTarget | null)[];
}

export interface PolicySettings {
  /** Salto massimo "accettabile" rispetto al carico prima di proporre consolidamento (es. 0.1 = 10%). */
  maxJumpPct: number;
  /** RIR minimo usato se il target non è impostato. */
  defaultRirMin: number;
  /** Esposizioni comparabili consecutive richieste per proporre un aumento. */
  exposuresForIncrease: number;
}
export const DEFAULT_POLICY: PolicySettings = { maxJumpPct: 0.1, defaultRirMin: 1, exposuresForIncrease: 2 };

export type SuggestionKind = 'increase' | 'consolidate' | 'hold' | 'collect_data' | 'review' | 'pain_stop' | 'not_comparable';

export interface Suggestion {
  kind: SuggestionKind;
  title: string;
  reason: string;
  dataUsed: string[];
  limits: string[];
  /** Carico da APPLICARE se l'utente accetta: valorizzato solo per una vera proposta di aumento. */
  proposedLoad: number | null;
  jumpPct: number | null;
  /** Solo informazione: carico attuale confrontato e prossimo scatto disponibile dell'attrezzatura. */
  currentLoad?: number | null;
  nextStep?: { incrementKg: number; load: number; pct: number | null } | null;
  ruleId: string;
}

const LIMITS_BASE = [
  'Regola euristica dell\'app, non una prescrizione né un algoritmo validato clinicamente.',
  'RIR e qualità tecnica sono autodichiarati: l\'app non valuta la tecnica.'
];

/** Ripetizioni valide utilizzabili per la progressione full-ROM. Parziali/assistite NON contano. */
export function progressionReps(s: SetEntry): number | null {
  if (s.validReps == null) return null;
  const v = s.unilateral && s.fullRepsOtherSide != null ? Math.min(s.validReps, s.fullRepsOtherSide) : s.validReps;
  return Math.min(v, s.fullReps);
}

function workingSets(e: Exposure) { return e.sets.filter((s) => s.kind === 'working').sort((a, b) => a.order - b.order); }

function sameLoad(e: Exposure): number | null {
  const ws = workingSets(e);
  if (!ws.length || ws.some((s) => s.load == null)) return null;
  const l = ws[0].load!;
  return ws.every((s) => Math.abs((s.load ?? NaN) - l) < 1e-9) ? l : null;
}

function fmt(n: number) { return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(n); }

export function describeExposure(e: Exposure): string {
  const ws = workingSets(e);
  return `${e.dateKey}: ` + ws.map((s) => `${s.load == null ? '?' : fmt(s.load)}×${s.validReps ?? '?'} valide${s.rir != null ? ` RIR ${s.rir}` : ' RIR n.d.'}${s.extraPartials ? ` +${s.extraPartials} parziali extra` : ''}`).join(', ');
}

/**
 * Doppia progressione.
 * @param exposures esposizioni della STESSA configurazione (configKey), ordinate dalla più vecchia.
 */
export function suggestProgression(args: {
  exposures: Exposure[];
  target: ProgressionTarget;
  increments: number[];         // incrementi disponibili per quella macchina/attrezzo
  activePain: boolean;          // episodio di dolore attivo o modalità pausa
  policy?: PolicySettings;
}): Suggestion {
  const policy = args.policy ?? DEFAULT_POLICY;
  const exps = args.exposures.filter((e) => workingSets(e).length > 0);
  const last = exps.slice(-policy.exposuresForIncrease);
  const dataUsed = last.map(describeExposure);
  const base = { dataUsed, limits: [...LIMITS_BASE], proposedLoad: null, jumpPct: null };

  if (args.activePain || (exps.length && workingSets(exps[exps.length - 1]).some((s) => s.pain))) {
    return {
      ...base, kind: 'pain_stop', ruleId: 'pain',
      title: 'Nessun aumento: dolore segnalato',
      reason: 'Con dolore segnalato l\'app non propone aumenti. Interrompi o modifica l\'esercizio e, se il dolore è nuovo, acuto o persistente, considera una valutazione qualificata.',
      limits: [...LIMITS_BASE, 'L\'app non fa diagnosi e non genera programmi di riabilitazione.']
    };
  }
  if (args.target.repMax == null) {
    return { ...base, kind: 'collect_data', ruleId: 'no_target', title: 'Imposta un range di ripetizioni', reason: 'Senza range di ripetizioni confermato non è possibile applicare la doppia progressione.' };
  }
  if (exps.length < policy.exposuresForIncrease) {
    return { ...base, kind: 'collect_data', ruleId: 'few_exposures', title: 'Raccogli altre sedute', reason: `Servono almeno ${policy.exposuresForIncrease} sedute comparabili con questa configurazione (ora ${exps.length}). Una sola seduta non basta per proporre un aumento.` };
  }
  const loads = last.map(sameLoad);
  if (loads.some((l) => l == null) || loads.some((l) => l !== loads[0])) {
    return { ...base, kind: 'not_comparable', ruleId: 'load_mismatch', title: 'Sedute non confrontabili', reason: 'Le ultime sedute hanno carichi diversi tra le serie o tra le sedute (o carico non inserito). Mantieni il carico e raccogli dati coerenti.' };
  }
  const load = loads[0]!;
  const expectedSets = args.target.sets;
  const missingQuality = last.some((e) => workingSets(e).some((s) => s.validReps == null || s.rir == null));
  if (missingQuality) {
    return { ...base, kind: 'collect_data', ruleId: 'missing_quality', title: 'Mantieni e completa i dati', reason: 'In alcune serie mancano RIR o ripetizioni conformi. Un dato mancante non è RIR 0 né tecnica perfetta: l\'app non deduce cedimento o qualità.' };
  }
  const issues = last.some((e) => workingSets(e).some((s) => s.techIssue));
  const allTop = last.every((e) => {
    const ws = workingSets(e);
    if (expectedSets != null && ws.length < expectedSets) return false;
    return ws.every((s, i) => {
      const reps = progressionReps(s);
      const rirMin = args.target.rirTargets[i]?.min ?? policy.defaultRirMin;
      return reps != null && reps >= args.target.repMax! && (s.rir ?? -1) >= rirMin;
    });
  });
  if (allTop && !issues) {
    const incs = args.increments.filter((x) => x > 0).sort((a, b) => a - b);
    if (!incs.length) {
      return { ...base, kind: 'increase', ruleId: 'double_progression', title: 'Pronto per il più piccolo incremento disponibile', reason: `In ${last.length} sedute comparabili tutte le serie hanno raggiunto ${args.target.repMax} ripetizioni valide con RIR nel target e senza dolore o problemi tecnici. Gli incrementi di questa attrezzatura non sono registrati: inserisci il più piccolo disponibile.`, limits: [...LIMITS_BASE, 'Incremento minimo dell\'attrezzatura non noto.'] };
    }
    const inc = incs[0];
    const pct = load > 0 ? inc / load : null;
    if (pct != null && pct > policy.maxJumpPct) {
      return { ...base, kind: 'consolidate', ruleId: 'jump_too_big', proposedLoad: null, jumpPct: pct, currentLoad: load, nextStep: { incrementKg: inc, load: load + inc, pct }, title: `Mantieni ${fmt(load)} kg: lo scatto successivo è di ${fmt(inc)} kg (+${fmt(pct * 100)}%)`, reason: `Il più piccolo incremento disponibile (+${fmt(inc)} kg) vale il ${fmt(pct * 100)}% del carico. Valuta di mantenere e consolidare, ampliare il range di ripetizioni o usare microcarichi se l'attrezzatura li consente (senza aggiunte non approvate dal produttore).` };
    }
    return { ...base, kind: 'increase', ruleId: 'double_progression', proposedLoad: load + inc, jumpPct: pct, currentLoad: load, nextStep: { incrementKg: inc, load: load + inc, pct }, title: `Proposta: ${fmt(load)} → ${fmt(load + inc)} kg`, reason: `In ${last.length} sedute comparabili tutte le serie hanno raggiunto ${args.target.repMax} ripetizioni valide, RIR almeno al minimo del target, nessun dolore o problema tecnico. Dopo l'aumento è normale tornare verso il basso del range.` };
  }
  // Tendenza al peggioramento su più sedute comparabili allo stesso carico
  const sameLoadExps = exps.filter((e) => sameLoad(e) === load).slice(-3);
  if (sameLoadExps.length >= 3) {
    const tot = sameLoadExps.map((e) => workingSets(e).reduce((a, s) => a + (progressionReps(s) ?? 0), 0));
    if (tot[2] < tot[1] && tot[1] < tot[0]) {
      return {
        ...base, kind: 'review', ruleId: 'declining', dataUsed: sameLoadExps.map(describeExposure),
        title: 'Calo su più sedute: verifica il contesto',
        reason: 'Le ripetizioni valide sono calate in 3 sedute comparabili. Prima di cambiare, controlla recuperi, sonno, cambi di esercizio o ordine, tempo disponibile, malessere e alimentazione. Una riduzione di carico o volume è solo una proposta da confermare.'
      };
    }
  }
  return {
    ...base, kind: 'hold', ruleId: issues ? 'tech_issue' : 'target_not_reached',
    title: 'Mantieni il carico',
    reason: issues ? 'Sono stati segnalati problemi tecnici: mantieni e stabilizza l\'esecuzione.' : `Non tutte le serie hanno raggiunto ${args.target.repMax} ripetizioni valide con RIR nel target in ${last.length} sedute comparabili. Un singolo episodio non è una tendenza.`
  };
}

/** Policy 5A proposta (da confermare) per classe di esercizio, per 2 serie. */
export function proposedRir(policyClass: string, sets: number): (RirTarget | null)[] {
  const arr: (RirTarget | null)[] = [];
  for (let i = 0; i < sets; i++) {
    const last = i === sets - 1;
    if (policyClass === 'heavy_compound') arr.push({ min: 2, max: 2 });
    else if (policyClass === 'compound') arr.push(last && sets > 1 ? { min: 1, max: 1 } : { min: 2, max: 2 });
    else if (policyClass === 'isolation') arr.push(last && sets > 1 ? { min: 0, max: 1 } : { min: 1, max: 2 });
    else arr.push({ min: 1, max: 2 });
  }
  return arr;
}

/** e1RM facoltativo (Epley) — stima, non invito a provare massimali. Solo 1–12 ripetizioni valide. */
export function e1rmEpley(load: number | null, validReps: number | null): number | null {
  if (load == null || validReps == null || validReps < 1 || validReps > 12) return null;
  return load * (1 + validReps / 30);
}
