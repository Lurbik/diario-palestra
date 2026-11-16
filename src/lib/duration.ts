// Durata stimata di una seduta: serie, recuperi tra le serie, avvicinamenti, transizioni e riscaldamento.
// Stima di prodotto (non cronometrata): serve a non etichettare "30 minuti" una seduta che ne richiede 50.
import type { Exercise } from '../db/types';

export const WORK_SEC = 45;          // tempo medio di una serie (esecuzione + preparazione immediata)
export const TRANSITION_MIN = 2;     // cambio postazione, regolazioni
export const GENERAL_WARMUP_MIN = 5; // riscaldamento generale
export const APPROACH_MIN = 2;       // serie di avvicinamento per i multiarticolari di inizio seduta

export function estimateItemMinutes(item: { sets: number | null; restSec: number | null }) {
  const sets = item.sets ?? 2;
  const rest = item.restSec ?? 150;
  return (sets * WORK_SEC + Math.max(0, sets - 1) * rest) / 60 + TRANSITION_MIN;
}

export function estimateDayMinutes(items: { exerciseId: string; sets: number | null; restSec: number | null }[], cls: (id: string) => Exercise['policyClass'] | undefined): number {
  let m = GENERAL_WARMUP_MIN;
  items.forEach((it, i) => {
    m += estimateItemMinutes(it);
    const c = cls(it.exerciseId);
    if (i < 2 && (c === 'heavy_compound' || c === 'compound')) m += APPROACH_MIN;
  });
  return Math.round(m);
}
