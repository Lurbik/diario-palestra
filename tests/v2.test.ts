import { describe, it, expect } from 'vitest';
import { exclusionReason, suggestRecipes, shoppingNeeds, stockByFood } from '../src/lib/recipes';
import { lotStatus, expiringSoon } from '../src/lib/lots';
import { planMeals, type SlotNeed } from '../src/lib/planner';
import { detectStall } from '../src/lib/stall';
import { proposeCalories, goalRange, DEFAULT_CAL_RULES } from '../src/lib/calories';
import { planSleep, tomorrowWake, sleepConflicts } from '../src/lib/sleep';
import { workByMuscle, workLabel } from '../src/lib/bodymap';
import { alternatives } from '../src/lib/substitute';
import { rankTemplates } from '../src/catalog/templates';
import { EXERCISE_CATALOG } from '../src/catalog/exercises';
import { planDeduction } from '../src/lib/inventory';
import { addDays, romeLocalToEpoch } from '../src/lib/dates';
import { defaultSettings } from '../src/db/settings';
import type { Exposure } from '../src/lib/progression';
import type { Food, Recipe, StockLot, SetEntry, Session, PreparedBatch, WeightEntry } from '../src/db/types';

const F = (id: string, extra: Partial<Food> = {}): Food => ({
  id, name: id, brand: '', source: 'database', sourceNote: '', sourceDate: null, verified: true, state: 'raw', basis: '100g',
  per100: { kcal: 100, protein: 10, carbs: 10, fat: 2, fiber: 1 }, densityGPerMl: null, gramsPerPiece: null, defaultPortion: null,
  defaultUnit: 'g', barcode: '', tags: [], shelfStable: 'unknown', seed: false, favorite: false, allergenInfo: 'declared', ...extra
});
const R = (id: string, ings: [string, number][], extra: Partial<Recipe> = {}): Recipe => ({
  id, name: id, ingredients: ings.map(([foodId, qty]) => ({ foodId, qty, unit: 'g' })), servings: 1, steps: [], equipment: [], activeMin: 10, totalMin: 10,
  portable: false, eatCold: false, needsColdChain: false, storage: '', storageSource: '', mealSlots: ['pranzo'], notes: '', seed: false, favorite: false,
  origin: 'catalog', portionSteps: [1], ...extra
});
const LOT = (foodId: string, qty: number, expiry: string | null, expiryType: StockLot['expiryType'] = null): StockLot => ({ id: foodId + qty + expiry, foodId, qty, unit: 'g', location: 'frigo', purchasedAt: null, expiry, expiryType, openedAt: null, note: '' });
const TODAY = '2026-11-20';

describe('1. avvio neutro', () => {
  it('impostazioni predefinite senza dati personali, esclusioni o orari del proprietario', () => {
    const s = defaultSettings();
    expect(s.profile.name).toBe('');
    expect(s.profile.goal).toBeNull();
    expect(s.excludedTags).toEqual([]);
    expect(s.prepWeekdays).toEqual([]);
    expect(s.dailyTimeLimitMin).toBeNull();
    expect(JSON.stringify(s)).not.toMatch(/borsa per domani \(pasti e spuntini\)|scuola/i);
  });
});

describe('5. ricette non certificate compatibili', () => {
  const foods = new Map([['a', F('a')], ['nut', F('nut', { tags: ['arachidi'] })], ['proc', F('proc', { allergenInfo: 'unknown' })]]);
  it('allergene dichiarato → esclusa', () => {
    expect(exclusionReason(R('r', [['a', 50], ['nut', 20]]), foods, { excludedTags: [], allergies: ['arachidi'] })).toMatch(/allergene/);
  });
  it('ingrediente inesistente → non verificabile', () => {
    expect(exclusionReason(R('r', [['a', 50], ['ghost', 20]]), foods, { excludedTags: [], allergies: [] })).toMatch(/non presente/);
  });
  it('con allergie dichiarate, un prodotto senza informazioni allergeniche non è "sicuro"', () => {
    expect(exclusionReason(R('r', [['proc', 50]]), foods, { excludedTags: [], allergies: ['latte'] })).toMatch(/non dichiarati/);
    expect(exclusionReason(R('r', [['proc', 50]]), foods, { excludedTags: [], allergies: [] })).toBeNull();
  });
});

describe('6. lotti e scorte', () => {
  it('stato dei lotti: da consumarsi entro superato = non utilizzabile; preferibilmente entro superato = da valutare', () => {
    expect(lotStatus(LOT('a', 100, '2026-11-19', 'use_by'), TODAY)).toBe('unsafe');
    expect(lotStatus(LOT('a', 100, '2026-11-19', 'best_before'), TODAY)).toBe('review');
    expect(lotStatus(LOT('a', 100, '2026-11-21', 'use_by'), TODAY)).toBe('usable');
    expect(lotStatus(LOT('a', 0, null), TODAY)).toBe('empty');
  });
  it('"in scadenza" considera solo lotti utilizzabili, non le date passate', () => {
    const s = expiringSoon([LOT('a', 100, '2026-11-10'), LOT('b', 100, '2026-11-21'), LOT('c', 100, '2026-12-30')], TODAY);
    expect(s.map((l) => l.foodId)).toEqual(['b']);
  });
  it('disponibilità conta solo lotti utilizzabili; FEFO salta quelli non sicuri', () => {
    const lots = [LOT('a', 100, '2026-11-18', 'use_by'), LOT('a', 50, '2026-11-25'), LOT('a', 70, '2026-11-22')];
    expect(stockByFood(lots, TODAY).get('a|g')).toBe(120);
    const p = planDeduction(lots, 'a', 100, 'g', TODAY);
    expect(p.takes.map((t) => t.lot.expiry)).toEqual(['2026-11-22', '2026-11-25']);
    expect(p.takes.some((t) => t.lot.expiryType === 'use_by')).toBe(false);
  });
  it('dispensa mai compilata ≠ dispensa vuota: la spesa lo segnala', () => {
    const plan = [{ id: 'p', dateKey: TODAY, slot: 'pranzo' as const, recipeId: 'r', foodId: null, servings: 1, locked: true, done: false }];
    const needs = shoppingNeeds({ plan, recipes: new Map([['r', R('r', [['a', 100]])]]), foods: new Map([['a', F('a')]]), lots: [], batches: [], today: TODAY, pantryTracked: false });
    expect(needs[0].unknownStock).toBe(true);
    const sugg = suggestRecipes({ recipes: [R('r', [['a', 100]])], foods: new Map([['a', F('a')]]), lots: [], today: TODAY, recentDiary: [], rules: { excludedTags: [], allergies: [] }, pantryTracked: false,
      filter: { availability: 'only_available', maxMissing: 0, maxActiveMin: null, portable: false, eatCold: false, noColdChain: false, expiringFirst: false } });
    expect(sugg.length).toBe(1); // inventario sconosciuto: non si dichiara "mancante"
  });
});

describe('9. pianificatore pasti', () => {
  const foods = new Map([['a', F('a', { per100: { kcal: 400, protein: 20, carbs: 50, fat: 10, fiber: 2 } })]]);
  const slot = (s: SlotNeed['slot'], extra: Partial<SlotNeed> = {}): SlotNeed => ({ dateKey: TODAY, slot: s, maxActiveMin: null, mustBePortable: false, coldChainOk: true, ...extra });
  const base = { foods, lots: [], batches: [] as PreparedBatch[], rules: { excludedTags: [], allergies: [] }, kcalTarget: 2000, proteinTarget: 120, locked: [], previous: [], today: TODAY };
  it('vincoli impossibili → spiega il conflitto, non produce quantità assurde', () => {
    const r = planMeals({ ...base, slots: [slot('pranzo', { maxActiveMin: 5 })], recipes: [R('lenta', [['a', 100]], { activeMin: 40 })] });
    expect(r.entries.length).toBe(0);
    expect(r.messages[0]).toMatch(/tempo attivo/);
  });
  it('porzioni solo dai passi ammessi della ricetta (nessuna frazione arbitraria)', () => {
    const r = planMeals({ ...base, slots: [slot('pranzo'), slot('cena')], recipes: [R('x', [['a', 150]], { mealSlots: ['pranzo', 'cena'], portionSteps: [1, 1.5] })] });
    for (const e of r.entries) expect([1, 1.5]).toContain(e.servings);
  });
  it('varietà: con alternative disponibili non ripete la stessa ricetta nello stesso giorno', () => {
    const recipes = [R('x', [['a', 150]], { mealSlots: ['pranzo', 'cena'] }), R('y', [['a', 150]], { mealSlots: ['pranzo', 'cena'] })];
    const r = planMeals({ ...base, kcalTarget: null, proteinTarget: null, slots: [slot('pranzo'), slot('cena')], recipes });
    expect(new Set(r.entries.map((e) => e.recipeId)).size).toBe(2);
  });
  it('i pasti bloccati non vengono modificati', () => {
    const locked = [{ id: 'l', dateKey: TODAY, slot: 'pranzo' as const, recipeId: 'x', foodId: null, servings: 1, locked: true, done: false, status: 'confirmed' as const }];
    const r = planMeals({ ...base, locked, slots: [slot('pranzo'), slot('cena')], recipes: [R('x', [['a', 150]], { mealSlots: ['pranzo', 'cena'] }), R('y', [['a', 150]], { mealSlots: ['cena'] })] });
    expect(r.entries.find((e) => e.slot === 'pranzo')).toBeUndefined();
    expect(r.entries.find((e) => e.slot === 'cena')).toBeDefined();
  });
  it('una multiporzione non preparata non è "pronta"; le porzioni pronte non vengono allocate due volte', () => {
    const multi = R('m', [['a', 600]], { servings: 4, activeMin: 30, mealSlots: ['pranzo', 'cena'] });
    const r0 = planMeals({ ...base, slots: [slot('pranzo', { maxActiveMin: 5 })], recipes: [multi] });
    expect(r0.entries.length).toBe(0);
    const batch: PreparedBatch = { id: 'b', recipeId: 'm', name: 'm', preparedAt: 0, dateKey: TODAY, servingsTotal: 4, servingsLeft: 1, finalWeightG: null, totals: { kcal: 2400, protein: 120, carbs: 0, fat: 0, fiber: 0 }, location: 'frigo', note: '', txId: 't' };
    const days = [TODAY, addDays(TODAY, 1)];
    const r1 = planMeals({ ...base, batches: [batch], slots: days.map((d) => ({ ...slot('pranzo', { maxActiveMin: 5 }), dateKey: d })), recipes: [multi] });
    expect(r1.entries.filter((e) => e.fromBatch).length).toBe(1);
  });
});

let n = 0;
const S = (p: Partial<SetEntry>): SetEntry => ({
  id: `s${++n}`, sessionId: 'x', exerciseId: 'e', configKey: 'k', itemIndex: 0, kind: 'working', order: n, load: 50, loadConvention: 'machine_stack', unilateral: false,
  romType: 'full', fullReps: 10, validReps: 10, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 2, rirUnknown: false,
  restBeforeSec: 180, pain: false, painNote: '', techIssue: false, notes: '', savedAt: 0, ...p
});
const EXP = (d: string, sets: Partial<SetEntry>[]): Exposure => ({ sessionId: d, dateKey: d, startedAt: Date.parse(d), sets: sets.map((s, i) => S({ order: i + 1, restBeforeSec: i ? 180 : null, ...s })) });

describe('10. stallo robusto', () => {
  it('carico maggiore con crollo delle ripetizioni non è progresso automatico', () => {
    const e = [0, 7, 14, 21].map((d, i) => EXP(addDays('2026-10-05', d), i < 3 ? [{ load: 50, validReps: 10, fullReps: 10 }, { load: 50, validReps: 10, fullReps: 10 }] : [{ load: 60, validReps: 4, fullReps: 4 }, { load: 60, validReps: 3, fullReps: 3 }]));
    expect(detectStall(e).status).toBe('unclear');
  });
  it('esposizioni con numero di serie diverso sono escluse dal confronto', () => {
    const e = [0, 7, 14, 21, 28].map((d, i) => EXP(addDays('2026-10-05', d), i === 2 ? [{}] : [{}, {}]));
    const r = detectStall(e);
    expect(r.status).toBe('possible_stall');
    expect(r.reasons[0]).toMatch(/4 esposizioni/);
  });
  it('mediane di più osservazioni: un solo picco iniziale non nasconde il progresso', () => {
    const reps = [12, 8, 9, 10, 11, 12];
    const e = reps.map((r, i) => EXP(addDays('2026-10-01', i * 7), [{ validReps: r, fullReps: r }, { validReps: r, fullReps: r }]));
    expect(detectStall(e).status).toBe('progressing');
  });
});

describe('8. obiettivi alimentari distinti', () => {
  const today = '2026-11-28';
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i));
  const W = (d: string, kg: number): WeightEntry => ({ id: d, dateKey: d, time: '', kg, morning: true, conditions: '', flags: [], note: '' });
  it('range per obiettivo', () => {
    expect(goalRange('mantenimento', DEFAULT_CAL_RULES)).toEqual([-0.1, 0.1]);
    expect(goalRange('dimagrimento', DEFAULT_CAL_RULES)[1]).toBeLessThan(0);
  });
  it('dimagrimento: peso stabile seguendo il target → piccola riduzione, non un aumento', () => {
    const w = days.map((d, i) => W(d, 80 + ((i * 7) % 3 - 1) * 0.03));
    const p = proposeCalories({ weights: w, completeDiaryDays: days, avgIntakeKcal: 2200, targetKcal: 2200, lastTargetChange: null, today, goal: 'dimagrimento' });
    expect(p.kind).toBe('decrease');
  });
  it('dimagrimento: se mangia più del target non si abbassa il target', () => {
    const w = days.map((d) => W(d, 80));
    const p = proposeCalories({ weights: w, completeDiaryDays: days, avgIntakeKcal: 2600, targetKcal: 2200, lastTargetChange: null, today, goal: 'dimagrimento' });
    expect(p.kind).toBe('improve_practicality');
  });
});

describe('12. sonno pianificato', () => {
  it('sveglia 07:00, 8 h, latenza 20, routine 30 → letto 22:40, routine 22:10 del giorno prima', () => {
    const p = planSleep({ wakeDateKey: '2026-11-13', wakeTime: '07:00', sleepHours: 8, latencyMin: 20, routineMin: 30 });
    expect(p.label.bed).toBe('22:40');
    expect(p.label.routine).toBe('22:10');
    expect(p.label.bedDate).toBe('2026-11-12');
  });
  it('notte del cambio ora (25/10/2026): calcolo su istanti reali', () => {
    const p = planSleep({ wakeDateKey: '2026-10-25', wakeTime: '07:00', sleepHours: 8, latencyMin: 0, routineMin: 0 });
    expect(p.wakeAt - p.sleepAt).toBe(8 * 3600e3);
    expect(p.label.sleep).toBe('00:00'); // 07:00 CET − 8 h reali = 00:00 CEST
  });
  it('sveglia di domani: eccezione del giorno prevale sulla ricorrente', () => {
    expect(tomorrowWake('2026-11-12', '07:00', { '2026-11-13': '09:30' }).time).toBe('09:30');
    expect(tomorrowWake('2026-11-12', '07:00', {}).time).toBe('07:00');
  });
  it('conflitto esplicito con un impegno serale', () => {
    const p = planSleep({ wakeDateKey: '2026-11-13', wakeTime: '07:00', sleepHours: 8, latencyMin: 20, routineMin: 30 });
    const c = sleepConflicts(p, [{ label: 'Allenamento', endAt: romeLocalToEpoch('2026-11-12', '22:30') }]);
    expect(c[0]).toMatch(/20 min dopo/);
  });
});

describe('4. mappa del lavoro registrato', () => {
  const ex = new Map(EXERCISE_CATALOG.map((e) => [e.id, e]));
  const ses: Session[] = [{ id: 's1', programId: null, dayId: null, title: '', dateKey: '2026-11-10', startedAt: 0, endedAt: 1, pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false }];
  it('zero dati → "nessun allenamento registrato", non "poco sviluppato"', () => {
    const w = workByMuscle([], ses, ex, '2026-11-01');
    expect(workLabel(w.get('petto'))).toBe('nessun allenamento registrato nel periodo');
  });
  it('riscaldamento escluso, unilaterali non raddoppiati, dirette/indirette separate', () => {
    const sets = [
      S({ sessionId: 's1', exerciseId: 'cx_panca_piana_man', kind: 'warmup' }),
      S({ sessionId: 's1', exerciseId: 'cx_panca_piana_man' }),
      S({ sessionId: 's1', exerciseId: 'cx_rematore_man', unilateral: true })
    ];
    const w = workByMuscle(sets, ses, ex, '2026-11-01');
    expect(w.get('petto')!.direct).toBe(1);
    expect(w.get('tricipiti')!.indirect).toBe(1);
    expect(w.get('dorsali')!.direct).toBe(1);
  });
});

describe('7/11. sostituzioni e template', () => {
  it('alternative motivate rispettano attrezzatura e preferenze; storico separato', () => {
    const t = EXERCISE_CATALOG.find((e) => e.id === 'cx_lat_larga')!;
    const alt = alternatives(t, EXERCISE_CATALOG, { access: 'palestra', prefs: { disliked: ['cx_lat_stretta'], favorites: [], discomfort: [] } });
    expect(alt.length).toBeGreaterThan(0);
    expect(alt.some((a) => a.exercise.id === 'cx_lat_stretta')).toBe(false);
    expect(alt[0].reasons.join(' ')).toMatch(/storico separato/);
    const home = alternatives(t, EXERCISE_CATALOG, { access: 'corpo_libero', prefs: { disliked: [], favorites: [], discomfort: [] } });
    expect(home.every((a) => a.exercise.equipmentKind === 'corpo_libero')).toBe(true);
  });
  it('template ordinati secondo vincoli: corpo libero → solo template a corpo libero', () => {
    const r = rankTemplates({ days: 3, equipment: 'corpo_libero', experience: 'principiante', minutes: 40 });
    expect(r.every((t) => t.equipment === 'corpo_libero')).toBe(true);
  });
});
