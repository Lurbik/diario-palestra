import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import type { Muscle } from '../db/types';
import { Chip, Tabs } from '../ui/kit';
import { BodySvg, MUSCLE_VIEW, fillFor } from '../ui/visuals';
import { ALL_MUSCLES, MUSCLE_LABEL } from '../ui/labels';
import { workByMuscle, plannedByMuscle, workLabel } from '../lib/bodymap';
import { addDays, dateKey, formatDateIt } from '../lib/dates';

interface Feeling { id: string; muscle: Muscle; kind: 'indolenzimento' | 'fastidio'; level: 1 | 2 | 3; dateKey: string }

export function BodyMapTab() {
  const [view, setView] = useState<'lavoro' | 'piano' | 'sensazioni'>('lavoro');
  const [days, setDays] = useState<7 | 28>(7);
  const [sel, setSel] = useState<Muscle | null>(null);
  const today = dateKey();
  const sets = useLiveQuery(() => db.sets.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const program = useLiveQuery(() => db.programs.filter((p) => p.isActive && !p.archived).first(), []);
  const feelingsRow = useLiveQuery(() => db.kv.get('bodyFeelings'), []);
  const focusRow = useLiveQuery(() => db.kv.get('muscleFocus'), []);
  const feelings = (feelingsRow?.value as Feeling[] | undefined) ?? [];
  const focus = (focusRow?.value as Muscle[] | undefined) ?? [];
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const work = useMemo(() => workByMuscle(sets, sessions, exMap, addDays(today, -(days - 1))), [sets, sessions, exMap, today, days]);
  const planned = useMemo(() => (program ? plannedByMuscle(program.days, exMap) : new Map<Muscle, number>()), [program, exMap]);
  const recentFeel = feelings.filter((f) => f.dateKey >= addDays(today, -6));

  const values = new Map<Muscle, number>();
  for (const m of ALL_MUSCLES) {
    if (view === 'lavoro') values.set(m, work.get(m)?.direct ?? 0);
    else if (view === 'piano') values.set(m, planned.get(m) ?? 0);
    else values.set(m, recentFeel.filter((f) => f.muscle === m).reduce((a, f) => a + f.level, 0));
  }
  const max = Math.max(0, ...values.values());
  const total = [...values.values()].reduce((a, b) => a + b, 0);
  const legendTitle = view === 'lavoro' ? `Distribuzione del lavoro registrato (serie allenanti dirette, ultimi ${days} giorni)` : view === 'piano' ? 'Serie dirette previste dalla scheda attiva in una settimana tipo' : 'Sensazioni riferite negli ultimi 7 giorni (soggettive)';

  return (
    <>
      <Tabs value={view} onChange={(v) => { setView(v); setSel(null); }} items={[['lavoro', 'Lavoro registrato'], ['piano', 'Piano'], ['sensazioni', 'Sensazioni']]} />
      {view === 'lavoro' && <div className="chips"><Chip on={days === 7} onClick={() => setDays(7)}>7 giorni</Chip><Chip on={days === 28} onClick={() => setDays(28)}>28 giorni</Chip></div>}
      <div className="card mt">
        <p className="small"><strong>{legendTitle}</strong></p>
        {total === 0 ? (
          <p className="muted">{view === 'lavoro' ? 'Nessun allenamento registrato nel periodo.' : view === 'piano' ? 'Nessuna scheda attiva: niente da mostrare.' : 'Nessuna sensazione registrata. Tocca un muscolo per aggiungerne una.'}</p>
        ) : null}
        <div className="grid2">
          <BodySvg view="front" label="Vista anteriore, tocca un muscolo" values={values} selected={sel} onSelect={setSel} />
          <BodySvg view="back" label="Vista posteriore, tocca un muscolo" values={values} selected={sel} onSelect={setSel} />
        </div>
        <div className="legend mt" aria-hidden>
          <span><i style={{ background: fillFor(0, 1) }} />0</span>
          <span><i style={{ background: fillFor(1, 3) }} />poco</span>
          <span><i style={{ background: fillFor(2, 3) }} />medio</span>
          <span><i style={{ background: fillFor(3, 3) }} />di più (max {max})</span>
        </div>
        <p className="small muted mt">I colori indicano quantità di {view === 'sensazioni' ? 'segnalazioni' : 'serie'}, non sviluppo, forza o qualità di un muscolo. "Meno lavoro" non significa "poco sviluppato".</p>
      </div>
      {sel && <MusclePanel m={sel} view={view} work={work.get(sel)} planned={planned.get(sel) ?? 0} feelings={recentFeel.filter((f) => f.muscle === sel)} focus={focus.includes(sel)}
        onFocus={(on) => kvSet('muscleFocus', on ? [...new Set([...focus, sel])] : focus.filter((x) => x !== sel))}
        onFeel={(kind, level) => kvSet('bodyFeelings', [...feelings, { id: `${Date.now()}`, muscle: sel, kind, level, dateKey: today }].slice(-200))}
        exNames={(ids) => ids.map((i) => exMap.get(i)?.name ?? i)} />}
      <details className="card flat">
        <summary>Elenco accessibile di tutti i muscoli</summary>
        <ul className="list">{ALL_MUSCLES.map((m) => (
          <li key={m}><button className="listbtn" onClick={() => setSel(m)}><span>{MUSCLE_LABEL[m]} <span className="small muted">({MUSCLE_VIEW[m] === 'front' ? 'davanti' : 'dietro'})</span></span>
            <span className="small">{view === 'lavoro' ? workLabel(work.get(m)) : view === 'piano' ? `${planned.get(m) ?? 0} serie previste` : `${recentFeel.filter((f) => f.muscle === m).length} segnalazioni`}{focus.includes(m) ? ' · focus' : ''}</span></button></li>
        ))}</ul>
      </details>
    </>
  );
}

function MusclePanel({ m, view, work, planned, feelings, focus, onFocus, onFeel, exNames }: {
  m: Muscle; view: string; work: ReturnType<typeof workByMuscle> extends Map<Muscle, infer W> ? W | undefined : never; planned: number;
  feelings: Feeling[]; focus: boolean; onFocus: (on: boolean) => void; onFeel: (k: Feeling['kind'], l: Feeling['level']) => void; exNames: (ids: string[]) => string[];
}) {
  return (
    <section className="card accent" aria-live="polite">
      <h3>{MUSCLE_LABEL[m]}</h3>
      <p className="small">{workLabel(work)}{work?.lastDate ? ` · ultimo lavoro ${formatDateIt(work.lastDate)}` : ''}</p>
      {work && work.exercises.size > 0 && <p className="small muted">Esercizi: {exNames([...work.exercises]).join(', ')}</p>}
      <p className="small">Previste dalla scheda: {planned} serie dirette a settimana.</p>
      <label className="check small"><input type="checkbox" checked={focus} onChange={(e) => onFocus(e.target.checked)} /> Voglio dare priorità estetica a questo muscolo (preferenza tua, non una valutazione dell'app)</label>
      {view === 'sensazioni' && (
        <div className="mt">
          <p className="small">Aggiungi una sensazione di oggi (soggettiva, non una diagnosi):</p>
          <div className="chips">
            {([1, 2, 3] as const).map((l) => <button key={l} className="chip" onClick={() => onFeel('indolenzimento', l)}>Indolenzimento {['', 'lieve', 'medio', 'forte'][l]}</button>)}
            <button className="chip danger" aria-pressed={false} onClick={() => onFeel('fastidio', 2)}>Fastidio</button>
          </div>
          {feelings.length > 0 && <ul className="small">{feelings.map((f) => <li key={f.id}>{formatDateIt(f.dateKey)}: {f.kind} {f.kind === 'indolenzimento' ? ['', 'lieve', 'medio', 'forte'][f.level] : ''}</li>)}</ul>}
          <p className="small muted">L'app non calcola una "percentuale di recupero". Se il fastidio persiste o peggiora, valuta un parere qualificato.</p>
        </div>
      )}
    </section>
  );
}
