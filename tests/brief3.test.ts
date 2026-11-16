// Brief "atlante e coach" (16/11/2026): problemi riprodotti prima di correggerli. Fixture sintetiche.
import { describe, it, expect } from 'vitest';
import { supplementAdvice, type SupplementContext } from '../src/lib/supplements';

const ADULT: SupplementContext = { goal: 'massa', diet: 'onnivora', health: {}, weightKg: 75, proteinAvgG: null, proteinDays: 0, sessions28: 10, lateSessionShare: null, fishPerWeek: null, noDairy: false, using: [] };
const crea = (c: Partial<SupplementContext>) => supplementAdvice({ ...ADULT, ...c }).find((a) => a.info.id === 'creatina')!;

describe('integratori: tre assi distinti (uso, cautela, pertinenza)', () => {
  it('farmaci dichiarati + creatina già in uso: la cautela resta dominante e l\'uso resta vero', () => {
    const a = crea({ health: { meds: true }, using: ['creatina'] });
    expect(a.status).toBe('ask_doctor');
    expect(a.inUse).toBe(true);
    expect(a.title).not.toMatch(/Da considerare/);
    expect(a.caution).toBeTruthy();
  });
  it('farmaci senza uso: prima il medico, nessuna dose personalizzata', () => {
    const a = crea({ health: { meds: true } });
    expect(a.status).toBe('ask_doctor');
    expect(a.inUse).toBe(false);
  });
  it('utente nuovo con zero sedute e giorni non indicati: niente "non serve", si chiede l\'informazione', () => {
    const a = crea({ sessions28: 0, declaredDays: null });
    expect(a.status).toBe('need_info');
    expect(a.title).toMatch(/Non so ancora quanto ti alleni/);
  });
  it('zero sedute registrate ma giorni dichiarati: pertinenza dai giorni dichiarati', () => {
    expect(crea({ sessions28: 0, declaredDays: 3 }).status).toBe('consider');
  });
  it('l\'ordinamento non porta un integratore in uso davanti a una cautela', () => {
    const list = supplementAdvice({ ...ADULT, health: { meds: true }, using: ['caffeina'] });
    const firstCaution = list.findIndex((x) => x.status === 'ask_doctor');
    const inUseNoCaution = list.findIndex((x) => x.inUse && !x.caution);
    expect(firstCaution).toBeGreaterThanOrEqual(0);
    if (inUseNoCaution >= 0) expect(firstCaution).toBeLessThan(inUseNoCaution);
  });
});

import { mergeDose, doseSummary } from '../src/lib/supplementLog';
describe('diario delle prese', () => {
  it('salvare due volte lo stesso giorno aggiorna, non duplica; retrodatazione possibile', () => {
    let l = mergeDose([], { supp: 'creatina', day: '2026-11-10', status: 'taken', qty: 3, unit: 'g' });
    l = mergeDose(l, { supp: 'creatina', day: '2026-11-10', status: 'taken', qty: 3, unit: 'g' });
    l = mergeDose(l, { supp: 'creatina', day: '2026-11-08', status: 'skipped', qty: null, unit: 'g' });
    expect(l.filter((d) => d.day === '2026-11-10').length).toBe(1);
    expect(l.map((d) => d.day)).toEqual(['2026-11-08', '2026-11-10']);
  });
  it('giorni non registrati restano "non registrati", non saltati né presi', () => {
    const l = mergeDose(mergeDose([], { supp: 'creatina', day: '2026-11-10', status: 'taken', qty: 3, unit: 'g' }), { supp: 'creatina', day: '2026-11-11', status: 'skipped', qty: null, unit: 'g' });
    expect(doseSummary(l, 'creatina', ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'])).toEqual({ taken: 1, skipped: 1, unknown: 2 });
  });
});

import { alternatives } from '../src/lib/substitute';
import { suggestProgression, progressionReps, type Exposure } from '../src/lib/progression';
import { EXERCISE_CATALOG } from '../src/catalog/exercises';
import { urgentSigns, painLabel } from '../src/lib/painReport';
import type { SetEntry } from '../src/db/types';

describe('priorità muscolare: preferenza, non vincolo', () => {
  const prefs = { disliked: [], favorites: [], discomfort: [] };
  const lat = EXERCISE_CATALOG.find((e) => e.id === 'cx_lat_larga')!;
  it('"petto prioritario" non promuove una croce al posto di una tirata', () => {
    const alts = alternatives(lat, EXERCISE_CATALOG, { access: 'palestra', prefs, max: 5, focus: ['petto'] });
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) expect(a.exercise.primaryMuscles.includes('petto')).toBe(false);
  });
  it('a parità di criteri tecnici la priorità decide, poi l\'ID (ordine stabile)', () => {
    const chest = EXERCISE_CATALOG.find((e) => e.id === 'cx_chest_press')!;
    const a1 = alternatives(chest, EXERCISE_CATALOG, { access: 'palestra', prefs, max: 10 });
    const a2 = alternatives(chest, EXERCISE_CATALOG, { access: 'palestra', prefs, max: 10 });
    expect(a1.map((x) => x.exercise.id)).toEqual(a2.map((x) => x.exercise.id));
  });
});

describe('dolore e progressione', () => {
  const S = (sid: string, o: Partial<SetEntry>): SetEntry => ({ id: sid + Math.random(), sessionId: sid, exerciseId: 'x', configKey: 'x', itemIndex: 0, kind: 'working', order: 1, load: 60, loadConvention: 'machine_stack', unilateral: false, romType: 'full', fullReps: 12, validReps: 12, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 2, rirUnknown: false, restBeforeSec: 120, pain: false, painNote: '', savedAt: 0, ...o } as SetEntry);
  const exp = (sid: string, d: string, sets: SetEntry[]): Exposure => ({ sessionId: sid, dateKey: d, startedAt: Date.parse(d), sets });
  const target = { sets: 2, repMin: 8, repMax: 12, rirTargets: [] };
  it('priorità petto + dolore alla spalla sulla press: nessuna spinta ad aumentare anche col range raggiunto', () => {
    const e = [exp('a', '2026-11-01', [S('a', {}), S('a', { order: 2 })]), exp('b', '2026-11-05', [S('b', {}), S('b', { order: 2, pain: true, painDetail: { zone: 'spalla', side: 'dx', onset: 'durante', intensity: null, note: '' } })])];
    const r = suggestProgression({ exposures: e, target, increments: [5], activePain: false });
    expect(r.kind).toBe('pain_stop');
    expect(r.proposedLoad).toBeNull();
  });
  it('seduta successiva senza dolore: nessun blocco perpetuo', () => {
    const e = [exp('a', '2026-11-01', [S('a', {}), S('a', { order: 2, pain: true })]), exp('b', '2026-11-05', [S('b', {}), S('b', { order: 2 })]), exp('c', '2026-11-08', [S('c', {}), S('c', { order: 2 })])];
    expect(suggestProgression({ exposures: e, target, increments: [5], activePain: false }).kind).toBe('increase');
  });
  it('6 complete + 4 parziali extra = 6 valide per la progressione (le 4 restano nel diario)', () => {
    const s = S('x', { fullReps: 6, validReps: 6, extraPartials: 4 });
    expect(progressionReps(s)).toBe(6);
    expect(s.extraPartials).toBe(4);
  });
  it('avvisi d\'urgenza diversi per articolazione e schiena; dettagli ignoti non inventati', () => {
    expect(urgentSigns('polso')).not.toMatch(/genitale|urinare/);
    expect(urgentSigns('schiena')).toMatch(/urinare/);
    expect(painLabel({ zone: null, side: null, onset: null, intensity: null, note: '' })).toBe('dettagli non indicati');
    expect(painLabel({ zone: 'spalla', side: 'dx', onset: 'durante', intensity: 4, note: '' })).toBe('spalla, destra, durante, 4/10');
  });
});
