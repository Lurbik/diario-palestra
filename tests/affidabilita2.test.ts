// Secondo audit, fase 1 · affidabilità. Riproduce i quattro casi con fixture sintetiche e verifica che
// Settimana (planner), Oggi, Spuntino, filtri ricette e Spesa diano la stessa risposta.
import { describe, it, expect } from 'vitest';
import { planMeals, type SlotNeed } from '../src/lib/planner';
import { shoppingNeeds, suggestRecipes } from '../src/lib/recipes';
import { snackForWork } from '../src/lib/snack';
import type { Food, PlanEntry, PreparedBatch, Recipe, StockLot } from '../src/db/types';

const SUN = '2026-11-22', MON = '2026-11-23', TUE = '2026-11-24';
const F = (id: string): Food => ({
  id, name: id, brand: '', source: 'database', sourceNote: '', sourceDate: null, verified: true, state: 'raw', basis: '100g',
  per100: { kcal: 300, protein: 10, carbs: 40, fat: 8, fiber: 4 }, densityGPerMl: null, gramsPerPiece: null, defaultPortion: null,
  defaultUnit: 'g', barcode: '', tags: [], shelfStable: 'unknown', seed: false, favorite: false, allergenInfo: 'declared'
});
const R = (id: string, slots: Recipe['mealSlots'], ings: [string, number][], extra: Partial<Recipe> = {}): Recipe => ({
  id, name: id, ingredients: ings.map(([foodId, qty]) => ({ foodId, qty, unit: 'g' })), servings: 1, steps: [], equipment: [], activeMin: 5, totalMin: 5,
  portable: false, eatCold: false, needsColdChain: false, storage: '', storageSource: '', mealSlots: slots, notes: '', seed: false, favorite: false,
  origin: 'catalog', portionSteps: [1], ...extra
});
const LOT = (foodId: string, qty: number, expiry: string | null = null, expiryType: StockLot['expiryType'] = null): StockLot =>
  ({ id: `lot-${foodId}-${qty}-${expiry}`, foodId, qty, unit: 'g', location: 'dispensa', purchasedAt: null, expiry, expiryType, openedAt: null, note: '' });
const PE = (id: string, dateKey: string, slot: PlanEntry['slot'], recipeId: string, extra: Partial<PlanEntry> = {}): PlanEntry =>
  ({ id, dateKey, slot, recipeId, foodId: null, servings: 1, locked: false, done: false, status: 'proposed', ...extra });
const foods = new Map(['a', 'b', 'avena', 'burro', 'ceci'].map((x) => [x, F(x)]));
const base = { foods, batches: [] as PreparedBatch[], rules: { excludedTags: [] as string[], allergies: [] as string[] }, kcalTarget: null, proteinTarget: null, locked: [] as PlanEntry[], previous: [] as PlanEntry[], today: SUN };
const slot = (dateKey: string, s: SlotNeed['slot'], away = false, cold = false): SlotNeed => ({ dateKey, slot: s, maxActiveMin: null, mustBePortable: away, coldChainOk: cold });

describe('1 · conservazione fuori casa: un solo criterio', () => {
  const ceci = R('ceci_croccanti', ['spuntino_mattina', 'merenda'], [['ceci', 80]], { portable: true, eatCold: true, ambient: 'not_verified', tags: ['salata'], category: 'spuntino' });
  const crackers = R('cracker', ['spuntino_mattina', 'merenda'], [['a', 40]], { portable: true, eatCold: true, ambient: 'ok', tags: ['salata'], category: 'spuntino' });

  it('ricetta "non verificata" unica candidata, senza borsa termica: Settimana lascia vuoto come lo Spuntino', () => {
    const plan = planMeals({ ...base, lots: [], slots: [slot(MON, 'spuntino_mattina', true, false)], recipes: [ceci] });
    expect(plan.entries).toEqual([]);
    expect(plan.messages.join(' ')).toMatch(/non verificata/);
    const snack = snackForWork({ recipes: [ceci], foods, lots: [], rules: base.rules, today: MON, coolerBag: null, fridgeAway: null, pantryTracked: true });
    expect(snack.options).toEqual([]);
    expect(snack.needsCold.map((r) => r.id)).toEqual(['ceci_croccanti']);
  });
  it('un frigo a destinazione NON copre il tragitto: stesso esito in Settimana e Spuntino', () => {
    const plan = planMeals({ ...base, lots: [], slots: [slot(MON, 'spuntino_mattina', true, false)], recipes: [ceci] });
    const snack = snackForWork({ recipes: [ceci], foods, lots: [], rules: base.rules, today: MON, coolerBag: 'no', fridgeAway: 'si', pantryTracked: true });
    expect(plan.entries.length).toBe(0);
    expect(snack.options.length).toBe(0);
  });
  it('con la borsa termica la stessa ricetta è ammessa ovunque', () => {
    const plan = planMeals({ ...base, lots: [], slots: [slot(MON, 'spuntino_mattina', true, true)], recipes: [ceci] });
    expect(plan.entries.map((e) => e.recipeId)).toEqual(['ceci_croccanti']);
    const snack = snackForWork({ recipes: [ceci], foods, lots: [], rules: base.rules, today: MON, coolerBag: 'si', fridgeAway: null, pantryTracked: true });
    expect(snack.options.map((o) => o.recipe.id)).toEqual(['ceci_croccanti']);
  });
  it('filtro ricette "Senza frigo": esclude anche le non verificate, tiene quelle con fonte', () => {
    const list = suggestRecipes({ recipes: [ceci, crackers], foods, lots: [], rules: base.rules, recentDiary: [], today: SUN, pantryTracked: false,
      filter: { availability: 'any', maxMissing: 2, maxActiveMin: null, portable: false, eatCold: false, noColdChain: true, expiringFirst: false } });
    expect(list.map((s) => s.recipe.id)).toEqual(['cracker']);
  });
  it('porzioni pronte e avanzi virtuali seguono la stessa regola', () => {
    // lotto reale pronto di una ricetta da tenere al freddo
    const pollo = R('pollo_lotto', ['pranzo', 'spuntino_mattina'], [['b', 400]], { servings: 4, category: 'multiporzione', portable: true, ambient: 'requires_cold', needsColdChain: true });
    const batch: PreparedBatch = { id: 'bt', recipeId: 'pollo_lotto', name: 'pollo', preparedAt: 0, dateKey: SUN, servingsTotal: 4, servingsLeft: 4, finalWeightG: null, totals: { kcal: 1200, protein: 100, carbs: 0, fat: 40, fiber: 0 }, location: 'frigo', note: '', txId: 't' };
    const r1 = planMeals({ ...base, lots: [], batches: [batch], slots: [slot(MON, 'pranzo', true, false)], recipes: [pollo] });
    expect(r1.entries).toEqual([]);
    // avanzo virtuale: colazione a casa prepara il lotto, lo spuntino fuori casa non può usarne l'avanzo
    const lotto = R('lotto_ceci', ['colazione', 'spuntino_mattina'], [['ceci', 400]], { servings: 4, category: 'multiporzione', portable: true, ambient: 'not_verified' });
    const r2 = planMeals({ ...base, lots: [], slots: [slot(MON, 'colazione'), slot(MON, 'spuntino_mattina', true, false)], recipes: [lotto] });
    expect(r2.entries.map((e) => e.slot)).toEqual(['colazione']);
  });
});

describe('2 · scadenza valutata alla data effettiva del pasto', () => {
  const r = R('riso', ['pranzo'], [['a', 100]]);
  const lots = [LOT('a', 100, MON, 'use_by')];
  it('lotto che scade lunedì: martedì "solo dispensa" non è fattibile', () => {
    const tue = planMeals({ ...base, lots, slots: [slot(TUE, 'pranzo')], recipes: [r], stockMode: 'pantry_only' });
    expect(tue.entries).toEqual([]);
    const mon = planMeals({ ...base, lots, slots: [slot(MON, 'pranzo')], recipes: [r], stockMode: 'pantry_only' });
    expect(mon.entries.map((e) => [e.dateKey, e.canMakeNow])).toEqual([[MON, true]]);
  });
  it('"posso comprare": martedì segna 100 g da comprare; la spesa concorda', () => {
    const tue = planMeals({ ...base, lots, slots: [slot(TUE, 'pranzo')], recipes: [r] });
    expect(tue.entries[0].canMakeNow).toBe(false);
    expect(tue.entries[0].missing).toEqual([{ foodId: 'a', unit: 'g', qty: 100 }]);
    const shop = shoppingNeeds({ plan: [PE('p', TUE, 'pranzo', 'riso')], recipes: new Map([[r.id, r]]), foods, lots, batches: [], today: SUN });
    expect(shop.map((s) => [s.foodId, s.toBuy])).toEqual([['a', 100]]);
  });
});

describe('3 · scorte riservate ai pasti confermati', () => {
  const pr = R('pranzo_a', ['pranzo'], [['a', 100]]);
  const ce = R('cena_a', ['cena'], [['a', 100]]);
  const lots = [LOT('a', 100)];
  const confirmed = PE('c', MON, 'pranzo', 'pranzo_a', { locked: true, status: 'confirmed' });
  it('pranzo confermato occupa gli unici 100 g: la cena proposta mostra "compra 100 g"', () => {
    const res = planMeals({ ...base, lots, locked: [confirmed], slots: [slot(MON, 'pranzo'), slot(MON, 'cena')], recipes: [pr, ce] });
    const cena = res.entries.find((e) => e.slot === 'cena')!;
    expect(cena.canMakeNow).toBe(false);
    expect(cena.missing).toEqual([{ foodId: 'a', unit: 'g', qty: 100 }]);
    expect(res.entries.find((e) => e.slot === 'pranzo')).toBeUndefined(); // il confermato non viene riscritto
    const shop = shoppingNeeds({ plan: [confirmed, PE('p', MON, 'cena', 'cena_a')], recipes: new Map([[pr.id, pr], [ce.id, ce]]), foods, lots, batches: [], today: SUN });
    expect(shop.map((s) => [s.foodId, s.needed, s.toBuy])).toEqual([['a', 200, 100]]);
  });
  it('un pasto già mangiato non riserva una seconda volta', () => {
    const eaten = { ...confirmed, done: true };
    const res = planMeals({ ...base, lots, locked: [eaten], slots: [slot(MON, 'pranzo'), slot(MON, 'cena')], recipes: [pr, ce] });
    expect(res.entries.find((e) => e.slot === 'cena')!.canMakeNow).toBe(true);
  });
  it('anche "Oggi" (un solo slot, pasto confermato passato come bloccato) vede la riserva', () => {
    const res = planMeals({ ...base, lots, locked: [confirmed], slots: [slot(MON, 'cena')], recipes: [ce], lookupRecipes: [pr, ce], stockMode: 'pantry_only' });
    expect(res.entries).toEqual([]);
  });
});

describe('4 · spesa per ricette che si preparano in lotto', () => {
  const bars = R('barrette', ['merenda'], [['avena', 200], ['burro', 120]], { servings: 8, category: 'multiporzione', unitLabel: 'pezzi' });
  const recipes = new Map([[bars.id, bars]]);
  const batch = (left: number): PreparedBatch => ({ id: 'bb', recipeId: 'barrette', name: 'barrette', preparedAt: 0, dateKey: SUN, servingsTotal: 8, servingsLeft: left, finalWeightG: null, totals: { kcal: 2000, protein: 60, carbs: 200, fat: 90, fiber: 20 }, location: 'frigo', note: '', txId: 't' });
  it('un pezzo, nessun lotto pronto: si prepara il lotto intero → 200 g di avena (non 25)', () => {
    const shop = shoppingNeeds({ plan: [PE('p', MON, 'merenda', 'barrette')], recipes, foods, lots: [], batches: [], today: SUN });
    expect(shop.map((s) => [s.foodId, s.toBuy])).toEqual([['avena', 200], ['burro', 120]]);
    const plan = planMeals({ ...base, lots: [], slots: [slot(MON, 'merenda')], recipes: [bars] });
    expect(plan.entries[0].prepareWhole).toBe(true);
    expect(plan.entries[0].missing.find((m) => m.foodId === 'avena')!.qty).toBe(200);
  });
  it('un pezzo già pronto: 0 g', () => {
    const shop = shoppingNeeds({ plan: [PE('p', MON, 'merenda', 'barrette')], recipes, foods, lots: [], batches: [batch(1)], today: SUN });
    expect(shop).toEqual([]);
  });
  it('un pezzo lunedì e uno martedì: un solo lotto (200 g), il secondo è un avanzo', () => {
    const shop = shoppingNeeds({ plan: [PE('p1', MON, 'merenda', 'barrette'), PE('p2', TUE, 'merenda', 'barrette')], recipes, foods, lots: [], batches: [], today: SUN });
    expect(shop.find((s) => s.foodId === 'avena')!.toBuy).toBe(200);
  });
  it('generare il piano non consuma la dispensa reale', () => {
    const lots = [LOT('avena', 500), LOT('burro', 300)];
    const before = JSON.stringify(lots);
    planMeals({ ...base, lots, slots: [slot(MON, 'merenda'), slot(TUE, 'merenda')], recipes: [bars] });
    shoppingNeeds({ plan: [PE('p', MON, 'merenda', 'barrette')], recipes, foods, lots, batches: [], today: SUN });
    expect(JSON.stringify(lots)).toBe(before);
  });
});

describe('coerenza fra schermate: stesso calcolo', () => {
  it('le mancanze del piano coincidono con la lista della spesa dello stesso piano (lotti, scadenze, confermati, indivisibili)', () => {
    const bars = R('barrette', ['merenda'], [['avena', 200], ['burro', 120]], { servings: 8, category: 'multiporzione' });
    const pr = R('pranzo_a', ['pranzo'], [['a', 100]]);
    const ce = R('cena_a', ['cena'], [['a', 100], ['b', 50]]);
    const lots = [LOT('a', 150, MON, 'use_by'), LOT('b', 80), LOT('avena', 120)];
    const confirmed = PE('c', MON, 'pranzo', 'pranzo_a', { locked: true, status: 'confirmed' });
    const slots = [MON, TUE].flatMap((d) => [slot(d, 'pranzo'), slot(d, 'merenda'), slot(d, 'cena')]);
    const res = planMeals({ ...base, lots, locked: [confirmed], slots, recipes: [bars, pr, ce] });
    const fromPlan = new Map<string, number>();
    for (const e of res.entries) for (const m of e.missing) fromPlan.set(m.foodId, (fromPlan.get(m.foodId) ?? 0) + m.qty);
    const asPlan = [confirmed, ...res.entries.map((e, i) => PE('x' + i, e.dateKey, e.slot, e.recipeId, { servings: e.servings }))];
    const shop = shoppingNeeds({ plan: asPlan, recipes: new Map([bars, pr, ce].map((r) => [r.id, r])), foods, lots, batches: [], today: SUN });
    // il pranzo confermato può a sua volta mancare di qualcosa: si confrontano solo le proposte
    const conf = shoppingNeeds({ plan: [confirmed], recipes: new Map([[pr.id, pr]]), foods, lots, batches: [], today: SUN });
    const shopProposals = new Map(shop.map((s) => [s.foodId, s.toBuy - (conf.find((c) => c.foodId === s.foodId)?.toBuy ?? 0)]));
    for (const [f, q] of fromPlan) expect(shopProposals.get(f)).toBeCloseTo(q, 6);
    for (const [f, q] of shopProposals) if (q > 1e-9) expect(fromPlan.get(f)).toBeCloseTo(q, 6);
    // barrette: un solo lotto da 200 g di avena in tutto il periodo, 120 g in dispensa → 80 g da comprare
    if (res.entries.some((e) => e.recipeId === 'barrette')) expect(shop.find((s) => s.foodId === 'avena')!.toBuy).toBe(80);
  });
  it('Spuntino: le scorte riservate a un pasto confermato oggi non risultano "pronte"', () => {
    const cracker = R('cracker_tonno', ['spuntino_mattina'], [['a', 40]], { portable: true, ambient: 'ok', tags: ['salata'], category: 'spuntino' });
    const pr = R('pranzo_a', ['pranzo'], [['a', 100]]);
    const lots = [LOT('a', 100)];
    const free = snackForWork({ recipes: [cracker, pr], foods, lots, rules: base.rules, today: MON, coolerBag: null, fridgeAway: null, pantryTracked: true });
    expect(free.options[0].canMakeNow).toBe(true);
    const busy = snackForWork({ recipes: [cracker, pr], foods, lots, rules: base.rules, today: MON, coolerBag: null, fridgeAway: null, pantryTracked: true,
      plan: [PE('c', MON, 'pranzo', 'pranzo_a', { locked: true, status: 'confirmed' })] });
    expect(busy.options[0].canMakeNow).toBe(false);
    expect(busy.options[0].missing).toEqual([{ foodId: 'a', unit: 'g', qty: 40 }]);
  });
});
