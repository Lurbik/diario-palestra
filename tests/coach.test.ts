// Coach allenamento: test di accettazione della specifica (fixture sintetiche).
import { describe, it, expect } from 'vitest';
import { coachProposals, applyToProgram, sessionContext, type CoachInput } from '../src/lib/coach';
import { detectStall } from '../src/lib/stall';
import { rankTemplates } from '../src/catalog/templates';
import { addDays } from '../src/lib/dates';
import type { Program, Session, SetEntry } from '../src/db/types';
import type { Exposure } from '../src/lib/progression';

const TODAY = '2026-11-19'; // giovedì
const item = (id: string, ex: string) => ({ id, exerciseId: ex, sets: 3, repMin: 8, repMax: 12, rirTargets: [], restSec: 120, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' });
const prog = (days: number, createdDaysAgo = 400): Program => ({
  id: 'p', name: 'Scheda', kind: 'custom', isActive: true, notes: '', createdAt: Date.parse(addDays(TODAY, -createdDaysAgo) + 'T12:00:00Z'),
  days: Array.from({ length: days }, (_, i) => ({ id: 'd' + i, name: 'Giorno ' + (i + 1), weekday: i + 1, items: [item(`i${i}a`, 'ex_a'), item(`i${i}b`, 'ex_b'), item(`i${i}c`, 'ex_c')] }))
});
const ses = (id: string, dateKey: string, dayId: string, extra: Partial<Session> = {}): Session => ({ id, programId: 'p', dayId, title: '', dateKey, startedAt: Date.parse(dateKey + 'T18:00:00Z'), endedAt: Date.parse(dateKey + 'T19:00:00Z'), pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false, ...extra } as Session);
const set = (sid: string, ex: string): SetEntry => ({ id: sid + ex, sessionId: sid, exerciseId: ex, configKey: ex, itemIndex: 0, kind: 'working', order: 1, load: 50, loadConvention: 'machine_stack', unilateral: false, romType: 'full', fullReps: 10, validReps: 10, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 2, rirUnknown: false, restBeforeSec: 120, pain: false, painNote: '', savedAt: 0 } as SetEntry);
const templates = (days: number) => rankTemplates({ days, equipment: 'palestra', experience: 'intermedio', minutes: 60 });
const base = (p: Program, sessions: Session[], sets: SetEntry[], declaredDays: number | null): CoachInput => ({ program: p, sessions, sets, today: TODAY, declaredDays, templates: templates(declaredDays ?? 3), stalls: [] });

/** Settimane regolari: tutte le sedute previste, tutti gli esercizi fatti. */
function regular(p: Program, weeks: number) {
  const sessions: Session[] = []; const sets: SetEntry[] = [];
  for (let w = 0; w < weeks; w++) p.days.forEach((d, i) => {
    const date = addDays(TODAY, -7 * (w + 1) + i); const id = `s${w}_${i}`;
    sessions.push(ses(id, date, d.id));
    for (const it of d.items) sets.push(set(id, it.exerciseId));
  });
  return { sessions, sets };
}

describe('coach: proposte per portata', () => {
  it('scheda valida dopo 12 mesi → mantieni (l\'età non è un motivo)', () => {
    const p = prog(3, 365);
    const { sessions, sets } = regular(p, 6);
    const out = coachProposals(base(p, sessions, sets, 3));
    expect(out.map((x) => x.scope)).toEqual(['keep']);
    expect(out[0].note).toMatch(/età della scheda non è un motivo/);
  });
  it('giorni disponibili da 5 a 2 già nella prima settimana → proposta di un nuovo modello da 2 giorni, con la vecchia conservata', () => {
    const p = prog(5, 3);
    const out = coachProposals(base(p, [], [], 2));
    const m = out.find((x) => x.scope === 'model')!;
    expect(m.title).toMatch(/2 giorni.*ne prevede 5/);
    const tpl = m.actions.find((a) => a.action.kind === 'change_model')!;
    expect(tpl.label).toMatch(/2 giorni|Full body A\/B|Casa con manubri/);
    expect(m.note).toMatch(/resta salvata/);
    expect(m.actions.some((a) => a.action.kind === 'keep')).toBe(true);
  });
  it('scheda che non entra nella settimana: 2 settimane complete con meno della metà delle sedute', () => {
    const p = prog(5, 60);
    const sessions = [ses('a', addDays(TODAY, -15), 'd0'), ses('b', addDays(TODAY, -9), 'd1'), ses('c', addDays(TODAY, -40), 'd0')];
    const out = coachProposals(base(p, sessions, [], null));
    expect(out.find((x) => x.id.startsWith('fit_'))!.observation).toMatch(/1 e 1 sedute su 5/);
  });
  it('esercizio saltato 3 volte su 4 a fine seduta → anticipa o rendi facoltativo, mostrando cosa cambia', () => {
    const p = prog(1, 100);
    const sessions: Session[] = []; const sets: SetEntry[] = [];
    for (let w = 0; w < 4; w++) {
      const id = 'w' + w; sessions.push(ses(id, addDays(TODAY, -7 * (w + 1)), 'd0'));
      sets.push(set(id, 'ex_a'), set(id, 'ex_b'));
      if (w === 0) sets.push(set(id, 'ex_c'));
    }
    const out = coachProposals(base(p, sessions, sets, 1));
    const sk = out.find((x) => x.id === 'skip_d0_i0c')!;
    expect(sk.scope).toBe('day');
    expect(sk.observation).toMatch(/3 delle ultime 4.*fine seduta/);
    expect(sk.missing.join(' ')).toMatch(/non significa che non ti piace/);
    const mv = applyToProgram(p, sk.actions[0].action);
    expect(mv.program.days[0].items.map((i) => i.id)).toEqual(['i0a', 'i0c', 'i0b']);
    expect(mv.program.revision).toBe(2);
    expect(mv.change).toMatch(/posizione 3 → 2/);
    const opt = applyToProgram(p, sk.actions[1].action);
    expect(opt.program.days[0].items[2].optional).toBe(true);
    expect(p.days[0].items[2].optional).toBeUndefined(); // la scheda originale non è toccata (annullabile)
  });
  it('uno skip occasionale non apre proposte', () => {
    const p = prog(1, 100);
    const sessions: Session[] = []; const sets: SetEntry[] = [];
    for (let w = 0; w < 4; w++) { const id = 'w' + w; sessions.push(ses(id, addDays(TODAY, -7 * (w + 1)), 'd0')); sets.push(set(id, 'ex_a'), set(id, 'ex_b')); if (w !== 1) sets.push(set(id, 'ex_c')); }
    expect(coachProposals(base(p, sessions, sets, 1)).map((x) => x.scope)).toEqual(['keep']);
  });
});

describe('stallo affidabile', () => {
  const ws = (load: number | null, reps: number, rest = 120) => ({ ...set('x', 'e'), load, fullReps: reps, validReps: reps, restBeforeSec: rest });
  const exp = (id: string, dateKey: string, sets: Partial<SetEntry>[]): Exposure => ({ sessionId: id, dateKey, startedAt: Date.parse(dateKey), sets: sets.map((s, i) => ({ ...ws(50, 10), ...s, order: i + 1, sessionId: id }) as SetEntry) });
  it('una vecchia seduta incompleta non invalida la storia recente', () => {
    const e = [exp('old', '2026-09-01', [{ load: null }, {}]), ...['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29'].map((d, i) => exp('s' + i, d, [{}, {}]))];
    const r = detectStall(e);
    expect(r.status).toBe('possible_stall');
    expect(r.reasons.join(' ')).toMatch(/2026-09-01: carico o ripetizioni valide mancanti/);
  });
  it('notte molto breve o "ho meno tempo": seduta esclusa, mai prova di stallo', () => {
    const dates = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29'];
    const e = dates.map((d, i) => exp('s' + i, d, i === 4 ? [{ fullReps: 6, validReps: 6 }, { fullReps: 6, validReps: 6 }] : [{ fullReps: 8 + i, validReps: 8 + i }, { fullReps: 8 + i, validReps: 8 + i }]));
    const ctx = sessionContext([{ id: 's4', dateKey: '2026-10-29', reducedTime: false, painReported: false }], [{ dateKey: '2026-10-29', sleepHours: 3.5 }]);
    const r = detectStall(e, { context: ctx });
    expect(r.status).toBe('progressing');
    expect(r.reasons.join(' ')).toMatch(/notte molto breve \(3,5 h\)/);
  });
  it('oltre 12 ripetizioni: confronto diretto di carico e ripetizioni, mai zero', () => {
    const dates = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22'];
    const e = dates.map((d, i) => exp('s' + i, d, [{ fullReps: 15 + i, validReps: 15 + i }, { fullReps: 15 + i, validReps: 15 + i }]));
    const r = detectStall(e);
    expect(r.status).toBe('progressing');
  });
});
