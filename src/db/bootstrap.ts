// Primo avvio: carica catalogo, scheda dichiarata (come MODELLO), template, alimenti e ricette dimostrativi.
// Non crea sedute, pesate o voci di diario: quelle richiedono la conferma esplicita dell'utente.
import { db, kvGet, kvSet } from './db';
import { SEED_MACHINES, SEED_EXERCISES, declaredProgram, templates } from '../data/seedGym';
import { SEED_FOODS, SEED_RECIPES } from '../data/seedFood';
import { defaultSettings, type Settings } from './settings';

export const SEED_VERSION = 1;

export async function bootstrap() {
  const seeded = await kvGet<number>('seedVersion', 0);
  if (seeded >= SEED_VERSION) return false;
  await db.transaction('rw', [db.machines, db.exercises, db.programs, db.foods, db.recipes, db.kv], async () => {
    // bulkAdd con controllo: non sovrascrive mai dati esistenti dell'utente.
    const addMissing = async <T extends { id: string }>(table: typeof db.machines | typeof db.exercises | typeof db.programs | typeof db.foods | typeof db.recipes, rows: T[]) => {
      const existing = new Set((await table.toCollection().primaryKeys()) as string[]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (table as any).bulkAdd(rows.filter((r) => !existing.has(r.id)));
    };
    await addMissing(db.machines, SEED_MACHINES);
    await addMissing(db.exercises, SEED_EXERCISES);
    await addMissing(db.programs, [declaredProgram(), ...templates()]);
    await addMissing(db.foods, SEED_FOODS);
    await addMissing(db.recipes, SEED_RECIPES);
    if (!(await db.kv.get('settings'))) await kvSet('settings', defaultSettings());
    await kvSet('seedVersion', SEED_VERSION);
  });
  return true;
}

export async function getSettings(): Promise<Settings> {
  return { ...defaultSettings(), ...(await kvGet<Partial<Settings>>('settings', {})) };
}
export async function patchSettings(p: Partial<Settings>) {
  await kvSet('settings', { ...(await getSettings()), ...p });
}
