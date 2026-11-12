// Calcoli nutrizionali eseguiti dal codice. Un valore sconosciuto resta sconosciuto (null):
// non diventa mai zero e la somma viene marcata come incompleta.
import type { Food, Nutrients, Recipe, PreparedBatch } from '../db/types';

export const NUTRIENT_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export const NUTRIENT_LABEL: Record<NutrientKey, string> = { kcal: 'Energia', protein: 'Proteine', carbs: 'Carboidrati', fat: 'Grassi', fiber: 'Fibra' };
export const NUTRIENT_UNIT: Record<NutrientKey, string> = { kcal: 'kcal', protein: 'g', carbs: 'g', fat: 'g', fiber: 'g' };

export const EMPTY: Nutrients = { kcal: null, protein: null, carbs: null, fat: null, fiber: null };
export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/**
 * Quantità espressa nella base del valore nutrizionale (g se per 100 g, ml se per 100 ml).
 * Nessuna conversione ml↔g con densità 1: serve una densità nota. Pezzi: serve il peso per pezzo.
 */
export function amountInBasis(food: Pick<Food, 'basis' | 'densityGPerMl' | 'gramsPerPiece'>, qty: number, unit: 'g' | 'ml' | 'pz'): number | null {
  if (food.basis === '100g') {
    if (unit === 'g') return qty;
    if (unit === 'ml') return food.densityGPerMl != null ? qty * food.densityGPerMl : null;
    return food.gramsPerPiece != null ? qty * food.gramsPerPiece : null;
  }
  if (unit === 'ml') return qty;
  if (unit === 'g') return food.densityGPerMl != null ? qty / food.densityGPerMl : null;
  return food.gramsPerPiece != null && food.densityGPerMl != null ? (qty * food.gramsPerPiece) / food.densityGPerMl : null;
}

export function nutrientsFor(food: Pick<Food, 'basis' | 'densityGPerMl' | 'gramsPerPiece' | 'per100'>, qty: number, unit: 'g' | 'ml' | 'pz'): Nutrients {
  const amt = amountInBasis(food, qty, unit);
  const out = { ...EMPTY };
  for (const k of NUTRIENT_KEYS) {
    const v = food.per100[k];
    out[k] = v == null || amt == null ? null : (v * amt) / 100;
  }
  return out;
}

export interface NutrientSum { values: Nutrients; incomplete: Record<NutrientKey, boolean>; count: number }

/** Somma: values[k] = somma dei valori noti (null se nessuno noto); incomplete[k] = almeno un valore mancante. */
export function sumNutrients(list: Nutrients[]): NutrientSum {
  const values = { ...EMPTY };
  const incomplete = { kcal: false, protein: false, carbs: false, fat: false, fiber: false };
  for (const n of list) {
    for (const k of NUTRIENT_KEYS) {
      const v = n[k];
      if (v == null) incomplete[k] = true;
      else values[k] = (values[k] ?? 0) + v;
    }
  }
  return { values, incomplete, count: list.length };
}

export function scaleNutrients(n: Nutrients, f: number): Nutrients {
  const out = { ...EMPTY };
  for (const k of NUTRIENT_KEYS) out[k] = n[k] == null ? null : (n[k] as number) * f;
  return out;
}

/** Valori "pieni" solo se tutti gli addendi erano noti; altrimenti null (per salvataggi coerenti). */
export function strictTotals(sum: NutrientSum): Nutrients {
  const out = { ...EMPTY };
  for (const k of NUTRIENT_KEYS) out[k] = sum.incomplete[k] ? null : sum.values[k];
  return out;
}

export function recipeTotals(recipe: Pick<Recipe, 'ingredients'>, foods: Map<string, Food>, scale = 1): { sum: NutrientSum; rawWeightG: number | null; missingFoods: string[] } {
  const parts: Nutrients[] = [];
  const missingFoods: string[] = [];
  let raw: number | null = 0;
  for (const ing of recipe.ingredients) {
    const f = foods.get(ing.foodId);
    if (!f) { missingFoods.push(ing.foodId); parts.push({ ...EMPTY }); raw = null; continue; }
    parts.push(nutrientsFor(f, ing.qty * scale, ing.unit));
    const g = ing.unit === 'g' ? ing.qty * scale : ing.unit === 'pz' && f.gramsPerPiece != null ? ing.qty * scale * f.gramsPerPiece : ing.unit === 'ml' && f.densityGPerMl != null ? ing.qty * scale * f.densityGPerMl : null;
    raw = raw == null || g == null ? null : raw + g;
  }
  return { sum: sumNutrients(parts), rawWeightG: raw, missingFoods };
}

/**
 * Per ricette cotte: i nutrienti totali sono la somma degli ingredienti; il peso finale
 * misurato serve solo a ripartire (per 100 g di cotto). Nessun fattore crudo/cotto universale.
 */
export function per100gCooked(totals: Nutrients, finalWeightG: number | null): Nutrients {
  if (!finalWeightG || finalWeightG <= 0) return { ...EMPTY };
  return scaleNutrients(totals, 100 / finalWeightG);
}

export function batchPortion(batch: Pick<PreparedBatch, 'totals' | 'servingsTotal'>, servings: number): Nutrients {
  return scaleNutrients(batch.totals, servings / batch.servingsTotal);
}

/** Porzione per peso dal lotto cotto: grammi mangiati / peso finale. */
export function batchByWeight(batch: Pick<PreparedBatch, 'totals' | 'finalWeightG'>, grams: number): Nutrients | null {
  if (!batch.finalWeightG) return null;
  return scaleNutrients(batch.totals, grams / batch.finalWeightG);
}

/** Controllo informativo (non bloccante) tra kcal dichiarate e 4P+4C+9F. */
export function atwaterGap(n: Nutrients): number | null {
  if (n.kcal == null || n.protein == null || n.carbs == null || n.fat == null) return null;
  const est = 4 * n.protein + 4 * n.carbs + 9 * n.fat;
  if (n.kcal === 0) return null;
  return (est - n.kcal) / n.kcal;
}

/** Barrette: totali per lotto, per grammo, per pezzo. */
export function barTotals(totals: Nutrients, finalWeightG: number | null, pieces: number | null) {
  return {
    perBatch: totals,
    per100g: finalWeightG ? scaleNutrients(totals, 100 / finalWeightG) : { ...EMPTY },
    perPiece: pieces && pieces > 0 ? scaleNutrients(totals, 1 / pieces) : { ...EMPTY },
    pieceWeightG: finalWeightG && pieces ? finalWeightG / pieces : null
  };
}
