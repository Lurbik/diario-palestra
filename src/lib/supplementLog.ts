// Diario delle prese degli integratori: una voce per integratore e giorno (salvare due volte aggiorna, non duplica).
// "Non registrata" = nessuna voce: non è "saltata" né "presa". Nessun recupero o aumento automatico.
import { db, kvGet, kvSet } from '../db/db';

export interface Dose { id: string; supp: string; day: string; status: 'taken' | 'skipped'; qty: number | null; unit: string; savedAt: number }

export const doseId = (supp: string, day: string) => `${supp}:${day}`;

/** Inserisce o aggiorna (pura): nessun doppione per lo stesso integratore e giorno. */
export function mergeDose(list: Dose[], d: Omit<Dose, 'id' | 'savedAt'>, now = Date.now()): Dose[] {
  const id = doseId(d.supp, d.day);
  const next = list.filter((x) => x.id !== id);
  next.push({ ...d, id, savedAt: now });
  return next.sort((a, b) => a.day.localeCompare(b.day) || a.supp.localeCompare(b.supp));
}

export async function upsertDose(d: Omit<Dose, 'id' | 'savedAt'>) {
  await db.transaction('rw', db.kv, async () => {
    const list = await kvGet<Dose[]>('supplementDoses', []);
    await kvSet('supplementDoses', mergeDose(list, d));
  });
}

/** Riepilogo onesto di un periodo: prese, saltate e giorni non registrati restano tre numeri distinti. */
export function doseSummary(list: Dose[], supp: string, days: string[]) {
  const by = new Map(list.filter((d) => d.supp === supp).map((d) => [d.day, d]));
  let taken = 0, skipped = 0, unknown = 0;
  for (const day of days) { const x = by.get(day); if (!x) unknown++; else if (x.status === 'taken') taken++; else skipped++; }
  return { taken, skipped, unknown };
}
