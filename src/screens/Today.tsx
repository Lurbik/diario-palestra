import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import { Chip, Icon, go, useNow, useSettings } from '../ui/kit';
import { DAYTYPE_LABEL, MEAL_LABEL, type DayType } from '../db/settings';
import { dateKey, formatDateIt, timeHM, weekdayOf, WEEKDAYS, daysBetween } from '../lib/dates';
import { sumNutrients } from '../lib/nutrition';
import { fmtNum } from '../lib/id';
import { OnboardingSheet } from './Onboarding';
import { WeightSheet } from './WeightSheet';
import { PainBanner } from './Workout';
import { sessionTimes } from '../lib/workout';
import { formatDuration } from '../lib/dates';
import type { MealSlot } from '../db/types';

export function TodayScreen({ offline }: { offline: { ready: boolean; detail: string } | null }) {
  const settings = useSettings();
  const now = useNow(30000);
  const today = dateKey(now);
  const hm = timeHM(now);
  const [sheet, setSheet] = useState<null | 'onboarding' | 'weight'>(null);
  const active = useLiveQuery(() => db.sessions.where('status').equals('active').first(), []);
  const program = useLiveQuery(() => db.programs.filter((p) => p.isActive).first(), []);
  const pain = useLiveQuery(() => db.pain.where('status').equals('active').first(), []);
  const diary = useLiveQuery(() => db.diary.where('dateKey').equals(today).toArray(), [today]) ?? [];
  const plan = useLiveQuery(() => db.plan.where('dateKey').equals(today).toArray(), [today]) ?? [];
  const batches = useLiveQuery(() => db.batches.filter((b) => b.servingsLeft > 0).toArray(), []) ?? [];
  const weightToday = useLiveQuery(() => db.weights.where('dateKey').equals(today).count(), [today]) ?? 0;
  const target = useLiveQuery(() => db.targets.orderBy('effectiveFrom').filter((t) => t.effectiveFrom <= today).last(), [today]);
  const dayTypeRow = useLiveQuery(() => db.kv.get(`dayType:${today}`), [today]);
  const doneToday = useLiveQuery(() => db.sessions.where('dateKey').equals(today).filter((s) => s.status === 'done').count(), [today]) ?? 0;

  const wd = weekdayOf(today);
  const day = program?.days.find((d) => d.weekday === wd) ?? null;
  const dayType: DayType = (dayTypeRow?.value as DayType) ?? (day ? 'palestra_pomeriggio' : 'riposo');
  const windows = settings.mealWindows[dayType].filter((w) => w.enabled);
  const consumed = sumNutrients(diary.map((d) => d.nutrients));
  const loggedSlots = new Set(diary.map((d) => d.meal));
  const currentWindow = windows.find((w) => hm >= w.from && hm <= w.to) ?? null;
  const nextWindow = windows.find((w) => w.from > hm) ?? null;

  // 1. Prossima azione utile (una sola)
  let next: { text: string; action: () => void; cta: string } | null = null;
  if (active) next = { text: `Seduta in corso: ${active.title} (attiva ${formatDuration(sessionTimes(active, now).active)})`, cta: 'Riprendi', action: () => go('allenamento/seduta') };
  else if (!settings.prefillConfirmed || !settings.onboardingDone) next = { text: 'Conferma i dati iniziali (1 minuto). Il diario funziona anche senza.', cta: 'Apri', action: () => setSheet('onboarding') };
  else if (currentWindow && !loggedSlots.has(currentWindow.slot)) {
    const ready = batches.length > 0 && (currentWindow.slot === 'pranzo' || currentWindow.slot === 'cena');
    next = { text: ready ? `${MEAL_LABEL[currentWindow.slot]} pronto: registra la porzione` : `${MEAL_LABEL[currentWindow.slot]}: registralo quando mangi`, cta: 'Registra', action: () => go(`cibo/diario/${currentWindow.slot}`) };
  } else if (!weightToday && hm < '11:00') next = { text: 'Pesata del mattino (facoltativa)', cta: 'Registra peso', action: () => setSheet('weight') };
  else if (nextWindow) next = { text: `Prossimo: ${MEAL_LABEL[nextWindow.slot]} verso le ${nextWindow.from}`, cta: 'Diario', action: () => go('cibo') };

  // 4. Al massimo due suggerimenti motivati
  const tips: { text: string; why: string; href?: string }[] = [];
  const lastBackup = settings.lastBackupAt;
  if ((lastBackup == null || daysBetween(dateKey(lastBackup), today) >= 14) && (doneToday > 0 || diary.length > 0)) tips.push({ text: 'Fai un backup', why: lastBackup ? `L'ultimo risale a ${daysBetween(dateKey(lastBackup), today)} giorni fa.` : 'I dati sono solo su questo dispositivo e il browser potrebbe cancellarli.', href: '#/altro/backup' });
  if (settings.observationStart && !target && daysBetween(settings.observationStart, today) < 14) tips.push({ text: 'Fase di osservazione', why: `Giorno ${daysBetween(settings.observationStart, today) + 1} di ~14: registra pasti e pesate senza target calorico; dopo potrai calibrare.` });
  const reminders = settings.reminders.filter((r) => r.enabled && r.weekdays.includes(wd) && r.time <= hm);
  for (const r of reminders) if (tips.length < 2) tips.push({ text: r.label, why: `Promemoria delle ${r.time}` });

  return (
    <main className="main">
      <div className="eyebrow">{formatDateIt(today, true)}</div>
      <h1>Oggi</h1>

      {next && (
        <div className="card accent">
          <div className="eyebrow">Prossima azione</div>
          <p style={{ fontSize: '1.15rem', fontWeight: 600 }}>{next.text}</p>
          <button className="btn primary block" onClick={next.action}>{next.cta}</button>
        </div>
      )}

      {pain && <PainBanner pain={pain} />}

      <div className="card">
        <div className="eyebrow">Allenamento · {WEEKDAYS[wd]}</div>
        {pain ? <p>In pausa per dolore.</p>
          : doneToday ? <p>Seduta registrata oggi ✓</p>
          : day ? <><h3>{day.name}</h3><p className="small muted">{day.items.length} esercizi · limite {settings.dailyTimeLimitMin ?? '—'} min</p><button className="btn block" onClick={() => go('allenamento')}>Vai all'allenamento</button></>
          : <p>Riposo.</p>}
        <div className="chips mt" role="group" aria-label="Fascia della giornata">
          {(Object.keys(DAYTYPE_LABEL) as DayType[]).map((k) => <Chip key={k} on={dayType === k} onClick={() => kvSet(`dayType:${today}`, k)}>{DAYTYPE_LABEL[k]}</Chip>)}
        </div>
        <p className="small muted">Gli orari dei pasti si adattano alla fascia scelta (finestre organizzative, non obblighi).</p>
      </div>

      <div className="card">
        <div className="eyebrow">Alimentazione registrata</div>
        <div className="grid2 mt">
          <Metric label="Energia" value={consumed.values.kcal} unit="kcal" target={target?.kcal ?? null} incomplete={consumed.incomplete.kcal} />
          <Metric label="Proteine" value={consumed.values.protein} unit="g" target={settings.proteinTargetG ?? target?.proteinG ?? null} incomplete={consumed.incomplete.protein} />
        </div>
        <p className="small muted mt">Consumo confermato. {plan.length ? `Pianificati oggi: ${plan.length} pasti (non contati finché non li registri).` : ''}{!target?.kcal ? ' Nessun target calorico impostato.' : ''}</p>
        <div className="row wrap">
          <button className="btn sm" onClick={() => go('cibo')}>Diario</button>
          <button className="btn sm" onClick={() => setSheet('weight')}>Registra peso</button>
        </div>
        <MealDots windows={windows.map((w) => w.slot)} logged={loggedSlots} />
      </div>

      {tips.slice(0, 2).map((t) => (
        <div className="card flat" key={t.text}>
          <strong>{t.text}</strong>
          <p className="small muted">{t.why}</p>
          {t.href && <a className="btn sm" href={t.href}>Apri</a>}
        </div>
      ))}

      <p className="pill-status mt"><span className={`dot ${offline?.ready ? 'ok' : 'warn'}`} />{offline?.ready ? 'Pronta offline' : `Offline non ancora verificato${offline?.detail ? ': ' + offline.detail : ''}`}</p>

      {sheet === 'onboarding' && <OnboardingSheet settings={settings} onClose={() => setSheet(null)} />}
      {sheet === 'weight' && <WeightSheet onClose={() => setSheet(null)} />}
    </main>
  );
}

function Metric({ label, value, unit, target, incomplete }: { label: string; value: number | null; unit: string; target: number | null; incomplete: boolean }) {
  const pct = target && value != null ? Math.min(100, (value / target) * 100) : null;
  return (
    <div>
      <div className="small muted">{label}</div>
      <div className="big num">{fmtNum(value ?? 0, 0)}<span className="small muted"> {unit}</span></div>
      <div className="small muted">{target ? `target ${fmtNum(target, 0)} ${unit}` : 'nessun target'}{incomplete ? ' · dati mancanti' : ''}</div>
      {pct != null && <div className="meter mt" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} rispetto al target`}><div style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}

function MealDots({ windows, logged }: { windows: MealSlot[]; logged: Set<MealSlot> }) {
  return (
    <div className="chips mt" aria-label="Pasti registrati oggi">
      {windows.map((w) => <span key={w} className={`badge ${logged.has(w) ? 'ok' : ''}`}>{logged.has(w) ? <Icon.check /> : null}{MEAL_LABEL[w]}</span>)}
    </div>
  );
}
