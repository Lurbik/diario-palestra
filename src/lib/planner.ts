// Pianificatore pasti locale: 1) ammissibilità  2) candidati con porzioni realistiche  3) beam search sulla
// giornata con scorte e porzioni pronte VIRTUALI + penalità di varietà. Deterministico e spiegabile.
// La funzione obiettivo J è una scelta di prodotto con pesi configurabili, NON un modello fisiologico.
//
// Garanzie (Fase 1):
// - Ogni scelta porta con sé data e fascia originali: uno slot senza candidati resta vuoto e spiegato,
//   gli altri non "scivolano" di posizione.
// - Le scorte vengono RISERVATE virtualmente sui giorni (anche dai pasti bloccati), mai scalate dalla dispensa
//   reale: la dispensa cambia solo con un'azione esplicita di preparazione/consumo.
// - Una porzione pronta non viene allocata due volte. Una preparazione indivisibile (lotto multiporzione)
//   riserva gli ingredienti dell'intero lotto e rende disponibili le porzioni residue nei giorni successivi.
// - Modalità "solo dispensa" (posso prepararlo ora) o "posso comprare" (con elenco del mancante).
import type { Food, MealSlot, PlanEntry, PreparedBatch, Recipe, StockLot } from '../db/types';
import { exclusionReason, stockByFood, suggestable, type ExclusionRules, type RecipeFeedback } from './recipes';
import { recipeTotals, strictTotals } from './nutrition';
import { expiringSoon } from './lots';

export interface PlannerWeights { energy: number; protein: number; time: number; waste: number; repetition: number; preference: number; change: number; missing: number }
export const DEFAULT_WEIGHTS: PlannerWeights = { energy: 3, protein: 2, time: 0.5, waste: 0.5, repetition: 1, preference: 1, change: 2, missing: 0.6 };

export interface SlotNeed { dateKey: string; slot: MealSlot; maxActiveMin: number | null; mustBePortable: boolean; coldChainOk: boolean }

export interface MissingItem { foodId: string; qty: number; unit: string }

export interface Candidate {
  dateKey: string; slot: MealSlot;
  recipeId: string; servings: number; kcal: number | null; protein: number | null; activeMin: number;
  fromBatch: boolean; usesExpiring: number; label: string;
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
    if (s.mustBePortable && !r.portable) { reasons.add('serve una ricetta trasportabile'); continue; }
    if (s.mustBePortable && r.needsColdChain && !s.coldChainOk) { reasons.add('serve conservazione senza frigo'); continue; }
    const steps = r.portionSteps?.length ? r.portionSteps : [1];
    for (const servings of steps) {
      const t = strictTotals(recipeTotals(r, inp.foods, servings / r.servings).sum);
      const whole = !fromBatch && isIndivisible(r);
      cands.push({
        dateKey: s.dateKey, slot: s.slot, recipeId: r.id, servings, kcal: t.kcal, protein: t.protein, activeMin: active, fromBatch,
        usesExpiring: fromBatch ? 0 : r.ingredients.filter((i) => expiringFoods.has(i.foodId)).length, label: r.name,
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
  // Disponibilità VIRTUALI sull'intero periodo (la dispensa reale non viene toccata).
  const batchLeft = new Map<string, number>();
  for (const b of inp.batches) if (b.recipeId && b.servingsLeft > 0) add(batchLeft, b.recipeId, b.servingsLeft);
  const stockLeft = stockByFood(inp.lots, inp.today);
  const byDay = new Map<string, SlotNeed[]>();
  for (const s of inp.slots) byDay.set(s.dateKey, [...(byDay.get(s.dateKey) ?? []), s]);
  const lockedDays = new Set(inp.locked.map((l) => l.dateKey));
  const allDays = [...new Set([...byDay.keys(), ...lockedDays])].sort();

  for (const day of allDays) {
    const slots = byDay.get(day) ?? [];
    const lockedHere = inp.locked.filter((l) => l.dateKey === day);
    // 1) I pasti bloccati riservano prima porzioni pronte o ingredienti.
    let base: Partial = { picks: [], kcal: 0, protein: 0, unknownKcal: false, unknownProtein: false, batchUse: new Map(), stockUse: new Map(), virtualBatch: new Map(), missingCount: 0 };
    for (const l of lockedHere) {
      const r = inp.recipes.find((x) => x.id === l.recipeId);
      if (!r) continue;
      const t = strictTotals(recipeTotals(r, inp.foods, l.servings / r.servings).sum);
      base.kcal += t.kcal ?? 0; base.protein += t.protein ?? 0;
      base.unknownKcal ||= t.kcal == null; base.unknownProtein ||= t.protein == null;
      const ready = (batchLeft.get(r.id) ?? 0) - (base.batchUse.get(r.id) ?? 0);
      if (ready >= l.servings) add(base.batchUse, r.id, l.servings);
      else if (tracked) {
        for (const [k, q] of ingredientNeeds(r, l.servings)) add(base.stockUse, k, q);
        if (isIndivisible(r)) add(base.virtualBatch, r.id, Math.max(0, r.servings - l.servings));
      }
    }
    const free = slots.filter((s) => !lockedHere.some((l) => l.slot === s.slot));
    let frontier: Partial[] = [base];
    for (const s of free) {
      const avail = (p: Partial) => (k: string) => (stockLeft.get(k) ?? 0) - (p.stockUse.get(k) ?? 0);
      const batchAvail = (p: Partial, rid: string) => (batchLeft.get(rid) ?? 0) + (p.virtualBatch.get(rid) ?? 0) - (p.batchUse.get(rid) ?? 0);
      const { cands, reasons } = candidatesFor(s, inp, new Map([...batchLeft.entries()].map(([k, v]) => [k, v + 0])));
      // Le porzioni create nello stesso giorno da un lotto indivisibile contano come pronte per gli slot successivi:
      const extraFromVirtual = (p: Partial) => inp.recipes.filter((r) => (p.virtualBatch.get(r.id) ?? 0) > 0 && r.mealSlots.includes(s.slot) && !cands.some((c) => c.recipeId === r.id && c.fromBatch))
        .map((r): Candidate => { const t = strictTotals(recipeTotals(r, inp.foods, 1 / r.servings).sum); return { dateKey: s.dateKey, slot: s.slot, recipeId: r.id, servings: 1, kcal: t.kcal, protein: t.protein, activeMin: 2, fromBatch: true, usesExpiring: 0, label: r.name, needs: new Map(), prepareWhole: false, leftover: 0 }; });
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
        const why = [...reasons, ...(blockedByStock ? ['scorte insufficienti in modalità "solo dispensa"'] : [])];
        messages.push(`${day} · ${s.slot}: nessuna ricetta ammissibile (${why.join(', ') || 'nessuna ricetta per questo pasto'}). Lo slot resta vuoto. Puoi allentare un vincolo facoltativo (tempo, trasporto, solo dispensa); allergie e sicurezza non vengono allentate.`);
        continue; // lo slot resta vuoto; le scelte successive mantengono la propria fascia
      }
      const frac = (frontier[0].picks.length + lockedHere.length + 1) / Math.max(1, slots.length || 1);
      next.sort((a, b) => jScore(a, inp, w, frac, used) - jScore(b, inp, w, frac, used));
      frontier = next.slice(0, beam);
      if (Date.now() > deadline) { messages.push('Tempo di calcolo esaurito: mostrato il miglior piano ammissibile trovato.'); break; }
    }
    frontier.sort((a, b) => jScore(a, inp, w, 1, used) - jScore(b, inp, w, 1, used));
    const best = frontier[0];
    // 2) Impegno virtuale delle risorse della giornata scelta (anche dei soli pasti bloccati).
    const commitStock = new Map(stockLeft);
    for (const [rid, n] of best.batchUse) batchLeft.set(rid, (batchLeft.get(rid) ?? 0) - n);
    for (const [rid, n] of best.virtualBatch) add(batchLeft, rid, n);
    // Le mancanze di ciascuna scelta si calcolano in sequenza sulla disponibilità ancora libera.
    for (const c of best.picks) {
      let miss: MissingItem[] = [];
      let canMake: boolean | null = null;
      if (c.fromBatch) canMake = true;
      else if (tracked) { miss = missingFor(c.needs, (k) => commitStock.get(k) ?? 0); canMake = miss.length === 0; for (const [k, q] of c.needs) commitStock.set(k, Math.max(0, (commitStock.get(k) ?? 0) - q)); }
      entries.push({ dateKey: c.dateKey, slot: c.slot, recipeId: c.recipeId, servings: c.servings, fromBatch: c.fromBatch, canMakeNow: canMake, missing: miss, prepareWhole: c.prepareWhole });
      used.set(c.recipeId, (used.get(c.recipeId) ?? 0) + 1);
    }
    for (const [k, q] of best.stockUse) stockLeft.set(k, Math.max(0, (stockLeft.get(k) ?? 0) - q));
    days.set(day, { kcal: best.unknownKcal ? null : best.kcal, protein: best.unknownProtein ? null : best.protein });
    if (inp.kcalTarget && !best.unknownKcal && best.picks.length) {
      const gap = (best.kcal - inp.kcalTarget) / inp.kcalTarget;
      if (Math.abs(gap) > 0.15) messages.push(`${day}: miglior piano ammissibile ~${Math.round(best.kcal)} kcal (target ${inp.kcalTarget}). Non vengono forzate porzioni irrealistiche: valuta uno spuntino in più o ricette più energetiche.`);
    }
    if (best.unknownKcal) messages.push(`${day}: energia non calcolabile per almeno una ricetta (valori mancanti, non zero).`);
    if (best.unknownProtein) messages.push(`${day}: proteine non calcolabili per almeno una ricetta (valori mancanti, non zero).`);
  }
  if (!tracked) explain.push('Dispensa non compilata: disponibilità sconosciuta, non trattata come vuota.');
  explain.push('Criteri: esclusioni/allergie e sicurezza prima di tutto; poi disponibilità (porzioni pronte, scorte riservate per porzione), vicinanza ai target (energia ± e carenza proteica), tempo attivo, ingredienti in scadenza, varietà, preferenze e feedback. Pesi configurabili, non coefficienti fisiologici.');
  return { entries, days, messages, explain };
}
