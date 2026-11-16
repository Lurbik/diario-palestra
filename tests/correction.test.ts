// Collaudo 5: correggere una serie storica aggiorna mappa/progressi per la data giusta, il piano futuro non cambia.
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { AppDB, __setDb, db } from '../src/db/db';
import { bootstrap } from '../src/db/bootstrap';
import { updateSet } from '../src/lib/workout';
import { workByMuscle } from '../src/lib/bodymap';
import type { SetEntry, Session } from '../src/db/types';

describe('correzione di una serie registrata', () => {
  it('serie segnata "allenante" per errore → corretta in riscaldamento: il conteggio del giorno cala, la scheda resta uguale', async () => {
    const d = new AppDB('corr-1'); __setDb(d); await d.open(); await bootstrap();
    await db.programs.put({ id: 'p', name: 'Scheda', kind: 'custom', isActive: true, notes: '', createdAt: 1, days: [{ id: 'd', name: 'G', weekday: 1, items: [{ id: 'i', exerciseId: 'cx_chest_press', sets: 2, repMin: 8, repMax: 12, rirTargets: [null, null], restSec: 150, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' }] }] });
    const ses = { id: 's', programId: 'p', dayId: 'd', title: 'G', dateKey: '2026-11-02', startedAt: 1, endedAt: 2, pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false } as unknown as Session;
    await db.sessions.put(ses);
    const S = (id: string): SetEntry => ({ id, sessionId: 's', exerciseId: 'cx_chest_press', configKey: 'k', itemIndex: 0, kind: 'working', order: 1, load: 50, loadConvention: 'machine_stack', unilateral: false, romType: 'full', fullReps: 10, validReps: 10, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 2, rirUnknown: false, restBeforeSec: null, pain: false, painNote: '', savedAt: 1 } as SetEntry);
    await db.sets.bulkPut([S('a'), S('b'), S('c')]);
    const before = JSON.stringify(await db.programs.get('p'));
    const exMap = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
    const count = async () => workByMuscle(await db.sets.toArray(), await db.sessions.toArray(), exMap, '2026-11-01').get('petto')?.direct ?? 0;
    expect(await count()).toBe(3);
    await updateSet('c', { kind: 'warmup' });
    expect(await count()).toBe(2);
    expect(workByMuscle(await db.sets.toArray(), await db.sessions.toArray(), exMap, '2026-11-03').get('petto')?.direct ?? 0).toBe(0); // la data resta quella della seduta
    expect(JSON.stringify(await db.programs.get('p'))).toBe(before);
  });
});
