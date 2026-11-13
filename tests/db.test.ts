import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import Dexie from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppDB, __setDb, db, STORES_V1 } from '../src/db/db';
import { bootstrap } from '../src/db/bootstrap';
import { prepareBatch, eatBatchPortion, undoTx, purchase, ShortfallError, logFood, deleteDiaryEntry } from '../src/lib/inventory';
import { startSession, saveSet, finishSession, exposuresFor, configKey, activeSession, sessionTimes } from '../src/lib/workout';
import { exportAll, applyImport, previewImport, encryptText, decryptText, parseBackup } from '../src/lib/backup';
import { snapshotIfMigrating, listSnapshots } from '../src/db/migrate';
import foodsJson from '../src/catalog/foods.json';
import { bootstrap as boot2 } from '../src/db/bootstrap';
import { kvGet, kvSet } from '../src/db/db';
const FID = (slug: string) => (foodsJson as unknown as { items: { slug: string; id: string }[] }).items.find((i) => i.slug === slug)!.id;
const RISO = FID('riso_bianco'), POLLO = FID('petto_pollo'), BANANA = FID('banana');
import type { Recipe } from '../src/db/types';

let k = 0;
beforeEach(async () => {
  const fresh = new AppDB(`test-${++k}`);
  __setDb(fresh);
  await fresh.open();
  await bootstrap();
});

const recipe4: Recipe = {
  id: 'r_test', name: 'Test 4 porzioni', servings: 4, ingredients: [{ foodId: RISO, qty: 320, unit: 'g' }, { foodId: POLLO, qty: 600, unit: 'g' }],
  steps: [], equipment: [], activeMin: 10, totalMin: 30, portable: false, eatCold: false, needsColdChain: false, storage: '', storageSource: '', mealSlots: ['pranzo'], notes: '', seed: false, favorite: false
};

describe('dispensa e diario (transazioni)', () => {
  it('preparare 4 porzioni scarica una volta; mangiarne una lascia 3 porzioni e registra 1/4; annullamento ripristina', async () => {
    await db.recipes.add(recipe4);
    await purchase({ foodId: RISO, qty: 1000, unit: 'g', location: 'dispensa', expiry: null });
    await purchase({ foodId: POLLO, qty: 600, unit: 'g', location: 'frigo', expiry: '2026-11-14' });
    const { batch, tx } = await prepareBatch({ recipeId: 'r_test', servingsMade: 4, finalWeightG: 1400 });
    const riso = await db.stock.where('foodId').equals(RISO).first();
    const pollo = await db.stock.where('foodId').equals(POLLO).first();
    expect(riso!.qty).toBe(680);
    expect(pollo!.qty).toBe(0);
    const eat = await eatBatchPortion({ batchId: batch.id, servings: 1, meal: 'pranzo', dateKey: '2026-11-12' });
    expect((await db.batches.get(batch.id))!.servingsLeft).toBe(3);
    // Ingredienti NON scaricati di nuovo
    expect((await db.stock.where('foodId').equals(RISO).first())!.qty).toBe(680);
    expect(eat.entry.nutrients.kcal).toBeCloseTo(batch.totals.kcal! / 4);
    // Annullare la preparazione con porzioni mangiate è rifiutato
    await expect(undoTx(tx.id)).rejects.toThrow(/mangiate/);
    // Annulla il pasto → porzione ripristinata, voce di diario rimossa
    await undoTx(eat.tx.id);
    expect((await db.batches.get(batch.id))!.servingsLeft).toBe(4);
    expect(await db.diary.count()).toBe(0);
    // Ora si può annullare la preparazione → scorte ripristinate, lotto eliminato
    await undoTx(tx.id);
    expect((await db.stock.where('foodId').equals(RISO).first())!.qty).toBe(1000);
    expect((await db.stock.where('foodId').equals(POLLO).first())!.qty).toBe(600);
    expect(await db.batches.count()).toBe(0);
  });
  it('scorte insufficienti: nessuna quantità negativa silenziosa', async () => {
    await db.recipes.add(recipe4);
    await purchase({ foodId: RISO, qty: 100, unit: 'g', location: 'dispensa', expiry: null });
    await expect(prepareBatch({ recipeId: 'r_test', servingsMade: 4, finalWeightG: null })).rejects.toBeInstanceOf(ShortfallError);
    expect((await db.stock.where('foodId').equals(RISO).first())!.qty).toBe(100); // transazione annullata
    const ok = await prepareBatch({ recipeId: 'r_test', servingsMade: 4, finalWeightG: null, allowShortfall: true });
    expect(ok.tx.shortfalls.length).toBe(2);
    expect((await db.stock.toArray()).every((l) => l.qty >= 0)).toBe(true);
  });
  it('pianificare non scarica la dispensa', async () => {
    await purchase({ foodId: RISO, qty: 500, unit: 'g', location: 'dispensa', expiry: null });
    await db.plan.add({ id: 'p1', dateKey: '2026-11-13', slot: 'pranzo', recipeId: 'cr_riso_pollo_verdure', foodId: null, servings: 1, locked: false, done: false });
    expect((await db.stock.toArray())[0].qty).toBe(500);
    expect(await db.diary.count()).toBe(0);
  });
  it('alimento con scarico + eliminazione voce ripristina la scorta', async () => {
    await purchase({ foodId: BANANA, qty: 3, unit: 'pz', location: 'dispensa', expiry: null });
    const f = (await db.foods.get(BANANA))!;
    const r = await logFood({ food: f, qty: 1, unit: 'pz', meal: 'merenda', deductStock: true });
    expect((await db.stock.toArray())[0].qty).toBe(2);
    expect(r.entry.nutrients.kcal).toBeCloseTo(f.per100.kcal! * f.gramsPerPiece! / 100); // peso per pezzo documentato dalla fonte
    await deleteDiaryEntry(r.entry.id);
    expect((await db.stock.toArray())[0].qty).toBe(3);
  });
});

describe('avvio e aggiornamento V2', () => {
  it('installazione nuova: nessun profilo, nessuna scheda attiva, nessun carico; cataloghi caricati', async () => {
    expect(await db.programs.filter((p) => p.isActive).count()).toBe(0);
    const st = await kvGet<{ profile: { name: string; goal: unknown } }>('settings', { profile: { name: 'x', goal: 'x' } });
    expect(st.profile.name).toBe('');
    expect(st.profile.goal).toBeNull();
    expect(await db.exercises.count()).toBeGreaterThanOrEqual(60);
    expect(await db.foods.count()).toBeGreaterThanOrEqual(100);
    expect(await db.recipes.count()).toBeGreaterThanOrEqual(30);
    expect((await db.programs.toArray()).every((p) => p.days.every((d) => d.items.every((i) => !i.declaredLoad)))).toBe(true);
    expect(await db.sessions.count()).toBe(0);
  });
  it('reimportare il catalogo è idempotente e non sovrascrive voci modificate dall’utente', async () => {
    const before = await db.foods.count();
    await db.foods.update(RISO, { name: 'Il mio riso', userModified: true, favorite: true });
    await kvSet('catalogVersion', 0);
    await boot2();
    expect(await db.foods.count()).toBe(before);
    expect((await db.foods.get(RISO))!.name).toBe('Il mio riso');
  });
  it('aggiornamento da V1 con seed personali: nulla cancellato, provenienza marcata, scelte all’utente', async () => {
    const fresh = new AppDB(`legacy-${++k}`);
    __setDb(fresh);
    await fresh.open();
    await kvSet('seedVersion', 1);
    await db.programs.bulkAdd([
      { id: 'prog_dichiarata_2026_11', name: 'Scheda dichiarata', kind: 'declared', isActive: true, notes: '', createdAt: 1, days: [{ id: 'd', name: 'Lun', weekday: 1, items: [{ id: 'i', exerciseId: 'ex_tbar', sets: 2, repMin: 6, repMax: 8, rirTargets: [], restSec: 180, declaredLoad: '70 kg', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' }] }] },
      { id: 'tpl_fb3', name: 'Vecchio template', kind: 'template', isActive: false, notes: '', createdAt: 1, days: [] },
      { id: 'mia-scheda-uuid', name: 'Mia scheda', kind: 'custom', isActive: false, notes: '', createdAt: 2, days: [] }
    ]);
    await db.exercises.add({ id: 'ex_tbar', name: 'T-bar', aliases: [], variant: '', machineId: 'm_tbar', equipment: '', primaryMuscles: ['dorsali'], secondaryMuscles: [], loadConvention: 'unknown', unilateral: false, romType: 'full', configVersion: 1, configNote: '', techNotes: '', toConfirm: [], policyClass: 'compound' });
    await db.sessions.add({ id: 'S', programId: 'prog_dichiarata_2026_11', dayId: 'd', title: 'Lun', dateKey: '2026-11-10', startedAt: 1, endedAt: 2, pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false });
    await db.sets.add({ id: 'Z', sessionId: 'S', exerciseId: 'ex_tbar', configKey: 'k', itemIndex: 0, kind: 'working', order: 1, load: 70, loadConvention: 'unknown', unilateral: false, romType: 'full', fullReps: 7, validReps: 7, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 1, rirUnknown: false, restBeforeSec: null, pain: false, painNote: '', techIssue: false, notes: '', savedAt: 3 });
    await db.stock.add({ id: 'L', foodId: 'f_pasta', qty: 500, unit: 'g', location: 'dispensa', purchasedAt: null, expiry: null, openedAt: null, note: '' });
    const r = await boot2();
    expect(r.legacyMarked).toBeGreaterThanOrEqual(3);
    const decl = (await db.programs.get('prog_dichiarata_2026_11'))!;
    expect(decl.isActive).toBe(true);           // resta com'era: decide l'utente
    expect(decl.origin).toBe('legacy_seed');
    expect((await db.programs.get('tpl_fb3'))!.archived).toBe(true);
    expect((await db.programs.get('mia-scheda-uuid'))!.origin).toBeUndefined();
    expect((await db.exercises.get('ex_tbar'))!.origin).toBe('legacy_seed');
    expect(await db.sets.count()).toBe(1);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.stock.count()).toBe(1);
    expect(await kvGet('seedVersion', 0)).toBe(2);
  });
});

describe('seduta', () => {
  it('scheda dichiarata non crea sedute o serie al primo avvio', async () => {
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
    expect(await db.weights.count()).toBe(0);
  });
  it('salvataggio idempotente (doppio tocco) e ripresa della seduta attiva', async () => {
    const prog = (await db.programs.get('tpl2_fb3'))!;
    const s = await startSession({ program: prog, dayId: 'tpl2_fb3_d0' });
    const ex = (await db.exercises.get('cx_pulldown_unil'))!;
    const draft = {
      id: 'set-1', sessionId: s.id, exerciseId: ex.id, itemIndex: 1, kind: 'working' as const, load: 95, loadConvention: ex.loadConvention,
      unilateral: true, romType: 'full' as const, fullReps: 6, validReps: 6, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 3,
      assistedReps: 0, failedAttempts: 0, rir: 0, rirUnknown: false, pain: false, painNote: '', techIssue: false, notes: ''
    };
    const a = await saveSet(draft, ex, 180);
    const b = await saveSet(draft, ex, 180);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(await db.sets.count()).toBe(1);
    // "Riapertura": una nuova istanza legge la seduta attiva e il timer di recupero dai timestamp
    const again = await activeSession();
    expect(again!.id).toBe(s.id);
    expect(again!.rest!.plannedSec).toBe(180);
    expect(sessionTimes(again!).active).toBeGreaterThanOrEqual(0);
    await finishSession(s.id);
    const exps = await exposuresFor(configKey(ex));
    expect(exps.length).toBe(1);
    expect(exps[0].sets[0].validReps).toBe(6);
    expect(exps[0].sets[0].extraPartials).toBe(3);
  });
  it('valide > complete è rifiutato', async () => {
    const s = await startSession({ program: null, dayId: null });
    const ex = (await db.exercises.get('cx_pec_deck'))!;
    await expect(saveSet({
      id: 'bad', sessionId: s.id, exerciseId: ex.id, itemIndex: 0, kind: 'working', load: 10, loadConvention: 'unknown', unilateral: false, romType: 'full',
      fullReps: 6, validReps: 8, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: null, rirUnknown: true,
      pain: false, painNote: '', techIssue: false, notes: ''
    }, ex, null)).rejects.toThrow();
    expect(await db.sets.count()).toBe(0);
  });
});

describe('backup', () => {
  it('export → import su DB vuoto preserva dati e allegati; reimport non duplica', async () => {
    await db.weights.add({ id: 'w1', dateKey: '2026-11-12', time: '08:00', kg: 63, morning: null, conditions: 'non standard', flags: [], note: '' });
    await db.attachments.add({ id: 'a1', blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/png' }), mime: 'image/png', createdAt: 1 });
    const b = await exportAll('test');
    const text = JSON.stringify(b);
    const other = new AppDB(`test-import-${k}`);
    __setDb(other);
    await other.open();
    const parsed = parseBackup(text);
    const prev = await previewImport(parsed);
    expect(prev.find((p) => p.table === 'weights')!.added).toBe(1);
    await applyImport(parsed, 'merge');
    expect((await db.weights.get('w1'))!.kg).toBe(63);
    const att = (await db.attachments.get('a1'))!;
    expect(Array.from(new Uint8Array(await att.blob.arrayBuffer()))).toEqual([1, 2, 3, 250]);
    const countBefore = await db.foods.count();
    const prev2 = await previewImport(parsed);
    expect(prev2.every((p) => p.added === 0 && p.conflicts === 0)).toBe(true);
    await applyImport(parsed, 'merge');
    expect(await db.foods.count()).toBe(countBefore);
    expect(await db.weights.count()).toBe(1);
  });
  it('backup cifrato: password giusta decifra, password errata fallisce chiaramente', async () => {
    const enc = await encryptText('{"ciao":1}', 'password-lunga', 1000);
    expect(enc).not.toContain('ciao');
    expect(await decryptText(enc, 'password-lunga', )).toBe('{"ciao":1}');
    await expect(decryptText(enc, 'sbagliata!!')).rejects.toThrow(/Password errata/);
  });
});

describe('migrazione schema', () => {
  it('da v1 con sedute reali: snapshot pre-migrazione + dati preservati e normalizzati in v2', async () => {
    const idb = new IDBFactory();
    Dexie.dependencies.indexedDB = idb;
    const name = 'mig-test';
    const v1 = new Dexie(name, { indexedDB: idb });
    v1.version(1).stores(STORES_V1);
    await v1.open();
    await v1.table('sessions').add({ id: 'S1', dateKey: '2026-11-02', status: 'done', startedAt: 1, title: 'Petto / Schiena' });
    await v1.table('sets').add({ id: 'X1', sessionId: 'S1', exerciseId: 'ex_tbar', configKey: 'k', fullReps: 7, validReps: 7, rir: 1, savedAt: 5 });
    v1.close();
    expect(await snapshotIfMigrating(idb, name)).toBe(true);
    const snaps = await listSnapshots(idb);
    expect((snaps[0].data.sets as unknown[]).length).toBe(1);
    const v2 = new AppDB(name);
    await v2.open();
    const s = await v2.sets.get('X1');
    expect(s!.validReps).toBe(7);
    expect(s!.fullRepsOtherSide).toBeNull();
    expect(s!.rirUnknown).toBe(false);
    expect(await v2.sessions.count()).toBe(1);
    expect(await snapshotIfMigrating(idb, name)).toBe(false); // già aggiornato
    v2.close();
  });
  it('snapshot salvato anche se il DB degli snapshot esiste già senza archivio', async () => {
    const idb = new IDBFactory();
    await new Promise<void>((res) => { const r = idb.open('diario-palestra-snapshots'); r.onsuccess = () => { r.result.close(); res(); }; });
    const v1 = new Dexie('mig2', { indexedDB: idb });
    v1.version(1).stores(STORES_V1);
    await v1.open();
    await v1.table('sets').add({ id: 'A' });
    v1.close();
    expect(await snapshotIfMigrating(idb, 'mig2')).toBe(true);
    expect((await listSnapshots(idb))[0].data.sets.length).toBe(1);
  });
});
