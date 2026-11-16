// "Spuntino salato da portare al lavoro": vincoli prima del gusto, fattibilità per porzione, motivi osservabili.
// - Vincoli obbligatori: esclusioni/allergie, trasportabile, conservazione compatibile (fuori frigo solo se la fonte
//   lo consente; altrimenti serve frigo o borsa termica dichiarati dall'utente). Mai allentati in silenzio.
// - Fattibilità: "puoi prepararlo ora" (scorte utilizzabili per UNA porzione) oppure elenco del mancante.
// - Dispensa mai compilata: disponibilità sconosciuta, non "manca tutto".
import type { Food, PlanEntry, PreparedBatch, Recipe, StockLot } from '../db/types';
import { exclusionReason, suggestable, type ExclusionRules, type RecipeFeedback } from './recipes';
import { ingredientNeeds, missingFor, simulatePlan, simEntryOf, isFirm, type MissingItem } from './mealSim';
import { awayCheck } from './away';
import { expiringSoon } from './lots';

export interface SnackOption { recipe: Recipe; canMakeNow: boolean | null; missing: MissingItem[]; reasons: string[]; ambient: Recipe['ambient']; ready: boolean }
export interface SnackResult { options: SnackOption[]; needsCold: Recipe[]; excludedCount: number; tracked: boolean; coldOk: boolean }

export function snackForWork(args: {
  recipes: Recipe[]; foods: Map<string, Food>; lots: StockLot[]; rules: ExclusionRules; today: string;
  coolerBag: 'si' | 'no' | null; fridgeAway: 'si' | 'no' | null; pantryTracked: boolean; salty?: boolean; feedback?: Record<string, RecipeFeedback>;
  /** Pasti già confermati/bloccati: le loro scorte sono riservate (stesso calcolo del piano e della spesa). */
  plan?: PlanEntry[]; batches?: PreparedBatch[];
}): SnackResult {
  const salty = args.salty ?? true;
  const ctx = { coolerBag: args.coolerBag, fridgeAway: args.fridgeAway };
  const coldOk = ctx.coolerBag === 'si';
  const recipeMap = new Map(args.recipes.map((r) => [r.id, r]));
  const firm = (args.plan ?? []).filter((p) => isFirm(p) && !p.done && p.dateKey <= args.today).map(simEntryOf);
  const { sim } = simulatePlan({ entries: firm, recipes: recipeMap, foods: args.foods, lots: args.lots, batches: args.batches ?? [], pantryTracked: args.pantryTracked });
  const stock = sim.pantry.available(args.today);
  const expiring = new Set(expiringSoon(args.lots, args.today).map((l) => l.foodId));
  const name = (id: string) => args.foods.get(id)?.name ?? id;
  const options: SnackOption[] = [];
  const needsCold: Recipe[] = [];
  let excludedCount = 0;
  for (const r of args.recipes.filter(suggestable)) {
    const isSnack = r.category === 'spuntino' || r.mealSlots.includes('spuntino_mattina') || r.mealSlots.includes('merenda');
    if (!isSnack || !r.portable) continue;
    if (salty && !(r.tags ?? []).includes('salata')) continue;
    if (args.feedback?.[r.id]?.never) continue;
    if (exclusionReason(r, args.foods, args.rules)) { excludedCount++; continue; }
    const chk = awayCheck(r, ctx);
    if (!chk.ok) { if (chk.code !== 'not_portable') needsCold.push(r); continue; }
    const ready = (sim.batchLeft.get(r.id) ?? 0) >= 1;
    const needs = ready ? new Map<string, number>() : ingredientNeeds(r, 1);
    const missing = args.pantryTracked && !ready ? missingFor(needs, (k) => stock.get(k) ?? 0) : [];
    const canMakeNow = ready ? true : args.pantryTracked ? missing.length === 0 : null;
    const reasons: string[] = [];
    if (ready) reasons.push('hai già porzioni pronte');
    else if (canMakeNow === true) reasons.push('puoi prepararlo adesso con quello che hai (scorte non riservate ad altri pasti)');
    else if (canMakeNow === false) reasons.push(`manca: ${missing.map((m) => `${name(m.foodId)} ${Math.ceil(m.qty)} ${m.unit}`).join(', ')}`);
    else reasons.push('dispensa non compilata: disponibilità non verificata');
    reasons.push(chk.reason);
    const exp = r.ingredients.filter((i) => expiring.has(i.foodId)).length;
    if (exp) reasons.push(`usa ${exp} ingrediente in scadenza`);
    options.push({ recipe: r, canMakeNow, missing, reasons, ambient: r.ambient, ready });
  }
  const score = (o: SnackOption) => (o.canMakeNow === true ? 0 : o.canMakeNow == null ? 1 : 2) * 100 + o.missing.length * 10
    - (o.recipe.favorite || args.feedback?.[o.recipe.id]?.liked ? 5 : 0) - o.recipe.ingredients.filter((i) => expiring.has(i.foodId)).length * 3 + (o.recipe.activeMin ?? 30) / 10;
  options.sort((a, b) => score(a) - score(b) || a.recipe.name.localeCompare(b.recipe.name));
  return { options, needsCold, excludedCount, tracked: args.pantryTracked, coldOk };
}
