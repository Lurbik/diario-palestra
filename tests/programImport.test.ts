// Collaudo 2: importazione sintetica ADDITIVA ripetuta → zero doppioni, nessuna seduta, scheda attiva invariata.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppDB, __setDb, db } from '../src/db/db';
import { bootstrap } from '../src/db/bootstrap';
import { parseProgramFile, previewProgramImport, applyProgramImport, exportPrograms } from '../src/lib/programImport';
import type { Program } from '../src/db/types';

const it2 = (id: string, ex: string) => ({ id, exerciseId: ex, sets: 2, repMin: 6, repMax: 8, rirTargets: [null, null], restSec: 180, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' });
const FILE = JSON.stringify({
  format: 'diario-backup', tables: {
    programs: [{ id: 'imp_rot', name: 'Rotazione importata', kind: 'custom', isActive: true, notes: '', createdAt: 1, days: [{ id: 'imp_d1', name: 'Torso', weekday: null, items: [it2('i1', 'cx_rdl_man'), it2('i2', 'u_rematore_mio')] }] }],
    exercises: [{ id: 'u_rematore_mio', name: 'Rematore mio', aliases: ['ciuf ciuf'], variant: '', machineId: null, equipment: 'Macchina', primaryMuscles: ['schiena_alta'], secondaryMuscles: [], loadConvention: 'machine_stack', unilateral: false, romType: 'full', configVersion: 1, configNote: '', techNotes: '', toConfirm: [], policyClass: 'compound', origin: 'user' }],
    sessions: [{ id: 's1' }], sets: [{ id: 'x' }], weights: [{ id: 'w' }]
  }
});
let k = 0;
describe('importazione additiva di schede', () => {
  beforeEach(async () => { const d = new AppDB(`imp-${++k}`); __setDb(d); await d.open(); await bootstrap(); });
  it('due importazioni di fila: zero doppioni, nessuna seduta, la scheda attiva non cambia', async () => {
    const mine: Program = { id: 'mia', name: 'La mia', kind: 'custom', isActive: true, notes: '', createdAt: 1, days: [] };
    await db.programs.put(mine);
    const f = parseProgramFile(FILE);
    expect(f.ignored.sort()).toEqual(['sessions', 'sets', 'weights']);
    const pv = await previewProgramImport(f);
    expect(pv.programs[0].status).toBe('nuova');
    expect(pv.missing).toEqual([]);
    const r1 = await applyProgramImport(f);
    expect(r1).toMatchObject({ programs: 1, exercises: 1 });
    const n = await db.programs.count();
    const pv2 = await previewProgramImport(parseProgramFile(FILE));
    expect(pv2.programs[0].status).toBe('identica');
    expect(pv2.exercises).toMatchObject({ added: 0, identical: 1, conflicts: 0 });
    const r2 = await applyProgramImport(parseProgramFile(FILE));
    expect(r2).toMatchObject({ programs: 0, exercises: 0 });
    expect(await db.programs.count()).toBe(n);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
    expect(await db.weights.count()).toBe(0);
    expect((await db.programs.filter((p) => p.isActive).toArray()).map((p) => p.id)).toEqual(['mia']);
    expect((await db.programs.get('imp_rot'))!.isActive).toBe(false);
    expect((await db.programs.get('imp_rot'))!.origin).toBe('private_import');
  });
  it('conflitto: per default tengo i miei', async () => {
    await applyProgramImport(parseProgramFile(FILE));
    await db.programs.update('imp_rot', { name: 'Rinominata da me' });
    const pv = await previewProgramImport(parseProgramFile(FILE));
    expect(pv.programs[0].status).toBe('conflitto');
    await applyProgramImport(parseProgramFile(FILE));
    expect((await db.programs.get('imp_rot'))!.name).toBe('Rinominata da me');
  });
  it('esercizi mancanti: segnalati, importazione rifiutata senza modifiche (atomica)', async () => {
    const bad = JSON.parse(FILE); bad.tables.exercises = [];
    const f = parseProgramFile(JSON.stringify(bad));
    const pv = await previewProgramImport(f);
    expect(pv.missing).toEqual([{ programId: 'imp_rot', exerciseId: 'u_rematore_mio' }]);
    const before = await db.programs.count();
    await expect(applyProgramImport(f)).rejects.toThrow(/Mancano 1 esercizi/);
    expect(await db.programs.count()).toBe(before);
  });
  it('esportazione: solo schede ed esercizi personali necessari, niente storico o dati sanitari', async () => {
    await applyProgramImport(parseProgramFile(FILE));
    const out = JSON.parse(await exportPrograms(['imp_rot']));
    expect(Object.keys(out.tables).sort()).toEqual(['exercises', 'machines', 'programs']);
    expect(out.tables.exercises.map((e: { id: string }) => e.id)).toEqual(['u_rematore_mio']); // il catalogo pubblico non viene copiato
    expect(JSON.stringify(out)).not.toMatch(/weights|sessions|health|pain/);
  });
});
