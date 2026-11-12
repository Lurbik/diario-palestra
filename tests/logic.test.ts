import { describe, it, expect } from 'vitest';
import { nutrientsFor, sumNutrients, recipeTotals, per100gCooked, strictTotals, amountInBasis, barTotals } from '../src/lib/nutrition';
import { suggestProgression, progressionReps, type Exposure } from '../src/lib/progression';
import { detectStall } from '../src/lib/stall';
import { proposeCalories, dataQuality } from '../src/lib/calories';
import { dateKey, addDays, weekdayOf, romeLocalToEpoch, daysBetween } from '../src/lib/dates';
import { painSafety } from '../src/lib/safety';
import { configKey, sessionTimes, restState, dumbbellTotal, smithTotal, tonnage } from '../src/lib/workout';
import { SEED_RECIPES, SEED_FOODS } from '../src/data/seedFood';
import { declaredProgram, SEED_EXERCISES } from '../src/data/seedGym';
import type { Food, SetEntry, WeightEntry } from '../src/db/types';
import { parseNum } from '../src/lib/id';

const food = (per100: Partial<Food['per100']>, extra: Partial<Food> = {}): Food => ({
  id: 'x', name: 'x', brand: '', source: 'label', sourceNote: '', sourceDate: null, verified: true, state: 'raw', basis: '100g',
  per100: { kcal: null, protein: null, carbs: null, fat: null, fiber: null, ...per100 }, densityGPerMl: null, gramsPerPiece: null,
  defaultPortion: null, defaultUnit: 'g', barcode: '', tags: [], shelfStable: 'unknown', seed: false, favorite: false, ...extra
});

describe('nutrienti', () => {
  it('360 kcal/100 g → 50 g = 180 kcal; nutriente sconosciuto resta sconosciuto', () => {
    const n = nutrientsFor(food({ kcal: 360, protein: 10 }), 50, 'g');
    expect(n.kcal).toBe(180);
    expect(n.protein).toBe(5);
    expect(n.fiber).toBeNull();
  });
  it('somma: un valore mancante marca il totale come incompleto, non zero', () => {
    const s = sumNutrients([{ kcal: 100, protein: null, carbs: 1, fat: 1, fiber: null }, { kcal: 50, protein: 5, carbs: 1, fat: 1, fiber: null }]);
    expect(s.values.kcal).toBe(150);
    expect(s.incomplete.kcal).toBe(false);
    expect(s.values.protein).toBe(5);
    expect(s.incomplete.protein).toBe(true);
    expect(s.values.fiber).toBeNull();
    expect(strictTotals(s).protein).toBeNull();
  });
  it('ml→g non assume densità 1', () => {
    expect(amountInBasis(food({ kcal: 100 }), 100, 'ml')).toBeNull();
    expect(amountInBasis(food({ kcal: 100 }, { densityGPerMl: 0.92 }), 100, 'ml')).toBeCloseTo(92);
    expect(nutrientsFor(food({ kcal: 899 }), 10, 'ml').kcal).toBeNull();
  });
  it('ricetta 100 g A + 200 g B: totali dagli ingredienti, peso finale solo per ripartire', () => {
    const foods = new Map<string, Food>([
      ['a', food({ kcal: 100, protein: 10, carbs: 0, fat: 0, fiber: 0 }, { id: 'a' })],
      ['b', food({ kcal: 50, protein: 0, carbs: 10, fat: 0, fiber: 1 }, { id: 'b' })]
    ]);
    const r = recipeTotals({ ingredients: [{ foodId: 'a', qty: 100, unit: 'g' }, { foodId: 'b', qty: 200, unit: 'g' }] }, foods);
    expect(r.rawWeightG).toBe(300);
    const tot = strictTotals(r.sum);
    expect(tot.kcal).toBe(200);
    expect(tot.protein).toBe(10);
    // Dopo cottura pesa 240 g: i totali NON cambiano, cambia solo la densità per 100 g
    const p = per100gCooked(tot, 240);
    expect(p.kcal).toBeCloseTo(200 / 240 * 100);
    expect(p.kcal! * 2.4).toBeCloseTo(200);
  });
  it('barrette: per lotto, per 100 g e per pezzo', () => {
    const b = barTotals({ kcal: 2000, protein: 100, carbs: 200, fat: 80, fiber: 20 }, 500, 8);
    expect(b.perPiece.kcal).toBe(250);
    expect(b.per100g.protein).toBe(20);
    expect(b.pieceWeightG).toBe(62.5);
  });
  it('virgola italiana', () => { expect(parseNum('12,5')).toBe(12.5); expect(parseNum('')).toBeNull(); });
});

describe('seed', () => {
  it('nessuna ricetta include alimenti con formaggi esclusi', () => {
    const tagged = new Set(SEED_FOODS.filter((f) => f.tags.includes('formaggio')).map((f) => f.id));
    for (const r of SEED_RECIPES) for (const i of r.ingredients) expect(tagged.has(i.foodId)).toBe(false);
  });
  it('lo yogurt non è inserito di default', () => {
    expect(SEED_FOODS.some((f) => /yogurt/i.test(f.name))).toBe(false);
  });
  it('Bayesian mantiene serie sconosciute; la scheda è un modello senza sedute', () => {
    const p = declaredProgram();
    const bay = p.days.flatMap((d) => d.items).find((i) => i.exerciseId === 'ex_bayesian')!;
    expect(bay.sets).toBeNull();
    expect(p.kind).toBe('declared');
    expect(p.days.map((d) => d.weekday)).toEqual([1, 2, 3, 5, 6]);
  });
  it('conteggio serie dirette della scheda dichiarata', () => {
    const p = declaredProgram();
    const ex = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
    const count = (m: string) => p.days.flatMap((d) => d.items).filter((i) => ex.get(i.exerciseId)!.primaryMuscles.includes(m as never)).reduce((a, i) => a + (i.sets ?? 0), 0);
    expect(count('petto')).toBe(6);
    expect(count('quadricipiti')).toBe(6);
    expect(count('femorali')).toBe(6);
    expect(count('tricipiti')).toBe(6);
    expect(count('bicipiti')).toBe(4); // + Bayesian da confermare
    expect(count('deltoidi_laterali')).toBe(4);
    expect(count('deltoidi_anteriori')).toBe(2);
    expect(count('polpacci')).toBe(4);
    expect(count('addome')).toBe(4);
  });
});

let n = 0;
const set = (p: Partial<SetEntry>): SetEntry => ({
  id: `s${++n}`, sessionId: 'x', exerciseId: 'e', configKey: 'k', itemIndex: 0, kind: 'working', order: n, load: 50, loadConvention: 'machine_stack',
  unilateral: false, romType: 'full', fullReps: 12, validReps: 12, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0,
  failedAttempts: 0, rir: 2, rirUnknown: false, restBeforeSec: 180, pain: false, painNote: '', techIssue: false, notes: '', savedAt: 0, ...p
});
const exp = (date: string, sets: Partial<SetEntry>[]): Exposure => ({ sessionId: date, dateKey: date, startedAt: Date.parse(date), sets: sets.map((s, i) => set({ order: i + 1, restBeforeSec: i ? 180 : null, ...s })) });
const target = { sets: 2, repMin: 8, repMax: 12, rirTargets: [{ min: 1, max: 2 }, { min: 1, max: 2 }] };

describe('progressione', () => {
  it('due sedute 12/12 valide, RIR compatibile, nessun problema → proposta di incremento', () => {
    const s = suggestProgression({ exposures: [exp('2026-11-02', [{}, {}]), exp('2026-11-09', [{}, {}])], target, increments: [2.5, 5], activePain: false });
    expect(s.kind).toBe('increase');
    expect(s.proposedLoad).toBe(52.5);
  });
  it('una sola seduta non basta', () => {
    expect(suggestProgression({ exposures: [exp('2026-11-09', [{}, {}])], target, increments: [2.5], activePain: false }).kind).toBe('collect_data');
  });
  it('8 eseguite / 6 valide non soddisfa un target di 8 valide', () => {
    const t8 = { ...target, repMax: 8 };
    const e = [exp('2026-11-02', [{ fullReps: 8, validReps: 6 }, { fullReps: 8, validReps: 8 }]), exp('2026-11-09', [{ fullReps: 8, validReps: 6 }, { fullReps: 8, validReps: 8 }])];
    expect(suggestProgression({ exposures: e, target: t8, increments: [2.5], activePain: false }).kind).not.toBe('increase');
  });
  it('RIR mancante non è RIR 0: chiede dati, non deduce cedimento', () => {
    const e = [exp('2026-11-02', [{ rir: null }, {}]), exp('2026-11-09', [{}, {}])];
    const s = suggestProgression({ exposures: e, target, increments: [2.5], activePain: false });
    expect(s.kind).toBe('collect_data');
    expect(s.reason).toMatch(/non è RIR 0/);
  });
  it('lat: 6 valide + 4 parziali extra resta 6 per la progressione full-ROM', () => {
    expect(progressionReps(set({ fullReps: 6, validReps: 6, extraPartials: 4 }))).toBe(6);
    const t6 = { ...target, repMin: 6, repMax: 8 };
    const e = [exp('2026-11-02', [{ fullReps: 6, validReps: 6, extraPartials: 4 }, { fullReps: 6, validReps: 6, extraPartials: 4 }]), exp('2026-11-09', [{ fullReps: 6, validReps: 6, extraPartials: 4 }, { fullReps: 6, validReps: 6, extraPartials: 4 }])];
    expect(suggestProgression({ exposures: e, target: t6, increments: [2.5], activePain: false }).kind).toBe('hold');
  });
  it('dolore attivo: nessun aumento', () => {
    expect(suggestProgression({ exposures: [exp('2026-11-02', [{}, {}]), exp('2026-11-09', [{}, {}])], target, increments: [2.5], activePain: true }).kind).toBe('pain_stop');
  });
  it('salto troppo grande → consolidamento con percentuale', () => {
    const e = [exp('2026-11-02', [{ load: 20 }, { load: 20 }]), exp('2026-11-09', [{ load: 20 }, { load: 20 }])];
    const s = suggestProgression({ exposures: e, target, increments: [5], activePain: false });
    expect(s.kind).toBe('consolidate');
    expect(s.jumpPct).toBeCloseTo(0.25);
  });
  it('cambio macchina/leva → configKey distinta (storico separato)', () => {
    const base = { id: 'ex_hack', machineId: 'm_hack_1', configVersion: 1, romType: 'full' as const, loadConvention: 'unknown' as const };
    expect(configKey(base)).not.toBe(configKey({ ...base, machineId: 'm_hack_2' }));
    expect(configKey(base)).not.toBe(configKey({ ...base, configVersion: 2 }));
  });
  it('carico per manubrio non diventa totale senza conversione esplicita; multipower senza barra nota → totale ignoto', () => {
    const s1 = set({ load: 22, loadConvention: 'per_dumbbell' });
    expect(s1.load).toBe(22);
    expect(dumbbellTotal(22)).toBe(44);
    expect(smithTotal(30, null)).toBeNull();
    expect(smithTotal(30, 15)).toBe(75);
  });
  it('tonnellaggio solo entro la stessa configurazione', () => {
    expect(tonnage([set({ configKey: 'a', load: 10, fullReps: 10 }), set({ configKey: 'b', load: 10, fullReps: 10 })])).toBeNull();
    expect(tonnage([set({ configKey: 'a', load: 10, fullReps: 10 }), set({ configKey: 'a', load: 10, fullReps: 8 })])).toBe(180);
  });
});

describe('stallo', () => {
  it('cinque settimane stesso carico con ripetizioni valide crescenti → non è stallo', () => {
    const e = [8, 9, 9, 10, 11].map((r, i) => exp(addDays('2026-10-05', i * 7), [{ fullReps: r, validReps: r }, { fullReps: r, validReps: r }]));
    expect(detectStall(e).status).toBe('progressing');
  });
  it('poche osservazioni con recuperi diversi → dati non confrontabili', () => {
    const e = [exp('2026-11-02', [{}, { restBeforeSec: 60 }]), exp('2026-11-09', [{}, { restBeforeSec: 240 }])];
    expect(detectStall(e).status).toBe('not_comparable');
  });
  it('due sedute identiche non sono uno stallo', () => {
    const e = [exp('2026-11-02', [{}, {}]), exp('2026-11-09', [{}, {}])];
    expect(detectStall(e).status).toBe('insufficient');
  });
  it('quattro esposizioni identiche in meno di 3 settimane → periodo troppo breve', () => {
    const e = [0, 3, 7, 10].map((d) => exp(addDays('2026-11-02', d), [{}, {}]));
    expect(detectStall(e).status).toBe('insufficient');
  });
  it('quattro settimane identiche → possibile stallo (euristico)', () => {
    const e = [0, 7, 14, 21].map((d) => exp(addDays('2026-10-12', d), [{ validReps: 10, fullReps: 10 }, { validReps: 10, fullReps: 10 }]));
    expect(detectStall(e).status).toBe('possible_stall');
  });
});

const W = (d: string, kg: number, flags: string[] = []): WeightEntry => ({ id: d + kg, dateKey: d, time: '07:30', kg, morning: true, conditions: '', flags, note: '' });

describe('calorie', () => {
  const today = '2026-11-28';
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i));
  it('poche pesate o diario incompleto non fanno aumentare le calorie', () => {
    const p = proposeCalories({ weights: [W(days[0], 63), W(days[13], 63)], completeDiaryDays: days, avgIntakeKcal: 2800, targetKcal: 2800, lastTargetChange: null, today });
    expect(p.kind).toBe('insufficient_data');
    const all = days.map((d) => W(d, 63));
    const p2 = proposeCalories({ weights: all, completeDiaryDays: days.slice(0, 5), avgIntakeKcal: 2800, targetKcal: 2800, lastTargetChange: null, today });
    expect(p2.kind).toBe('insufficient_data');
  });
  it('un aumento rapido in una sola pesata non genera riduzione calorica', () => {
    const w = days.map((d, i) => W(d, i === 13 ? 64.5 : 63 + (i % 2) * 0.1));
    const p = proposeCalories({ weights: w, completeDiaryDays: days, avgIntakeKcal: 2800, targetKcal: 2800, lastTargetChange: null, today });
    expect(p.kind).not.toBe('decrease');
  });
  it('peso stabile seguendo il target → piccolo aumento motivato', () => {
    const w = days.map((d, i) => W(d, 63 + ((i * 7) % 3 - 1) * 0.05));
    const p = proposeCalories({ weights: w, completeDiaryDays: days, avgIntakeKcal: 2790, targetKcal: 2800, lastTargetChange: null, today });
    expect(['increase', 'hold_uncertain']).toContain(p.kind);
  });
  it('se non riesce a mangiare il target → prima praticabilità, non aumento', () => {
    const w = days.map((d) => W(d, 63));
    const p = proposeCalories({ weights: w, completeDiaryDays: days, avgIntakeKcal: 2300, targetKcal: 2800, lastTargetChange: null, today });
    expect(p.kind).toBe('improve_practicality');
  });
  it('massimo un cambio ogni 2 settimane', () => {
    const w = days.map((d) => W(d, 63));
    expect(proposeCalories({ weights: w, completeDiaryDays: days, avgIntakeKcal: 2800, targetKcal: 2800, lastTargetChange: addDays(today, -5), today }).kind).toBe('too_soon');
  });
  it('qualità del dato: 3 pesate per settimana', () => {
    const q = dataQuality([W(days[0], 63), W(days[1], 63), W(days[2], 63), W(days[8], 63)], days, today);
    expect(q.ok).toBe(false);
  });
});

describe('date Europe/Rome', () => {
  it('mezzanotte: 23:30 UTC del 12/11 è già il 13/11 a Roma', () => {
    expect(dateKey(Date.UTC(2026, 10, 12, 23, 30))).toBe('2026-11-13');
    expect(dateKey(Date.UTC(2026, 10, 12, 22, 59))).toBe('2026-11-12');
  });
  it('estate (UTC+2): 22:30 UTC del 30/6 è 1/7 a Roma', () => {
    expect(dateKey(Date.UTC(2026, 5, 30, 22, 30))).toBe('2026-07-01');
  });
  it('cambio ora: giorni di calendario corretti attraverso il 25/10/2026', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    // 25/10/2026 dura 25 ore a Roma: 00:00 → 23:00 locali
    expect(romeLocalToEpoch('2026-10-25', '23:00') - romeLocalToEpoch('2026-10-25', '00:00')).toBe(24 * 3600e3);
    expect(romeLocalToEpoch('2026-03-29', '12:00')).toBe(Date.UTC(2026, 2, 29, 10, 0));
    expect(romeLocalToEpoch('2026-11-12', '12:00')).toBe(Date.UTC(2026, 10, 12, 11, 0));
  });
  it('giorno della settimana', () => { expect(weekdayOf('2026-11-12')).toBe(4); expect(weekdayOf('2026-11-15')).toBe(7); });
});

describe('timer da timestamp', () => {
  it('durata attiva/totale e pause, ricostruite dai timestamp', () => {
    const t = sessionTimes({ startedAt: 0, endedAt: null, pauses: [{ start: 10 * 60e3, end: 15 * 60e3 }] }, 60 * 60e3);
    expect(t.total).toBe(3600e3);
    expect(t.active).toBe(55 * 60e3);
    const r = restState({ rest: { startedAt: 1000, plannedSec: 180 } }, 1000 + 200e3)!;
    expect(r.done).toBe(true);
    expect(r.remainingMs).toBe(-20e3);
  });
});

describe('sicurezza', () => {
  it('segnali d\'allarme → indicazione urgente invece di esercizi', () => {
    expect(painSafety({ redFlags: { perineal: true, bladderBowel: false, legWeakness: false }, intensity: null, worsening: null, limitsActivities: null }).level).toBe('urgent');
    expect(painSafety({ redFlags: { perineal: false, bladderBowel: false, legWeakness: false }, intensity: 8, worsening: null, limitsActivities: null }).level).toBe('medical');
    expect(painSafety({ redFlags: { perineal: false, bladderBowel: false, legWeakness: false }, intensity: 3, worsening: false, limitsActivities: false }).level).toBe('none');
  });
});
