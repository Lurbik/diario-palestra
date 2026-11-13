import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { MealSlot, PlanEntry } from '../db/types';
import { Check, Chip, Field, Icon, NumInput, Sheet, useSettings, useToast } from '../ui/kit';
import { DAYTYPE_LABEL, GOAL_LABEL, MEAL_LABEL, type DayType, type Settings } from '../db/settings';
import { patchSettings } from '../db/bootstrap';
import { addDays, dateKey, formatDateIt, weekStart, weekdayOf, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/dates';
import { fmtNum, uid } from '../lib/id';
import { planMeals } from '../lib/planner';
import { buildIcs } from '../lib/ics';
import { planSleep, tomorrowWake } from '../lib/sleep';
import { syncNativeReminders } from '../lib/notify';
import { downloadText } from '../lib/backup';
import { SOURCES } from '../data/sources';
import { BackupScreen } from './Backup';
import { OnboardingSheet } from './Onboarding';
import { isNative, isStandalone } from '../lib/pwa';

export const APP_VERSION = __APP_VERSION__;

export function MoreScreen({ route, offline }: { route: string[]; offline: { ready: boolean; detail: string } | null }) {
  const sub = route[1] ?? '';
  const back = <a href="#/altro" className="small">‹ Altro</a>;
  if (sub === 'calendario') return <main className="main">{back}<CalendarScreen /></main>;
  if (sub === 'sonno') return <main className="main">{back}<SleepScreen /></main>;
  if (sub === 'fonti') return <main className="main">{back}<SourcesScreen /></main>;
  if (sub === 'impostazioni') return <main className="main">{back}<SettingsScreen /></main>;
  if (sub === 'backup') return <main className="main">{back}<BackupScreen /></main>;
  if (sub === 'installa') return <main className="main">{back}<InstallScreen offline={offline} /></main>;
  if (sub === 'info') return <main className="main">{back}<InfoScreen /></main>;
  const items: [string, string, string][] = [
    ['calendario', 'Calendario', 'Piano pasti, preparazioni, esportazione calendario'],
    ['sonno', 'Sonno', 'Ore stimate, qualità, sonnellini'],
    ['fonti', 'Fonti', 'Bibliografia e tipi di consiglio'],
    ['impostazioni', 'Impostazioni', 'Profilo, preferenze, aspetto, promemoria, regole'],
    ['backup', 'Backup', 'Esporta, importa, backup cifrato, CSV'],
    ['installa', 'Installazione', 'Usare l\'app come applicazione e offline'],
    ['info', 'Informazioni e limiti', `Versione ${APP_VERSION}`]
  ];
  return (
    <main className="main">
      <h1>Altro</h1>
      <div className="card flat"><ul className="list">
        {items.map(([k, t, d]) => <li key={k}><a className="listbtn" href={`#/altro/${k}`}><span>{t}<br /><span className="small muted">{d}</span></span><Icon.right /></a></li>)}
      </ul></div>
      <p className="pill-status"><span className={`dot ${offline?.ready ? 'ok' : 'warn'}`} />{offline?.ready ? 'Pronta offline' : 'Offline non ancora verificato'}</p>
    </main>
  );
}

// ---------------- Calendario e piano pasti ----------------
function CalendarScreen() {
  const settings = useSettings();
  const toast = useToast();
  const [ws, setWs] = useState(weekStart(dateKey()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const plan = useLiveQuery(() => db.plan.where('dateKey').between(days[0], days[6], true, true).toArray(), [ws]) ?? [];
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const program = useLiveQuery(() => db.programs.filter((p) => p.isActive).first(), []);
  const dayTypes = useLiveQuery(() => db.kv.where('key').startsWith('dayType:').toArray(), []) ?? [];
  const target = useLiveQuery(() => db.targets.orderBy('effectiveFrom').last(), []);
  const [messages, setMessages] = useState<string[]>([]);
  const [add, setAdd] = useState<{ d: string; slot: MealSlot } | null>(null);
  const rName = new Map(recipes.map((r) => [r.id, r.name]));
  const dtOf = (d: string): DayType => (dayTypes.find((x) => x.key === `dayType:${d}`)?.value as DayType) ?? (program?.days.some((x) => x.weekday === weekdayOf(d)) ? 'palestra_pomeriggio' : 'riposo');

  const generate = async () => {
    const away = settings.profile.fridgeAway !== 'si';
    const slots = days.filter((d) => d >= dateKey()).flatMap((d) => settings.mealWindows[dtOf(d)].filter((w) => w.enabled).map((w) => ({
      dateKey: d, slot: w.slot, maxActiveMin: settings.profile.defaultCookMin ?? null,
      mustBePortable: away && dtOf(d) === 'universita' && (w.slot === 'spuntino_mattina' || w.slot === 'pranzo'), coldChainOk: settings.profile.coolerBag === 'si'
    })));
    const [lots, batches, fb] = await Promise.all([db.stock.toArray(), db.batches.toArray(), db.kv.get('recipeFeedback')]);
    const kept = plan.filter((p) => p.locked || p.done || p.status === 'confirmed');
    const res = planMeals({
      slots, recipes, foods: new Map(foods.map((f) => [f.id, f])), lots, batches, rules: { excludedTags: settings.excludedTags, allergies: settings.profile.allergies },
      kcalTarget: target?.kcal ?? null, proteinTarget: settings.proteinTargetG, locked: kept, previous: plan, today: dateKey(), feedback: (fb?.value as never) ?? {}, budgetMs: 1500
    });
    await db.transaction('rw', db.plan, async () => {
      await db.plan.bulkDelete(plan.filter((p) => !p.locked && !p.done && p.status !== 'confirmed').map((p) => p.id));
      await db.plan.bulkPut(res.entries.map((e) => ({ id: uid(), dateKey: e.dateKey, slot: e.slot, recipeId: e.recipeId, foodId: null, servings: e.servings, locked: false, done: false, status: 'proposed' as const })));
    });
    setMessages([...res.messages, ...res.explain]);
    toast({ text: 'Proposte aggiornate: i pasti bloccati o confermati non sono cambiati' });
  };
  const exportIcs = () => {
    const ev = [
      ...(program?.days.filter((d) => d.weekday).map((d) => ({ uid: `allenamento-${d.id}`, title: `Allenamento: ${d.name}`, weekday: d.weekday!, start: '15:00', durationMin: settings.dailyTimeLimitMin ?? 90, description: 'Orario indicativo: modificalo nel calendario.' })) ?? []),
      ...settings.prepWeekdays.map((w) => ({ uid: `prep-${w}`, title: 'Preparazione pasti', weekday: w, start: '17:00', durationMin: 60 })),
      ...settings.reminders.filter((r) => r.enabled).flatMap((r) => r.weekdays.map((w) => ({ uid: `${r.id}-${w}`, title: r.label, weekday: w, start: r.time, durationMin: 10 })))
    ];
    downloadText('diario-calendario.ics', buildIcs(ev, dateKey()), 'text/calendar');
  };
  return (
    <>
      <h1>Calendario</h1>
      <div className="row between">
        <button className="iconbtn" aria-label="Settimana precedente" onClick={() => setWs(addDays(ws, -7))}><Icon.left /></button>
        <strong>Settimana dal {formatDateIt(ws)}</strong>
        <button className="iconbtn" aria-label="Settimana successiva" onClick={() => setWs(addDays(ws, 7))}><Icon.right /></button>
      </div>
      <div className="row wrap mt">
        <button className="btn sm primary" onClick={generate}>Genera / rigenera non bloccati</button>
        <button className="btn sm" onClick={exportIcs}>Esporta calendario (.ics)</button>
      </div>
      {messages.length > 0 && <div className="card warn small mt"><ul>{messages.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
      <p className="small muted">Finestre orarie organizzative, non obblighi biologici. Il piano non entra nel diario finché non registri il pasto; non scarica la dispensa.</p>
      {days.map((d) => {
        const dt = dtOf(d);
        return (
          <section className="card" key={d}>
            <div className="row between"><strong>{formatDateIt(d)}</strong>
              <select aria-label="Tipo di giornata" value={dt} style={{ width: 'auto' }} onChange={(e) => db.kv.put({ key: `dayType:${d}`, value: e.target.value, updatedAt: Date.now() })}>
                {(Object.keys(DAYTYPE_LABEL) as DayType[]).map((k) => <option key={k} value={k}>{DAYTYPE_LABEL[k]}</option>)}
              </select>
            </div>
            {settings.prepWeekdays.includes(weekdayOf(d)) && <span className="badge accent">Giorno di preparazione</span>}
            {settings.mealWindows[dt].filter((w) => w.enabled).map((w) => {
              const es = plan.filter((p) => p.dateKey === d && p.slot === w.slot);
              return (
                <div className="setline" key={w.slot}>
                  <div className="grow"><span className="small muted">{w.from} {MEAL_LABEL[w.slot]}</span><br />
                    {es.map((p) => <PlanChip key={p.id} p={p} name={p.recipeId ? rName.get(p.recipeId) ?? '?' : p.foodId ?? '?'} />)}
                    {!es.length && <span className="small muted">—</span>}
                  </div>
                  <button className="iconbtn" aria-label={`Aggiungi a ${MEAL_LABEL[w.slot]}`} onClick={() => setAdd({ d, slot: w.slot })}><Icon.plus /></button>
                </div>
              );
            })}
          </section>
        );
      })}
      {add && (
        <Sheet title={`${MEAL_LABEL[add.slot]} — ${formatDateIt(add.d)}`} onClose={() => setAdd(null)}>
          <ul className="list">{recipes.map((r) => <li key={r.id}><button className="listbtn" onClick={async () => { await db.plan.add({ id: uid(), dateKey: add.d, slot: add.slot, recipeId: r.id, foodId: null, servings: 1, locked: true, done: false }); setAdd(null); }}>{r.name}<Icon.plus /></button></li>)}</ul>
        </Sheet>
      )}
    </>
  );
}

function PlanChip({ p, name }: { p: PlanEntry; name: string }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <span>{name}{p.servings !== 1 ? ` × ${fmtNum(p.servings, 1)}` : ''}</span>
      <button className="btn sm ghost" aria-label={p.locked ? 'Sblocca' : 'Blocca'} aria-pressed={p.locked} onClick={() => db.plan.update(p.id, { locked: !p.locked })}><Icon.lock />{p.locked ? 'bloccato' : 'libero'}</button>
      <button className="btn sm ghost" aria-label="Rimuovi" onClick={() => db.plan.delete(p.id)}><Icon.trash /></button>
    </span>
  );
}

// ---------------- Sonno ----------------
function SleepScreen() {
  const settings = useSettings();
  const toast = useToast();
  const list = useLiveQuery(() => db.sleep.orderBy('dateKey').reverse().limit(30).toArray(), []) ?? [];
  const [d, setD] = useState(dateKey());
  const [bed, setBed] = useState('');
  const [wake, setWake] = useState('');
  const [hours, setHours] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [nap, setNap] = useState<number | null>(null);
  const inBed = bed && wake ? ((Number(wake.slice(0, 2)) * 60 + Number(wake.slice(3)) - (Number(bed.slice(0, 2)) * 60 + Number(bed.slice(3))) + 1440) % 1440) / 60 : null;
  const last7 = list.filter((s) => s.dateKey > addDays(dateKey(), -7) && s.sleepHours != null);
  const avg = last7.length ? last7.reduce((a, s) => a + s.sleepHours!, 0) / last7.length : null;
  return (
    <>
      <h1>Sonno</h1>
      <SleepPlanner />
      <h2>Registro</h2>
      <div className="card">
        <Field label="Data del risveglio"><input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
        <div className="grid2 mt">
          <Field label="A letto alle"><input type="time" value={bed} onChange={(e) => setBed(e.target.value)} /></Field>
          <Field label="Sveglia alle"><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></Field>
        </div>
        {inBed != null && <p className="small muted">Tempo a letto: {fmtNum(inBed, 1)} h (non è il sonno effettivo).</p>}
        <NumInput label="Ore di sonno stimate" value={hours} onChange={setHours} />
        <div className="mt"><strong className="small">Qualità percepita</strong><div className="chips">{[1, 2, 3, 4, 5].map((q) => <Chip key={q} on={quality === q} onClick={() => setQuality(quality === q ? null : q)}>{q}</Chip>)}</div></div>
        <div className="mt"><NumInput label="Sonnellino (minuti, facoltativo)" value={nap} onChange={setNap} decimals={false} /></div>
        <button className="btn primary block mt" disabled={hours == null && !bed && !wake} onClick={async () => {
          await db.sleep.add({ id: uid(), dateKey: d, bedTime: bed || null, wakeTime: wake || null, sleepHours: hours, quality, napMin: nap, note: '' });
          setHours(null); setQuality(null); setNap(null); toast({ text: 'Sonno salvato ✓' });
        }}>Salva</button>
      </div>
      <div className="card">
        <p>Media ultimi 7 giorni: <strong>{avg != null ? `${fmtNum(avg, 1)} h` : '—'}</strong> · obiettivo personale {fmtNum(settings.sleepTargetH, 1)} h</p>
        <p className="small muted">Riferimento generale per adulti: almeno 7 ore regolari (AASM/SRS). 7–9 ore come finestra organizzativa iniziale, non obbligo identico per tutti. Una notte breve non modifica la scheda.</p>
        <ul className="list">{list.map((s) => <li key={s.id} className="row between small"><span>{formatDateIt(s.dateKey)} {s.bedTime ?? ''}–{s.wakeTime ?? ''}</span><span>{s.sleepHours != null ? `${fmtNum(s.sleepHours, 1)} h` : '—'}{s.quality ? ` · q${s.quality}` : ''}{s.napMin ? ` · +${s.napMin}′` : ''} <button className="iconbtn" aria-label="Elimina" onClick={() => db.sleep.delete(s.id)}><Icon.trash /></button></span></li>)}</ul>
      </div>
      <p className="small muted">Integrazione con smartwatch, Health Connect o Apple Health: non implementata.</p>
    </>
  );
}

// ---------------- Fonti ----------------
function SourcesScreen() {
  const areas = [...new Set(SOURCES.map((s) => s.area))];
  return (
    <>
      <h1>Fonti</h1>
      <div className="card flat small">
        <p><strong>Ogni consiglio distingue:</strong></p>
        <ul>
          <li><strong>Evidenza generale</strong> — principi da fonti come quelle qui sotto.</li>
          <li><strong>Euristica dell'app</strong> — regole prudenti e configurabili (soglie, numero di sedute), non validate clinicamente.</li>
          <li><strong>Dato personale osservato</strong> — ciò che hai registrato.</li>
          <li><strong>Preferenza dell'utente</strong> — scelte e gusti dichiarati.</li>
        </ul>
        <p>Le fonti supportano i principi generali, non validano l'intero motore decisionale. Le novità non modificano automaticamente il piano.</p>
      </div>
      {areas.map((a) => (
        <section key={a}><h2>{a}</h2>
          <ul className="list card flat">{SOURCES.filter((s) => s.area === a).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a><br /><span className="small muted">{s.note}</span></li>)}</ul>
        </section>
      ))}
    </>
  );
}

// ---------------- Impostazioni ----------------
function SettingsScreen() {
  const s = useSettings();
  const toast = useToast();
  const [onb, setOnb] = useState(false);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const set = (p: Partial<Settings>) => patchSettings(p);
  const [allergies, setAllergies] = useState(s.profile.allergies.join(', '));
  useEffect(() => setAllergies(s.profile.allergies.join(', ')), [s.profile.allergies]);
  return (
    <>
      <h1>Impostazioni</h1>
      <section className="card">
        <h3>Aspetto</h3>
        <div className="chips">{(['system', 'dark', 'light'] as const).map((t) => <Chip key={t} on={s.theme === t} onClick={() => set({ theme: t })}>{{ system: 'Automatico', dark: 'Scuro', light: 'Chiaro' }[t]}</Chip>)}</div>
        <Check checked={s.highContrast} onChange={(v) => set({ highContrast: v })}>Alto contrasto</Check>
        <Check checked={s.reduceMotion} onChange={(v) => set({ reduceMotion: v })}>Riduci animazioni</Check>
      </section>
      <section className="card">
        <h3>Profilo e preferenze</h3>
        <p className="small muted">{[s.profile.goal ? GOAL_LABEL[s.profile.goal] : 'Obiettivo non indicato', s.profile.experience, s.profile.trainingDaysPerWeek ? `${s.profile.trainingDaysPerWeek} giorni` : null, s.profile.sessionMinutes ? `${s.profile.sessionMinutes} min` : null, s.profile.equipment].filter(Boolean).join(' · ')}</p>
        <div className="chips">{(['manuale', 'assistita', 'automatica'] as const).map((m) => <Chip key={m} on={s.assistMode === m} onClick={() => set({ assistMode: m })}>{{ manuale: 'Manuale', assistita: 'Assistita', automatica: 'Pianifica il non confermato' }[m]}</Chip>)}</div>
        <p className="small muted">In tutte le modalità serie e pasti entrano nello storico solo quando li confermi.</p>
        <button className="btn sm" onClick={() => setOnb(true)}>Rivedi obiettivo e preferenze</button>
        <Field label="Allergie (separate da virgola)" hint="Distinte dalle preferenze: filtrano ricette e sostituzioni"><input value={allergies} onChange={(e) => setAllergies(e.target.value)} onBlur={() => set({ profile: { ...s.profile, allergies: allergies.split(',').map((x) => x.trim()).filter(Boolean) } })} /></Field>
        <div className="mt"><strong className="small">Etichette escluse dai suggerimenti</strong>
          <div className="chips">{['formaggio', 'latte', 'glutine', 'uova', 'pesce', 'crostacei', 'affettato', 'arachidi', 'frutta_a_guscio', 'soia', 'legumi'].map((t) => <Chip key={t} on={s.excludedTags.includes(t)} onClick={() => set({ excludedTags: s.excludedTags.includes(t) ? s.excludedTags.filter((x) => x !== t) : [...s.excludedTags, t] })}>{t}</Chip>)}</div>
          
        </div>
        <NumInput label="Target proteico (g/die)" value={s.proteinTargetG} onChange={(v) => set({ proteinTargetG: v })} decimals={false} />
      </section>
      <section className="card">
        <h3>Allenamento</h3>
        <NumInput label="Passo +/− del carico (kg) quando la macchina non ha incrementi registrati" value={s.loadStepKg} onChange={(v) => v && set({ loadStepKg: v })} />
        <NumInput label="Limite di tempo giornaliero (min)" value={s.dailyTimeLimitMin} onChange={(v) => set({ dailyTimeLimitMin: v })} decimals={false} />
        <Check checked={s.vibration} onChange={(v) => set({ vibration: v })}>Vibrazione a fine recupero (solo con app aperta, se supportata)</Check>
        <Check checked={s.sound} onChange={(v) => set({ sound: v })}>Suono a fine recupero (solo con app aperta)</Check>
        <Check checked={s.keepAwake} onChange={(v) => set({ keepAwake: v })}>Schermo acceso durante la seduta (se supportato)</Check>
        <Check checked={s.showE1rm} onChange={(v) => set({ showE1rm: v })}>Mostra e1RM stimato (facoltativo)</Check>
        <details><summary>Regole di progressione (avanzate)</summary>
          <NumInput label="Sedute comparabili richieste per proporre un aumento" value={s.policy.exposuresForIncrease} onChange={(v) => v && set({ policy: { ...s.policy, exposuresForIncrease: Math.max(2, Math.round(v)) } })} decimals={false} />
          <NumInput label="Salto massimo prima di proporre consolidamento (%)" value={s.policy.maxJumpPct * 100} onChange={(v) => v && set({ policy: { ...s.policy, maxJumpPct: v / 100 } })} />
          <NumInput label="RIR minimo se il target non è impostato" value={s.policy.defaultRirMin} onChange={(v) => v != null && set({ policy: { ...s.policy, defaultRirMin: v } })} decimals={false} />
          <NumInput label="Frazione per serie indirette (vuoto = disattivata)" hint="Approssimazione facoltativa, es. 0,5" value={s.indirectFraction} onChange={(v) => set({ indirectFraction: v })} />
        </details>
      </section>
      <section className="card">
        <h3>Alimentazione e calorie (avanzate)</h3>
        <details><summary>Soglie di adattamento</summary>
          <NumInput label="Ritmo minimo (% peso/settimana)" value={s.calorieRules.rateMinPct} onChange={(v) => v != null && set({ calorieRules: { ...s.calorieRules, rateMinPct: v } })} />
          <NumInput label="Ritmo massimo (% peso/settimana)" value={s.calorieRules.rateMaxPct} onChange={(v) => v != null && set({ calorieRules: { ...s.calorieRules, rateMaxPct: v } })} />
          <NumInput label="Ritocco proposto (kcal)" value={s.calorieRules.stepKcal} onChange={(v) => v && set({ calorieRules: { ...s.calorieRules, stepKcal: v } })} decimals={false} />
          <NumInput label="Giorni di diario completi richiesti su 14" value={s.calorieRules.minCompleteDiaryDays} onChange={(v) => v && set({ calorieRules: { ...s.calorieRules, minCompleteDiaryDays: v } })} decimals={false} />
          <p className="small muted">Valori iniziali prudenti (0,1–0,25%/settimana, +100 kcal) scelti come proposta operativa, non soglie ottimali dimostrate.</p>
        </details>
        <NumInput label="Obiettivo di sonno (ore)" value={s.sleepTargetH} onChange={(v) => v && set({ sleepTargetH: v })} />
        <div className="mt"><strong className="small">Giorni di preparazione pasti</strong>
          <div className="chips">{[1, 2, 3, 4, 5, 6, 7].map((w) => <Chip key={w} on={s.prepWeekdays.includes(w)} onClick={() => set({ prepWeekdays: s.prepWeekdays.includes(w) ? s.prepWeekdays.filter((x) => x !== w) : [...s.prepWeekdays, w] })}>{WEEKDAYS_SHORT[w]}</Chip>)}</div>
        </div>
        <details className="mt"><summary>Orari dei pasti per tipo di giornata</summary>
          {(Object.keys(DAYTYPE_LABEL) as DayType[]).map((dt) => (
            <div key={dt} className="card flat"><strong className="small">{DAYTYPE_LABEL[dt]}</strong>
              {s.mealWindows[dt].map((w, i) => (
                <div className="row" key={w.slot}>
                  <input type="checkbox" aria-label={`Attiva ${MEAL_LABEL[w.slot]}`} checked={w.enabled} onChange={(e) => set({ mealWindows: { ...s.mealWindows, [dt]: s.mealWindows[dt].map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)) } })} />
                  <span className="small grow">{MEAL_LABEL[w.slot]}</span>
                  <input type="time" aria-label="Dalle" value={w.from} style={{ width: 110 }} onChange={(e) => set({ mealWindows: { ...s.mealWindows, [dt]: s.mealWindows[dt].map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) } })} />
                  <input type="time" aria-label="Alle" value={w.to} style={{ width: 110 }} onChange={(e) => set({ mealWindows: { ...s.mealWindows, [dt]: s.mealWindows[dt].map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) } })} />
                </div>
              ))}
            </div>
          ))}
        </details>
      </section>
      <section className="card">
        <h3>Promemoria</h3>
        <p className="small muted">Nella versione web i promemoria compaiono dentro l'app (schermata Oggi) e si possono esportare nel calendario: le notifiche ad app chiusa non sono garantite. Nell'app Android diventano notifiche locali (soggette a permessi e risparmio energetico).</p>
        {s.reminders.map((r, i) => (
          <div key={r.id} className="card flat">
            <Check checked={r.enabled} onChange={(v) => set({ reminders: s.reminders.map((x, j) => (j === i ? { ...x, enabled: v } : x)) })}>{r.label}</Check>
            <div className="row"><input type="time" aria-label="Orario" value={r.time} style={{ width: 120 }} onChange={(e) => set({ reminders: s.reminders.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })} />
              <div className="chips">{[1, 2, 3, 4, 5, 6, 7].map((w) => <button key={w} className="chip" aria-pressed={r.weekdays.includes(w)} onClick={() => set({ reminders: s.reminders.map((x, j) => (j === i ? { ...x, weekdays: x.weekdays.includes(w) ? x.weekdays.filter((y) => y !== w) : [...x.weekdays, w] } : x)) })}>{WEEKDAYS_SHORT[w]}</button>)}</div>
            </div>
          </div>
        ))}
        <div className="grid2"><Field label="Ore silenziose dalle"><input type="time" value={s.quietFrom} onChange={(e) => set({ quietFrom: e.target.value })} /></Field><Field label="alle"><input type="time" value={s.quietTo} onChange={(e) => set({ quietTo: e.target.value })} /></Field></div>
        {isNative() && <button className="btn sm mt" onClick={async () => setNotifMsg(await syncNativeReminders(s.reminders, s.quietFrom, s.quietTo))}>Programma notifiche sul telefono</button>}
        {notifMsg && <p className="small">{notifMsg}</p>}
      </section>
      <p className="small muted">Impostazioni salvate automaticamente sul dispositivo.</p>
      {onb && <OnboardingSheet settings={s} onClose={() => { setOnb(false); toast({ text: 'Fatto' }); }} />}
    </>
  );
}

// ---------------- Installazione ----------------
function InstallScreen({ offline }: { offline: { ready: boolean; detail: string } | null }) {
  const [evt, setEvt] = useState<Event | null>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return (
    <>
      <h1>Installazione</h1>
      <div className="card">
        <p><span className={`dot ${offline?.ready ? 'ok' : 'warn'}`} /> {offline?.ready ? 'Pronta offline' : 'Offline non ancora verificato'}<br /><span className="small muted">{offline?.detail}</span></p>
        <p className="small">{isStandalone() ? 'Stai usando l\'app installata.' : 'Stai usando l\'app nel browser.'}</p>
        {evt && <button className="btn primary block" onClick={() => (evt as unknown as { prompt: () => void }).prompt()}>Installa app</button>}
      </div>
      <div className="card">
        <h3>Android (Chrome)</h3>
        <ol className="small"><li>Apri l'indirizzo HTTPS dell'app in Chrome.</li><li>Attendi "Pronta offline" (serve il primo caricamento online).</li><li>Menu ⋮ → <strong>Installa app</strong> (o "Aggiungi a schermata Home").</li><li>Apri dall'icona: funziona anche in modalità aereo.</li></ol>
      </div>
      <div className="card">
        <h3>Windows (Edge o Chrome)</h3>
        <ol className="small"><li>Apri l'indirizzo dell'app.</li><li>Icona "Installa" nella barra degli indirizzi, oppure menu → App → Installa questo sito come app.</li></ol>
      </div>
      <div className="card warn small">
        <strong>Importante</strong>
        <ul>
          <li>I dati restano sul dispositivo: PC e telefono <strong>non si sincronizzano</strong>. Per spostarli usa Backup → esporta/importa.</li>
          <li>Aprire il file index.html con doppio clic non basta: serve HTTPS o localhost.</li>
          <li>Prima di cancellare i dati del browser, disinstallare o cambiare telefono, fai un backup.</li>
          <li>Funziona offline: diario, sedute, ricette salvate, grafici, suggerimenti. Serve la rete per: nuove versioni, ricerca Open Food Facts.</li>
        </ul>
      </div>
    </>
  );
}

function InfoScreen() {
  return (
    <>
      <h1>Informazioni e limiti</h1>
      <div className="card small">
        <p>Versione {APP_VERSION} · build {__COMMIT__} · {new Date(__BUILD_DATE__).toLocaleString('it-IT')}. App personale di registrazione e organizzazione. Non è un dispositivo medico, non sostituisce medico, dietista o personal trainer e non promette risultati.</p>
        <p>Nessuna registrazione, nessun tracker, nessun invio automatico di dati. Unica richiesta di rete facoltativa: ricerca di un codice a barre su Open Food Facts, solo quando la avvii tu.</p>
      </div>
      <div className="card small">
        <h3>Non implementato in questa versione</h3>
        <ul>
          <li>Sincronizzazione tra dispositivi (usa backup/importazione).</li>
          <li>Scansione del codice a barre con la fotocamera (si digita il codice).</li>
          <li>Funzioni IA (nessuna chiave API nell'app; tutto è calcolato da regole locali).</li>
          <li>Integrazioni smartwatch / Health Connect.</li>
          <li>Notifiche ad app chiusa nella versione web (sì nell'APK Capacitor, con permessi).</li>
        </ul>
      </div>
    </>
  );
}

export { WEEKDAYS };

function SleepPlanner() {
  const settings = useSettings();
  const today = dateKey();
  const ovRow = useLiveQuery(() => db.kv.get('wakeOverrides'), []);
  const overrides = (ovRow?.value as Record<string, string | null> | undefined) ?? {};
  const w = tomorrowWake(today, settings.sleepPlan.wakeTime, overrides);
  const plan = w.time ? planSleep({ wakeDateKey: w.dateKey, wakeTime: w.time, sleepHours: settings.sleepTargetH, latencyMin: settings.sleepPlan.latencyMin, routineMin: settings.sleepPlan.routineMin }) : null;
  const setPlan = (p: Partial<Settings['sleepPlan']>) => patchSettings({ sleepPlan: { ...settings.sleepPlan, ...p } });
  return (
    <section className="hero">
      <div className="eyebrow">A che ora devi svegliarti domani?</div>
      <div className="grid2 mt">
        <Field label="Sveglia abituale"><input type="time" value={settings.sleepPlan.wakeTime ?? ''} onChange={(e) => setPlan({ wakeTime: e.target.value || null })} /></Field>
        <Field label={`Solo domani (${formatDateIt(w.dateKey)})`}><input type="time" value={w.dateKey in overrides ? overrides[w.dateKey] ?? '' : ''} onChange={(e) => db.kv.put({ key: 'wakeOverrides', value: { ...overrides, [w.dateKey]: e.target.value || null }, updatedAt: Date.now() })} /></Field>
      </div>
      <div className="grid3 mt">
        <NumInput label="Sonno desiderato (h)" value={settings.sleepTargetH} onChange={(v) => v && patchSettings({ sleepTargetH: v })} />
        <NumInput label="Per addormentarti (min)" value={settings.sleepPlan.latencyMin} onChange={(v) => v != null && setPlan({ latencyMin: v })} decimals={false} />
        <NumInput label="Routine serale (min)" value={settings.sleepPlan.routineMin} onChange={(v) => v != null && setPlan({ routineMin: v })} decimals={false} />
      </div>
      {plan ? (
        <p className="mt" style={{ fontSize: '1.1rem' }}>Routine dalle <strong>{plan.label.routine}</strong> · a letto alle <strong>{plan.label.bed}</strong> · sonno dalle {plan.label.sleep} · sveglia {plan.label.wake}</p>
      ) : <p className="muted mt">Inserisci una sveglia per calcolare gli orari.</p>}
      <p className="small muted">Pianificazione organizzativa, non una previsione dell'addormentamento. Riferimento generale per adulti: almeno 7 ore (AASM/SRS); la durata la scegli tu. Nessun ciclo fisso da 90 minuti.</p>
    </section>
  );
}
