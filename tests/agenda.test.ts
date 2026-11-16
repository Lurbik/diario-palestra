// Agenda condivisa: stessi orari per Oggi, sonno ed export calendario (fixture sintetiche).
import { describe, it, expect } from 'vitest';
import { buildIcs } from '../src/lib/ics';
import { emptyAgenda, trainingWindow, trainingStartFor, spanMinutes } from '../src/lib/agenda';
import { planSleep, sleepConflicts } from '../src/lib/sleep';
import { timeHM, dateKey } from '../src/lib/dates';

const MON = '2026-11-23';

describe('export calendario', () => {
  it('evento dalle 23:30 per 60 minuti: fine alle 00:30 del giorno dopo (non 23:59)', () => {
    const ics = buildIcs([{ uid: 'x', title: 'Allenamento', weekday: 1, start: '23:30', durationMin: 60 }], MON);
    expect(ics).toContain('DTSTART;TZID=Europe/Rome:20261123T233000');
    expect(ics).toContain('DTEND;TZID=Europe/Rome:20261124T003000');
  });
  it('evento normale: stesso giorno', () => {
    const ics = buildIcs([{ uid: 'y', title: 'Prep', weekday: 1, start: '17:00', durationMin: 45 }], MON);
    expect(ics).toContain('DTEND;TZID=Europe/Rome:20261123T174500');
  });
  it('durata anche attraverso la mezzanotte', () => { expect(spanMinutes('23:30', '00:30')).toBe(60); expect(spanMinutes('15:00', '16:15')).toBe(75); });
});

describe('agenda: una sola fonte di orari', () => {
  it('senza agenda nessun orario inventato', () => {
    expect(trainingWindow(emptyAgenda(), MON, 1, 70)).toBeNull();
  });
  it('allenamento spostato dalle 15:30 alle 21: cambiano fine e rientro, e compare il conflitto con la routine serale', () => {
    const sleep = planSleep({ wakeDateKey: '2026-11-24', wakeTime: '06:30', sleepHours: 8, latencyMin: 15, routineMin: 30 }); // routine dalle 21:45
    const early = trainingWindow({ ...emptyAgenda(), trainingStart: '15:30', commuteMin: 20 }, MON, 1, 70)!;
    expect(timeHM(early.endAt)).toBe('16:40');
    expect(sleepConflicts(sleep, [{ label: 'Allenamento', endAt: early.homeAt }])).toEqual([]);
    const late = trainingWindow({ ...emptyAgenda(), trainingStart: '21:00', commuteMin: 20 }, MON, 1, 70)!;
    expect(timeHM(late.homeAt)).toBe('22:30');
    expect(sleepConflicts(sleep, [{ label: 'Allenamento', endAt: late.homeAt }])[0]).toMatch(/45 min dopo l'inizio della routine serale \(21:45\)/);
  });
  it('allenamento tardivo che passa la mezzanotte: fine il giorno dopo', () => {
    const w = trainingWindow({ ...emptyAgenda(), trainingStart: '23:15' }, MON, 1, 60)!;
    expect(w.endsNextDay).toBe(true);
    expect(dateKey(w.endAt)).toBe('2026-11-24');
    expect(w.label).toBe('23:15–00:15 (giorno dopo)');
  });
  it('orario diverso solo il venerdì: gli altri giorni restano quelli abituali', () => {
    const a = { ...emptyAgenda(), trainingStart: '18:00', trainingByWeekday: { '5': '07:00' } };
    expect(trainingStartFor(a, 5)).toBe('07:00');
    expect(trainingStartFor(a, 1)).toBe('18:00');
    expect(trainingStartFor(a, 4)).toBe('18:00');
  });
});
