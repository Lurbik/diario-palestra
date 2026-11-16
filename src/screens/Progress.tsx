import { weightConfounders } from '../lib/supplements';
import { sessionContext } from '../lib/coach';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import type { Exercise, Session, SetEntry, TargetVersion } from '../db/types';
import { Check, Chip, Field, Icon, LineChart, NumInput, Sheet, Tabs, go, useSettings, useToast } from '../ui/kit';
import { dailyWeights, movingAverage, proposeCalories, dataQuality, proteinReference, mifflinStJeor, intakeStats } from '../lib/calories';
import { suggestProgression, e1rmEpley, progressionReps, type Exposure, type Suggestion } from '../lib/progression';
import { detectStall } from '../lib/stall';
import { configKey, setsPerMuscle } from '../lib/workout';
import { addDays, dateKey, formatDateIt, weekStart } from '../lib/dates';
import { fmtNum, uid } from '../lib/id';
import { MUSCLE_LABEL } from '../ui/labels';
import { WeightSheet } from './WeightSheet';
import { patchSettings } from '../db/bootstrap';
import { BodyMapTab } from './BodyMap';
import { loadWriteFor } from '../lib/loadDecision';

export function ProgressScreen({ route }: { route: string[] }) {
  const sub = (route[1] as 'peso' | 'allenamento' | 'muscoli' | 'recupero') || 'peso';
  return (
    <main className="main">
      <h1>Progressi</h1>
      <Tabs value={sub} onChange={(v) => go(`progressi/${v}`)} items={[['peso', 'Peso'], ['allenamento', 'Esercizi'], ['muscoli', 'Muscoli'], ['recupero', 'Sonno']]} />
      {sub === 'peso' && <WeightTab />}
      {sub === 'allenamento' && <TrainingTab />}
      {sub === 'muscoli' && <BodyMapTab />}
      {sub === 'recupero' && <RecoveryTab />}
    </main>
  );
}

// ---------------- Peso e calorie ----------------
function WeightTab() {
  const settings = useSettings();
  const toast = useToast();
  const today = dateKey();
  const weights = useLiveQuery(() => db.weights.orderBy('dateKey').toArray(), []) ?? [];
  const waist = useLiveQuery(() => db.waist.orderBy('dateKey').reverse().toArray(), []) ?? [];
  const targets = useLiveQuery(() => db.targets.orderBy('effectiveFrom').toArray(), []) ?? [];
  const completeRows = useLiveQuery(() => db.kv.where('key').startsWith('diaryComplete:').toArray(), []) ?? [];
  const from14 = addDays(today, -13);
  const diary14 = useLiveQuery(() => db.diary.where('dateKey').between(from14, today, true, true).toArray(), [from14, today]) ?? [];
  const [sheet, setSheet] = useState<null | 'weight' | 'target' | 'waist'>(null);
  const [waistCm, setWaistCm] = useState<number | null>(null);
  // Periodi in cui il peso non è interpretabile per le calorie (es. prime 4 settimane di creatina)
  const suppLog = (useLiveQuery(() => db.kv.get('supplementLog'), [])?.value as { id: string; start: string }[] | undefined) ?? [];
  const confounders = weightConfounders(suppLog, addDays);
  const completeDays = completeRows.filter((r) => r.value === true).map((r) => r.key.split(':')[1]);
  const daily = dailyWeights(weights);
  const ma = movingAverage(daily, 7);
  const target = targets.filter((t) => t.effectiveFrom <= today).at(-1) ?? null;
  // Solo giorni dichiarati completi con tutte le kcal note: mancante ≠ zero, giorno vuoto ≠ 0 kcal.
  const intake = intakeStats(diary14, completeDays, from14, today);
  const avgIntake = intake.avgKcal;
  const proposal = proposeCalories({ weights, completeDiaryDays: intake.usableDays, avgIntakeKcal: avgIntake, targetKcal: target?.kcal ?? null, lastTargetChange: target ? target.effectiveFrom : null, today, rules: settings.calorieRules, goal: settings.profile.goal ?? undefined, confounders });
  const q = dataQuality(weights, intake.usableDays, today, settings.calorieRules);
  const lastKg = daily.at(-1)?.kg ?? settings.profile.declaredWeightKg;
  const ref = lastKg ? proteinReference(lastKg) : null;
  const weeks = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const d of daily) m.set(weekStart(d.dateKey), [...(m.get(weekStart(d.dateKey)) ?? []), d.kg]);
    return [...m.entries()].map(([w, v]) => ({ w, avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length })).reverse().slice(0, 8);
  }, [daily]);

  const decide = async (decision: 'accepted' | 'kept' | 'postponed') => {
    await db.decisions.add({ id: uid(), at: Date.now(), scope: 'calories', refId: target?.id ?? null, ruleId: proposal.kind, decision, detail: proposal.title, reviewAfter: addDays(today, 14) });
    if (decision === 'accepted' && proposal.deltaKcal && target?.kcal) {
      await db.targets.add({ id: uid(), createdAt: Date.now(), effectiveFrom: today, kcal: target.kcal + proposal.deltaKcal, proteinG: target.proteinG, mode: 'calibrated', reason: proposal.title + ' — ' + proposal.reasons.join(' ') });
      toast({ text: `Nuovo target ${target.kcal + proposal.deltaKcal} kcal da oggi ✓` });
    } else toast({ text: 'Decisione registrata ✓' });
  };

  return (
    <>
      <div className="row wrap"><button className="btn primary" onClick={() => setSheet('weight')}>Registra peso</button><button className="btn" onClick={() => setSheet('waist')}>Circonferenza vita</button></div>
      <div className="card mt">
        <div className="eyebrow">Andamento del peso</div>
        <LineChart yLabel="kg" series={[{ name: 'pesate', points: daily.map((d) => ({ x: d.dateKey, y: d.kg })), dots: true }, { name: 'media mobile 7 giorni', points: ma.map((d) => ({ x: d.dateKey, y: d.avg })) }]} />
        <p className="small muted">Linea grigia: pesate · linea blu: media mobile 7 giorni. Le singole pesate oscillano per acqua, glicogeno e contenuto intestinale.</p>
        {weeks.length > 0 && (
          <table className="t mt"><thead><tr><th>Settimana dal</th><th>Media</th><th>Pesate</th></tr></thead>
            <tbody>{weeks.map((w) => <tr key={w.w}><td>{formatDateIt(w.w)}</td><td className="num">{fmtNum(w.avg, 2)} kg</td><td>{w.n}</td></tr>)}</tbody></table>
        )}
      </div>

      <div className="card">
        <div className="eyebrow">Target</div>
        {target ? <p><strong>{target.kcal != null ? `${target.kcal} kcal/die` : 'Calorie non impostate'}</strong>{target.proteinG ? ` · ${target.proteinG} g proteine` : ''}<br /><span className="small muted">dal {formatDateIt(target.effectiveFrom)} · {({ manual: 'manuale', professional: 'da professionista', formula: 'stima da formula', calibrated: 'calibrato' } as const)[target.mode]} · {target.reason}</span></p>
          : <p className="small">Nessun target calorico. {settings.observationStart ? `Fase di osservazione dal ${formatDateIt(settings.observationStart)}: registra pasti e pesate per ~14 giorni prima di calibrare.` : 'Puoi osservare ~14 giorni o inserire un target consapevole.'}</p>}
        {ref && <p className="small muted">Riferimento proteico informativo a {fmtNum(lastKg, 1)} kg: 1,6–2,2 g/kg ≈ {ref.low}–{ref.high} g/die. Target scelto: {settings.proteinTargetG ? `${settings.proteinTargetG} g` : 'non impostato'}.</p>}
        <button className="btn sm" onClick={() => setSheet('target')}>Imposta target</button>
      </div>

      <div className="card">
        <div className="eyebrow">Proposta calorie (regole spiegabili)</div>
        <h3>{proposal.title}</h3>
        <ul className="small">{proposal.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        <details><summary>Qualità dei dati</summary>
          <ul className="small"><li>Storico peso: {q.spanDays} giorni</li><li>Pesate ultime due settimane: {q.weighInsByWeek.join(' e ')}</li><li>Giorni completi con valori noti (14 gg): {q.completeDays}{intake.unknownDays.length ? ` · ${intake.unknownDays.length} esclusi per valori mancanti` : ''}{intake.emptyDays.length ? ` · ${intake.emptyDays.length} senza voci (non contati come 0)` : ''}</li><li>Consumo medio nei giorni completi: {avgIntake != null ? `${Math.round(avgIntake)} kcal` : '—'}</li></ul>
          <p className="small muted">Soglie di qualità del dato configurabili, non validazione scientifica. Nessun calcolo "7700 kcal per kg".</p>
        </details>
        {(proposal.kind === 'increase' || proposal.kind === 'decrease') && (
          <div className="row wrap mt"><button className="btn sm primary" onClick={() => decide('accepted')}>Accetta</button><button className="btn sm" onClick={() => decide('kept')}>Mantieni</button><button className="btn sm" onClick={() => setSheet('target')}>Modifica</button></div>
        )}
        {proposal.kind === 'postpone' && <div className="row wrap mt"><button className="btn sm" onClick={() => decide('postponed')}>Rinvia la decisione</button></div>}
      </div>

      {waist.length > 0 && (
        <div className="card"><div className="eyebrow">Circonferenza vita</div>
          <ul className="list">{waist.slice(0, 6).map((w) => <li key={w.id} className="row between small"><span>{formatDateIt(w.dateKey, true)}</span><span className="num">{fmtNum(w.cm, 1)} cm</span></li>)}</ul>
        </div>
      )}
      <WeightList />
      {sheet === 'weight' && <WeightSheet onClose={() => setSheet(null)} />}
      {sheet === 'target' && <TargetSheet current={target} onClose={() => setSheet(null)} lastKg={lastKg ?? null} />}
      {sheet === 'waist' && (
        <Sheet title="Circonferenza vita" onClose={() => setSheet(null)}>
          <div className="col">
            <NumInput label="cm (stesse condizioni ogni settimana)" value={waistCm} onChange={setWaistCm} />
            <button className="btn primary block" disabled={!waistCm} onClick={async () => { await db.waist.add({ id: uid(), dateKey: dateKey(), cm: waistCm!, note: '' }); setSheet(null); toast({ text: 'Salvato ✓' }); }}>Salva</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function WeightList() {
  const weights = useLiveQuery(() => db.weights.orderBy('dateKey').reverse().limit(30).toArray(), []) ?? [];
  if (!weights.length) return <p className="empty">Nessuna pesata. Pesate facoltative 3–7 a settimana, al mattino in condizioni simili quando possibile.</p>;
  return (
    <details className="card flat"><summary>Ultime pesate</summary>
      <ul className="list">{weights.map((w) => (
        <li key={w.id} className="row between small">
          <span>{formatDateIt(w.dateKey, true)} {w.time}<br /><span className="muted">{w.conditions}{w.flags.length ? ` · ${w.flags.join(', ')}` : ''}{w.note ? ` · ${w.note}` : ''}</span></span>
          <span className="row"><span className="num">{fmtNum(w.kg, 1)} kg</span><button className="iconbtn" aria-label="Elimina pesata" onClick={() => db.weights.delete(w.id)}><Icon.trash /></button></span>
        </li>
      ))}</ul>
    </details>
  );
}

function TargetSheet({ current, onClose, lastKg }: { current: TargetVersion | null; onClose: () => void; lastKg: number | null }) {
  const settings = useSettings();
  const toast = useToast();
  const [mode, setMode] = useState<TargetVersion['mode']>('manual');
  const [kcal, setKcal] = useState<number | null>(current?.kcal ?? null);
  const [prot, setProt] = useState<number | null>(settings.proteinTargetG);
  const [reason, setReason] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | null>(settings.profile.sex);
  const [act, setAct] = useState<number | null>(null);
  const est = mode === 'formula' && sex && act && lastKg && settings.profile.heightCm && settings.profile.age
    ? mifflinStJeor({ kg: lastKg, cm: settings.profile.heightCm, age: settings.profile.age, sex, activity: act }) : null;
  return (
    <Sheet title="Imposta target" onClose={onClose}>
      <div className="col">
        <div className="chips">
          <Chip on={mode === 'manual'} onClick={() => setMode('manual')}>Manuale</Chip>
          <Chip on={mode === 'professional'} onClick={() => setMode('professional')}>Da professionista</Chip>
          <Chip on={mode === 'formula'} onClick={() => setMode('formula')}>Stima da formula</Chip>
        </div>
        {mode === 'formula' && (
          <div className="card flat">
            <p className="small">Formula Mifflin-St Jeor × fattore di attività scelto da te. È solo un punto di partenza con ampia incertezza (±15% mostrato), da calibrare con diario e trend del peso.</p>
            <div className="chips"><Chip on={sex === 'M'} onClick={() => setSex('M')}>Maschio</Chip><Chip on={sex === 'F'} onClick={() => setSex('F')}>Femmina</Chip></div>
            <p className="small muted">Dato richiesto solo perché la formula lo usa.</p>
            <Field label="Fattore di attività (scegli tu)">
              <select value={act ?? ''} onChange={(e) => setAct(e.target.value ? Number(e.target.value) : null)}>
                <option value="">—</option><option value="1.4">1,4 — sedentario + allenamenti</option><option value="1.55">1,55 — moderatamente attivo</option><option value="1.7">1,7 — molto attivo</option>
              </select>
            </Field>
            {est && <p>Stima: ~{Math.round(est.tdee)} kcal (intervallo {Math.round(est.low)}–{Math.round(est.high)}). Peso usato: {fmtNum(lastKg, 1)} kg.</p>}
            {est && <button className="btn sm" onClick={() => setKcal(Math.round(est.tdee / 50) * 50)}>Usa come punto di partenza</button>}
          </div>
        )}
        <NumInput label="Calorie/die" hint="Lascia vuoto per non impostarle" value={kcal} onChange={setKcal} decimals={false} />
        <NumInput label="Proteine g/die" value={prot} onChange={setProt} decimals={false} />
        <Field label="Motivo / fonte"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === 'professional' ? 'es. indicato dal dietista il …' : 'es. scelta consapevole dopo osservazione'} /></Field>
        <p className="small muted">Le calorie dell'allenamento non vengono stimate né aggiunte al budget (evita il doppio conteggio). Il target cambia al massimo una volta ogni 2 settimane secondo le regole di adattamento.</p>
        <button className="btn primary block" onClick={async () => {
          await db.targets.add({ id: uid(), createdAt: Date.now(), effectiveFrom: dateKey(), kcal, proteinG: prot, mode, reason: reason || (mode === 'formula' ? 'Stima iniziale da formula, da calibrare' : 'Inserito dall\'utente') });
          await patchSettings({ proteinTargetG: prot, profile: { ...settings.profile, sex } });
          toast({ text: 'Target salvato (versione registrata) ✓' }); onClose();
        }}>Salva target</button>
      </div>
    </Sheet>
  );
}

// ---------------- Allenamento ----------------
function TrainingTab() {
  const settings = useSettings();
  const toast = useToast();
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), []) ?? [];
  const sets = useLiveQuery(() => db.sets.toArray(), []) ?? [];
  const machines = useLiveQuery(() => db.machines.toArray(), []) ?? [];
  const programs = useLiveQuery(() => db.programs.toArray(), []) ?? [];
  const pain = useLiveQuery(() => db.pain.where('status').equals('active').count(), []) ?? 0;
  const decisions = useLiveQuery(() => db.decisions.filter((d) => d.scope === 'exercise').toArray(), []) ?? [];
  const [indirect, setIndirect] = useState(false);
  const [detail, setDetail] = useState<{ ex: Exercise; exps: Exposure[] } | null>(null);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const done = new Map(sessions.map((s) => [s.id, s]));
  // Sedute con notte molto breve, dolore o "ho meno tempo": escluse dallo stallo (mai prova contro la scheda)
  const sleepRows = useLiveQuery(() => db.sleep.toArray(), []) ?? [];
  const stallCtx = sessionContext(sessions, sleepRows);
  const active = programs.find((p) => p.isActive);

  const byConfig = useMemo(() => {
    const m = new Map<string, Exposure[]>();
    const bySess = new Map<string, SetEntry[]>();
    for (const s of sets) if (done.has(s.sessionId)) bySess.set(`${s.configKey}§${s.sessionId}`, [...(bySess.get(`${s.configKey}§${s.sessionId}`) ?? []), s]);
    for (const [k, list] of bySess) {
      const [ck, sid] = k.split('§');
      const ses = done.get(sid)!;
      m.set(ck, [...(m.get(ck) ?? []), { sessionId: sid, dateKey: ses.dateKey, startedAt: ses.startedAt, sets: list.sort((a, b) => a.order - b.order) }]);
    }
    for (const v of m.values()) v.sort((a, b) => a.startedAt - b.startedAt);
    return m;
  }, [sets, sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const week = weekStart(dateKey());
  const weekSets = sets.filter((s) => { const ses = done.get(s.sessionId); return ses && ses.dateKey >= week; });
  const vol = setsPerMuscle(weekSets, exMap);

  const cards = exercises.map((ex) => {
    const exps = byConfig.get(configKey(ex)) ?? [];
    if (!exps.length) return null;
    const item = active?.days.flatMap((d) => d.items).find((i) => i.exerciseId === ex.id);
    const mach = machines.find((m) => m.id === ex.machineId);
    const sug = suggestProgression({ exposures: exps, target: { sets: item?.sets ?? null, repMin: item?.repMin ?? null, repMax: item?.repMax ?? null, rirTargets: item?.rirTargets ?? [] }, increments: mach?.increments ?? [], activePain: pain > 0, policy: settings.policy });
    const stall = detectStall(exps, { context: stallCtx });
    return { ex, exps, sug, stall };
  }).filter(Boolean) as { ex: Exercise; exps: Exposure[]; sug: Suggestion; stall: ReturnType<typeof detectStall> }[];

  const [modify, setModify] = useState<{ ex: Exercise; sug: Suggestion } | null>(null);
  const [modLoad, setModLoad] = useState<number | null>(null);
  const decide = async (ex: Exercise, sug: Suggestion, decision: 'accepted' | 'kept' | 'modified', chosen?: number | null) => {
    const now = Date.now();
    const w = loadWriteFor(sug, decision, now, chosen);
    const key = `acceptedLoad:${configKey(ex)}`;
    const prevAccepted = (await db.kv.get(key))?.value ?? null;
    await db.decisions.add({ id: uid(), at: now, scope: 'exercise', refId: configKey(ex), ruleId: sug.ruleId, decision,
      detail: `${sug.title}${w.action === 'set' ? ` → ${fmtNum(w.value.load, 2)} kg` : ''}${prevAccepted ? ` (prima: ${JSON.stringify(prevAccepted)})` : ''}`, reviewAfter: addDays(dateKey(), 14) });
    if (w.action === 'set') await kvSet(key, w.value);
    if (w.action === 'clear') await db.kv.delete(key);
    toast({ text: w.action === 'set' ? `Applicato: ${fmtNum(w.value.load, 2)} kg verranno precompilati (da confermare) nella prossima seduta` : w.action === 'clear' ? `Mantieni ${fmtNum(sug.currentLoad ?? null, 2)} kg: nessun carico cambiato` : 'Decisione registrata, nessun carico modificato' });
  };

  return (
    <>
      <div className="card">
        <div className="eyebrow">Serie allenanti questa settimana (dal {formatDateIt(week)})</div>
        {!weekSets.length ? <p className="small muted">Nessuna serie registrata questa settimana.</p> : (
          <table className="t"><thead><tr><th>Muscolo</th><th>Dirette</th><th>Indirette</th>{indirect && settings.indirectFraction != null && <th>Totale approx.</th>}</tr></thead>
            <tbody>{[...new Set([...vol.direct.keys(), ...vol.indirect.keys()])].map((m) => (
              <tr key={m}><td>{MUSCLE_LABEL[m]}</td><td className="num">{vol.direct.get(m) ?? 0}</td><td className="num">{vol.indirect.get(m) ?? 0}</td>
                {indirect && settings.indirectFraction != null && <td className="num">≈ {fmtNum((vol.direct.get(m) ?? 0) + (vol.indirect.get(m) ?? 0) * settings.indirectFraction, 1)}</td>}</tr>
            ))}</tbody></table>
        )}
        {settings.indirectFraction != null && <Check checked={indirect} onChange={setIndirect}>Mostra conversione delle indirette (× {fmtNum(settings.indirectFraction, 2)})</Check>}
        <p className="small muted">Conteggio orientativo per muscoli principali/secondari, non misura esatta dello stimolo. La conversione delle indirette è un'approssimazione facoltativa (Impostazioni).</p>
      </div>
      {pain > 0 && <div className="banner warn small"><Icon.alert /> Pausa per dolore attiva: nessuna proposta di aumento.</div>}
      {!cards.length && <p className="empty">I suggerimenti compaiono dopo aver registrato sedute. I carichi dichiarati nella scheda non contano come storico.</p>}
      {cards.map(({ ex, exps, sug, stall }) => {
        const last = decisions.filter((d) => d.refId === configKey(ex)).sort((a, b) => b.at - a.at)[0];
        return (
          <div className="card" key={ex.id}>
            <div className="row between"><strong>{ex.name}</strong><span className="small muted">{exps.length} sedute · v{ex.configVersion}</span></div>
            <p className={`badge ${sug.kind === 'increase' ? 'ok' : sug.kind === 'pain_stop' ? 'danger' : sug.kind === 'review' || sug.kind === 'consolidate' ? 'warn' : ''}`}>{sug.title}</p>
            <p className="small">{sug.reason}</p>
            <details><summary>Dati usati e limiti</summary>
              <div className="small"><strong>Dato personale osservato:</strong><ul>{sug.dataUsed.map((d, i) => <li key={i}>{d}</li>)}</ul>
                <strong>Euristica dell'app:</strong> doppia progressione con soglie configurabili ({settings.policy.exposuresForIncrease} sedute, salto max {fmtNum(settings.policy.maxJumpPct * 100, 0)}%).<br />
                <strong>Limiti:</strong><ul>{sug.limits.map((d, i) => <li key={i}>{d}</li>)}</ul>
                <strong>Stallo:</strong> {stall.title}. {stall.reasons.join(' ')}{stall.checklist.length > 0 && <ol>{stall.checklist.map((c) => <li key={c}>{c.replace(/^\d\.\s/, '')}</li>)}</ol>}
              </div>
            </details>
            {sug.kind === 'increase' && sug.proposedLoad != null && (
              <div className="row wrap mt">
                <button className="btn sm primary" onClick={() => decide(ex, sug, 'accepted')}>Applica {fmtNum(sug.proposedLoad, 2)} kg</button>
                <button className="btn sm" onClick={() => decide(ex, sug, 'kept')}>Mantieni {fmtNum(sug.currentLoad ?? null, 2)} kg</button>
                <button className="btn sm" onClick={() => { setModify({ ex, sug }); setModLoad(sug.currentLoad ?? null); }}>Scegli io</button>
              </div>
            )}
            {sug.kind === 'consolidate' && (
              <div className="row wrap mt">
                <button className="btn sm primary" onClick={() => decide(ex, sug, 'kept')}>Mantieni {fmtNum(sug.currentLoad ?? null, 2)} kg</button>
                <button className="btn sm" onClick={() => { setModify({ ex, sug }); setModLoad(sug.currentLoad ?? null); }}>Scegli io</button>
              </div>
            )}
            {sug.kind === 'review' && (
              <div className="row wrap mt"><button className="btn sm" onClick={() => decide(ex, sug, 'kept')}>Ho rivisto, mantieni</button></div>
            )}
            {last && <p className="small muted mt">Ultima decisione: {({ accepted: 'accettata', kept: 'mantenuto', modified: 'modificata', postponed: 'rinviata' })[last.decision]} il {new Date(last.at).toLocaleDateString('it-IT')} ({last.detail}).</p>}
            <button className="btn sm ghost" onClick={() => setDetail({ ex, exps })}>Storico e grafico</button>
          </div>
        );
      })}
      {detail && <ExerciseHistory ex={detail.ex} exps={detail.exps} showE1rm={settings.showE1rm} onClose={() => setDetail(null)} />}
      {modify && (
        <Sheet title={`Carico per ${modify.ex.name}`} onClose={() => setModify(null)}>
          <NumInput label="Carico da precompilare nella prossima seduta (kg)" value={modLoad} onChange={setModLoad} />
          <p className="small muted">Vale solo per questa configurazione ed è sempre da confermare con "Salva serie". La scheda non cambia.</p>
          <button className="btn primary block" disabled={!modLoad} onClick={async () => { await decide(modify.ex, modify.sug, 'modified', modLoad); setModify(null); }}>Salva scelta</button>
        </Sheet>
      )}
    </>
  );
}

function ExerciseHistory({ ex, exps, showE1rm, onClose }: { ex: Exercise; exps: Exposure[]; showE1rm: boolean; onClose: () => void }) {
  const first = (e: Exposure) => e.sets.find((s) => s.kind === 'working');
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <p className="small muted">Solo sedute con la stessa configurazione (macchina, ROM, convenzione). Cambi di setup avviano uno storico separato.</p>
      <LineChart yLabel="rip. valide (1ª serie)" series={[{ name: 'ripetizioni valide', points: exps.map((e) => ({ x: e.dateKey, y: progressionReps(first(e)!) ?? 0 })), dots: true }]} />
      <LineChart yLabel="kg (1ª serie)" series={[{ name: 'carico', points: exps.filter((e) => first(e)?.load != null).map((e) => ({ x: e.dateKey, y: first(e)!.load! })), dots: true }]} />
      <table className="t">
        <thead><tr><th>Data</th><th>Serie allenanti</th>{showE1rm && <th>e1RM*</th>}</tr></thead>
        <tbody>{[...exps].reverse().map((e) => {
          const ws = e.sets.filter((s) => s.kind === 'working');
          const best = Math.max(...ws.map((s) => e1rmEpley(s.load, progressionReps(s)) ?? 0));
          return <tr key={e.sessionId}><td>{formatDateIt(e.dateKey)}</td><td className="small">{ws.map((s) => `${fmtNum(s.load, 2)}×${s.validReps ?? '?'}${s.rir != null ? ` R${s.rir}` : ''}${s.extraPartials ? ` +${s.extraPartials}p` : ''}`).join(', ')}</td>{showE1rm && <td className="num">{best ? fmtNum(best, 1) : '—'}</td>}</tr>;
        })}</tbody>
      </table>
      {showE1rm && <p className="small muted">*e1RM stimato con Epley (carico × (1 + rip/30)) su 1–12 ripetizioni valide: stima facoltativa, non confrontabile tra esercizi diversi e non un invito a provare massimali.</p>}
    </Sheet>
  );
}

// ---------------- Sonno e sedute (correlazioni descrittive) ----------------
function RecoveryTab() {
  const sleep = useLiveQuery(() => db.sleep.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('done').sortBy('startedAt'), []) ?? [];
  const sets = useLiveQuery(() => db.sets.toArray(), []) ?? [];
  const sleepByDate = new Map(sleep.map((s) => [s.dateKey, s.sleepHours]));
  // Esito di ogni seduta: per esercizio, ripetizioni valide totali a parità di carico vs esposizione precedente
  const outcome = useMemo(() => sessionOutcomes(sessions, sets), [sessions, sets]);
  const groups = [['< 6 h', (h: number) => h < 6], ['6–7 h', (h: number) => h >= 6 && h < 7], ['≥ 7 h', (h: number) => h >= 7]] as const;
  const recent = outcome.slice(-3);
  const hard = recent.length === 3 && recent.every((o) => o.worse > o.better);
  return (
    <>
      {hard && <div className="card warn"><strong>Più sedute recenti più difficili</strong><p className="small">Nelle ultime 3 sedute sono prevalsi peggioramenti a parità di carico. Prima di cambiare la scheda, rivedi sonno, stress, alimentazione, tempo disponibile e malessere. Una notte breve non modifica automaticamente nulla; l'app non diagnostica sovrallenamento.</p></div>}
      <div className="card">
        <div className="eyebrow">Sonno della notte precedente e esito delle sedute</div>
        <table className="t"><thead><tr><th>Sonno</th><th>Sedute</th><th>Esercizi migliorati / uguali / peggiorati</th></tr></thead>
          <tbody>{groups.map(([label, fn]) => {
            const os = outcome.filter((o) => { const h = sleepByDate.get(o.dateKey); return h != null && fn(h); });
            return <tr key={label}><td>{label}</td><td>{os.length}</td><td className="num">{os.reduce((a, o) => a + o.better, 0)} / {os.reduce((a, o) => a + o.same, 0)} / {os.reduce((a, o) => a + o.worse, 0)}</td></tr>;
          })}</tbody></table>
        <p className="small muted">Descrizione dei tuoi dati, non un rapporto di causa-effetto: con pochi dati le differenze possono essere casuali. Il sonno si registra in Altro → Sonno (la data è quella del risveglio).</p>
      </div>
    </>
  );
}

export function sessionOutcomes(sessions: Session[], sets: SetEntry[]) {
  const lastByConfig = new Map<string, { load: number; reps: number }>();
  const out: { dateKey: string; better: number; same: number; worse: number }[] = [];
  for (const s of sessions) {
    const mine = sets.filter((x) => x.sessionId === s.id && x.kind === 'working');
    const byCk = new Map<string, SetEntry[]>();
    for (const x of mine) byCk.set(x.configKey, [...(byCk.get(x.configKey) ?? []), x]);
    let better = 0, same = 0, worse = 0;
    for (const [ck, list] of byCk) {
      const load = list[0].load;
      const reps = list.reduce((a, x) => a + (progressionReps(x) ?? 0), 0);
      const prev = lastByConfig.get(ck);
      if (prev && load != null && list.every((x) => x.load === load)) {
        if (load > prev.load) better++;
        else if (load === prev.load) { if (reps > prev.reps) better++; else if (reps === prev.reps) same++; else worse++; }
      }
      if (load != null) lastByConfig.set(ck, { load, reps });
    }
    out.push({ dateKey: s.dateKey, better, same, worse });
  }
  return out;
}
