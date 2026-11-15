// Fase 3 — cataloghi e consigli. Fixture sintetiche, nessun dato personale.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppDB, __setDb, db } from '../src/db/db';
import type { Exercise, Food, Recipe, Session, SetEntry, StockLot } from '../src/db/types';
import { prepareBatch, eatBatchPortion } from '../src/lib/inventory';
import { snackForWork } from '../src/lib/snack';
import { exclusionReason, rulesFrom } from '../src/lib/recipes';
import { planMeals, type SlotNeed } from '../src/lib/planner';
import { switchMachine, createMachine, previousPerformance, exposuresFor } from '../src/lib/workout';
import { suggestProgression } from '../src/lib/progression';
import { prefillLoad } from '../src/lib/loadDecision';
import { EXERCISE_CATALOG } from '../src/catalog/exercises';
import { buildRecipeCatalog } from '../src/catalog/recipes';

const TODAY = '2026-11-20';
const F = (id: string, tags: string[] = [], per100: Partial<Food['per100']> = {}): Food => ({
  id, name: id, brand: '', source: 'database', sourceNote: '', sourceDate: null, verified: true, state: 'raw', basis: '100g',
  per100: { kcal: 400, protein: 10, carbs: 50, fat: 15, fiber: 5, ...per100 }, densityGPerMl: null, gramsPerPiece: null, defaultPortion: null,
  defaultUnit: 'g', barcode: '', tags, shelfStable: 'unknown', seed: false, favorite: false, allergenInfo: 'declared'
});
const R = (id: string, ings: [string, number][], extra: Partial<Recipe> = {}): Recipe => ({
  id, name: id, ingredients: ings.map(([foodId, qty]) => ({ foodId, qty, unit: 'g' })), servings: 1, steps: [], equipment: [], activeMin: 2, totalMin: 2,
  portable: true, eatCold: true, needsColdChain: false, storage: '', storageSource: '', mealSlots: ['spuntino_mattina', 'merenda'], notes: '', seed: false, favorite: false,
  origin: 'catalog', category: 'spuntino', tags: ['salata'], ambient: 'ok', ...extra
});
const LOT = (foodId: string, qty: number): StockLot => ({ id: `lot-${foodId}`, foodId, qty, unit: 'g', location: 'dispensa', purchasedAt: null, expiry: null, expiryType: null, openedAt: null, note: '' });
let k = 0;
const fresh = async (p: string) => { const d = new AppDB(`fase3-${p}-${++k}`); __setDb(d); await d.open(); };

describe('caso 1 · otto barrette, ne mangio una, ne restano sette', () => {
  beforeEach(() => fresh('bars'));
  it('lotto contato in pezzi; una barretta = 1/8 dei valori; dispensa scaricata una sola volta', async () => {
    const foods = [F('avena', [], { kcal: 380, protein: 13 }), F('burro_ar', [], { kcal: 600, protein: 25 })];
    await db.foods.bulkAdd(foods);
    await db.stock.bulkAdd([LOT('avena', 500), LOT('burro_ar', 300)]);
    const bars = R('bars', [['avena', 200], ['burro_ar', 120]], { servings: 8, unitLabel: 'pezzi', category: 'multiporzione', ambient: 'requires_cold', tags: ['dolce'] });
    await db.recipes.add(bars);
    const { batch } = await prepareBatch({ recipeId: 'bars', servingsMade: 8, finalWeightG: 400, location: 'frigo' });
    expect(batch.unitLabel).toBe('pezzi');
    expect((await db.stock.get('lot-avena'))!.qty).toBe(300);
    const { entry } = await eatBatchPortion({ batchId: batch.id, servings: 1, meal: 'merenda', dateKey: TODAY });
    const after = (await db.batches.get(batch.id))!;
    expect(after.servingsLeft).toBe(7);
    expect(after.servingsTotal).toBe(8);
    expect(entry.nutrients.kcal).toBeCloseTo(batch.totals.kcal! / 8, 5);
    expect(entry.nutrients.protein).toBeCloseTo(batch.totals.protein! / 8, 5);
    // mangiare non tocca di nuovo la dispensa
    expect((await db.stock.get('lot-avena'))!.qty).toBe(300);
    expect((await db.stock.get('lot-burro_ar'))!.qty).toBe(180);
  });
});

describe('caso 2 · spuntino salato per il lavoro', () => {
  const foods = new Map([F('cracker'), F('tonno'), F('arachidi', ['arachidi']), F('bresaola', ['affettato']), F('piadina'), F('mozzarella', ['formaggio', 'mozzarella']), F('pane')].map((f) => [f.id, f]));
  const recipes = [
    R('cracker_tonno', [['cracker', 40], ['tonno', 60]]),
    R('arachidi_cracker', [['arachidi', 25], ['cracker', 25]]),
    R('piadina_bresaola', [['piadina', 60], ['bresaola', 50]], { ambient: 'requires_cold', needsColdChain: true }),
    R('pane_mozzarella', [['pane', 60], ['mozzarella', 60]], { ambient: 'requires_cold', needsColdChain: true }),
    R('dolce', [['cracker', 30]], { tags: ['dolce'] }),
    R('non_portabile', [['cracker', 30]], { portable: false })
  ];
  const base = { recipes, foods, today: TODAY, rules: { excludedTags: [] as string[], allergies: [] as string[] }, coolerBag: null, fridgeAway: null, pantryTracked: true as boolean };

  it('con la dispensa: dice cosa posso fare ora e cosa manca (in grammi), ognuno con il motivo', () => {
    const r = snackForWork({ ...base, lots: [LOT('cracker', 100), LOT('tonno', 80)] });
    expect(r.options.map((o) => o.recipe.id)).toEqual(['cracker_tonno', 'arachidi_cracker']);
    expect(r.options[0].canMakeNow).toBe(true);
    expect(r.options[0].reasons.join(' ')).toMatch(/puoi prepararlo adesso/);
    expect(r.options[1].canMakeNow).toBe(false);
    expect(r.options[1].missing).toEqual([{ foodId: 'arachidi', unit: 'g', qty: 25 }]);
    expect(r.options[1].reasons[0]).toBe('manca: arachidi 25 g');
    // senza frigo né borsa termica dichiarati: le ricette da tenere al freddo non sono proposte, ma elencate a parte
    expect(r.needsCold.map((x) => x.id).sort()).toEqual(['pane_mozzarella', 'piadina_bresaola']);
    expect(r.options.every((o) => o.reasons.some((x) => /fuori frigo secondo la fonte/.test(x)))).toBe(true);
  });
  it('con borsa termica dichiarata le ricette fredde entrano, con il motivo', () => {
    const r = snackForWork({ ...base, coolerBag: 'si', lots: [] });
    const p = r.options.find((o) => o.recipe.id === 'piadina_bresaola')!;
    expect(p).toBeTruthy();
    expect(p.reasons.join(' ')).toMatch(/va tenuto al freddo: usi la borsa termica/);
    expect(r.needsCold).toEqual([]);
  });
  it('dispensa mai compilata: disponibilità "non verificata", non "manca tutto"', () => {
    const r = snackForWork({ ...base, lots: [], pantryTracked: false });
    expect(r.options.every((o) => o.canMakeNow === null && o.missing.length === 0)).toBe(true);
  });
  it('preferenze configurabili: escludo i formaggi ma consento la mozzarella; le allergie non hanno eccezioni', () => {
    const noCheese = { excludedTags: ['formaggio'], allergies: [] as string[] };
    expect(exclusionReason(recipes[3], foods, noCheese)).toMatch(/mozzarella/);
    expect(exclusionReason(recipes[3], foods, { ...noCheese, allowFoods: ['mozzarella'] })).toBeNull();
    expect(exclusionReason(recipes[1], foods, { excludedTags: [], allergies: ['arachidi'], allowFoods: ['arachidi'] })).toMatch(/allergene/);
    const rules = rulesFrom({ excludedTags: ['formaggio'], allowedFoodIds: ['mozzarella'], profile: { allergies: [] } });
    const r = snackForWork({ ...base, rules, coolerBag: 'si', lots: [] });
    expect(r.options.map((o) => o.recipe.id)).toContain('pane_mozzarella');
  });
  it('"non propormelo più" toglie la proposta', () => {
    const r = snackForWork({ ...base, lots: [], feedback: { cracker_tonno: { never: true } } });
    expect(r.options.map((o) => o.recipe.id)).not.toContain('cracker_tonno');
  });
  it('catalogo pubblico: nessuna preferenza preimpostata, "trasportabile" distinto da "fuori frigo"', () => {
    const { recipes: cat, unresolved } = buildRecipeCatalog(new Map());
    expect(unresolved.length).toBeGreaterThan(0); // mappa vuota: ID non risolti, nessun crash
    const salty = cat.filter((r) => (r.tags ?? []).includes('salata') && r.portable);
    expect(salty.length).toBeGreaterThanOrEqual(8);
    expect(salty.some((r) => r.ambient === 'ok')).toBe(true);
    expect(salty.some((r) => r.ambient === 'requires_cold')).toBe(true);
    for (const r of cat) {
      expect(r.ambient).toBeDefined();
      if (r.needsColdChain) expect(r.ambient).not.toBe('ok');
    }
    expect(cat.filter((r) => r.id.startsWith('cr_cr_')).length).toBeGreaterThanOrEqual(6);
    expect(cat.filter((r) => r.id.includes('fz_') && r.category === 'multiporzione').length).toBeGreaterThanOrEqual(4);
  });
});

describe('caso 3 · due hack squat: storici separati', () => {
  beforeEach(() => fresh('mach'));
  const hack = (): Exercise => ({ ...EXERCISE_CATALOG.find((e) => e.id === 'cx_hack_squat')!, id: 'hack_squat', machineId: null });
  const SET = (sid: string, ck: string, load: number, reps: number, order: number): SetEntry => ({
    id: `${sid}-${order}`, sessionId: sid, exerciseId: 'hack_squat', configKey: ck, itemIndex: 0, kind: 'working', order, load, loadConvention: 'plates_per_side',
    unilateral: false, romType: 'full', fullReps: reps, validReps: reps, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0,
    rir: 1, rirUnknown: false, restBeforeSec: null, pain: false, painNote: '', savedAt: order
  } as SetEntry);
  const SES = (id: string, day: string, at: number) => ({ id, dateKey: day, startedAt: at, endedAt: at + 3600e3, status: 'done', items: [], currentIndex: 0, pauses: [], rest: null, painReported: false } as unknown as Session);

  it('cambio macchina: la nuova non eredita carichi, prefill né proposte di aumento dalla vecchia', async () => {
    await db.exercises.add(hack());
    const A = await createMachine({ name: 'Hack squat sala A', increments: [5] });
    const B = await createMachine({ name: 'Hack squat sala B', increments: [5] });
    const ckA = await switchMachine('hack_squat', A.id);
    // Due sedute sulla A con il massimo del range: sulla A l'app proporrebbe un aumento
    await db.sessions.bulkAdd([SES('s1', '2026-11-10', 1000), SES('s2', '2026-11-13', 2000)]);
    await db.sets.bulkAdd([SET('s1', ckA, 100, 12, 1), SET('s1', ckA, 100, 12, 2), SET('s2', ckA, 100, 12, 1), SET('s2', ckA, 100, 12, 2)]);
    const target = { sets: 2, repMin: 8, repMax: 12, rirTargets: [] };
    const onA = suggestProgression({ exposures: await exposuresFor(ckA), target, increments: [5], activePain: false, policy: { maxJumpPct: 0.1, defaultRirMin: 1, exposuresForIncrease: 2 } });
    expect(onA.kind).toBe('increase');

    const ckB = await switchMachine('hack_squat', B.id);
    expect(ckB).not.toBe(ckA);
    expect((await db.exercises.get('hack_squat'))!.machineId).toBe(B.id);
    expect(await previousPerformance(ckB)).toBeNull();
    const onB = suggestProgression({ exposures: await exposuresFor(ckB), target, increments: [5], activePain: false });
    expect(onB.kind).not.toBe('increase');
    expect(onB.proposedLoad).toBeNull();
    expect(prefillLoad({ lastHereLoad: null, previous: null, accepted: null }).load).toBeNull();

    // tornando alla A si ritrova il suo storico (configVersion invariata)
    const back = await switchMachine('hack_squat', A.id);
    expect(back).toBe(ckA);
    expect((await previousPerformance(ckA))!.sets[0].load).toBe(100);
  });
});

describe('preferenza "colazione salata": pesa, non esclude', () => {
  it('a parità di condizioni la salata passa davanti; senza preferenza nessuna forzatura', () => {
    const foods = new Map([F('a'), F('b')].map((f) => [f.id, f]));
    const recipes = [R('dolce_col', [['a', 80]], { mealSlots: ['colazione'], tags: ['dolce'] }), R('salata_col', [['b', 80]], { mealSlots: ['colazione'], tags: ['salata'] })];
    const S: SlotNeed = { dateKey: TODAY, slot: 'colazione', maxActiveMin: null, mustBePortable: false, coldChainOk: true };
    const common = { foods, recipes, lots: [], batches: [], rules: { excludedTags: [], allergies: [] }, kcalTarget: null, proteinTarget: null, locked: [], previous: [], today: TODAY, slots: [S] };
    const withPref = planMeals({ ...common, prefs: { saltyBreakfast: true } });
    expect(withPref.entries[0].recipeId).toBe('salata_col');
    // la dolce resta possibile: è nelle alternative / sceglibile, non esclusa
    const noPref = planMeals({ ...common });
    expect(['dolce_col', 'salata_col']).toContain(noPref.entries[0].recipeId);
  });
});
