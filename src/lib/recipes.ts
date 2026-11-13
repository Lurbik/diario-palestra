// Ammissibilità delle ricette, suggerimenti e lista della spesa: deterministici e spiegabili.
import type { DiaryEntry, Food, PlanEntry, PreparedBatch, Recipe, StockLot } from '../db/types';
import { usableLots, expiringSoon } from './lots';

export interface ExclusionRules { excludedTags: string[]; allergies: string[] }

const norm = (s: string) => s.toLowerCase().trim();
const allergyHit = (f: Food, a: string) => !!a && (f.tags.some((t) => norm(t).includes(norm(a))) || norm(f.name).includes(norm(a)) || (f.synonyms ?? []).some((s) => norm(s).includes(norm(a))));

/**
 * Motivo per cui una ricetta NON può essere proposta automaticamente, oppure null.
 * - Ingrediente assente dal catalogo → compatibilità non verificabile (non "sicura" per default).
 * - Esclusioni e allergie confermate.
 * - Con allergie dichiarate, un prodotto senza informazioni allergeniche dichiarate richiede verifica dell'etichetta.
 */
export function exclusionReason(r: Recipe, foods: Map<string, Food>, rules: ExclusionRules): string | null {
  for (const ing of r.ingredients) {
    const f = foods.get(ing.foodId);
    if (!f) return 'contiene un ingrediente non presente nel catalogo: compatibilità non verificabile';
    const tag = f.tags.find((t) => rules.excludedTags.includes(t));
    if (tag) return `contiene "${f.name}" (${tag})`;
    const al = rules.allergies.find((a) => allergyHit(f, a));
    if (al) return `allergene dichiarato: ${al} (${f.name})`;
    if (rules.allergies.length && f.allergenInfo === 'unknown') return `allergeni non dichiarati per "${f.name}": verifica l'etichetta prima`;
  }
  return null;
}

export function isFoodAllowed(f: Food, rules: ExclusionRules) {
  return !f.tags.some((t) => rules.excludedTags.includes(t)) && !rules.allergies.some((a) => allergyHit(f, a));
}

/** Quantità disponibile per alimento+unità contando solo lotti UTILIZZABILI. */
export function stockByFood(lots: StockLot[], today: string) {
  const m = new Map<string, number>();
  for (const l of usableLots(lots, today)) m.set(`${l.foodId}|${l.unit}`, (m.get(`${l.foodId}|${l.unit}`) ?? 0) + l.qty);
  return m;
}

export interface RecipeFilter {
  availability: 'any' | 'only_available' | 'max_missing';
  maxMissing: number;
  maxActiveMin: number | null;
  portable: boolean;
  eatCold: boolean;
  noColdChain: boolean;
  expiringFirst: boolean;
}

export interface RecipeSuggestion { recipe: Recipe; missing: string[]; expiringUsed: number; excluded: string | null; score: number; repetitive: boolean }

/** Ricette visibili nei suggerimenti: niente archiviate né vecchi seed non verificati (salvo preferiti). */
export const suggestable = (r: Recipe) => !r.archived && (r.origin !== 'legacy_seed' || r.favorite);

export function suggestRecipes(args: {
  recipes: Recipe[]; foods: Map<string, Food>; lots: StockLot[]; filter: RecipeFilter; rules: ExclusionRules;
  recentDiary: DiaryEntry[]; today: string; pantryTracked?: boolean; feedback?: Record<string, RecipeFeedback>;
}): RecipeSuggestion[] {
  const tracked = args.pantryTracked ?? true;
  const stock = stockByFood(args.lots, args.today);
  const expiringFoods = new Set(expiringSoon(args.lots, args.today).map((l) => l.foodId));
  const recentTags = new Set<string>();
  for (const d of args.recentDiary) {
    const f = d.foodId ? args.foods.get(d.foodId) : null;
    f?.tags.forEach((t) => recentTags.add(t));
    if (d.recipeId) args.recipes.find((x) => x.id === d.recipeId)?.ingredients.forEach((i) => args.foods.get(i.foodId)?.tags.forEach((t) => recentTags.add(t)));
  }
  const out: RecipeSuggestion[] = [];
  for (const r of args.recipes.filter(suggestable)) {
    const fb = args.feedback?.[r.id];
    if (fb?.never) continue;
    const excluded = exclusionReason(r, args.foods, args.rules);
    const missing = tracked ? r.ingredients.filter((i) => (stock.get(`${i.foodId}|${i.unit}`) ?? 0) + 1e-9 < i.qty).map((i) => i.foodId) : [];
    const expiringUsed = r.ingredients.filter((i) => expiringFoods.has(i.foodId)).length;
    const repetitive = r.ingredients.some((i) => args.foods.get(i.foodId)?.tags.some((t) => (t === 'pesce' || t === 'affettato') && recentTags.has(t)));
    const f = args.filter;
    if (tracked && f.availability === 'only_available' && missing.length) continue;
    if (tracked && f.availability === 'max_missing' && missing.length > f.maxMissing) continue;
    if (f.maxActiveMin != null && (r.activeMin == null || r.activeMin > f.maxActiveMin)) continue;
    if (f.portable && !r.portable) continue;
    if (f.eatCold && !r.eatCold) continue;
    if (f.noColdChain && r.needsColdChain) continue;
    if (f.expiringFirst && expiringUsed === 0) continue;
    const score = (r.favorite ? 3 : 0) + (fb?.liked ? 2 : 0) - (fb?.tooSlow ? 1 : 0) + expiringUsed * 2 - missing.length - (repetitive ? 2 : 0);
    out.push({ recipe: r, missing, expiringUsed, excluded, score, repetitive });
  }
  return out.sort((a, b) => Number(!!a.excluded) - Number(!!b.excluded) || b.score - a.score || a.recipe.name.localeCompare(b.recipe.name));
}

/** Feedback esplicito sulle ricette (pesi semplici, nessun modello ML). */
export interface RecipeFeedback { liked?: boolean; never?: boolean; tooBig?: boolean; tooDry?: boolean; tooSlow?: boolean; toTry?: boolean }

export interface ShoppingNeed { foodId: string; unit: string; needed: number; have: number; toBuy: number; unknownStock: boolean }

/** Ingredienti del piano − scorte utilizzabili − porzioni pronte (riservate in ordine di data). */
export function shoppingNeeds(args: { plan: PlanEntry[]; recipes: Map<string, Recipe>; foods: Map<string, Food>; lots: StockLot[]; batches: PreparedBatch[]; today: string; pantryTracked?: boolean }): ShoppingNeed[] {
  const need = new Map<string, number>();
  const batchLeft = new Map<string, number>();
  for (const b of args.batches) if (b.recipeId && b.servingsLeft > 0) batchLeft.set(b.recipeId, (batchLeft.get(b.recipeId) ?? 0) + b.servingsLeft);
  for (const p of [...args.plan].filter((x) => !x.done).sort((a, b) => a.dateKey.localeCompare(b.dateKey))) {
    if (p.recipeId) {
      const r = args.recipes.get(p.recipeId);
      if (!r) continue;
      const avail = batchLeft.get(r.id) ?? 0;
      const fromBatch = Math.min(avail, p.servings);
      batchLeft.set(r.id, avail - fromBatch);
      const rest = p.servings - fromBatch;
      if (rest <= 0) continue;
      for (const i of r.ingredients) need.set(`${i.foodId}|${i.unit}`, (need.get(`${i.foodId}|${i.unit}`) ?? 0) + (i.qty * rest) / r.servings);
    } else if (p.foodId) {
      const f = args.foods.get(p.foodId);
      const k = `${p.foodId}|${f?.defaultUnit ?? 'g'}`;
      need.set(k, (need.get(k) ?? 0) + p.servings);
    }
  }
  const stock = stockByFood(args.lots, args.today);
  const tracked = args.pantryTracked ?? true;
  return [...need.entries()].map(([k, n]) => {
    const [foodId, unit] = k.split('|');
    const have = stock.get(k) ?? 0;
    return { foodId, unit, needed: n, have, toBuy: Math.max(0, n - have), unknownStock: !tracked };
  }).sort((a, b) => (args.foods.get(a.foodId)?.name ?? '').localeCompare(args.foods.get(b.foodId)?.name ?? ''));
}
