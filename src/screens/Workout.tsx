import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { PainEpisode, Program, SetEntry } from '../db/types';
import { Check, Chip, Field, Icon, NumInput, Sheet, go, useSettings, useToast } from '../ui/kit';
import { SessionScreen, SetForm, fromSet, type FormState } from './Session';
import { updateSet, deleteSet } from '../lib/workout';
import { ProgramsScreen, ProgramEditor } from './Programs';
import { CatalogScreen, ExerciseEditor, MachineEditor } from './Catalog';
import { ExercisePage } from './ExercisePage';
import { estimateItemMin, sessionTimes, startSession, discardSession } from '../lib/workout';
import { dateKey, formatDateIt, formatDuration, weekdayOf, WEEKDAYS } from '../lib/dates';
import { describeSet } from '../ui/labels';
import { painSafety } from '../lib/safety';
import { uid } from '../lib/id';

export function WorkoutScreen({ route }: { route: string[] }) {
  const sub = route[1] ?? '';
  if (sub === 'seduta') return <SessionScreen />;
  if (sub === 'schede') return <ProgramsScreen />;
  if (sub === 'scheda' && route[2]) return <ProgramEditor id={route[2]} />;
  if (sub === 'catalogo') return <CatalogScreen />;
  if (sub === 'esercizio' && route[2] && route[3] === 'modifica') return <ExerciseEditor id={route[2]} />;
  if (sub === 'esercizio' && route[2]) return <ExercisePage id={route[2]} />;
  if (sub === 'macchina' && route[2]) return <MachineEditor id={route[2]} />;
  if (sub === 'storico' && route[2]) return <SessionDetail id={route[2]} />;
  if (sub === 'storico') return <HistoryScreen />;
  if (sub === 'dolore') return <PainScreen />;
  return <WorkoutHome />;
}

function WorkoutHome() {
  const settings = useSettings();
  const toast = useToast();
  const active = useLiveQuery(() => db.sessions.where('status').equals('active').first(), []);
  const programs = useLiveQuery(() => db.programs.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const pain = useLiveQuery(() => db.pain.where('status').equals('active').first(), []);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const program = programs.find((p) => p.isActive) ?? null;
  const today = dateKey();
  const wd = weekdayOf(today);
  const todayDay = program?.days.find((d) => d.weekday === wd) ?? null;
  const [dayId, setDayId] = useState<string | null>(null);
  const day = program?.days.find((d) => d.id === (dayId ?? todayDay?.id)) ?? null;
  const [reduced, setReduced] = useState(false);
  const [limit, setLimit] = useState<number | null>(null);
  const [confirmPain, setConfirmPain] = useState(false);
  const timeLimit = limit ?? settings.dailyTimeLimitMin;

  const plan = useMemo(() => {
    if (!day) return { skip: [] as string[], est: 0, canReduce: false };
    const est = day.items.reduce((a, it) => a + estimateItemMin(it), 0);
    const canReduce = settings.reducedTimePrioritiesConfirmed && day.items.every((it) => it.priority != null);
    if (!reduced || !canReduce || timeLimit == null) return { skip: [], est, canReduce };
    const byPrio = [...day.items].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    let acc = 0; const keep = new Set<string>();
    for (const it of byPrio) { const m = estimateItemMin(it); if (acc + m <= timeLimit || keep.size === 0) { keep.add(it.id); acc += m; } }
    return { skip: day.items.filter((it) => !keep.has(it.id)).map((it) => it.id), est, canReduce };
  }, [day, reduced, timeLimit, settings.reducedTimePrioritiesConfirmed]);

  const start = async (free = false) => {
    await startSession({
      program: free ? null : program, dayId: free ? null : day?.id ?? null, title: free ? 'Seduta libera' : undefined,
      reducedTime: reduced && plan.canReduce, timeLimitMin: timeLimit, skipItemIds: plan.skip
    });
    go('allenamento/seduta');
  };
  const tryStart = (free = false) => { if (pain && !confirmPain) { setConfirmPain(true); toast({ text: 'Pausa per dolore attiva: conferma di nuovo per avviare comunque.', kind: 'info' }); return; } start(free); };

  return (
    <main className="main">
      <h1>Allenamento</h1>
      {active && (
        <div className="card accent">
          <div className="eyebrow">Seduta in corso</div>
          <h3>{active.title}</h3>
          <p className="small muted">Iniziata alle {new Date(active.startedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · attiva {formatDuration(sessionTimes(active).active)}</p>
          <button className="btn primary block" onClick={() => go('allenamento/seduta')}>Riprendi seduta</button>
        </div>
      )}
      {pain && <PainBanner pain={pain} />}
      {!active && (
        <div className="card">
          <div className="eyebrow">{WEEKDAYS[wd]}</div>
          {!program ? <p>Nessuna scheda attiva. <a href="#/allenamento/schede">Scegli una scheda</a>.</p> : (
            <>
              <h3>{day ? day.name : 'Riposo'}{!dayId && todayDay ? '' : day ? ' (scelto)' : ''}</h3>
              <p className="small muted">{program.name}</p>
              <Field label="Giorno della scheda">
                <select value={day?.id ?? ''} onChange={(e) => setDayId(e.target.value || null)}>
                  <option value="">{todayDay ? `Oggi: ${todayDay.name}` : 'Oggi: riposo'}</option>
                  {program.days.map((d) => <option key={d.id} value={d.id}>{d.weekday ? WEEKDAYS[d.weekday] + ' — ' : ''}{d.name}</option>)}
                </select>
              </Field>
              {day && (
                <>
                  <ul className="list mt">
                    {day.items.map((it) => (
                      <li key={it.id} className="row between small" style={{ opacity: plan.skip.includes(it.id) ? 0.45 : 1 }}>
                        <span>{exMap.get(it.exerciseId)?.name ?? it.exerciseId}{plan.skip.includes(it.id) && ' — saltato (tempo ridotto)'}</span>
                        <span className="muted nowrap">{it.sets ?? '?'}×{it.repMin ?? '?'}{it.repMax && it.repMax !== it.repMin ? '–' + it.repMax : ''}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="small muted">Stima ~{Math.round(plan.est)} min (recuperi inclusi, non compressi){timeLimit ? ` · limite ${timeLimit} min` : ''}.</p>
                  <details>
                    <summary>Tempo disponibile oggi</summary>
                    <NumInput label="Limite di oggi (minuti)" value={timeLimit} onChange={setLimit} decimals={false} />
                    <div className="mt">
                      <Chip on={reduced} onClick={() => setReduced(!reduced)}>Modalità tempo ridotto</Chip>
                    </div>
                    {reduced && !plan.canReduce && <p className="small">Per usarla, conferma prima le priorità degli esercizi nella <a href={`#/allenamento/scheda/${program.id}`}>scheda</a>. La modalità salta gli esercizi a priorità più bassa: non aumenta intensità, cedimento o densità e non accorcia recuperi o riscaldamento.</p>}
                  </details>
                </>
              )}
              <div className="col mt">
                {day && <button className="btn primary xl block" onClick={() => tryStart(false)}>{confirmPain ? 'Avvia comunque' : `Inizia ${day.name}`}</button>}
                <button className="btn block" onClick={() => tryStart(true)}>Seduta libera</button>
              </div>
            </>
          )}
        </div>
      )}
      <div className="card flat">
        <ul className="list">
          <li><a className="listbtn" href="#/allenamento/storico"><span>Storico sedute</span><Icon.right /></a></li>
          <li><a className="listbtn" href="#/allenamento/schede"><span>Schede e template</span><Icon.right /></a></li>
          <li><a className="listbtn" href="#/allenamento/catalogo"><span>Esercizi e macchine</span><Icon.right /></a></li>
          <li><a className="listbtn" href="#/allenamento/dolore"><span>Dolore e pausa</span><Icon.right /></a></li>
        </ul>
      </div>
    </main>
  );
}

export function PainBanner({ pain }: { pain: PainEpisode }) {
  const s = painSafety(pain);
  return (
    <div className={`card ${s.level === 'urgent' ? 'danger' : 'warn'}`}>
      <div className="row"><Icon.alert /><strong>{s.level === 'urgent' ? 'Valutazione medica urgente' : 'Pausa per dolore attiva'}</strong></div>
      {s.level !== 'none' ? <p>{s.message}</p> : (
        <p className="small">Autodescrizione: “{pain.selfDescription || pain.area}”. Gli allenamenti saltati per dolore non sono fallimenti né volume da recuperare. Nessun invito ad aumentare il carico finché la pausa è attiva.</p>
      )}
      <a className="btn sm" href="#/allenamento/dolore">Aggiorna o gestisci</a>
    </div>
  );
}

function HistoryScreen() {
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('done').reverse().sortBy('startedAt'), []) ?? [];
  const counts = useLiveQuery(async () => {
    const all = await db.sets.toArray();
    const m = new Map<string, number>();
    for (const s of all) if (s.kind === 'working') m.set(s.sessionId, (m.get(s.sessionId) ?? 0) + 1);
    return m;
  }, []) ?? new Map();
  return (
    <main className="main">
      <a href="#/allenamento" className="small">‹ Allenamento</a>
      <h1>Storico sedute</h1>
      {!sessions.length && <p className="empty">Nessuna seduta registrata. La scheda dichiarata non genera sedute: lo storico parte dalla prima seduta che registri.</p>}
      <ul className="list">
        {sessions.map((s) => (
          <li key={s.id}><a className="listbtn" href={`#/allenamento/storico/${s.id}`}>
            <span><strong>{formatDateIt(s.dateKey, true)}</strong> · {s.title}<br /><span className="small muted">{counts.get(s.id) ?? 0} serie allenanti · attiva {formatDuration(sessionTimes(s).active)}{s.painReported ? ' · dolore segnalato' : ''}</span></span>
            <Icon.right />
          </a></li>
        ))}
      </ul>
    </main>
  );
}

function SessionDetail({ id }: { id: string }) {
  const toast = useToast();
  const s = useLiveQuery(() => db.sessions.get(id), [id]);
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(id).sortBy('order'), [id]) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const [edit, setEdit] = useState<SetEntry | null>(null);
  const [del, setDel] = useState(false);
  if (!s) return <main className="main"><p className="muted">Seduta non trovata.</p></main>;
  const t = sessionTimes(s);
  const groups = new Map<number, SetEntry[]>();
  for (const x of sets) groups.set(x.itemIndex, [...(groups.get(x.itemIndex) ?? []), x]);
  return (
    <main className="main">
      <a href="#/allenamento/storico" className="small">‹ Storico</a>
      <h1>{s.title}</h1>
      <p className="muted">{formatDateIt(s.dateKey, true)} · inizio {new Date(s.startedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}{s.endedAt ? ` · fine ${new Date(s.endedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
      <p className="small">Durata attiva {formatDuration(t.active)} · totale {formatDuration(t.total)}{t.paused ? ` · pause ${formatDuration(t.paused)}` : ''}</p>
      {s.notes && <p className="card flat small">{s.notes}</p>}
      {[...groups.entries()].map(([i, list]) => {
        const ex = exMap.get(list[0].exerciseId);
        return (
          <div className="card" key={i}>
            <h3>{ex?.name ?? list[0].exerciseId}</h3>
            {list.map((x) => (
              <div className="setline" key={x.id}>
                <div className="small"><strong>{x.kind === 'warmup' ? 'Risc.' : '#' + x.order}</strong> {describeSet(x)}{x.restBeforeSec != null && <span className="muted"> · {formatDuration(x.restBeforeSec * 1000)} dalla serie prima</span>}{x.pain && <span className="badge danger"> dolore</span>}{x.notes && <><br /><span className="muted">{x.notes}</span></>}</div>
                <button className="iconbtn" aria-label="Modifica serie" onClick={() => setEdit(x)}><Icon.edit /></button>
              </div>
            ))}
          </div>
        );
      })}
      {!sets.length && <p className="empty">Nessuna serie.</p>}
      <button className="btn danger block mt" onClick={() => setDel(true)}><Icon.trash /> Elimina seduta</button>
      {edit && <EditSetSheetLazy set={edit} onClose={() => setEdit(null)} />}
      {del && (
        <Sheet title="Eliminare la seduta?" onClose={() => setDel(false)}>
          <p>Verranno eliminate la seduta e le sue {sets.length} serie. L'operazione non è annullabile (fai un backup se serve).</p>
          <div className="grid2"><button className="btn" onClick={() => setDel(false)}>Annulla</button><button className="btn danger" onClick={async () => { await discardSession(id); toast({ text: 'Seduta eliminata' }); go('allenamento/storico'); }}>Elimina</button></div>
        </Sheet>
      )}
    </main>
  );
}

function EditSetSheetLazy({ set, onClose }: { set: SetEntry; onClose: () => void }) {
  const ex = useLiveQuery(() => db.exercises.get(set.exerciseId), [set.exerciseId]);
  const machine = useLiveQuery(async () => (ex?.machineId ? db.machines.get(ex.machineId) : undefined), [ex?.machineId]);
  const settings = useSettings();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => fromSet(set));
  if (!ex) return null;
  return (
    <Sheet title="Modifica serie" onClose={onClose}>
      <SetForm form={form} setForm={(f) => f && setForm(f)} ex={ex} machine={machine} loadStep={settings.loadStepKg} title="Serie salvata" repStart={null} />
      <div className="grid2">
        <button className="btn danger" onClick={async () => { await deleteSet(set.id); toast({ text: 'Serie eliminata' }); onClose(); }}>Elimina</button>
        <button className="btn primary" onClick={async () => {
          const full = form.fullReps ?? 0;
          try {
            await updateSet(set.id, {
              kind: form.kind, load: form.load, fullReps: full, validReps: form.conform === 'all' ? full : form.conform === 'unknown' ? null : Math.min(form.validReps ?? 0, full),
              fullRepsOtherSide: ex.unilateral ? form.otherSide : null, rir: form.rirUnknown ? null : form.rir, rirUnknown: form.rirUnknown,
              plannedPartials: form.plannedPartials ?? 0, extraPartials: form.extraPartials ?? 0, assistedReps: form.assistedReps ?? 0, failedAttempts: form.failedAttempts ?? 0,
              pain: form.pain, painNote: form.painNote, techIssue: form.techIssue, notes: form.notes
            });
            toast({ text: 'Modifica salvata ✓' }); onClose();
          } catch (e) { toast({ text: `Modifica NON salvata: ${e instanceof Error ? e.message : e}`, kind: 'error' }); }
        }}>Salva</button>
      </div>
    </Sheet>
  );
}

// ---------------- Dolore e pausa ----------------
const emptyPain = (): PainEpisode => ({
  id: uid(), area: '', selfDescription: '', startDate: null, symptoms: '', intensity: null, limitsActivities: null, worsening: null,
  redFlags: { perineal: false, bladderBowel: false, legWeakness: false }, professionalNotes: '', status: 'active', resume: null, createdAt: Date.now(), log: []
});

function PainScreen() {
  const toast = useToast();
  const active = useLiveQuery(() => db.pain.where('status').equals('active').first(), []);
  const closed = useLiveQuery(() => db.pain.where('status').equals('closed').toArray(), []) ?? [];
  const [draft, setDraft] = useState<PainEpisode | null>(null);
  const [note, setNote] = useState('');
  const [noteInt, setNoteInt] = useState<number | null>(null);
  const [resume, setResume] = useState(false);
  const [resumeNotes, setResumeNotes] = useState('');
  const [resumeCheck, setResumeCheck] = useState(false);
  const ep = draft ?? active ?? null;
  const safety = ep ? painSafety(ep) : null;
  const up = (p: Partial<PainEpisode>) => ep && setDraft({ ...ep, ...p });

  return (
    <main className="main">
      <a href="#/allenamento" className="small">‹ Allenamento</a>
      <h1>Dolore e pausa</h1>
      <p className="small muted">Le informazioni restano su questo dispositivo e non vengono condivise. L'app non fa diagnosi, non stima tempi di guarigione e non genera esercizi riabilitativi o terapie.</p>
      {safety && safety.level !== 'none' && (
        <div className={`card ${safety.level === 'urgent' ? 'danger' : 'warn'}`} role="alert"><strong>{safety.level === 'urgent' ? 'Valutazione URGENTE' : 'Serve una valutazione sanitaria'}</strong><p>{safety.message}</p></div>
      )}
      {!ep && (
        <div className="card">
          <p>Nessun episodio attivo.</p>
          <button className="btn primary block" onClick={() => setDraft(emptyPain())}>Registra un episodio di dolore</button>
        </div>
      )}
      {ep && (
        <div className="card">
          <div className="col">
            <Field label="Zona"><input value={ep.area} onChange={(e) => up({ area: e.target.value })} placeholder="es. zona lombare" /></Field>
            <Field label="Come lo descrivi (autodescrizione)"><input value={ep.selfDescription} onChange={(e) => up({ selfDescription: e.target.value })} /></Field>
            <Field label="Data di inizio" hint="Inseriscila tu se la conosci; l'app non la deduce."><input type="date" value={ep.startDate ?? ''} onChange={(e) => up({ startDate: e.target.value || null })} /></Field>
            <Field label="Sintomi"><textarea value={ep.symptoms} onChange={(e) => up({ symptoms: e.target.value })} /></Field>
            <NumInput label="Intensità percepita 0–10 (facoltativa)" value={ep.intensity} onChange={(v) => up({ intensity: v == null ? null : Math.max(0, Math.min(10, v)) })} decimals={false} />
            <Check checked={!!ep.limitsActivities} onChange={(v) => up({ limitsActivities: v })}>Limita le attività quotidiane</Check>
            <Check checked={!!ep.worsening} onChange={(v) => up({ worsening: v })}>Sta peggiorando rapidamente</Check>
            <fieldset className="card flat" style={{ margin: 0 }}>
              <legend className="small"><strong>Segnali d'allarme</strong></legend>
              <Check checked={ep.redFlags.perineal} onChange={(v) => up({ redFlags: { ...ep.redFlags, perineal: v } })}>Perdita di sensibilità nella zona perineale/genitale</Check>
              <Check checked={ep.redFlags.bladderBowel} onChange={(v) => up({ redFlags: { ...ep.redFlags, bladderBowel: v } })}>Nuove alterazioni di vescica o intestino</Check>
              <Check checked={ep.redFlags.legWeakness} onChange={(v) => up({ redFlags: { ...ep.redFlags, legWeakness: v } })}>Debolezza importante o progressiva alle gambe</Check>
            </fieldset>
            <Field label="Annotazioni del professionista"><textarea value={ep.professionalNotes} onChange={(e) => up({ professionalNotes: e.target.value })} /></Field>
            {draft && <button className="btn primary block" onClick={async () => { await db.pain.put(draft); setDraft(null); toast({ text: 'Salvato ✓ — modalità pausa attiva' }); }}>Salva</button>}
          </div>
        </div>
      )}
      {active && !draft && (
        <>
          <div className="card">
            <h3>Diario dei sintomi</h3>
            <Field label="Aggiornamento"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Com'è oggi?" /></Field>
            <div className="mt"><NumInput label="Intensità 0–10 (facoltativa)" value={noteInt} onChange={setNoteInt} decimals={false} /></div>
            <button className="btn block mt" disabled={!note && noteInt == null} onClick={async () => {
              await db.pain.update(active.id, { log: [...active.log, { at: Date.now(), note, intensity: noteInt }], intensity: noteInt ?? active.intensity });
              setNote(''); setNoteInt(null); toast({ text: 'Aggiornamento salvato ✓' });
            }}>Aggiungi</button>
            <ul className="list mt">{[...active.log].reverse().map((l) => <li key={l.at} className="small">{new Date(l.at).toLocaleString('it-IT')} — {l.note}{l.intensity != null ? ` (${l.intensity}/10)` : ''}</li>)}</ul>
          </div>
          <div className="card">
            <h3>Ripresa graduale</h3>
            <p className="small">Nessun conto alla rovescia: la ripresa la confermi tu, idealmente dopo averne parlato con un professionista. Alla ripresa i carichi abituali non vengono riproposti automaticamente.</p>
            {!resume ? <button className="btn block" onClick={() => setResume(true)}>Conferma la ripresa…</button> : (
              <div className="col">
                <Field label="Indicazioni ricevute / note"><textarea value={resumeNotes} onChange={(e) => setResumeNotes(e.target.value)} /></Field>
                <Check checked={resumeCheck} onChange={setResumeCheck}>Ho valutato la ripresa e non ho segnali d'allarme</Check>
                <button className="btn primary block" disabled={!resumeCheck || safety?.level === 'urgent'} onClick={async () => {
                  await db.pain.update(active.id, { status: 'closed', resume: { confirmedAt: Date.now(), notes: resumeNotes } });
                  setResume(false); toast({ text: 'Ripresa confermata. Riparti calibrando i carichi in palestra.' });
                }}>Chiudi la pausa</button>
              </div>
            )}
          </div>
          <button className="btn block" onClick={() => setDraft(active)}><Icon.edit /> Modifica dati episodio</button>
        </>
      )}
      {closed.length > 0 && (
        <details className="mt"><summary>Episodi chiusi ({closed.length})</summary>
          <ul className="list">{closed.map((c) => <li key={c.id} className="small">{c.area} — {c.selfDescription}{c.resume ? ` · ripresa ${new Date(c.resume.confirmedAt).toLocaleDateString('it-IT')}` : ''}</li>)}</ul>
        </details>
      )}
      <p className="small muted mt">Fonte generale: <a href="https://www.nhs.uk/conditions/back-pain/" target="_blank" rel="noreferrer">NHS — mal di schiena</a> (informativa, non sostituisce una visita).</p>
    </main>
  );
}

export type { Program };
