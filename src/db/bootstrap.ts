// Avvio: importa i cataloghi pubblici (idempotente) e gestisce i seed delle versioni precedenti.
// Avvio nuovo = profilo vuoto, diario vuoto, nessuna scheda attiva.
// Aggiornamento = nessun record dell'utente cancellato; i vecchi seed vengono solo marcati per provenienza.
import { db, kvGet, kvSet } from './db';
import { defaultSettings, mergeSettings, type Settings } from './settings';
import { loadCatalog, upsertCatalog, retireCatalogItems } from '../catalog/load';
import { exportAll } from '../lib/backup';
import { saveSnapshot } from './migrate';

export const SEED_VERSION = 2;

/** ID dei seed della versione 1 (riconoscimento per provenienza, non per confronto di valori). */
const V1_PROGRAMS = new Set(['prog_dichiarata_2026_11', 'tpl_fb3', 'tpl_ul4', 'tpl_ulppl5']);
const isV1Seed = (table: 'machines' | 'exercises' | 'foods' | 'recipes', id: string) =>
  ({ machines: /^m_/, exercises: /^ex_/, foods: /^f_/, recipes: /^r_/ })[table].test(id);

export async function bootstrap(): Promise<{ legacyMarked: number; catalog: string }> {
  const seeded = await kvGet<number>('seedVersion', 0);
  let legacyMarked = 0;
  if (seeded === 1) legacyMarked = await markLegacySeeds();
  if (!(await db.kv.get('settings'))) await kvSet('settings', defaultSettings());
  const catalog = await importCatalog();
  if (seeded < SEED_VERSION) await kvSet('seedVersion', SEED_VERSION);
  return { legacyMarked, catalog };
}

async function importCatalog(): Promise<string> {
  const c = await loadCatalog();
  const cur = await kvGet<string>('catalogRelease', '');
  if (cur === c.release) return `catalogo ${c.release} già presente`;
  const r = await db.transaction('rw', [db.exercises, db.foods, db.recipes, db.programs, db.kv], async () => {
    const e = await upsertCatalog(db.exercises, c.exercises);
    const f = await upsertCatalog(db.foods, c.foods);
    const rc = await upsertCatalog(db.recipes, c.recipes);
    const t = await upsertCatalog(db.programs, c.templates);
    const retired = await retireCatalogItems(db.recipes, c.retiredRecipes);
    await kvSet('catalogVersion', c.version);
    await kvSet('catalogRelease', c.release);
    return { e, f, rc, t, retired };
  });
  return `catalogo v${c.version}: esercizi +${r.e.added}/${r.e.updated}, alimenti +${r.f.added}/${r.f.updated}, ricette +${r.rc.added}/${r.rc.updated}, template +${r.t.added}/${r.t.updated}, ritirate ${r.retired}`;
}

/**
 * Versione 1 → 2: i seed personali/dimostrativi precedenti restano sul dispositivo (possono avere storico).
 * Prima di toccare qualcosa: snapshot completo. Poi si marca solo la provenienza (origin = legacy_seed);
 * i vecchi template generici vengono archiviati (nascosti, non cancellati). La scheda dichiarata resta
 * com'era finché l'utente non sceglie "Mantieni come mia" o "Archivia".
 */
async function markLegacySeeds(): Promise<number> {
  try { await saveSnapshot(indexedDB, (await exportAll('pre-v2')).tables, 1); } catch (e) { console.warn('Snapshot pre-v2 non riuscito', e); }
  let n = 0;
  await db.transaction('rw', [db.machines, db.exercises, db.foods, db.recipes, db.programs], async () => {
    for (const t of ['machines', 'exercises', 'foods', 'recipes'] as const) {
      const table = db.table(t);
      for (const row of await table.toArray()) {
        if (!row.origin && isV1Seed(t, row.id)) { await table.update(row.id, { origin: 'legacy_seed' }); n++; }
      }
    }
    for (const p of await db.programs.toArray()) {
      if (p.origin || !V1_PROGRAMS.has(p.id)) continue;
      await db.programs.update(p.id, { origin: 'legacy_seed', ...(p.kind === 'template' ? { archived: true } : {}) });
      n++;
    }
  });
  return n;
}

export async function getSettings(): Promise<Settings> {
  return mergeSettings(await kvGet<Partial<Settings>>('settings', {}));
}
export async function patchSettings(p: Partial<Settings>) {
  await kvSet('settings', { ...(await getSettings()), ...p });
}
