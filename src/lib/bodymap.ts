// Distribuzione del LAVORO REGISTRATO per muscolo. Non misura sviluppo, ipertrofia o forza.
// - Solo serie allenanti (riscaldamento escluso).
// - Una serie unilaterale registrata conta come una serie (nessun raddoppio).
// - Dirette (muscoli principali) e indirette (secondari) sempre separate.
import type { Exercise, Muscle, Session, SetEntry } from '../db/types';

export interface MuscleWork { direct: number; indirect: number; exercises: Set<string>; lastDate: string | null }

export function workByMuscle(sets: SetEntry[], sessions: Session[], exercises: Map<string, Exercise>, fromDateKey: string): Map<Muscle, MuscleWork> {
  const ses = new Map(sessions.filter((s) => s.status === 'done' && s.dateKey >= fromDateKey).map((s) => [s.id, s]));
  const out = new Map<Muscle, MuscleWork>();
  const get = (m: Muscle) => { let w = out.get(m); if (!w) { w = { direct: 0, indirect: 0, exercises: new Set(), lastDate: null }; out.set(m, w); } return w; };
  for (const s of sets) {
    const se = ses.get(s.sessionId);
    if (!se || s.kind !== 'working') continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    for (const m of ex.primaryMuscles) { const w = get(m); w.direct++; w.exercises.add(ex.id); if (!w.lastDate || se.dateKey > w.lastDate) w.lastDate = se.dateKey; }
    for (const m of ex.secondaryMuscles) { if (ex.primaryMuscles.includes(m)) continue; const w = get(m); w.indirect++; w.exercises.add(ex.id); if (!w.lastDate || se.dateKey > w.lastDate) w.lastDate = se.dateKey; }
  }
  return out;
}

/** Serie dirette PREVISTE dalla scheda attiva per muscolo (settimana tipo). */
export function plannedByMuscle(days: { items: { exerciseId: string; sets: number | null }[] }[], exercises: Map<string, Exercise>) {
  const out = new Map<Muscle, number>();
  for (const d of days) for (const it of d.items) {
    const ex = exercises.get(it.exerciseId);
    if (!ex || it.sets == null) continue;
    for (const m of ex.primaryMuscles) out.set(m, (out.get(m) ?? 0) + it.sets);
  }
  return out;
}

/** Testo accessibile per un muscolo senza dati: mai "poco sviluppato". */
export function workLabel(w: MuscleWork | undefined): string {
  if (!w || (w.direct === 0 && w.indirect === 0)) return 'nessun allenamento registrato nel periodo';
  return `${w.direct} serie dirette${w.indirect ? `, ${w.indirect} indirette` : ''}`;
}
