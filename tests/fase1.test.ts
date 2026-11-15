// Fase 1 — affidabilità. Fixture sintetiche. Ogni blocco riproduce un problema dell'audit e verifica
// anche il passaggio dal suggerimento al valore effettivamente salvato.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { planMeals, ingredientNeeds, type SlotNeed } from '../src/lib/planner';
import { replaceProposals } from '../src/lib/planStore';
import { shoppingNeeds } from '../src/lib/recipes';
import { suggestProgression, type Exposure } from '../src/lib/progression';
import { loadWriteFor, prefillLoad, type AcceptedLoad } from '../src/lib/loadDecision';
import { intakeStats, proposeCalories } from '../src/lib/calories';
import { addDays } from '../src/lib/dates';
import { AppDB, __setDb, db, kvGet, kvSet } from '../src/db/db';
import type { Food, PlanEntry, PreparedBatch, Recipe, SetEntry, StockLot, WeightEntry } from '../src/db/types';

const D1 = '2026-11-20', D2 = '2026-11-21';
const F = (id: string, per100: Partial<Food['per100']> = {}): Food => ({
  id, name: id, brand: '', source: 'database', sourceNote: '', sourceDate: null, verified: true, state: 'raw', basis: '100g',
  per100: { kcal: 100, protein: 10, carbs: 10, fat: 2, fiber: 1, ...per100 }, densityGPerMl: null, gramsPerPiece: null, defaultPortion: null,
  defaultUnit: 'g', barcode: '', tags: [], shelfStable: 'unknown', seed: false, favorite: false, allergenInfo: 'declared'
});
const R = (id: string, slots: Recipe['mealSlots'], ings: [string, number][], extra: Partial<Recipe> = {}): Recipe => ({
  id, name: id, ingredients: ings.map(([foodId, qty]) => ({ foodId, qty, unit: 'g' })), servings: 1, steps: [], equipment: [], activeMin: 10, totalMin: 10,
  portable: false, eatCold: false, needsColdChain: false, storage: '', storageSource: '', mealSlots: slots, notes: '', seed: false, favorite: false,
  origin: 'catalog', portionSteps: [1], ...extra
});
const S = (dateKey: string, slot: SlotNeed['slot']): SlotNeed => ({ dateKey, slot, maxActiveMin: null, mustBePortable: false, coldChainOk: true });
const LOT = (foodId: string, qty: number): StockLot => ({ id: `lot-${foodId}-${qty}`, foodId, qty, unit: 'g', location: 'dispensa', purchasedAt: null, expiry: null, expiryType: null, openedAt: null, note: '' });
const foods = new Map([['a', F('a')], ['b', F('b')], ['np', F('np', { protein: null })]]);
const base = { foods, lots: [] as StockLot[], batches: [] as PreparedBatch[], rules: { excludedTags: [], allergies: [] }, kcalTarget: null, proteinTarget: null, locked: [] as PlanEntry[], previous: [] as PlanEntry[], today: D1 };

describe('1 · identità dei pasti (data + fascia)', () => {
  it('unica ricetta valida per pranzo, slot colazione + pranzo → pranzo al posto giusto, colazione vuota con spiegazione', () => {
    const r = planMeals({ ...base, slots: [S(D1, 'colazione'), S(D1, 'pranzo')], recipes: [R('p', ['pranzo'], [['a', 100]])] });
    expect(r.entries.map((e) => [e.dateKey, e.slot, e.recipeId])).toEqual([[D1, 'pranzo', 'p']]);
    expect(r.messages.join(' ')).toMatch(/colazione: nessuna ricetta ammissibile.*resta vuoto/);
  });
  it('due giorni con uno slot vuoto in mezzo: ogni voce resta nella sua fascia', () => {
    const recipes = [R('c', ['colazione'], [['a', 50]]), R('p', ['pranzo'], [['a', 100]])];
    const slots = [D1, D2].flatMap((d) => [S(d, 'colazione'), S(d, 'spuntino_mattina'), S(d, 'pranzo')]);
    const r = planMeals({ ...base, slots, recipes });
    expect(r.entries.map((e) => `${e.dateKey}/${e.slot}/${e.recipeId}`).sort()).toEqual([`${D1}/colazione/c`, `${D1}/pranzo/p`, `${D2}/colazione/c`, `${D2}/pranzo/p`]);
  });
  it('pasto bloccato: non riproposto e la sua fascia non viene riassegnata', () => {
    const locked: PlanEntry[] = [{ id: 'L', dateKey: D2, slot: 'pranzo', recipeId: 'p', foodId: null, servings: 1, locked: true, done: false, status: 'confirmed' }];
    const r = planMeals({ ...base, locked, slots: [S(D2, 'colazione'), S(D2, 'pranzo')], recipes: [R('c', ['colazione'], [['a', 50]]), R('p', ['pranzo'], [['a', 100]])] });
    expect(r.entries.map((e) => e.slot)).toEqual(['colazione']);
  });
});

describe('1 · dati salvati del piano', () => {
  let k = 0;
  beforeEach(async () => { const d = new AppDB(`fase1-${++k}`); __setDb(d); await d.open(); });
  it('il piano salvato ha esattamente data e fascia proposte; bloccati intatti; la dispensa non cambia', async () => {
    await db.stock.add(LOT('a', 500));
    const locked: PlanEntry = { id: 'L', dateKey: D1, slot: 'cena', recipeId: 'x', foodId: null, servings: 1, locked: true, done: false, status: 'confirmed' };
    const stale: PlanEntry = { id: 'old', dateKey: D1, slot: 'colazione', recipeId: 'vecchia', foodId: null, servings: 1, locked: false, done: false, status: 'proposed' };
    await db.plan.bulkAdd([locked, stale]);
    const r = planMeals({ ...base, lots: await db.stock.toArray(), slots: [S(D1, 'colazione'), S(D1, 'pranzo')], recipes: [R('p', ['pranzo'], [['a', 100]])] });
    await replaceProposals(await db.plan.toArray(), r.entries);
    const saved = (await db.plan.toArray()).map((p) => `${p.dateKey}/${p.slot}/${p.recipeId}/${p.status}`).sort();
    expect(saved).toEqual([`${D1}/cena/x/confirmed`, `${D1}/pranzo/p/proposed`]);
    expect((await db.stock.toArray())[0].qty).toBe(500);
  });
});

describe('1 · quantità, porzioni, lotti e spesa', () => {
  it('una sola porzione già pronta non viene usata in due pranzi', () => {
    const batch: PreparedBatch = { id: 'b', recipeId: 'm', name: 'm', preparedAt: 0, dateKey: D1, servingsTotal: 4, servingsLeft: 1, finalWeightG: null, totals: { kcal: 400, protein: 40, carbs: 0, fat: 0, fiber: 0 }, location: 'frigo', note: '', txId: 't' };
    const r = planMeals({ ...base, batches: [batch], slots: [{ ...S(D1, 'pranzo'), maxActiveMin: 5 }, { ...S(D2, 'pranzo'), maxActiveMin: 5 }], recipes: [R('m', ['pranzo'], [['a', 400]], { servings: 4, category: 'multiporzione', activeMin: 30 })] });
    expect(r.entries.filter((e) => e.fromBatch).length).toBe(1);
  });
  it('ricetta divisibile da 8 porzioni: una porzione richiede 1/8 degli ingredienti', () => {
    const r8 = R('r8', ['pranzo'], [['a', 800]], { servings: 8 });
    expect(ingredientNeeds(r8, 1).get('a|g')).toBe(100);
    const needs = shoppingNeeds({ plan: [{ id: 'p', dateKey: D1, slot: 'pranzo', recipeId: 'r8', foodId: null, servings: 1, locked: true, done: false }], recipes: new Map([['r8', r8]]), foods, lots: [LOT('a', 30)], batches: [], today: D1 });
    expect(needs[0]).toMatchObject({ needed: 100, have: 30, toBuy: 70 });
  });
  it('preparazione indivisibile: riserva il lotto intero e rende disponibili le porzioni residue il giorno dopo', () => {
    const lotto = R('lotto', ['pranzo'], [['a', 800]], { servings: 4, category: 'multiporzione' });
    expect(ingredientNeeds(lotto, 1).get('a|g')).toBe(800);
    const r = planMeals({ ...base, lots: [LOT('a', 800)], stockMode: 'pantry_only', slots: [S(D1, 'pranzo'), S(D2, 'pranzo')], recipes: [lotto] });
    expect(r.entries.map((e) => [e.dateKey, e.prepareWhole, e.fromBatch])).toEqual([[D1, true, false], [D2, false, true]]);
  });
  it('"solo dispensa": scorte per una porzione → il secondo giorno non riusa le stesse scorte; dispensa reale invariata', () => {
    const lots = [LOT('a', 100)];
    const r = planMeals({ ...base, lots, stockMode: 'pantry_only', slots: [S(D1, 'pranzo'), S(D2, 'pranzo')], recipes: [R('p', ['pranzo'], [['a', 100]])] });
    expect(r.entries.map((e) => e.dateKey)).toEqual([D1]);
    expect(r.entries[0].canMakeNow).toBe(true);
    expect(r.messages.join(' ')).toMatch(/solo dispensa/);
    expect(lots[0].qty).toBe(100);
  });
  it('"posso comprare": nessun lotto sufficiente → proposta con elenco del mancante per la sola differenza', () => {
    const r = planMeals({ ...base, lots: [LOT('a', 60)], slots: [S(D1, 'pranzo')], recipes: [R('p', ['pranzo'], [['a', 100], ['b', 50]])] });
    expect(r.entries[0].canMakeNow).toBe(false);
    expect(r.entries[0].missing.map((m) => [m.foodId, m.qty])).toEqual([['a', 40], ['b', 50]]);
  });
  it('un pasto bloccato riserva le scorte: lo stesso giorno non vengono riallocate', () => {
    const locked: PlanEntry[] = [{ id: 'L', dateKey: D1, slot: 'cena', recipeId: 'p', foodId: null, servings: 1, locked: true, done: false }];
    const r = planMeals({ ...base, locked, lots: [LOT('a', 100)], stockMode: 'pantry_only', slots: [S(D1, 'pranzo'), S(D1, 'cena')], recipes: [R('p', ['pranzo', 'cena'], [['a', 100]])] });
    expect(r.entries.length).toBe(0);
  });
  it('dispensa non compilata: disponibilità sconosciuta, non "da comprare"', () => {
    const r = planMeals({ ...base, pantryTracked: false, slots: [S(D1, 'pranzo')], recipes: [R('p', ['pranzo'], [['a', 100]])] });
    expect(r.entries[0].canMakeNow).toBeNull();
    expect(r.entries[0].missing).toEqual([]);
  });
  it('proteine mancanti nel planner: totale del giorno sconosciuto, non zero', () => {
    const r = planMeals({ ...base, proteinTarget: 120, slots: [S(D1, 'pranzo')], recipes: [R('p', ['pranzo'], [['np', 100]])] });
    expect(r.days.get(D1)!.protein).toBeNull();
    expect(r.messages.join(' ')).toMatch(/proteine non calcolabili/);
  });
});

let n = 0;
const set = (p: Partial<SetEntry> = {}): SetEntry => ({
  id: `s${++n}`, sessionId: 'x', exerciseId: 'e', configKey: 'k', itemIndex: 0, kind: 'working', order: n, load: 20, loadConvention: 'machine_stack', unilateral: false,
  romType: 'full', fullReps: 8, validReps: 8, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 2, rirUnknown: false,
  restBeforeSec: 180, pain: false, painNote: '', techIssue: false, notes: '', savedAt: 0, ...p
});
const exp = (d: string, p: Partial<SetEntry> = {}): Exposure => ({ sessionId: d, dateKey: d, startedAt: Date.parse(d), sets: [set(p), set(p)] });
const target = { sets: 2, repMin: 6, repMax: 8, rirTargets: [] };

describe('2 · carico: scatto disponibile ≠ carico da applicare', () => {
  const consol = suggestProgression({ exposures: [exp('2026-11-02'), exp('2026-11-09')], target, increments: [5], activePain: false });
  // 2,5 kg su 20 kg = +12,5%: con la soglia predefinita (10%) sarebbe consolidamento; qui soglia configurata al 15%
  const incr = suggestProgression({ exposures: [exp('2026-11-02'), exp('2026-11-09')], target, increments: [2.5], activePain: false, policy: { maxJumpPct: 0.15, defaultRirMin: 1, exposuresForIncrease: 2 } });
  it('2×8 valide, 20 kg, RIR 2, incremento minimo 5 kg → consolidamento SENZA carico da applicare', () => {
    expect(consol.kind).toBe('consolidate');
    expect(consol.proposedLoad).toBeNull();
    expect(consol.nextStep).toMatchObject({ incrementKg: 5, load: 25 });
    expect(consol.title).toMatch(/Mantieni 20 kg: lo scatto successivo è di 5 kg/);
  });
  it('mappatura decisione → scrittura', () => {
    expect(loadWriteFor(consol, 'accepted', 1)).toEqual({ action: 'none' });
    expect(loadWriteFor(consol, 'kept', 1)).toEqual({ action: 'clear' });
    expect(loadWriteFor(incr, 'accepted', 1)).toMatchObject({ action: 'set', value: { load: 22.5, previousLoad: 20 } });
    const review = { ...incr, kind: 'review' as const, proposedLoad: null };
    const collect = { ...incr, kind: 'collect_data' as const, proposedLoad: null };
    for (const s of [review, collect]) for (const d of ['accepted', 'kept'] as const) expect(loadWriteFor(s, d, 1)).toEqual({ action: 'none' });
    expect(loadWriteFor(consol, 'modified', 1, 22.5)).toMatchObject({ action: 'set', value: { load: 22.5, ruleId: 'manual' } });
  });

  let k = 0;
  beforeEach(async () => { const d = new AppDB(`fase1-load-${++k}`); __setDb(d); await d.open(); });
  const apply = async (s: typeof incr, decision: 'accepted' | 'kept' | 'modified', at: number, chosen?: number) => {
    const w = loadWriteFor(s, decision, at, chosen);
    if (w.action === 'set') await kvSet('acceptedLoad:k', w.value);
    if (w.action === 'clear') await db.kv.delete('acceptedLoad:k');
  };
  const prefill = async (prevStartedAt: number) => prefillLoad({ lastHereLoad: null, previous: { startedAt: prevStartedAt, dateLabel: '9 nov', firstWorkingLoad: 20 }, accepted: await kvGet<AcceptedLoad | null>('acceptedLoad:k', null) });

  it('"Mantieni 20 kg" resta 20 anche alla riapertura, anche se prima era stato salvato un 25 per errore', async () => {
    await kvSet('acceptedLoad:k', { load: 25, at: 2_000_000_000_000 }); // dato vecchio prodotto dal bug
    await apply(consol, 'kept', 2_000_000_000_001);
    expect(await kvGet('acceptedLoad:k', null)).toBeNull();
    expect((await prefill(1_000)).load).toBe(20);
  });
  it('"Applica 22,5 kg" precompila 22,5 alla seduta successiva; dopo una seduta a 22,5 si riparte da quella', async () => {
    await apply(incr, 'accepted', 5_000);
    expect(await prefill(1_000)).toEqual({ load: 22.5, from: 'proposta accettata, da confermare' });
    const after = prefillLoad({ lastHereLoad: null, previous: { startedAt: 9_000, dateLabel: '16 nov', firstWorkingLoad: 22.5 }, accepted: await kvGet<AcceptedLoad | null>('acceptedLoad:k', null) });
    expect(after.load).toBe(22.5);
    expect(after.from).toMatch(/seduta del/);
  });
  it('"Accetta" su un consolidamento non scrive nulla', async () => {
    await apply(consol, 'accepted', 5_000);
    expect(await kvGet('acceptedLoad:k', null)).toBeNull();
    expect((await prefill(1_000)).load).toBe(20);
  });
  it('6 valide + 3 parziali extra contano 6 per la progressione', () => {
    const s = suggestProgression({ exposures: [exp('2026-11-02', { fullReps: 6, validReps: 6, extraPartials: 3 }), exp('2026-11-09', { fullReps: 6, validReps: 6, extraPartials: 3 })], target, increments: [2.5], activePain: false });
    expect(s.kind).not.toBe('increase');
    expect(s.proposedLoad).toBeNull();
  });
});

describe('4 · calorie: mancante ≠ zero ≠ registrazione incompleta', () => {
  const E = (dateKey: string, kcal: number | null) => ({ dateKey, nutrients: { kcal } });
  it('giorno completo con una voce senza kcal: escluso dalla media; giorno senza voci: escluso, non 0; kcal 0 nota: valida', () => {
    const st = intakeStats([E(D1, 2000), E(D1, null), E(D2, 2400), E(D2, 0)], [D1, D2, '2026-11-22'], D1, '2026-11-22');
    expect(st.usableDays).toEqual([D2]);
    expect(st.unknownDays).toEqual([D1]);
    expect(st.emptyDays).toEqual(['2026-11-22']);
    expect(st.avgKcal).toBe(2400);
  });
  it('target impostato ma consumo non calcolabile → nessuna proposta attribuita al diario', () => {
    const today = '2026-11-28';
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i));
    const w: WeightEntry[] = days.map((d) => ({ id: d, dateKey: d, time: '', kg: 70, morning: true, conditions: '', flags: [], note: '' }));
    const p = proposeCalories({ weights: w, completeDiaryDays: days, avgIntakeKcal: null, targetKcal: 2500, lastTargetChange: null, today });
    expect(p.kind).toBe('insufficient_data');
    expect(p.deltaKcal).toBeNull();
    expect(p.reasons.join(' ')).toMatch(/non è zero/);
  });
});
