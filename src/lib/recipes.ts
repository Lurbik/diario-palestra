// Suggerimento ricette, lista della spesa e generatore di piano: tutto deterministico e spiegabile.
import type { DiaryEntry, Food, MealSlot, PlanEntry, PreparedBatch, Recipe, StockLot } from '../db/types';
import { addDays } from './dates';
import { recipeTotals, strictTotals } from './nutrition';

export interface ExclusionRules { excludedTags: string[]; allergies: string[] }

/** Motivo di esclusione (formaggi esclusi, allergeni) o null se la ricetta è ammessa. */
export function exclusionReason(r: Recipe, foods: Map<string, Food>, rules: ExclusionRules): string | null {
  for (const ing of r.ingredients) {
    const f = foods.get(ing.foodId);
    if (!f) continue;
    const tag = f.tags.find((t) => rules.excludedTags.includes(t));
    if (tag) return `contiene "${f.name}" (${tag})`;
    const al = rules.allergies.find((a) => a && (f.tags.some((t) => t.toLowerCase().includes(a.toLowerCase())) || f.name.toLowerCase().includes(a.toLowerCase())));
    if (al) return `allergene dichiarato: ${al} (${f.name})`;
  }
  return null;
}

export function isFoodAllowed(f: Food, rules: ExclusionRules) {
  return !f.tags.some((t) => rules.excludedTags.includes(t)) && !rules.allergies.some((a) => a && (f.name.toLowerCase().includes(a.toLowerCase()) || f.tags.some((t) => t.toLowerCase().includes(a.toLowerCase()))));
}

export function stockByFood(lots: StockLot[]) {
  const m = new Map<string, number>();
  for (const l of lots) if (l.qty > 0) m.set(`${l.foodId}|${l.unit}`, (m.get(`${l.foodId}|${l.unit}`) ?? 0) + l.qty);
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

export function suggestRecipes(args: {
  recipes: Recipe[]; foods: Map<string, Food>; lots: StockLot[]; filter: RecipeFilter; rules: ExclusionRules;
  recentDiary: DiaryEntry[]; today: string;
}): RecipeSuggestion[] {
  const stock = stockByFood(args.lots);
  const soon = addDays(args.today, 3);
  const expiringFoods = new Set(args.lots.filter((l) => l.qty > 0 && l.expiry && l.expiry <= soon).map((l) => l.foodId));
  // Varietà: tonno/affettati consumati negli ultimi 2 giorni
  const recentTags = new Set<string>();
  for (const d of args.recentDiary) {
    const f = d.foodId ? args.foods.get(d.foodId) : null;
    f?.tags.forEach((t) => recentTags.add(t));
    if (d.recipeId) {
      const r = args.recipes.find((x) => x.id === d.recipeId);
      r?.ingredients.forEach((i) => args.foods.get(i.foodId)?.tags.forEach((t) => recentTags.add(t)));
    }
  }
  const out: RecipeSuggestion[] = [];
  for (const r of args.recipes) {
    const excluded = exclusionReason(r, args.foods, args.rules);
    const missing = r.ingredients.filter((i) => (stock.get(`${i.foodId}|${i.unit}`) ?? 0) + 1e-9 < i.qty).map((i) => i.foodId);
    const expiringUsed = r.ingredients.filter((i) => expiringFoods.has(i.foodId)).length;
    const repetitive = r.ingredients.some((i) => args.foods.get(i.foodId)?.tags.some((t) => (t === 'pesce' || t === 'affettato') && recentTags.has(t)));
    const f = args.filter;
    if (f.availability === 'only_available' && missing.length) continue;
    if (f.availability === 'max_missing' && missing.length > f.maxMissing) continue;
    if (f.maxActiveMin != null && (r.activeMin == null || r.activeMin > f.maxActiveMin)) continue;
    if (f.portable && !r.portable) continue;
    if (f.eatCold && !r.eatCold) continue;
    if (f.noColdChain && r.needsColdChain) continue;
    if (f.expiringFirst && expiringUsed === 0) continue;
    const score = (r.favorite ? 3 : 0) + expiringUsed * 2 - missing.length - (repetitive ? 2 : 0);
    out.push({ recipe: r, missing, expiringUsed, excluded, score, repetitive });
  }
  return out.sort((a, b) => Number(!!a.excluded) - Number(!!b.excluded) || b.score - a.score || a.recipe.name.localeCompare(b.recipe.name));
}

export interface ShoppingNeed { foodId: string; unit: string; needed: number; have: number; toBuy: number; fromBatches: number }

/** Aggrega ingredienti del piano senza doppioni, sottraendo scorte e porzioni già preparate (riservate). */
export function shoppingNeeds(args: { plan: PlanEntry[]; recipes: Map<string, Recipe>; foods: Map<string, Food>; lots: StockLot[]; batches: PreparedBatch[] }): ShoppingNeed[] {
  const need = new Map<string, number>();
  const batchLeft = new Map<string, number>();
  for (const b of args.batches) if (b.recipeId && b.servingsLeft > 0) batchLeft.set(b.recipeId, (batchLeft.get(b.recipeId) ?? 0) + b.servingsLeft);
  const coveredByBatches = new Map<string, number>();
  for (const p of [...args.plan].filter((x) => !x.done).sort((a, b) => a.dateKey.localeCompare(b.dateKey))) {
    if (p.recipeId) {
      const r = args.recipes.get(p.recipeId);
      if (!r) continue;
      const avail = batchLeft.get(r.id) ?? 0;
      const fromBatch = Math.min(avail, p.servings);
      batchLeft.set(r.id, avail - fromBatch);
      coveredByBatches.set(r.id, (coveredByBatches.get(r.id) ?? 0) + fromBatch);
      const rest = p.servings - fromBatch;
      if (rest <= 0) continue;
      for (const i of r.ingredients) {
        const k = `${i.foodId}|${i.unit}`;
        need.set(k, (need.get(k) ?? 0) + (i.qty * rest) / r.servings);
      }
    } else if (p.foodId) {
      const f = args.foods.get(p.foodId);
      const k = `${p.foodId}|${f?.defaultUnit ?? 'g'}`;
      need.set(k, (need.get(k) ?? 0) + p.servings);
    }
  }
  const stock = stockByFood(args.lots);
  return [...need.entries()].map(([k, n]) => {
    const [foodId, unit] = k.split('|');
    const have = stock.get(k) ?? 0;
    return { foodId, unit, needed: n, have, toBuy: Math.max(0, n - have), fromBatches: 0 };
  }).sort((a, b) => (args.foods.get(a.foodId)?.name ?? '').localeCompare(args.foods.get(b.foodId)?.name ?? ''));
}

export interface PlanSlotNeed { dateKey: string; slot: MealSlot; workday: boolean }
export interface GeneratedPlan { entries: PlanEntry[]; messages: string[]; dayTotals: Map<string, { kcal: number | null; protein: number | null }> }

/**
 * Generatore di piano deterministico. Rispetta esclusioni, slot, tempo attivo e trasportabilità,
 * mantiene i pasti bloccati e rigenera solo gli altri. Porzioni sempre 1 (nessuna porzione assurda);
 * se i totali sono lontani dai target lo segnala invece di forzare i numeri.
 */
export function generatePlan(args: {
  slots: PlanSlotNeed[]; existing: PlanEntry[]; recipes: Recipe[]; foods: Map<string, Food>; rules: ExclusionRules;
  coolerBag: boolean; maxActiveMinWeekday: number | null; kcalTarget: number | null; proteinTarget: number | null; idGen: () => string;
}): GeneratedPlan {
  const messages: string[] = [];
  const allowed = args.recipes.filter((r) => !exclusionReason(r, args.foods, args.rules));
  const locked = args.existing.filter((e) => e.locked);
  const entries: PlanEntry[] = [...locked];
  const useCount = new Map<string, number>();
  for (const e of locked) if (e.recipeId) useCount.set(e.recipeId, (useCount.get(e.recipeId) ?? 0) + 1);
  const lastBySlot = new Map<MealSlot, string>();
  for (const s of args.slots) {
    if (locked.some((e) => e.dateKey === s.dateKey && e.slot === s.slot)) continue;
    let cands = allowed.filter((r) => r.mealSlots.includes(s.slot));
    const atWork = s.workday && (s.slot === 'colazione' || s.slot === 'spuntino_mattina');
    if (atWork && s.slot === 'spuntino_mattina') {
      cands = cands.filter((r) => r.portable && (!r.needsColdChain || args.coolerBag));
    }
    if (s.workday && args.maxActiveMinWeekday != null) cands = cands.filter((r) => (r.activeMin ?? 99) <= args.maxActiveMinWeekday! || r.servings > 1);
    if (!cands.length) {
      messages.push(`${s.dateKey} ${s.slot}: nessuna ricetta compatibile (${atWork ? 'serve trasportabile' + (args.coolerBag ? '' : ' e senza catena del freddo') : 'vincoli di tempo/esclusioni'}). Aggiungi una ricetta adatta o lascia libero.`);
      continue;
    }
    cands.sort((a, b) => (useCount.get(a.id) ?? 0) - (useCount.get(b.id) ?? 0) || Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
    const pick = cands.find((r) => lastBySlot.get(s.slot) !== r.id && (useCount.get(r.id) ?? 0) < 3) ?? cands[0];
    useCount.set(pick.id, (useCount.get(pick.id) ?? 0) + 1);
    lastBySlot.set(s.slot, pick.id);
    entries.push({ id: args.idGen(), dateKey: s.dateKey, slot: s.slot, recipeId: pick.id, foodId: null, servings: 1, locked: false, done: false });
  }
  const dayTotals = new Map<string, { kcal: number | null; protein: number | null }>();
  for (const e of entries) {
    const r = e.recipeId ? args.recipes.find((x) => x.id === e.recipeId) : null;
    if (!r) continue;
    const t = strictTotals(recipeTotals(r, args.foods, e.servings / r.servings).sum);
    const cur = dayTotals.get(e.dateKey) ?? { kcal: 0, protein: 0 };
    dayTotals.set(e.dateKey, { kcal: cur.kcal == null || t.kcal == null ? null : cur.kcal + t.kcal, protein: cur.protein == null || t.protein == null ? null : cur.protein + t.protein });
  }
  for (const [d, t] of dayTotals) {
    if (args.kcalTarget && t.kcal != null && Math.abs(t.kcal - args.kcalTarget) / args.kcalTarget > 0.15) messages.push(`${d}: il piano arriva a ~${Math.round(t.kcal)} kcal (target ${args.kcalTarget}). Valuta porzioni o uno spuntino in più: non vengono forzate porzioni irrealistiche.`);
    if (args.proteinTarget && t.protein != null && t.protein < args.proteinTarget * 0.85) messages.push(`${d}: proteine pianificate ~${Math.round(t.protein)} g (target ${args.proteinTarget} g).`);
    if (t.kcal == null) messages.push(`${d}: alcuni nutrienti mancano (es. proteine in polvere senza etichetta): totali incompleti.`);
  }
  return { entries, messages, dayTotals };
}
