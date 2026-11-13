// Caricamento e importazione idempotente dei cataloghi pubblici.
// - I cataloghi sono moduli dati separati (chunk propri, in cache offline).
// - Importare di nuovo non duplica e non sovrascrive le voci modificate dall'utente (userModified)
//   né quelle create dall'utente o importate privatamente.
import type { Exercise, Food, Program, Recipe } from '../db/types';

export interface CatalogFoodItem {
  id: string; slug: string; name: string; synonyms: string[]; originalName: string; sourceId: string; source: Food['source'];
  license: string; sourceNote: string; sourceDate: string; verified: boolean; state: Food['state']; basis: Food['basis'];
  per100: Food['per100']; gramsPerPiece: number | null; category: string; tags: string[]; allergenInfo: 'declared' | 'unknown';
}

/** Densità tipiche documentate solo per pochi liquidi comuni (mai assunta 1 per tutto). */
const DENSITY: Record<string, number> = { latte_intero: 1.03, latte_ps: 1.03, latte_scremato: 1.03, acqua: 1.0, olio_oliva: 0.92, olio_semi: 0.92, succo_arancia: 1.04, bevanda_soia: 1.03 };
const LIQUID = new Set(Object.keys(DENSITY));

export function toFood(i: CatalogFoodItem, version: number): Food {
  return {
    id: i.id, name: i.name, brand: '', source: i.source, sourceNote: i.sourceNote, sourceDate: i.sourceDate, verified: i.verified,
    state: i.state, basis: i.basis, per100: i.per100, densityGPerMl: DENSITY[i.slug] ?? null, gramsPerPiece: i.gramsPerPiece,
    defaultPortion: null, defaultUnit: LIQUID.has(i.slug) && i.slug.startsWith('olio') === false ? 'ml' : 'g', barcode: '', tags: i.tags,
    shelfStable: 'unknown', seed: false, favorite: false, synonyms: i.synonyms, slug: i.slug, originalName: i.originalName, sourceId: i.sourceId,
    license: i.license, allergenInfo: i.allergenInfo, category: i.category, origin: 'catalog', catalogVersion: version
  };
}

export interface Catalog { version: number; exercises: Exercise[]; foods: Food[]; recipes: Recipe[]; templates: Program[]; unresolved: string[]; foodMeta: Record<string, unknown> }

export async function loadCatalog(): Promise<Catalog> {
  const [ex, rec, tpl, foodsJson] = await Promise.all([
    import('./exercises'), import('./recipes'), import('./templates'), import('./foods.json')
  ]);
  const fj = (foodsJson as unknown as { default: { meta: { version: number } & Record<string, unknown>; items: CatalogFoodItem[] } }).default;
  const foods = fj.items.map((i) => toFood(i, fj.meta.version));
  const slugToId = new Map(fj.items.map((i) => [i.slug, i.id]));
  const { recipes, unresolved } = rec.buildRecipeCatalog(slugToId);
  return {
    version: Math.max(ex.EXERCISE_CATALOG_VERSION, rec.RECIPE_CATALOG_VERSION, fj.meta.version, tpl.TEMPLATE_VERSION),
    exercises: ex.EXERCISE_CATALOG, foods, recipes, templates: tpl.templatesV2(), unresolved, foodMeta: fj.meta
  };
}

interface Upsertable { id: string; origin?: string; userModified?: boolean; catalogVersion?: number }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TableLike { get(id: string): Promise<any>; put(v: any): Promise<unknown>; add(v: any): Promise<unknown> }

/** Inserisce le voci nuove e aggiorna solo quelle di catalogo non modificate dall'utente. */
export async function upsertCatalog<T extends Upsertable>(table: TableLike, items: T[]) {
  let added = 0, updated = 0, kept = 0;
  for (const it of items) {
    const cur = await table.get(it.id);
    if (!cur) { await table.add(it); added++; continue; }
    if (cur.origin === 'catalog' && !cur.userModified && (cur.catalogVersion ?? 0) < (it.catalogVersion ?? 0)) {
      // preserva i preferiti e lo stato di archiviazione scelti dall'utente
      await table.put({ ...it, favorite: (cur as Record<string, unknown>).favorite ?? (it as Record<string, unknown>).favorite, archived: (cur as Record<string, unknown>).archived } as T);
      updated++;
    } else kept++;
  }
  return { added, updated, kept };
}
