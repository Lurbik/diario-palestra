// Target della singola serie: UNA funzione per editor, seduta e coach.
// Ordine delle decisioni:
//   1) dolore o pausa dichiarata → nessun invito a spingere (margine ampio, opzione di fermarsi);
//   2) scelta manuale esplicita dell'utente → resta tale ("prescritto da te");
//   3) altrimenti: classe tecnica dell'esercizio + esperienza su QUESTA variante (storico confrontabile) → margine iniziale;
//   4) dopo ogni serie: solo i riscontri realmente inseriti (RIR "non so" ≠ 0; parziali non contano come complete).
// La posizione nella seduta ("esercizio 4 di 5") non rende da sola la serie più difficile.
// I valori sono impostazioni di prodotto prudenti, NON ottimi fisiologici universali (vedi docs/EVIDENZE.md).
import type { Exercise, RirTarget, SetEntry } from '../db/types';

export type PolicyClass = Exercise['policyClass'];
export interface TargetCtx {
  exercise: Pick<Exercise, 'policyClass' | 'measure' | 'name'>;
  item: { sets: number | null; repMin: number | null; repMax: number | null; rirTargets: (RirTarget | null)[]; restSec: number | null; rirManual?: boolean };
  /** esposizioni passate confrontabili (stessa configurazione) */
  exposures: number;
  /** nelle ultime esposizioni: problemi tecnici o ripetizioni non conformi */
  unstable?: boolean;
  /** dolore attivo o segnalato su questo esercizio oggi, oppure pausa dichiarata */
  pain?: boolean;
  /** serie allenanti già salvate oggi per questo esercizio, in ordine */
  done?: Pick<SetEntry, 'fullReps' | 'validReps' | 'rir' | 'rirUnknown' | 'extraPartials' | 'load'>[];
  position?: { index: number; count: number };
  /** prossimo gradino di carico più basso disponibile (kg), se noto */
  lowerStep?: number | null;
}

export interface SetTarget {
  setNo: number; sets: number; reps: [number, number] | null;
  rir: RirTarget | null; source: 'prescritto' | 'suggerito' | 'nessuno';
  reliability: 'bassa' | 'media' | 'buona';
  why: string[]; dataUsed: string[];
  sentence: string;
  /** consiglio dopo la serie precedente (solo da riscontri inseriti) */
  live: string | null;
  /** niente RIR per esercizi a tempo/distanza */
  measure: 'reps' | 'seconds' | 'meters';
}

/** Margine suggerito per classe ed esperienza: [prima serie, serie successive]. */
export function suggestedRir(cls: PolicyClass, exposures: number, unstable: boolean): [RirTarget, RirTarget] {
  const r = (min: number, max: number): RirTarget => ({ min, max });
  if (exposures === 0 || unstable) {
    // primo approccio o tecnica incerta: margine più ampio, niente stima "al singolo kg"
    return cls === 'heavy_compound' ? [r(3, 4), r(3, 3)] : cls === 'compound' ? [r(2, 3), r(2, 3)] : [r(2, 3), r(2, 2)];
  }
  if (cls === 'heavy_compound') return [r(2, 3), r(2, 2)];
  if (cls === 'compound') return [r(2, 2), r(1, 2)];
  if (cls === 'isolation') return [r(1, 2), r(1, 1)];
  return [r(1, 2), r(1, 2)];
}

const fmtR = (t: RirTarget | null) => (t ? (t.min === t.max ? `RIR ${t.min}` : `RIR ${t.min}–${t.max}`) : 'RIR non indicato');
const fmtRest = (s: number | null) => (s == null ? null : s >= 60 ? `recupero ${Math.round((s / 60) * 2) / 2} min`.replace('.5', ',5') : `recupero ${s} s`);

export function setTarget(ctx: TargetCtx): SetTarget {
  const measure = ctx.exercise.measure ?? 'reps';
  const done = ctx.done ?? [];
  const sets = ctx.item.sets ?? Math.max(2, done.length + 1);
  const setNo = done.length + 1;
  const reps: [number, number] | null = ctx.item.repMin != null ? [ctx.item.repMin, ctx.item.repMax ?? ctx.item.repMin] : null;
  const why: string[] = [];
  const dataUsed: string[] = [];
  const reliability = ctx.exposures >= 3 ? 'buona' : ctx.exposures >= 1 ? 'media' : 'bassa';
  dataUsed.push(ctx.exposures ? `${ctx.exposures} sedute confrontabili con questa configurazione` : 'nessuna seduta precedente con questa configurazione');
  let rir: RirTarget | null = null;
  let source: SetTarget['source'] = 'nessuno';

  if (measure !== 'reps') {
    why.push(measure === 'seconds' ? 'Esercizio a tempo: conta i secondi con buona tecnica, il RIR non si applica.' : 'Esercizio a distanza: conta i metri con lo stesso carico, il RIR non si applica.');
  } else if (ctx.pain) {
    rir = { min: 3, max: 4 };
    source = 'suggerito';
    why.push('Dolore o pausa segnalati: nessun invito a spingere. Margine ampio, oppure interrompi l\'esercizio.');
  } else {
    const manual = ctx.item.rirManual ? ctx.item.rirTargets[setNo - 1] ?? null : null;
    if (manual) { rir = manual; source = 'prescritto'; why.push('Target scelto da te nella scheda: resta com\'è.'); }
    else {
      const [first, next] = suggestedRir(ctx.exercise.policyClass, ctx.exposures, !!ctx.unstable);
      rir = setNo === 1 ? first : next; source = 'suggerito';
      why.push(ctx.exposures === 0 ? 'Prima volta con questa variante: margine più ampio, si affina con i riscontri.' : ctx.unstable ? 'Tecnica o ripetizioni non sempre conformi di recente: margine più ampio.' : `Margine abituale per ${ctx.exercise.policyClass === 'heavy_compound' ? 'un multiarticolare pesante' : ctx.exercise.policyClass === 'compound' ? 'un multiarticolare guidato' : ctx.exercise.policyClass === 'isolation' ? 'un esercizio di isolamento' : 'polpacci/addome'}.`);
    }
  }

  // Riscontro della serie precedente (solo dati inseriti)
  let live: string | null = null;
  const last = done[done.length - 1];
  if (last && measure === 'reps' && !ctx.pain) {
    const valid = last.validReps ?? last.fullReps;
    if (last.rirUnknown || last.rir == null) live = 'RIR della serie precedente non indicato: nessuna deduzione, tieni il target.';
    else if (rir && last.rir < rir.min && reps && valid < reps[0]) {
      live = `Serie precedente: ${valid} valide a RIR ${last.rir}, sotto il range. Recupera del tutto e controlla il set-up; tieni il margine${ctx.lowerStep != null ? `, eventualmente con il gradino inferiore (${String(ctx.lowerStep).replace('.', ',')} kg)` : ''}. Non serve battere il record oggi.`;
    } else if (rir && last.rir < rir.min) {
      live = `Serie precedente a RIR ${last.rir}, sotto il margine scelto: nella prossima resta sul target, senza aggiungere ripetizioni.`;
    } else if (rir && last.rir > rir.max + 1 && reps && valid >= reps[1]) {
      live = `Margine più ampio del previsto (RIR ${last.rir}) al massimo del range: oggi tieni il carico; l'aumento si valuta a fine seduta con la regola di progressione.`;
    } else live = 'Serie precedente nel target: prosegui allo stesso modo.';
    if (last.extraPartials) live += ` Le ${last.extraPartials} parziali restano annotate a parte e non contano come complete.`;
    dataUsed.push(`serie ${done.length} di oggi: ${valid} valide${last.rirUnknown ? ', RIR non so' : last.rir != null ? `, RIR ${last.rir}` : ''}`);
  }

  const parts = [
    ctx.position ? `Esercizio ${ctx.position.index} di ${ctx.position.count}` : null,
    `serie ${Math.min(setNo, Math.max(sets, setNo))} di ${Math.max(sets, setNo)}`,
    reps ? (measure === 'reps' ? `${reps[0]}${reps[1] !== reps[0] ? '–' + reps[1] : ''} ripetizioni` : `${reps[0]}${reps[1] !== reps[0] ? '–' + reps[1] : ''} ${measure === 'seconds' ? 's' : 'm'}`) : null,
    measure === 'reps' ? (rir ? `mira a ${fmtR(rir)}` : null) : null,
    fmtRest(ctx.item.restSec)
  ].filter(Boolean);
  return { setNo, sets, reps, rir, source, reliability, why, dataUsed, sentence: parts.join(' · '), live, measure };
}

/** Target suggeriti per tutte le serie di un esercizio (per editor e "usa i suggerimenti"). */
export function suggestedRirTargets(cls: PolicyClass, sets: number, exposures: number, unstable = false): RirTarget[] {
  const [first, next] = suggestedRir(cls, exposures, unstable);
  return Array.from({ length: sets }, (_, i) => (i === 0 ? first : next));
}

/** Serie: punto di partenza per un accessorio nuovo; per gli altri si parte dalla scheda. */
export function startingSets(item: { sets: number | null } | null, cls: PolicyClass): { sets: number; why: string } {
  if (item?.sets) return { sets: item.sets, why: 'Dalla scheda scelta: resta com\'è.' };
  return { sets: cls === 'heavy_compound' ? 2 : 2, why: 'Punto di partenza modificabile per un esercizio nuovo senza storico (circa 2 serie).' };
}

/** Range di ripetizioni proposto per un esercizio nuovo (modificabile). */
export const RANGE_PROPOSAL: Record<string, [number, number]> = { heavy_compound: [6, 10], compound: [8, 12], isolation: [10, 15], calves_abs: [10, 15] };

/** Una sola funzione per creare una voce di scheda da un esercizio: stessa logica in editor, scheda esercizio e atlante. */
export function newProgramItem(id: string, ex: { id: string; policyClass: PolicyClass; measure?: string } | undefined, exerciseId: string) {
  const cls = ex?.policyClass ?? 'compound';
  const r = RANGE_PROPOSAL[cls] ?? [8, 12];
  const st = startingSets(null, cls);
  return { id, exerciseId, sets: st.sets, repMin: ex?.measure === 'seconds' ? 20 : r[0], repMax: ex?.measure === 'seconds' ? 45 : r[1], rirTargets: suggestedRirTargets(cls, st.sets, 0), rirManual: false, restSec: r[0] >= 10 ? 90 : 150, declaredLoad: '', declaredNotes: '', toConfirm: [] as string[], priority: null, sameAs: '' };
}
