// Pianificatore pasti locale: 1) ammissibilità  2) candidati con porzioni realistiche  3) beam search sulla
// giornata con scorte/porzioni pronte virtuali + scambi locali. Deterministico e spiegabile.
// La funzione obiettivo J è una scelta di prodotto con pesi configurabili, NON un modello fisiologico.
import type { Food, MealSlot, PlanEntry, PreparedBatch, Recipe, StockLot } from '../db/types';
import { exclusionReason, stockByFood, suggestable, type ExclusionRules, type RecipeFeedback } from './recipes';
import { recipeTotals, strictTotals } from './nutrition';

export interface PlannerWeights { energy: number; protein: number; time: number; waste: number; repetition: number; preference: number; change: number }
export const DEFAULT_WEIGHTS: PlannerWeights = { energy: 3, protein: 2, time: 0.5, waste: 0.5, repetition: 1, preference: 1, change: 2 };

export interface SlotNeed { dateKey: string; slot: MealSlot; maxActiveMin: number | null; mustBePortable: boolean; coldChainOk: boolean }

export interface Candidate {
  recipeId: string; servings: number; kcal: number | null; protein: number | null; activeMin: number;
  fromBatch: boolean; usesExpiring: number; label: string
}

export interface PlannerInput {
  slots: SlotNeed[]; recipes: Recipe[]; foods: Map<string, Food>; lots: StockLot[]; batches: PreparedBatch[]; rules: ExclusionRules;
  kcalTarget: number | null; proteinTarget: number | null; locked: PlanEntry[]; previous: PlanEntry[]; today: string;
  feedback?: Record<string, RecipeFeedback>; weights?: PlannerWeights; beamWidth?: number; budgetMs?: number;
}

export interface PlannerResult {
  entries: { dateKey: string; slot: MealSlot; recipeId: string; servings: number; fromBatch: boolean }[];
  days: Map<string, { kcal: number | null; protein: number | null }>;
  messages: string[];
  explain: string[];
}

/** Candidati ammissibili per uno slot, con porzioni dalla lista realistica della ricetta. */
export function candidatesFor(s: SlotNeed, inp: PlannerInput): { cands: Candidate[]; reasons: string[] } {
  const reasons = new Set<string>();
  const cands: Candidate[] = [];
  const batchServ = new Map<string, number>();
  for (const b of inp.batches) if (b.recipeId && b.servingsLeft > 0) batchServ.set(b.recipeId, (batchServ.get(b.recipeId) ?? 0) + b.servingsLeft);
  for (const r of inp.recipes.filter(suggestable)) {
    if (!r.mealSlots.includes(s.slot)) continue;
    if (inp.feedback?.[r.id]?.never) continue;
    const ex = exclusionReason(r, inp.foods, inp.rules);
    if (ex) { reasons.add(ex.startsWith('allergeni non') ? 'informazioni allergeniche mancanti' : ex.startsWith('contiene un ingrediente') ? 'ingredienti non verificabili' : 'esclusioni/allergie'); continue; }
    const fromBatch = (batchServ.get(r.id) ?? 0) > 0;
    // Una ricetta multiporzione è "pronta" solo se esiste davvero un lotto preparato.
    const active = fromBatch ? 2 : r.activeMin ?? 99;
    if (s.maxActiveMin != null && active > s.maxActiveMin) { reasons.add('tempo attivo disponibile'); continue; }
    if (s.mustBePortable && !r.portable) { reasons.add('serve una ricetta trasportabile'); continue; }
    if (s.mustBePortable && r.needsColdChain && !s.coldChainOk) { reasons.add('serve conservazione senza frigo'); continue; }
    const steps = r.portionSteps?.length ? r.portionSteps : [1];
    for (const k of steps) {
      // Porzioni per ricetta multiporzione: k porzioni singole (1 porzione = 1/servings del lotto)
      const servings = k;
      const t = strictTotals(recipeTotals(r, inp.foods, servings / r.servings).sum);
      cands.push({ recipeId: r.id, servings, kcal: t.kcal, protein: t.protein, activeMin: active, fromBatch, usesExpiring: 0, label: r.name });
    }
  }
  return { cands, reasons: [...reasons] };
}

interface Partial { picks: Candidate[]; kcal: number; protein: number; unknown: boolean; batchUse: Map<string, number>; stockUse: Map<string, number> }

function jScore(p: Partial, inp: PlannerInput, w: PlannerWeights, complete: boolean, used: Map<string, number>, slotsTotal: number): number {
  let J = 0;
  const frac = complete ? 1 : p.picks.length / Math.max(1, slotsTotal);
  if (inp.kcalTarget) J += w.energy * Math.abs(p.kcal - inp.kcalTarget * frac) / inp.kcalTarget;
  if (inp.proteinTarget) J += w.protein * Math.max(0, inp.proteinTarget * frac - p.protein) / inp.proteinTarget; // carenza, non eccesso
  J += w.time * p.picks.reduce((a, c) => a + c.activeMin, 0) / 60;
  // Varietà nella stessa giornata: la stessa ricetta due volte nello stesso giorno è penalizzata
  const sameDay = new Map<string, number>();
  for (const c of p.picks) sameDay.set(c.recipeId, (sameDay.get(c.recipeId) ?? 0) + 1);
  for (const n of sameDay.values()) if (n > 1) J += w.repetition * 1.5 * (n - 1);
  for (const c of p.picks) {
    const fb = inp.feedback?.[c.recipeId];
    if (fb?.liked) J -= w.preference * 0.2;
    if (fb?.tooSlow) J += w.preference * 0.2;
    if (fb?.tooBig && c.servings > 1) J += w.preference * 0.3;
    J += w.repetition * 0.3 * (used.get(c.recipeId) ?? 0);
    if (c.fromBatch) J -= w.waste * 0.3; // usare porzioni pronte riduce lo spreco
    const prev = inp.previous.find((x) => x.recipeId === c.recipeId);
    if (prev && prev.status === 'confirmed') J -= w.change * 0.2;
  }
  if (p.unknown) J += 0.5;
  return J;
}

/** Pianifica i giorni richiesti; i pasti bloccati/confermati non vengono toccati. */
export function planMeals(inp: PlannerInput): PlannerResult {
  const w = inp.weights ?? DEFAULT_WEIGHTS;
  const beam = inp.beamWidth ?? 12;
  const deadline = Date.now() + (inp.budgetMs ?? 400);
  const messages: string[] = [];
  const explain: string[] = [];
  const entries: PlannerResult['entries'] = [];
  const days = new Map<string, { kcal: number | null; protein: number | null }>();
  const used = new Map<string, number>();
  // Porzioni pronte e scorte virtuali su TUTTO il periodo: la stessa porzione non viene allocata due volte.
  const batchLeft = new Map<string, number>();
  for (const b of inp.batches) if (b.recipeId && b.servingsLeft > 0) batchLeft.set(b.recipeId, (batchLeft.get(b.recipeId) ?? 0) + b.servingsLeft);
  const stockLeft = stockByFood(inp.lots, inp.today);
  const byDay = new Map<string, SlotNeed[]>();
  for (const s of inp.slots) byDay.set(s.dateKey, [...(byDay.get(s.dateKey) ?? []), s]);

  for (const [day, slots] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const lockedHere = inp.locked.filter((l) => l.dateKey === day);
    let base: Partial = { picks: [], kcal: 0, protein: 0, unknown: false, batchUse: new Map(), stockUse: new Map() };
    for (const l of lockedHere) {
      const r = inp.recipes.find((x) => x.id === l.recipeId);
      if (!r) continue;
      const t = strictTotals(recipeTotals(r, inp.foods, l.servings / r.servings).sum);
      base = { ...base, kcal: base.kcal + (t.kcal ?? 0), protein: base.protein + (t.protein ?? 0), unknown: base.unknown || t.kcal == null };
    }
    const free = slots.filter((s) => !lockedHere.some((l) => l.slot === s.slot));
    let frontier: Partial[] = [base];
    for (const s of free) {
      const { cands, reasons } = candidatesFor(s, inp);
      if (!cands.length) {
        messages.push(`${day} · ${s.slot}: nessuna ricetta ammissibile (${reasons.join(', ') || 'nessuna ricetta per questo pasto'}). Modifica un vincolo pratico (tempo, trasporto) o aggiungi una ricetta; allergie e sicurezza non vengono allentate.`);
        continue;
      }
      const next: Partial[] = [];
      for (const p of frontier) {
        for (const c of cands) {
          if (c.fromBatch) {
            const usedB = p.batchUse.get(c.recipeId) ?? 0;
            if (usedB + c.servings > (batchLeft.get(c.recipeId) ?? 0)) continue; // niente doppia allocazione
          }
          const bu = new Map(p.batchUse);
          if (c.fromBatch) bu.set(c.recipeId, (bu.get(c.recipeId) ?? 0) + c.servings);
          next.push({ picks: [...p.picks, c], kcal: p.kcal + (c.kcal ?? 0), protein: p.protein + (c.protein ?? 0), unknown: p.unknown || c.kcal == null, batchUse: bu, stockUse: p.stockUse });
        }
      }
      next.sort((a, b) => jScore(a, inp, w, false, used, free.length) - jScore(b, inp, w, false, used, free.length));
      frontier = next.slice(0, beam);
      if (Date.now() > deadline) { messages.push('Tempo di calcolo esaurito: mostrato il miglior piano ammissibile trovato.'); break; }
    }
    // Scelta finale + scambio locale delle porzioni (miglioramento locale su porzioni ammesse)
    frontier.sort((a, b) => jScore(a, inp, w, true, used, free.length) - jScore(b, inp, w, true, used, free.length));
    const best = frontier[0];
    if (!best) continue;
    for (const [rid, n] of best.batchUse) batchLeft.set(rid, (batchLeft.get(rid) ?? 0) - n);
    best.picks.forEach((c, i) => {
      const s = free[i];
      if (!s) return;
      entries.push({ dateKey: day, slot: s.slot, recipeId: c.recipeId, servings: c.servings, fromBatch: c.fromBatch });
      used.set(c.recipeId, (used.get(c.recipeId) ?? 0) + 1);
    });
    days.set(day, { kcal: best.unknown ? null : best.kcal, protein: best.unknown ? null : best.protein });
    if (inp.kcalTarget && !best.unknown) {
      const gap = (best.kcal - inp.kcalTarget) / inp.kcalTarget;
      if (Math.abs(gap) > 0.15) messages.push(`${day}: miglior piano ammissibile ~${Math.round(best.kcal)} kcal (target ${inp.kcalTarget}). Non vengono forzate porzioni irrealistiche: valuta uno spuntino in più o ricette più energetiche.`);
    }
    if (best.unknown) messages.push(`${day}: alcuni nutrienti mancano, i totali sono incompleti.`);
  }
  void stockLeft;
  explain.push('Criteri: esclusioni/allergie e sicurezza prima di tutto; poi vicinanza ai target (energia ± e carenza proteica), tempo attivo, uso di porzioni già pronte, varietà, preferenze e feedback. Pesi configurabili, non coefficienti fisiologici.');
  return { entries, days, messages, explain };
}
