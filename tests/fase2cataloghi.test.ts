// Secondo audit, fase 2 · cataloghi, schede e integratori. Fixture sintetiche.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppDB, __setDb, db, kvGet, kvSet } from '../src/db/db';
import { bootstrap } from '../src/db/bootstrap';
import { loadCatalog } from '../src/catalog/load';
import { rankTemplates, templatesV2 } from '../src/catalog/templates';
import { EXERCISE_CATALOG } from '../src/catalog/exercises';
import { supplementAdvice, weightConfounders, type SupplementContext } from '../src/lib/supplements';
import { lateSessionShare, usualBedtimeMin, proteinFromDiary } from '../src/lib/supplementContext';
import { proposeCalories } from '../src/lib/calories';
import { addDays, romeLocalToEpoch } from '../src/lib/dates';
import type { WeightEntry } from '../src/db/types';

describe('cataloghi integrati dal pacchetto editoriale', () => {
  it('conteggi effettivi, riferimenti risolti, nessun doppione', async () => {
    const c = await loadCatalog();
    expect(c.foods.length).toBe(132);
    expect(c.exercises.length).toBe(85);
    expect(c.recipes.length).toBe(59);              // 48 + 12 nuove − 1 doppione hummus unito
    expect(c.templates.length).toBe(11);
    expect(c.unresolved).toEqual([]);
    expect(new Set(c.foods.map((f) => f.id)).size).toBe(c.foods.length);
    expect(new Set(c.exercises.map((e) => e.id)).size).toBe(c.exercises.length);
    const exIds = new Set(c.exercises.map((e) => e.id));
    for (const t of c.templates) for (const d of t.days) for (const i of d.items) expect(exIds.has(i.exerciseId)).toBe(true);
    expect(c.recipes.filter((r) => /hummus/i.test(r.name)).length).toBe(1);
  });
  it('ricette nuove: nessuna abilitata "fuori frigo" senza fonte; valori per porzione calcolati dagli ingredienti', async () => {
    const c = await loadCatalog();
    const fresh = c.recipes.filter((r) => r.id.startsWith('cr_esp_'));
    expect(fresh.length).toBe(12);
    for (const r of fresh) expect(r.ambient).not.toBe('ok');
    const fMap = new Map(c.foods.map((f) => [f.id, f]));
    const panino = fresh.find((r) => r.id === 'cr_esp_panino_mozz')!;
    const kcal = panino.ingredients.reduce((a, i) => a + (fMap.get(i.foodId)!.per100.kcal! * i.qty) / 100, 0);
    expect(kcal).toBeGreaterThan(380); expect(kcal).toBeLessThan(430); // stima del pacchetto: 406,9 kcal
  });
  it('alimenti nuovi: fonte, ID USDA, stato e allergeni sconosciuti per i trasformati', async () => {
    const c = await loadCatalog();
    for (const slug of ['pistacchi', 'trota', 'sgombro', 'farina_ceci', 'bulgur']) {
      const f = c.foods.find((x) => x.slug === slug)!;
      expect(f.sourceNote).toMatch(/fdcId \d+/);
      expect(f.state).toBeTruthy();
    }
    expect(c.foods.find((x) => x.slug === 'pistacchi')!.tags).toContain('frutta_a_guscio');
    expect(c.foods.find((x) => x.slug === 'bulgur')!.tags).toContain('glutine');
  });
  it('schede da 2 a 6 giorni: la prima proposta ha esattamente i giorni chiesti; carichi vuoti', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const r = rankTemplates({ days, equipment: 'palestra', experience: 'intermedio', minutes: 60 });
      expect(r[0].days).toBe(days);
    }
    expect(rankTemplates({ days: 2, equipment: 'casa_manubri', experience: 'principiante', minutes: 45 })[0].id).toBe('tpl2_casa2');
    for (const t of templatesV2()) for (const d of t.days) for (const i of d.items) expect(i.declaredLoad).toBe('');
  });
  it('esercizi a tempo o distanza: unità registrata e campi editoriali', () => {
    const by = (id: string) => EXERCISE_CATALOG.find((e) => e.id === id)!;
    expect(by('cx_plank').measure).toBe('seconds');
    expect(by('cx_side_plank').measure).toBe('seconds');
    expect(by('cx_farmer_walk').measure).toBe('meters');
    for (const id of ['cx_high_row', 'cx_landmine_press', 'cx_extrarotazione_cavo']) {
      expect(by(id).whenToChoose).toBeTruthy(); expect(by(id).comparisonLimits).toBeTruthy();
    }
    expect(by('cx_extrarotazione_cavo').whenToChoose).toMatch(/Non è una terapia/);
  });
});

describe('migrazione: archivio della versione precedente con preferiti e voci modificate', () => {
  let k = 0;
  beforeEach(async () => { const d = new AppDB(`f2cat-${++k}`); __setDb(d); await d.open(); });
  it('cambia UNA sola versione (template 2→3) con massimo invariato: il dispositivo reimporta comunque', async () => {
    await bootstrap();
    const tpl = (await db.programs.get('tpl2_fb3'))!;
    await db.programs.put({ ...tpl, catalogVersion: 2, name: 'vecchio nome' });
    await kvSet('catalogRelease', 'e4-r4-f4-t2');
    await kvSet('catalogVersion', 4); // con la vecchia logica (massimo) l'aggiornamento sarebbe stato saltato
    await bootstrap();
    expect((await db.programs.get('tpl2_fb3'))!.name).not.toBe('vecchio nome');
    expect(await kvGet('catalogRelease', '')).toMatch(/^e\d+-r\d+-f\d+-t3$/);
  });
  it('preferiti, voci modificate e doppioni ritirati: nulla perso, nulla sovrascritto', async () => {
    await bootstrap();
    // stato di un telefono con la v3: doppione hummus importato, un preferito, una ricetta modificata, una modificata e ritirata
    await db.recipes.update('cr_esp_trota', { favorite: true, catalogVersion: 3 });
    await db.recipes.update('cr_sn_cracker_tonno', { name: 'Cracker e tonno (mia versione)', userModified: true, catalogVersion: 3 });
    await db.recipes.put({ ...(await db.recipes.get('cr_hummus_carote_cracker'))!, id: 'cr_sn_hummus_cracker', name: 'Hummus, carote e cracker', catalogVersion: 3 });
    await db.diary.add({ id: 'd1', dateKey: '2026-11-10', meal: 'merenda', kind: 'recipe_direct', label: 'Hummus, carote e cracker', foodId: null, batchId: null, recipeId: 'cr_sn_hummus_cracker', qty: 1, unit: 'porzione', nutrients: { kcal: 300, protein: 9, carbs: 30, fat: 14, fiber: 6 }, estimated: false, txId: null, createdAt: 0 });
    await kvSet('catalogRelease', 'e3-r3-f3-t2');
    await bootstrap();
    expect((await db.recipes.get('cr_esp_trota'))!.favorite).toBe(true);
    expect((await db.recipes.get('cr_sn_cracker_tonno'))!.name).toBe('Cracker e tonno (mia versione)');
    const retired = (await db.recipes.get('cr_sn_hummus_cracker'))!;
    expect(retired.archived).toBe(true);
    expect(retired.replacedBy).toBe('cr_hummus_carote_cracker');
    expect(await db.diary.get('d1')).toBeTruthy(); // storico intatto
    expect(await db.foods.count()).toBe(132);
  });
});

const BASE: SupplementContext = { goal: 'massa', diet: 'onnivora', health: {}, weightKg: 80, proteinAvgG: 140, proteinDays: 10, sessions28: 12, lateSessionShare: 0, fishPerWeek: 2, noDairy: false, using: [] };
const st = (c: Partial<SupplementContext>, id: string) => supplementAdvice({ ...BASE, ...c }).find((a) => a.info.id === id)!;

describe('integratori: consigli dai dati, con sicurezza prima di tutto', () => {
  it('creatina: considerata con allenamento costante; non serve con poche sedute; reni → medico', () => {
    expect(st({}, 'creatina').status).toBe('consider');
    expect(st({ sessions28: 2 }, 'creatina').status).toBe('not_needed');
    expect(st({ health: { kidney: true } }, 'creatina').status).toBe('ask_doctor');
    expect(st({}, 'creatina').reasons.join(' ')).toMatch(/12 volte negli ultimi 28 giorni/);
  });
  it('caffeina: sconsigliata se le sedute sono vicine al sonno; riferimento in mg dal peso entro i limiti EFSA', () => {
    expect(st({ lateSessionShare: 0.7 }, 'caffeina').status).toBe('not_recommended');
    const ok = st({ lateSessionShare: 0.1 }, 'caffeina');
    expect(ok.status).toBe('consider');
    expect(ok.reasons.join(' ')).toMatch(/160 mg/);
    expect(ok.reasons.join(' ')).toMatch(/200 mg alla volta e 400 mg al giorno/);
    expect(st({ health: { heart: true } }, 'caffeina').status).toBe('ask_doctor');
  });
  it('proteine in polvere: dipende dai giorni completi; differenza in grammi; vegetali se niente latte', () => {
    expect(st({ proteinAvgG: 140 }, 'proteine_polvere').status).toBe('not_needed');
    const low = st({ proteinAvgG: 100 }, 'proteine_polvere');
    expect(low.status).toBe('food_first');
    expect(low.reasons.join(' ')).toMatch(/28 g sotto il riferimento di 128 g/);
    expect(st({ proteinAvgG: 100, noDairy: true }, 'proteine_polvere').reasons.join(' ')).toMatch(/proteine vegetali/);
    const few = st({ proteinDays: 3 }, 'proteine_polvere');
    expect(few.status).toBe('food_first');
    expect(few.missing.join(' ')).toMatch(/almeno 5 giorni completi/);
  });
  it('vegano → B12 necessaria; vitamina D e ferro solo dopo esami; BCAA e booster sconsigliati', () => {
    expect(st({ diet: 'vegana' }, 'b12').status).toBe('consider');
    expect(st({}, 'vitamina_d').status).toBe('test_first');
    expect(st({ diet: 'vegana' }, 'ferro').status).toBe('test_first');
    expect(st({}, 'bcaa').status).toBe('not_recommended');
    expect(st({}, 'booster').status).toBe('not_recommended');
    expect(st({}, 'beta_alanina').status).toBe('not_needed');
  });
  it('omega-3: prima il pesce; non serve se ne mangi abbastanza; anticoagulanti → medico', () => {
    expect(st({ fishPerWeek: 0.5 }, 'omega3').status).toBe('food_first');
    expect(st({ fishPerWeek: 2.5 }, 'omega3').status).toBe('not_needed');
    expect(st({ fishPerWeek: null }, 'omega3').missing.length).toBe(1);
    expect(st({ health: { meds: true } }, 'omega3').status).toBe('ask_doctor');
  });
  it('farmaci o gravidanza trasformano ogni "da considerare" in "prima il medico"; antidoping → certificazione', () => {
    for (const a of supplementAdvice({ ...BASE, diet: 'vegana', health: { meds: true } })) expect(a.status).not.toBe('consider');
    expect(st({ health: { tested: true } }, 'creatina').reasons.join(' ')).toMatch(/certificazione di lotto/);
  });
  it('contesto: sedute vicine all\'ora di dormire e proteine solo dai giorni completi con valori noti', () => {
    const bed = usualBedtimeMin({ sleepTargetH: 8, sleepPlan: { wakeTime: '07:00', latencyMin: 15, routineMin: 30 } }, []);
    expect(bed).toBe(22 * 60 + 45);
    const end = (hm: string) => ({ endedAt: romeLocalToEpoch('2026-11-10', hm) });
    expect(lateSessionShare([end('20:00'), end('21:30'), end('12:00'), end('18:00')], bed)).toBeCloseTo(0.75);
    expect(lateSessionShare([end('20:00')], bed)).toBeNull(); // troppe poche sedute
    const p = proteinFromDiary([
      { dateKey: 'a', nutrients: { kcal: 1, protein: 60, carbs: 1, fat: 1, fiber: 1 } }, { dateKey: 'a', nutrients: { kcal: 1, protein: 60, carbs: 1, fat: 1, fiber: 1 } },
      { dateKey: 'b', nutrients: { kcal: 1, protein: null, carbs: 1, fat: 1, fiber: 1 } }, { dateKey: 'c', nutrients: { kcal: 1, protein: 90, carbs: 1, fat: 1, fiber: 1 } }
    ], ['a', 'b']);
    expect(p).toEqual({ avg: 120, days: 1 }); // "b" ha un valore ignoto, "c" non è dichiarato completo
  });
});

describe('creatina e calorie: il peso delle prime settimane non cambia il target', () => {
  const today = '2026-11-30';
  const weights: WeightEntry[] = Array.from({ length: 14 }, (_, i) => ({ id: 'w' + i, dateKey: addDays(today, -13 + i), time: '07:30', kg: 70 + i * 0.1, morning: true, conditions: '', flags: [], note: '' }));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i));
  const args = { weights, completeDiaryDays: days, avgIntakeKcal: 2600, targetKcal: 2600, lastTargetChange: '2026-10-01', today, goal: 'massa' as const };
  it('senza creatina il motore propone; iniziata da 10 giorni → nessuna modifica, con il motivo', () => {
    expect(proposeCalories(args).kind).not.toBe('postpone');
    const conf = weightConfounders([{ id: 'creatina', start: addDays(today, -10) }], addDays);
    const p = proposeCalories({ ...args, confounders: conf });
    expect(p.kind).toBe('postpone');
    expect(p.reasons.join(' ')).toMatch(/creatina/);
    expect(p.deltaKcal).toBeNull();
    // iniziata 2 mesi fa: il periodo è finito
    expect(proposeCalories({ ...args, confounders: weightConfounders([{ id: 'creatina', start: addDays(today, -60) }], addDays) }).kind).not.toBe('postpone');
  });
});
