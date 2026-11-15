// Salvataggio delle proposte del pianificatore: ciò che viene scritto corrisponde esattamente a
// data + fascia + ricetta + porzioni scelte. Pasti bloccati, confermati o già consumati non vengono toccati.
// Pianificare NON modifica la dispensa.
import { db } from '../db/db';
import type { PlanEntry } from '../db/types';
import type { PlannedEntry } from './planner';
import { uid } from './id';

export async function replaceProposals(existing: PlanEntry[], entries: PlannedEntry[]): Promise<PlanEntry[]> {
  const keep = (p: PlanEntry) => p.locked || p.done || p.status === 'confirmed';
  const rows: PlanEntry[] = entries
    .filter((e) => !existing.some((p) => keep(p) && p.dateKey === e.dateKey && p.slot === e.slot))
    .map((e) => ({ id: uid(), dateKey: e.dateKey, slot: e.slot, recipeId: e.recipeId, foodId: null, servings: e.servings, locked: false, done: false, status: 'proposed' }));
  await db.transaction('rw', db.plan, async () => {
    await db.plan.bulkDelete(existing.filter((p) => !keep(p)).map((p) => p.id));
    await db.plan.bulkPut(rows);
  });
  return rows;
}
