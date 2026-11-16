// UN SOLO calcolo per lotti, scadenze, pasti bloccati, preparazioni indivisibili e mancanze della spesa.
// Usato dal pianificatore (etichette "puoi prepararlo" / "compra X g"), dalla lista della spesa e dallo Spuntino.
// Tutto è virtuale: la dispensa reale cambia solo con un'azione esplicita di preparazione/consumo.
//
// Regole:
// - Ordine: per data; nello stesso giorno prima i pasti confermati/bloccati, poi le proposte; poi per fascia.
// - Pasti già mangiati (done) non riservano nulla: le scorte sono già state scalate.
// - Porzioni pronte (lotti reali o avanzi virtuali di una preparazione) prima degli ingredienti.
// - Ricetta indivisibile (lotto multiporzione): se mancano porzioni pronte si prepara l'INTERO lotto;
//   gli avanzi diventano porzioni pronte per i pasti successivi. Una versione ridotta è un'altra scelta esplicita.
// - Le scorte valgono alla data del pasto (VirtualPantry), non a oggi.
import type { Food, MealSlot, PlanEntry, PreparedBatch, Recipe, StockLot } from '../db/types';
import { MEAL_ORDER } from '../db/settings';
import { VirtualPantry } from './lots';

export interface MissingItem { foodId: string; qty: number; unit: string }

/** Preparazione indivisibile: un lotto multiporzione si prepara intero. */
export const isIndivisible = (r: Recipe) => r.category === 'multiporzione' && r.servings > 1;

/** Ingredienti necessari per `servings` porzioni (o per l'intero lotto se indivisibile). */
export function ingredientNeeds(r: Recipe, servings: number): Map<string, number> {
  const scale = isIndivisible(r) ? 1 : servings / r.servings;
  const m = new Map<string, number>();
  for (const i of r.ingredients) m.set(`${i.foodId}|${i.unit}`, (m.get(`${i.foodId}|${i.unit}`) ?? 0) + i.qty * scale);
  return m;
}

/** Mancanze rispetto a una disponibilità (chiave alimento|unità). */
export function missingFor(needs: Map<string, number>, available: (k: string) => number): MissingItem[] {
  const out: MissingItem[] = [];
  for (const [k, q] of needs) {
    const gap = q - available(k);
    if (gap > 1e-9) { const [foodId, unit] = k.split('|'); out.push({ foodId, unit, qty: gap }); }
  }
  return out;
}

export interface SimEntry { dateKey: string; slot: MealSlot; recipeId: string | null; foodId: string | null; servings: number; firm: boolean; done?: boolean; ref?: unknown }
export interface SimOutcome {
  entry: SimEntry;
  /** porzioni coperte da porzioni pronte */
  fromBatch: number;
  /** si prepara l'intero lotto */
  prepareWhole: boolean;
  /** ingredienti richiesti dalla preparazione (vuoto se tutto pronto) */
  needs: Map<string, number>;
  missing: MissingItem[];
  /** true = fattibile con le scorte ancora libere; null = dispensa non compilata */
  canMakeNow: boolean | null;
}

export const isFirm = (p: Pick<PlanEntry, 'locked' | 'status'>) => p.locked || p.status === 'confirmed';
export const simEntryOf = (p: PlanEntry): SimEntry => ({ dateKey: p.dateKey, slot: p.slot, recipeId: p.recipeId, foodId: p.foodId, servings: p.servings, firm: isFirm(p), done: p.done, ref: p });

export function simOrder(a: SimEntry, b: SimEntry) {
  return a.dateKey.localeCompare(b.dateKey) || Number(!a.firm) - Number(!b.firm) || MEAL_ORDER.indexOf(a.slot) - MEAL_ORDER.indexOf(b.slot);
}

const toMissing = (m: Map<string, number>): MissingItem[] => [...m].map(([k, qty]) => { const [foodId, unit] = k.split('|'); return { foodId, unit, qty }; });

export class MealSim {
  pantry: VirtualPantry;
  batchLeft: Map<string, number>;
  constructor(args: { lots: StockLot[]; batches: PreparedBatch[] }, readonly tracked = true) {
    this.pantry = new VirtualPantry(args.lots);
    this.batchLeft = new Map();
    for (const b of args.batches) if (b.recipeId && b.servingsLeft > 0) this.batchLeft.set(b.recipeId, (this.batchLeft.get(b.recipeId) ?? 0) + b.servingsLeft);
  }
  clone(): MealSim { const s = Object.create(MealSim.prototype) as MealSim; Object.assign(s, { tracked: this.tracked, pantry: this.pantry.clone(), batchLeft: new Map(this.batchLeft) }); return s; }

  /** Esegue (virtualmente) un pasto e ne restituisce l'esito. */
  run(e: SimEntry, recipes: Map<string, Recipe>, foods: Map<string, Food>): SimOutcome {
    const none: SimOutcome = { entry: e, fromBatch: 0, prepareWhole: false, needs: new Map(), missing: [], canMakeNow: this.tracked ? true : null };
    if (e.done) return none;
    let needs = new Map<string, number>();
    let fromBatch = 0;
    let prepareWhole = false;
    if (e.recipeId) {
      const r = recipes.get(e.recipeId);
      if (!r) return none;
      const ready = this.batchLeft.get(r.id) ?? 0;
      fromBatch = Math.min(ready, e.servings);
      this.batchLeft.set(r.id, ready - fromBatch);
      const rest = e.servings - fromBatch;
      if (rest > 1e-9) {
        needs = ingredientNeeds(r, rest);
        if (isIndivisible(r)) {
          prepareWhole = true;
          this.batchLeft.set(r.id, (this.batchLeft.get(r.id) ?? 0) + Math.max(0, r.servings - rest));
        }
      }
    } else if (e.foodId) {
      needs.set(`${e.foodId}|${foods.get(e.foodId)?.defaultUnit ?? 'g'}`, e.servings);
    }
    const short = needs.size ? toMissing(this.pantry.reserve(needs, e.dateKey)) : [];
    // dispensa mai compilata: disponibilità sconosciuta, non "manca tutto"
    const missing = this.tracked ? short : [];
    return { entry: e, fromBatch, prepareWhole, needs, missing, canMakeNow: this.tracked ? missing.length === 0 : null };
  }
}

/** Simula un insieme di pasti nell'ordine canonico. */
export function simulatePlan(args: {
  entries: SimEntry[]; recipes: Map<string, Recipe>; foods: Map<string, Food>; lots: StockLot[]; batches: PreparedBatch[]; pantryTracked?: boolean; sim?: MealSim;
}): { outcomes: SimOutcome[]; sim: MealSim } {
  const sim = args.sim ?? new MealSim(args, args.pantryTracked ?? true);
  const outcomes = [...args.entries].sort(simOrder).map((e) => sim.run(e, args.recipes, args.foods));
  return { outcomes, sim };
}
