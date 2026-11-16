// Pianificatore pasti locale: 1) ammissibilità  2) candidati con porzioni realistiche  3) beam search sulla
// giornata con scorte e porzioni pronte VIRTUALI + penalità di varietà. Deterministico e spiegabile.
// La funzione obiettivo J è una scelta di prodotto con pesi configurabili, NON un modello fisiologico.
//
// Garanzie (Fase 1):
// - Ogni scelta porta con sé data e fascia originali: uno slot senza candidati resta vuoto e spiegato,
//   gli altri non "scivolano" di posizione.
// - Le scorte vengono RISERVATE virtualmente sui giorni (anche dai pasti bloccati), mai scalate dalla dispensa
//   reale: la dispensa cambia solo con un'azione esplicita di preparazione/consumo. Riserve, scadenze alla data
//   del pasto, lotti indivisibili e mancanze usano lo stesso simulatore della lista della spesa (mealSim.ts).
// - Pasti fuori casa: stesso criterio dello Spuntino e dei filtri (away.ts), anche per porzioni pronte e avanzi.
// - Una porzione pronta non viene allocata due volte. Una preparazione indivisibile (lotto multiporzione)
//   riserva gli ingredienti dell'intero lotto e rende disponibili le porzioni residue nei giorni successivi.
// - Modalità "solo dispensa" (posso prepararlo ora) o "posso comprare" (con elenco del mancante).
import type { Food, MealSlot, PlanEntry, PreparedBatch, Recipe, StockLot } from '../db/types';
import { exclusionReason, suggestable, type ExclusionRules, type RecipeFeedback } from './recipes';
import { recipeTotals, strictTotals } from './nutrition';
import { expiringSoon } from './lots';
import { MealSim, ingredientNeeds, isIndivisible, missingFor, simEntryOf, simOrder, type MissingItem, type SimEntry } from './mealSim';
import { awayCheck } from './away';
export { ingredientNeeds, isIndivisible, missingFor, type MissingItem };

export interface PlannerWeights { energy: number; protein: number; time: number; waste: number; repetition: number; preference: number; change: number; missing: number }
export const DEFAULT_WEIGHTS: PlannerWeights = { energy: 3, protein: 2, time: 0.5, waste: 0.5, repetition: 1, preference: 1, change: 2, missing: 0.6 };

/** mustBePortable = pasto fuori casa; coldChainOk = freddo garantito nel tragitto (borsa termica). Vedi away.ts. */
export interface SlotNeed { dateKey: string; slot: MealSlot; maxActiveMin: number | null; mustBePortable: boolean; coldChainOk: boolean }

export interface Candidate {
  dateKey: string; slot: MealSlot;
  recipeId: string; servings: number; kcal: number | null; protein: number | null; activeMin: number;
  fromBatch: boolean; usesExpiring: number; label: string; tags: string[];
  /** Ingredienti da riservare (vuoto se porzione già pronta). */
  needs: Map<string, number>;
  /** Preparazione indivisibile: si prepara l'intero lotto. */
  prepareWhole: boolean;
  /** Porzioni che restano dal lotto preparato per questa scelta. */
  leftover: number;
}

export interface PlannerInput {
  slots: SlotNeed[]; recipes: Recipe[]; foods: Map<string, Food>; lots: StockLot[]; batches: PreparedBatch[]; rules: ExclusionRules;
  kcalTarget: number | null; proteinTarget: number | null; locked: PlanEntry[]; previous: PlanEntry[]; today: string;
  feedback?: Record<string, RecipeFeedback>; weights?: PlannerWeights; beamWidth?: number; budgetMs?: number;
  /** false = dispensa mai compilata: disponibilità sconosciuta (non "vuota"). Default true. */
  pantryTracked?: boolean;
  /** 'pantry_only' = solo ciò che si può preparare con le scorte; 'can_buy' = ammette acquisti, elencando il mancante. */
  stockMode?: 'pantry_only' | 'can_buy';
  /** Preferenze configurabili (non vincoli): pesano nella graduatoria. */
  prefs?: { saltyBreakfast?: boolean | null };
  /** Tutte le ricette note, per riservare le scorte dei pasti bloccati anche se escluse dai candidati. */
  lookupRecipes?: Recipe[];
}

export interface PlannedEntry {
  dateKey: string; slot: MealSlot; recipeId: string; servings: number; fromBatch: boolean;
  /** true = preparabile con le scorte riservate; false = serve comprare; null = dispensa non compilata. */
  canMakeNow: boolean | null; missing: MissingItem[]; prepareWhole: boolean;
}

export interface PlannerResult {
  entries: PlannedEntry[];
  days: Map<string, { kcal: number | null; protein: number | null }>;
  messages: string[];
  explain: string[];
}

/** Candidati ammissibili per uno slot, con porzioni dalla lista realistica della ricetta. */
export function candidatesFor(s: SlotNeed, inp: PlannerInput, batchLeft?: Map<string, number>): { cands: Candidate[]; reasons: string[] } {
  const reasons = new Set<string>();
  const cands: Candidate[] = [];
  const bl = batchLeft ?? new Map(inp.batches.filter((b) => b.recipeId && b.servingsLeft > 0).map((b) => [b.recipeId!, b.servingsLeft]));
  const expiringFoods = new Set(expiringSoon(inp.lots, inp.today).map((l) => l.foodId));
  for (const r of inp.recipes.filter(suggestable)) {
    if (!r.mealSlots.includes(s.slot)) continue;
    if (inp.feedback?.[r.id]?.never) continue;
    const ex = exclusionReason(r, inp.foods, inp.rules);
    if (ex) { reasons.add(ex.startsWith('allergeni non') ? 'informazioni allergeniche mancanti' : ex.startsWith('contiene un ingrediente') ? 'ingredienti non verificabili' : 'esclusioni/allergie'); continue; }
    const fromBatch = (bl.get(r.id) ?? 0) > 0;
    // Una ricetta multiporzione è "pronta" solo se esiste davvero un lotto preparato.
    const active = fromBatch ? 2 : r.activeMin ?? 99;
    if (s.maxActiveMin != null && active > s.maxActiveMin) { reasons.add('tempo attivo disponibile'); continue; }
    if (s.mustBePortable) { const chk = awayCheck(r, { coolerBag: s.coldChainOk ? 'si' : null, fridgeAway: null }); if (!chk.ok) { reasons.add(chk.code === 'not_portable' ? 'serve una ricetta trasportabile' : chk.code === 'requires_cold' ? 'fuori casa senza borsa termica: ricetta da tenere al freddo' : 'fuori casa senza borsa termica: conservazione fuori frigo non verificata'); continue; } }
    const steps = r.portionSteps?.length ? r.portionSteps : [1];
    for (const servings of steps) {
      const t = strictTotals(recipeTotals(r, inp.foods, servings / r.servings).sum);
      const whole = !fromBatch && isIndivisible(r);
      cands.push({
        dateKey: s.dateKey, slot: s.slot, recipeId: r.id, servings, kcal: t.kcal, protein: t.protein, activeMin: active, fromBatch,
        usesExpiring: fromBatch ? 0 : r.ingredients.filter((i) => expiringFoods.has(i.foodId)).length, label: r.name, tags: r.tags ?? [],
        needs: fromBatch ? new Map() : ingredientNeeds(r, servings), prepareWhole: whole, leftover: whole ? Math.max(0, r.servings - servings) : 0
      });
    }
  }
  return { cands, reasons: [...reasons] };
}

interface Partial {
  picks: Candidate[]; kcal: number; protein: number; unknownKcal: boolean; unknownProtein: boolean;
  batchUse: Map<string, number>; stockUse: Map<string, number>; virtualBatch: Map<string, number>; missingCount: number;
}

const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);

function jScore(p: Partial, inp: PlannerInput, w: PlannerWeights, frac: number, used: Map<string, number>): number {
  let J = 0;
  if (inp.kcalTarget) J += w.energy * Math.abs(p.kcal - inp.kcalTarget * frac) / inp.kcalTarget;
  if (inp.proteinTarget) J += w.protein * Math.max(0, inp.proteinTarget * frac - p.protein) / inp.proteinTarget; // carenza, non eccesso
  J += w.time * p.picks.reduce((a, c) => a + c.activeMin, 0) / 60;
  const sameDay = new Map<string, number>();
  for (const c of p.picks) sameDay.set(c.recipeId, (sameDay.get(c.recipeId) ?? 0) + 1);
  for (const n of sameDay.values()) if (n > 1) J += w.repetition * 1.5 * (n - 1);
  for (const c of p.picks) {
    const fb = inp.feedback?.[c.recipeId];
    if (fb?.liked) J -= w.preference * 0.2;
    if (fb?.tooSlow) J += w.preference * 0.2;
    if (fb?.tooBig && c.servings > 1) J += w.preference * 0.3;
    if (fb?.tooDry) J += w.preference * 0.3;
    if (inp.prefs?.saltyBreakfast && c.slot === 'colazione' && c.tags.includes('dolce')) J += w.preference * 0.8;
    J += w.repetition * 0.3 * (used.get(c.recipeId) ?? 0);
    if (c.fromBatch) J -= w.waste * 0.3;            // usare porzioni pronte riduce lo spreco
    J -= w.waste * 0.3 * c.usesExpiring;             // usare ingredienti utilizzabili in scadenza
    const prev = inp.previous.find((x) => x.recipeId === c.recipeId);
    if (prev && prev.status === 'confirmed') J -= w.change * 0.2;
  }
  J += w.missing * p.missingCount;                   // ogni ingrediente da comprare pesa
  if ((inp.kcalTarget && p.unknownKcal) || (inp.proteinTarget && p.unknownProtein)) J += 0.5;
  return J;
}

/** Pianifica i giorni richiesti; i pasti bloccati/confermati non vengono toccati. */
export function planMeals(inp: PlannerInput): PlannerResult {
  const w = { ...DEFAULT_WEIGHTS, ...(inp.weights ?? {}) };
  const beam = inp.beamWidth ?? 12;
  const deadline = Date.now() + (inp.budgetMs ?? 400);
  const tracked = inp.pantryTracked ?? true;
  const mode = inp.stockMode ?? 'can_buy';
  const messages: string[] = [];
  const explain: string[] = [];
  const entries: PlannedEntry[] = [];
  const days = new Map<string, { kcal: number | null; protein: number | null }>();
  const used = new Map<string, number>();
  const recipeMap = new Map([...(inp.lookupRecipes ?? []), ...inp.recipes].map((r) => [r.id, r]));
  // Stato VIRTUALE condiviso con la lista della spesa: scorte per lotto con scadenza, porzioni pronte, avanzi.
  const sim = new MealSim({ lots: inp.lots, batches: inp.batches }, tracked);
  const byDay = new Map<string, SlotNeed[]>();
  for (const s of inp.slots) byDay.set(s.dateKey, [...(byDay.get(s.dateKey) ?? []), s]);
  const lockedDays = new Set(inp.locked.map((l) => l.dateKey));
  const allDays = [...new Set([...byDay.keys(), ...lockedDays])].sort();

  for (const day of allDays) {
    const slots = byDay.get(day) ?? [];
    const lockedHere = inp.locked.filter((l) => l.dateKey === day);
    const lockedSim: SimEntry[] = lockedHere.map(simEntryOf);
    // 1) I pasti bloccati/confermati riservano per primi (quelli già mangiati non riservano nulla).
    const daySim = sim.clone();
    for (const e of [...lockedSim].sort(simOrder)) daySim.run(e, recipeMap, inp.foods);
    const dayStock = daySim.pantry.available(day);
    let base: Partial = { picks: [], kcal: 0, protein: 0, unknownKcal: false, unknownProtein: false, batchUse: new Map(), stockUse: new Map(), virtualBatch: new Map(), missingCount: 0 };
    for (const l of lockedHere) {
      const r = recipeMap.get(l.recipeId ?? '');
      if (!r) continue;
      const t = strictTotals(recipeTotals(r, inp.foods, l.servings / r.servings).sum);
      base.kcal += t.kcal ?? 0; base.protein += t.protein ?? 0;
      base.unknownKcal ||= t.kcal == null; base.unknownProtein ||= t.protein == null;
    }
    const free = slots.filter((s) => !lockedHere.some((l) => l.slot === s.slot));
    let frontier: Partial[] = [base];
    for (const s of free) {
      const avail = (p: Partial) => (k: string) => (dayStock.get(k) ?? 0) - (p.stockUse.get(k) ?? 0);
      const batchAvail = (p: Partial, rid: string) => (daySim.batchLeft.get(rid) ?? 0) + (p.virtualBatch.get(rid) ?? 0) - (p.batchUse.get(rid) ?? 0);
      const { cands, reasons } = candidatesFor(s, inp, new Map(daySim.batchLeft));
      // Avanzi di un lotto indivisibile preparato in questa giornata: porzioni pronte per gli slot successivi,
      // con gli STESSI vincoli (fuori casa, esclusioni) delle altre ricette.
      const okRecipes = new Set(candidatesFor(s, { ...inp, recipes: inp.recipes.filter((r) => r.mealSlots.includes(s.slot)) }, new Map(inp.recipes.map((r) => [r.id, 1e9]))).cands.map((c) => c.recipeId));
      const extraFromVirtual = (p: Partial) => inp.recipes.filter((r) => (p.virtualBatch.get(r.id) ?? 0) > 0 && okRecipes.has(r.id) && !cands.some((c) => c.recipeId === r.id && c.fromBatch))
        .map((r): Candidate => { const t = strictTotals(recipeTotals(r, inp.foods, 1 / r.servings).sum); return { dateKey: s.dateKey, slot: s.slot, recipeId: r.id, servings: 1, kcal: t.kcal, protein: t.protein, activeMin: 2, fromBatch: true, usesExpiring: 0, label: r.name, tags: r.tags ?? [], needs: new Map(), prepareWhole: false, leftover: 0 }; });
      const next: Partial[] = [];
      let blockedByStock = false;
      for (const p of frontier) {
        for (const c of [...cands, ...extraFromVirtual(p)]) {
          if (c.fromBatch && c.servings > batchAvail(p, c.recipeId)) continue; // niente doppia allocazione
          let miss: MissingItem[] = [];
          if (!c.fromBatch && tracked) {
            miss = missingFor(c.needs, avail(p));
            if (mode === 'pantry_only' && miss.length) { blockedByStock = true; continue; }
          }
          const su = new Map(p.stockUse);
          if (!c.fromBatch && tracked) for (const [k, q] of c.needs) add(su, k, q);
          const bu = new Map(p.batchUse);
          if (c.fromBatch) add(bu, c.recipeId, c.servings);
          const vb = new Map(p.virtualBatch);
          if (c.prepareWhole && c.leftover > 0) add(vb, c.recipeId, c.leftover);
          next.push({
            picks: [...p.picks, c], kcal: p.kcal + (c.kcal ?? 0), protein: p.protein + (c.protein ?? 0),
            unknownKcal: p.unknownKcal || c.kcal == null, unknownProtein: p.unknownProtein || c.protein == null,
            batchUse: bu, stockUse: su, virtualBatch: vb, missingCount: p.missingCount + miss.length
          });
        }
      }
      if (!next.length) {
        const why = [...reasons, ...(blockedByStock ? ['scorte insufficienti in modalità "solo dispensa" alla data del pasto'] : [])];
        messages.push(`${day} · ${s.slot}: nessuna ricetta ammissibile (${why.join(', ') || 'nessuna ricetta per questo pasto'}). Lo slot resta vuoto. Puoi allentare un vincolo facoltativo (tempo, trasporto, solo dispensa); allergie e sicurezza non vengono allentate.`);
        continue; // lo slot resta vuoto; le scelte successive mantengono la propria fascia
      }
      const frac = (frontier[0].picks.length + lockedHere.length + 1) / Math.max(1, slots.length || 1);
      next.sort((a, b) => jScore(a, inp, w, frac, used) - jScore(b, inp, w, frac, used));
      frontier = next.slice(0, beam);
      if (Date.now() > deadline) { messages.push('Tempo di calcolo esaurito: mostrato il miglior piano ammissibile trovato. I pasti confermati non vengono sostituiti.'); break; }
    }
    frontier.sort((a, b) => jScore(a, inp, w, 1, used) - jScore(b, inp, w, 1, used));
    const best = frontier[0];
    // 2) Impegno: bloccati + scelte passano nel simulatore condiviso, nello stesso ordine della lista della spesa.
    //    Le etichette (pronto / compra X g / lotto intero) vengono da qui, quindi includono le riserve dei bloccati.
    const pickSim: SimEntry[] = best.picks.map((c) => ({ dateKey: c.dateKey, slot: c.slot, recipeId: c.recipeId, foodId: null, servings: c.servings, firm: false, ref: c }));
    for (const e of [...lockedSim, ...pickSim].sort(simOrder)) {
      const o = sim.run(e, recipeMap, inp.foods);
      if (e.firm) continue;
      const c = e.ref as Candidate;
      entries.push({ dateKey: c.dateKey, slot: c.slot, recipeId: c.recipeId, servings: c.servings, fromBatch: o.fromBatch >= c.servings - 1e-9, canMakeNow: o.canMakeNow, missing: o.missing, prepareWhole: o.prepareWhole });
      used.set(c.recipeId, (used.get(c.recipeId) ?? 0) + 1);
    }
    days.set(day, { kcal: best.unknownKcal ? null : best.kcal, protein: best.unknownProtein ? null : best.protein });
    if (inp.kcalTarget && !best.unknownKcal && best.picks.length) {
      const gap = (best.kcal - inp.kcalTarget) / inp.kcalTarget;
      if (Math.abs(gap) > 0.15) messages.push(`${day}: miglior piano ammissibile ~${Math.round(best.kcal)} kcal (target ${inp.kcalTarget}). Non vengono forzate porzioni irrealistiche: valuta uno spuntino in più o ricette più energetiche.`);
    }
    if (best.unknownKcal) messages.push(`${day}: energia non calcolabile per almeno una ricetta (valori mancanti, non zero).`);
    if (best.unknownProtein) messages.push(`${day}: proteine non calcolabili per almeno una ricetta (valori mancanti, non zero).`);
  }
  if (!tracked) explain.push('Dispensa non compilata: disponibilità sconosciuta, non trattata come vuota.');
  explain.push('Criteri: esclusioni/allergie e sicurezza prima di tutto; poi disponibilità (porzioni pronte, scorte riservate per porzione alla data del pasto), vicinanza ai target (energia ± e carenza proteica), tempo attivo, ingredienti in scadenza, varietà, preferenze e feedback. Pesi configurabili, non coefficienti fisiologici.');
  return { entries, days, messages, explain };
}
