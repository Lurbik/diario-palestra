import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import { Chip, Icon, go, useNow, useSettings, useToast } from '../ui/kit';
import { CategoryIcon } from '../ui/visuals';
import { MEAL_LABEL, type DayType } from '../db/settings';
import { addDays, dateKey, formatDateIt, formatDuration, romeLocalToEpoch, timeHM, weekdayOf, WEEKDAYS } from '../lib/dates';
import { fmtNum, uid } from '../lib/id';
import { estimateItemMin, sessionTimes } from '../lib/workout';
import { planMeals } from '../lib/planner';
import { eatBatchPortion, eatRecipeDirect, ShortfallError } from '../lib/inventory';
import { shoppingNeeds } from '../lib/recipes';
import { planSleep, sleepConflicts, tomorrowWake } from '../lib/sleep';
import { sumNutrients } from '../lib/nutrition';
import { OnboardingSheet } from './Onboarding';
import { WeightSheet } from './WeightSheet';
import type { MealSlot, Recipe } from '../db/types';

const ALT_LABELS = ['Proposta', 'Alternativa più comoda', 'Alternativa con quello che hai'];

export function TodayScreen({ offline }: { offline: { ready: boolean; detail: string } | null }) {
  const settings = useSettings();
  const toast = useToast();
  const now = useNow(30000);
  const today = dateKey(now);
  const tomorrow = addDays(today, 1);
  const hm = timeHM(now);
  const [sheet, setSheet] = useState<null | 'onboarding' | 'weight'>(null);
  const [alt, setAlt] = useState(0);
  const active = useLiveQuery(() => db.sessions.where('status').equals('active').first(), []);
  const program = useLiveQuery(() => db.programs.filter((p) => p.isActive && !p.archived).first(), []);
  const pain = useLiveQuery(() => db.pain.where('status').equals('active').first(), []);
  const doneToday = useLiveQuery(() => db.sessions.where('dateKey').equals(today).filter((s) => s.status === 'done').count(), [today]) ?? 0;
  const diary = useLiveQuery(() => db.diary.where('dateKey').equals(today).toArray(), [today]) ?? [];
  const plan = useLiveQuery(() => db.plan.where('dateKey').between(today, tomorrow, true, true).toArray(), [today]) ?? [];
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const lots = useLiveQuery(() => db.stock.toArray(), []) ?? [];
  const batches = useLiveQuery(() => db.batches.filter((b) => b.servingsLeft > 0).toArray(), []) ?? [];
  const target = useLiveQuery(() => db.targets.orderBy('effectiveFrom').filter((t) => t.effectiveFrom <= today).last(), [today]);
  const kv = useLiveQuery(() => db.kv.where('key').anyOf([`dayType:${today}`, `dayType:${tomorrow}`, `cookToday:${today}`, 'pantryTracking', 'recipeFeedback', 'wakeOverrides']).toArray(), [today]) ?? [];
  const kvv = (k: string) => kv.find((x) => x.key === k)?.value;

  const wd = weekdayOf(today);
  const day = program?.days.find((d) => d.weekday === wd) ?? null;
  const nextDay = program ? [1, 2, 3, 4, 5, 6, 7].map((i) => addDays(today, i)).map((d) => ({ d, pd: program.days.find((x) => x.weekday === weekdayOf(d)) })).find((x) => x.pd) : undefined;
  const dayType: DayType = (kvv(`dayType:${today}`) as DayType) ?? (day ? 'palestra_pomeriggio' : 'riposo');
  const windows = settings.mealWindows[dayType].filter((w) => w.enabled);
  const logged = new Set(diary.map((d) => d.meal));
  const nextSlot: MealSlot | null = (windows.find((w) => hm <= w.to && !logged.has(w.slot)) ?? null)?.slot ?? null;
  const cookToday = (kvv(`cookToday:${today}`) as number | undefined) ?? settings.profile.defaultCookMin ?? null;
  const fMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const consumed = sumNutrients(diary.map((d) => d.nutrients));

  // Prossimo pasto: piano confermato, altrimenti proposte del motore (massimo 3).
  const confirmed = nextSlot ? plan.find((p) => p.dateKey === today && p.slot === nextSlot && p.status === 'confirmed' && !p.done) : undefined;
  const proposals = useMemo(() => {
    if (!nextSlot || !recipes.length) return [] as { recipe: Recipe; servings: number; fromBatch: boolean; label: string }[];
    const rules = { excludedTags: settings.excludedTags, allergies: settings.profile.allergies };
    const atWork = nextSlot === 'spuntino_mattina' || (nextSlot === 'pranzo' && dayType === 'universita');
    const remainingKcal = target?.kcal != null && consumed.values.kcal != null ? Math.max(0, target.kcal - consumed.values.kcal) : null;
    const remainingSlots = windows.filter((w) => !logged.has(w.slot) && w.to >= hm).length || 1;
    const out: { recipe: Recipe; servings: number; fromBatch: boolean; label: string }[] = [];
    const tried = new Set<string>();
    for (let k = 0; k < 3; k++) {
      // k=1 "più comoda": meno tempo attivo; k=2 "con quello che hai": solo se la dispensa è compilata
      if (k === 2 && !kvv('pantryTracking')) continue;
      const pool = recipes.filter((r) => !tried.has(r.id));
      const res = planMeals({
        slots: [{ dateKey: today, slot: nextSlot, maxActiveMin: k === 1 ? Math.min(cookToday ?? 15, 10) : cookToday, mustBePortable: atWork, coldChainOk: settings.profile.coolerBag === 'si' || settings.profile.fridgeAway === 'si' }],
        recipes: pool, foods: fMap, lots, batches, rules, pantryTracked: !!kvv('pantryTracking'),
        // "con quello che hai": fattibilità calcolata per PORZIONE (o lotto intero se indivisibile)
        stockMode: k === 2 ? 'pantry_only' : 'can_buy',
        kcalTarget: remainingKcal != null ? remainingKcal / remainingSlots : null, proteinTarget: settings.proteinTargetG ? settings.proteinTargetG / Math.max(3, windows.length) : null,
        locked: [], previous: [], today, feedback: (kvv('recipeFeedback') as Record<string, never>) ?? {}, beamWidth: 6
      });
      const e = res.entries[0];
      if (!e) continue;
      tried.add(e.recipeId);
      const r = recipes.find((x) => x.id === e.recipeId);
      if (r) out.push({ recipe: r, servings: e.servings, fromBatch: e.fromBatch, label: ALT_LABELS[k] });
    }
    return out;
  }, [nextSlot, recipes, fMap, lots, batches, settings, cookToday, target, consumed.values.kcal, dayType, today, hm]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = confirmed ? { recipe: recipes.find((r) => r.id === confirmed.recipeId)!, servings: confirmed.servings, fromBatch: batches.some((b) => b.recipeId === confirmed.recipeId), label: 'Confermato' } : proposals[alt % Math.max(1, proposals.length)];

  const eatPick = async () => {
    if (!pick?.recipe || !nextSlot) return;
    try {
      const b = batches.find((x) => x.recipeId === pick.recipe.id);
      if (b) await eatBatchPortion({ batchId: b.id, servings: pick.servings, meal: nextSlot });
      else await eatRecipeDirect({ recipeId: pick.recipe.id, servings: pick.servings, meal: nextSlot, deductStock: !!kvv('pantryTracking'), allowShortfall: true });
      if (confirmed) await db.plan.update(confirmed.id, { done: true });
      toast({ text: `${MEAL_LABEL[nextSlot]} registrato ✓` });
    } catch (e) { toast({ text: e instanceof ShortfallError ? e.message : String(e), kind: 'error' }); }
  };
  const confirmPick = async () => {
    if (!pick?.recipe || !nextSlot) return;
    await db.plan.add({ id: uid(), dateKey: today, slot: nextSlot, recipeId: pick.recipe.id, foodId: null, servings: pick.servings, locked: true, done: false, status: 'confirmed' });
    toast({ text: 'Confermato: lo trovi nel piano. Quando mangi tocca "L\'ho mangiato".' });
  };

  // Per domani
  const tomorrowPlan = plan.filter((p) => p.dateKey === tomorrow && !p.done);
  const needs = shoppingNeeds({ plan: tomorrowPlan, recipes: new Map(recipes.map((r) => [r.id, r])), foods: fMap, lots, batches, today, pantryTracked: !!kvv('pantryTracking') }).filter((n) => n.toBuy > 0);
  const toPrepare = tomorrowPlan.map((p) => recipes.find((r) => r.id === p.recipeId)).filter((r): r is Recipe => !!r && r.servings > 1 && !batches.some((b) => b.recipeId === r.id));
  const wake = tomorrowWake(today, settings.sleepPlan.wakeTime, (kvv('wakeOverrides') as Record<string, string | null>) ?? {});
  const sleep = wake.time ? planSleep({ wakeDateKey: wake.dateKey, wakeTime: wake.time, sleepHours: settings.sleepTargetH, latencyMin: settings.sleepPlan.latencyMin, routineMin: settings.sleepPlan.routineMin }) : null;
  const eveningEnd = dayType === 'palestra_sera' && day && !doneToday ? romeLocalToEpoch(today, '22:00') : null;
  const conflicts = sleep && eveningEnd ? sleepConflicts(sleep, [{ label: 'Allenamento serale (stima)', endAt: eveningEnd }]) : [];

  const est = day ? Math.round(day.items.reduce((a, it) => a + estimateItemMin(it), 0)) : 0;

  return (
    <main className="main">
      <div className="eyebrow">{formatDateIt(today, true)}</div>
      <h1>Oggi</h1>

      {!settings.onboardingDone && (
        <div className="hero accent">
          <div className="eyebrow">Per iniziare</div>
          <div className="title">Tre scelte e una scheda pronta</div>
          <p className="seg-why">Obiettivo, giorni, attrezzatura e cosa non mangi. Il diario funziona anche senza.</p>
          <button className="btn primary block" onClick={() => setSheet('onboarding')}>Inizia</button>
        </div>
      )}

      {/* 1. Prossimo allenamento */}
      <section className="hero" aria-labelledby="h-train">
        <div className="eyebrow" id="h-train">Il tuo prossimo allenamento</div>
        {active ? (
          <><div className="title">{active.title}</div><p className="seg-why">In corso · attiva {formatDuration(sessionTimes(active, now).active)}</p><button className="btn primary block" onClick={() => go('allenamento/seduta')}>Riprendi</button></>
        ) : pain ? (
          <><div className="title">In pausa</div><p className="seg-why">Pausa per dolore attiva: niente inviti ad aumentare i carichi.</p><a className="btn block" href="#/allenamento/dolore">Gestisci</a></>
        ) : !program ? (
          <><div className="title">Nessuna scheda attiva</div><p className="seg-why">Scegli un template e modificalo come vuoi.</p><button className="btn block" onClick={() => (settings.onboardingDone ? go('allenamento/schede') : setSheet('onboarding'))}>Scegli una scheda</button></>
        ) : doneToday ? (
          <><div className="title">Fatto per oggi ✓</div>{nextDay?.pd && <p className="seg-why">Prossimo: {nextDay.pd.name}, {WEEKDAYS[weekdayOf(nextDay.d)]}</p>}</>
        ) : day ? (
          <><div className="title">{day.name}</div><p className="seg-why">{day.items.length} esercizi · circa {est} min</p><button className="btn primary block" onClick={() => go('allenamento')}>Inizia</button></>
        ) : (
          <><div className="title">Riposo</div>{nextDay?.pd && <p className="seg-why">Prossimo: {nextDay.pd.name}, {WEEKDAYS[weekdayOf(nextDay.d)]}</p>}</>
        )}
      </section>

      {/* 2. Prossimo pasto */}
      <section className="hero" aria-labelledby="h-meal">
        <div className="eyebrow" id="h-meal">Il prossimo pasto{nextSlot ? ` · ${MEAL_LABEL[nextSlot]}` : ''}</div>
        {!nextSlot ? <p>Pasti di oggi completati o fuori orario.</p> : !pick?.recipe ? (
          <><p>Nessuna proposta compatibile con tempo, trasporto o esclusioni.</p><button className="btn block" onClick={() => go(`cibo/diario/${nextSlot}`)}>Registra quello che mangi</button></>
        ) : (
          <>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="thumb"><CategoryIcon cat={pick.recipe.category} /></span>
              <div className="grow">
                <div className="title" style={{ fontSize: '1.15rem' }}>{pick.recipe.name}</div>
                <MealWhy recipe={pick.recipe} servings={pick.servings} fromBatch={pick.fromBatch} foods={fMap} label={pick.label} />
              </div>
            </div>
            <div className="action-row mt">
              {confirmed ? <button className="btn primary" onClick={eatPick}>L'ho mangiato</button> : <button className="btn primary" onClick={confirmPick}>Va bene</button>}
              {confirmed ? <button className="btn" onClick={async () => { await db.plan.delete(confirmed.id); }}>Cambia</button> : <button className="btn" disabled={proposals.length < 2} onClick={() => setAlt(alt + 1)}>Alternativa</button>}
            </div>
            <button className="btn ghost block" onClick={() => go(`cibo/diario/${nextSlot}`)}>Ho mangiato altro</button>
            <div className="chips mt" aria-label="Tempo in cucina oggi">
              <span className="small muted">Oggi ho:</span>
              {[5, 15, 30].map((m) => <Chip key={m} on={cookToday === m} onClick={() => kvSet(`cookToday:${today}`, m)}>{m} min</Chip>)}
            </div>
          </>
        )}
      </section>

      {/* 3. Per domani */}
      <section className="hero" aria-labelledby="h-tomorrow">
        <div className="eyebrow" id="h-tomorrow">Per domani</div>
        <ul className="list">
          {toPrepare.length > 0 && <li>Prepara: {toPrepare.map((r) => r.name).join(', ')}</li>}
          {needs.length > 0 && <li>Spesa: {needs.slice(0, 4).map((n) => fMap.get(n.foodId)?.name ?? n.foodId).join(', ')}{needs.length > 4 ? ` e altri ${needs.length - 4}` : ''} <a href="#/cibo/spesa">lista</a></li>}
          {sleep ? <li>Sveglia {wake.time} · a letto {sleep.label.bed} · routine serale dalle <strong>{sleep.label.routine}</strong></li> : <li><a href="#/altro/sonno">Imposta la sveglia</a> per calcolare l'orario della routine serale</li>}
          {!toPrepare.length && !needs.length && <li className="muted">Nulla da preparare o comprare per i pasti pianificati di domani.</li>}
        </ul>
        {conflicts.map((c) => <p key={c} className="small" style={{ color: 'var(--warn)' }}>{c}</p>)}
      </section>

      <div className="quick">
        <button className="btn" onClick={() => setSheet('weight')}><Icon.scale />Peso</button>
        <button className="btn" onClick={() => go('altro/sonno')}><Icon.moon />Sonno</button>
        <button className="btn" onClick={() => go('cibo')}><Icon.food />Diario</button>
      </div>
      {(consumed.values.kcal ?? 0) > 0 && <p className="small muted">Registrato oggi: {fmtNum(consumed.values.kcal, 0)} kcal · {fmtNum(consumed.values.protein, 0)} g proteine{consumed.incomplete.kcal ? ' (alcuni valori mancanti)' : ''}{target?.kcal ? ` · target ${target.kcal} kcal` : ''}.</p>}
      <p className="pill-status mt"><span className={`dot ${offline?.ready ? 'ok' : 'warn'}`} />{offline?.ready ? 'Pronta offline' : 'Offline non ancora verificato'}</p>

      {sheet === 'onboarding' && <OnboardingSheet settings={settings} onClose={() => setSheet(null)} />}
      {sheet === 'weight' && <WeightSheet onClose={() => setSheet(null)} />}
    </main>
  );
}

function MealWhy({ recipe, servings, fromBatch, foods, label }: { recipe: Recipe; servings: number; fromBatch: boolean; foods: Map<string, import('../db/types').Food>; label: string }) {
  const t = useMemo(() => {
    const s = sumNutrients(recipe.ingredients.map((i) => {
      const f = foods.get(i.foodId);
      if (!f) return { kcal: null, protein: null, carbs: null, fat: null, fiber: null };
      const amt = (i.qty * servings) / recipe.servings;
      return { kcal: f.per100.kcal == null ? null : (f.per100.kcal * amt) / 100, protein: f.per100.protein == null ? null : (f.per100.protein * amt) / 100, carbs: null, fat: null, fiber: null };
    }));
    return s;
  }, [recipe, servings, foods]);
  const why = [label, fromBatch ? 'porzione già pronta' : `${recipe.activeMin ?? '?'} min attivi`, `${fmtNum(servings, 2)} porz.`, t.values.kcal != null ? `~${fmtNum(t.values.kcal, 0)} kcal` : 'kcal mancanti', t.values.protein != null ? `${fmtNum(t.values.protein, 0)} g proteine` : null].filter(Boolean);
  return <p className="seg-why">{why.join(' · ')}</p>;
}
