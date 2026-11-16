// Stessa ricetta, obiettivi diversi: varianti ricalcolate dagli ingredienti, con le modifiche esplicite in grammi.
// Regole:
// - Si modificano solo gli ingredienti "di energia" (cereali, tuberi, pane, grassi da condimento) e le verdure.
//   Le fonti proteiche NON vengono ridotte in definizione (ridurre l'energia non significa tagliare le proteine).
// - La variante più proteica aumenta solo la fonte proteica principale.
// - Ogni variante riporta l'effetto per porzione su kcal e proteine e la differenza di spesa in grammi.
// - L'obiettivo ordina le varianti, non le impone: "solo diario" non propone nulla in automatico.
import type { Food, Recipe } from '../db/types';
import type { Goal } from '../db/settings';
import { recipeTotals, strictTotals } from './nutrition';

export type VariantKind = 'more_energy' | 'less_energy' | 'more_protein';
export interface Change { foodId: string; name: string; fromG: number; toG: number }
export interface Variant { kind: VariantKind; title: string; changes: Change[]; kcal: number | null; protein: number | null; dKcal: number | null; dProtein: number | null; extraShoppingG: number }

const ENERGY = new Set(['cereali', 'tuberi']);
const FAT = new Set(['grassi']);
const PROTEIN = new Set(['carne', 'pesce', 'uova', 'legumi', 'latticini']);
const round5 = (g: number) => Math.max(0, Math.round(g / 5) * 5);

function perServing(r: Recipe, foods: Map<string, Food>) {
  const t = strictTotals(recipeTotals(r, foods, 1 / r.servings).sum);
  return { kcal: t.kcal, protein: t.protein };
}

function build(r: Recipe, foods: Map<string, Food>, kind: VariantKind, title: string, edit: (cat: string, g: number, f: Food) => number): Variant | null {
  const changes: Change[] = [];
  const ingredients = r.ingredients.map((i) => {
    const f = foods.get(i.foodId);
    if (!f || i.unit !== 'g') return i;
    const to = edit(f.category ?? '', i.qty, f);
    if (Math.abs(to - i.qty) < 1e-9) return i;
    changes.push({ foodId: i.foodId, name: f.name, fromG: i.qty / r.servings, toG: to / r.servings });
    return { ...i, qty: to };
  });
  if (!changes.length) return null;
  const before = perServing(r, foods);
  const after = perServing({ ...r, ingredients }, foods);
  const d = (a: number | null, b: number | null) => (a == null || b == null ? null : b - a);
  return { kind, title, changes, kcal: after.kcal, protein: after.protein, dKcal: d(before.kcal, after.kcal), dProtein: d(before.protein, after.protein), extraShoppingG: changes.reduce((a, c) => a + (c.toG - c.fromG) * r.servings, 0) };
}

/** Ingredienti della variante (stesso numero di porzioni della ricetta), per creare una copia personale. */
export function applyVariant(r: Recipe, v: Variant): Recipe['ingredients'] {
  return r.ingredients.map((i) => { const c = v.changes.find((x) => x.foodId === i.foodId); return c ? { ...i, qty: c.toG * r.servings } : i; });
}

export function recipeVariants(r: Recipe, foods: Map<string, Food>, goal: Goal | 'solo_diario' | null): Variant[] {
  const mainProtein = [...r.ingredients].map((i) => ({ i, f: foods.get(i.foodId) })).filter((x) => x.f && PROTEIN.has(x.f.category ?? '') && x.i.unit === 'g')
    .sort((a, b) => (b.f!.per100.protein ?? 0) * b.i.qty - (a.f!.per100.protein ?? 0) * a.i.qty)[0]?.i.foodId;
  const hasOil = r.ingredients.some((i) => foods.get(i.foodId)?.category === 'grassi');
  // più verdura solo sulla verdura principale (non 50 g in più di ogni foglia)
  const mainVeg = [...r.ingredients].filter((i) => foods.get(i.foodId)?.category === 'verdura' && i.unit === 'g').sort((a, b) => b.qty - a.qty)[0]?.foodId;
  const vs = [
    build(r, foods, 'more_energy', 'Più energetica', (cat, g) => (ENERGY.has(cat) ? round5(g * 1.3) : FAT.has(cat) ? g + 5 * r.servings : g)),
    build(r, foods, 'less_energy', 'Meno energetica (proteine invariate)', (cat, g, f) => (ENERGY.has(cat) ? round5(g * 0.75) : FAT.has(cat) && hasOil ? Math.max(0, g - 3 * r.servings) : f.id === mainVeg ? g + 50 * r.servings : g)),
    mainProtein ? build(r, foods, 'more_protein', 'Più proteica', (_c, g, f) => (f.id === mainProtein ? round5(g * 1.3) : g)) : null
  ].filter((x): x is Variant => !!x);
  const order: Record<string, VariantKind[]> = { massa: ['more_energy', 'more_protein', 'less_energy'], dimagrimento: ['less_energy', 'more_protein', 'more_energy'], mantenimento: ['more_protein', 'more_energy', 'less_energy'] };
  const o = goal && order[goal] ? order[goal] : ['more_energy', 'less_energy', 'more_protein'];
  return vs.sort((a, b) => o.indexOf(a.kind) - o.indexOf(b.kind));
}

/** Colazione troppo abbondante: dividerla in due momenti invece di ridurre in silenzio l'obiettivo del giorno. */
export function splitMeal(totalKcal: number | null, shareLater = 1 / 3) {
  if (totalKcal == null) return null;
  return { nowKcal: Math.round(totalKcal * (1 - shareLater)), laterKcal: Math.round(totalKcal * shareLater), nowServings: Math.round((1 - shareLater) * 100) / 100, laterServings: Math.round(shareLater * 100) / 100 };
}
