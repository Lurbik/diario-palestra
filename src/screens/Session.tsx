import { useEffect, useMemo, useRef, useState } from 'react';
import { emptyPain, painLabel, urgentSigns, ZONE_LABEL, SIDE_LABEL, type PainDetail, type PainZone, type PainSide } from '../lib/painReport';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvGet, kvSet } from '../db/db';
import type { Exercise, Machine, Session, SessionItem, SetEntry } from '../db/types';
import { Chip, Icon, Sheet, Stepper, go, useNow, useSettings, useToast, NumInput, Check, Field } from '../ui/kit';
import { CONVENTION_LABEL, describeSet, totalLoadNote } from '../ui/labels';
import { configKey, deleteSet, discardSession, finishSession, previousPerformance, restState, saveSet, sessionTimes, togglePause, updateSet, estimateItemMin, type SetDraft } from '../lib/workout';
import { formatDateIt, formatDuration } from '../lib/dates';
import { uid } from '../lib/id';
import { setUnsaved } from '../lib/pwa';
import { SessionTools } from './SessionTools';
import { CompareEntry, type CompareField } from './SessionCompare';
import { MachineButton } from './MachinePicker';
import { prefillLoad } from '../lib/loadDecision';

export interface FormState {
  id: string;
  kind: 'warmup' | 'working';
  load: number | null;
  loadPrefilledFrom: string | null; // es. "seduta del 2 nov" — solo indicazione
  fullReps: number | null;
  conform: 'all' | 'some' | 'unknown';
  validReps: number | null;
  rir: number | null;
  rirUnknown: boolean;
  pain: boolean;
  painNote: string;
  painDetail?: PainDetail | null;
  plannedPartials: number | null;
  extraPartials: number | null;
  assistedReps: number | null;
  failedAttempts: number | null;
  otherSide: number | null;
  techIssue: boolean;
  notes: string;
}

const emptyForm = (load: number | null, from: string | null, kind: 'warmup' | 'working' = 'working'): FormState => ({
  id: uid(), kind, load, loadPrefilledFrom: from, fullReps: null, conform: 'all', validReps: null, rir: null, rirUnknown: false, pain: false,
  painNote: '', plannedPartials: null, extraPartials: null, assistedReps: null, failedAttempts: null, otherSide: null, techIssue: false, notes: ''
});

const isDirty = (f: FormState) => f.fullReps != null || f.rir != null || f.rirUnknown || f.pain || !!f.notes || f.extraPartials != null || f.plannedPartials != null;

function toDraft(f: FormState, s: Session, ex: Exercise, itemIndex: number): SetDraft {
  const full = f.fullReps ?? 0;
  return {
    id: f.id, sessionId: s.id, exerciseId: ex.id, itemIndex, kind: f.kind, load: f.load, loadConvention: ex.loadConvention,
    unilateral: ex.unilateral, romType: ex.romType, fullReps: full,
    validReps: f.conform === 'all' ? full : f.conform === 'unknown' ? null : Math.min(f.validReps ?? 0, full),
    fullRepsOtherSide: ex.unilateral ? f.otherSide : null,
    plannedPartials: f.plannedPartials ?? 0, extraPartials: f.extraPartials ?? 0, assistedReps: f.assistedReps ?? 0, failedAttempts: f.failedAttempts ?? 0,
    rir: f.rirUnknown ? null : f.rir, rirUnknown: f.rirUnknown, pain: f.pain, painNote: f.painNote, painDetail: f.pain ? f.painDetail ?? null : null, techIssue: f.techIssue, notes: f.notes
  };
}

export function fromSet(s: SetEntry): FormState {
  return {
    id: s.id, kind: s.kind, load: s.load, loadPrefilledFrom: null, fullReps: s.fullReps,
    conform: s.validReps == null ? 'unknown' : s.validReps === s.fullReps ? 'all' : 'some', validReps: s.validReps,
    rir: s.rir, rirUnknown: s.rirUnknown, pain: s.pain, painNote: s.painNote, painDetail: s.painDetail ?? null, plannedPartials: s.plannedPartials || null, extraPartials: s.extraPartials || null,
    assistedReps: s.assistedReps || null, failedAttempts: s.failedAttempts || null, otherSide: s.fullRepsOtherSide, techIssue: s.techIssue, notes: s.notes
  };
}

export function SessionScreen() {
  const session = useLiveQuery(() => db.sessions.where('status').equals('active').first(), []);
  const loaded = session !== undefined;
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  if (!loaded || !exercises) {
    return <main className="main"><p className="muted">Caricamento…</p></main>;
  }
  if (!session) {
    return (
      <main className="main">
        <h1>Nessuna seduta attiva</h1>
        <button className="btn primary block" onClick={() => go('allenamento')}>Vai ad Allenamento</button>
      </main>
    );
  }
  return <ActiveSession session={session} exercises={new Map(exercises.map((e) => [e.id, e]))} />;
}

function ActiveSession({ session, exercises }: { session: Session; exercises: Map<string, Exercise> }) {
  const settings = useSettings();
  const toast = useToast();
  const now = useNow(1000);
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(session.id).sortBy('order'), [session.id]) ?? [];
  const pain = useLiveQuery(() => db.pain.where('status').equals('active').first(), []);
  const idx = Math.min(session.currentIndex, Math.max(0, session.items.length - 1));
  const item: SessionItem | undefined = session.items[idx];
  const ex = item ? exercises.get(item.exerciseId) : undefined;
  const machine = useLiveQuery(async () => (ex?.machineId ? db.machines.get(ex.machineId) : undefined), [ex?.machineId]);
  const ck = ex ? configKey(ex) : '';
  // Ogni lettura porta con sé la configurazione a cui appartiene: durante il cambio di esercizio
  // useLiveQuery restituisce ancora il risultato precedente, che NON deve finire nella precompilazione.
  const prevQ = useLiveQuery(async () => ({ ck, v: ck ? await previousPerformance(ck, session.id) : null }), [ck, session.id]);
  const accQ = useLiveQuery(async () => ({ ck, v: ck ? await kvGet<{ load: number; at: number } | null>(`acceptedLoad:${ck}`, null) : null }), [ck]);
  const prev = prevQ && prevQ.ck === ck ? prevQ.v : undefined;
  const accepted = accQ && accQ.ck === ck ? accQ.v : undefined;
  const itemSets = sets.filter((s) => s.itemIndex === idx);
  // Dolore segnalato oggi su questo esercizio: niente proposte di carico più alto sul movimento
  const painHere = [...itemSets].reverse().find((s) => s.pain);
  const working = itemSets.filter((s) => s.kind === 'working');
  const times = sessionTimes(session, now);
  const rest = restState(session, now);
  const [sheet, setSheet] = useState<null | 'list' | 'finish' | 'add' | { edit: SetEntry }>(null);

  // --- Bozza del modulo, persistita in IndexedDB e ripristinata dopo chiusura/blocco schermo ---
  // La bozza è legata anche alla macchina/configurazione: cambiando macchina si riparte dallo storico di quella.
  const draftKey = `draft:${session.id}:${idx}:${ck}`;
  // Lo stato del modulo è legato alla chiave della bozza: cambiando esercizio non si "trascina" il modulo precedente.
  const [fs, setFs] = useState<{ key: string; form: FormState | null; loaded: boolean }>({ key: '', form: null, loaded: false });
  const form = fs.key === draftKey ? fs.form : null;
  const draftLoaded = fs.key === draftKey && fs.loaded;
  const setForm = (f: FormState | null) => setFs({ key: draftKey, form: f, loaded: true });
  const [saving, setSaving] = useState(false);
  const [painOpen, setPainOpen] = useState(false);
  // Campo attivo del pannello di confronto: si riparte da "Complete" a ogni serie e a ogni esercizio
  const [field, setField] = useState<CompareField>('reps');
  useEffect(() => { setField('reps'); }, [draftKey]);
  const lastSavedFor = useRef<string>('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await kvGet<FormState | null>(draftKey, null);
      if (alive) setFs({ key: draftKey, form: saved, loaded: true });
    })();
    return () => { alive = false; };
  }, [draftKey]);

  // Prefill del carico (solo carico, con indicazione) quando non c'è bozza.
  useEffect(() => {
    if (!draftLoaded || form || !ex) return;
    const lastHere = [...itemSets].reverse().find((s) => s.load != null && s.configKey === ck);
    if (!lastHere && (prev === undefined || accepted === undefined)) return;
    const pw = prev?.sets.find((s) => s.kind === 'working' && s.load != null);
    const pf = prefillLoad({
      lastHereLoad: lastHere?.load ?? null,
      previous: prev ? { startedAt: prev.startedAt, dateLabel: formatDateIt(prev.dateKey), firstWorkingLoad: pw?.load ?? null } : null,
      accepted: accepted ?? null
    });
    setForm(emptyForm(pf.load, pf.from));
  }, [draftLoaded, form, ex, prev, accepted, itemSets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form || fs.key !== draftKey) return;
    const dirty = isDirty(form);
    setUnsaved('set-form', dirty);
    const t = setTimeout(() => { kvSet(draftKey, form).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [form, draftKey, fs.key]);
  useEffect(() => () => setUnsaved('set-form', false), []);

  // --- Schermo acceso facoltativo (Wake Lock, dove supportato) ---
  useEffect(() => {
    if (!settings.keepAwake || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => { try { lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen'); } catch { /* non supportato o negato */ } };
    req();
    const vis = () => { if (document.visibilityState === 'visible') req(); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release().catch(() => {}); };
  }, [settings.keepAwake]);

  // --- Fine recupero: vibrazione/suono facoltativi, solo con app visibile ---
  const notified = useRef<number>(0);
  useEffect(() => {
    if (!rest?.done || !session.rest || notified.current === session.rest.startedAt) return;
    notified.current = session.rest.startedAt;
    if (document.visibilityState !== 'visible') return;
    if (settings.vibration && 'vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    if (settings.sound) beep();
  }, [rest?.done, session.rest, settings.vibration, settings.sound]);

  const setIdx = async (i: number) => {
    if (i < 0 || i >= session.items.length) return;
    await db.sessions.update(session.id, { currentIndex: i });
  };

  const setNo = working.length + 1;
  const loadStep = machine?.increments?.length ? Math.min(...machine.increments) : settings.loadStepKg;

  const doSave = async () => {
    if (!form || !ex || !item || saving) return;
    if (form.fullReps == null) { toast({ text: 'Inserisci le ripetizioni complete (anche 0).', kind: 'error' }); return; }
    if (form.conform === 'some' && (form.validReps == null || form.validReps > form.fullReps)) { toast({ text: 'Le ripetizioni conformi devono essere ≤ delle complete.', kind: 'error' }); return; }
    setSaving(true);
    try {
      const draft = toDraft(form, session, ex, idx);
      const { set, duplicate } = await saveSet(draft, ex, form.kind === 'working' ? item.restSec ?? 180 : 90);
      // Conferma SOLO dopo il completamento della scrittura su IndexedDB
      lastSavedFor.current = set.id;
      const next = emptyForm(form.load, null, form.kind);
      setForm(next);
      setField('reps');
      await kvSet(draftKey, next);
      setUnsaved('set-form', false);
      if (!duplicate) {
        toast({
          text: `Serie salvata ✓ ${describeSet(set).split(' · ').slice(0, 2).join(' · ')}`,
          actions: [
            { label: 'Annulla', onClick: async () => { await deleteSet(set.id); toast({ text: 'Serie annullata' }); } },
            { label: 'Modifica', onClick: () => setSheet({ edit: set }) }
          ]
        });
      }
    } catch (e) {
      toast({ text: `Serie NON salvata: ${e instanceof Error ? e.message : String(e)}. I dati inseriti sono ancora nel modulo.`, kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remainingEstimate = useMemo(() => {
    const left = session.items.slice(idx).filter((it) => !it.skipped).reduce((a, it) => a + estimateItemMin(it), 0);
    return Math.round(left);
  }, [session.items, idx]);

  return (
    <>
      <main className="main with-bar">
        <div className="row between">
          <div className="grow">
            <div className="eyebrow">{session.title}</div>
            <div className="row small muted"><span className="num">Attiva {formatDuration(times.active)}</span><span>·</span><span className="num">Totale {formatDuration(times.total)}</span>{times.isPaused && <span className="badge warn">In pausa</span>}</div>
          </div>
          <button className="iconbtn" aria-label={times.isPaused ? 'Riprendi seduta' : 'Metti in pausa'} onClick={() => togglePause(session.id)}>{times.isPaused ? <Icon.play /> : <Icon.pause />}</button>
          <button className="btn sm" onClick={() => setSheet('finish')}>Termina</button>
        </div>
        {session.timeLimitMin != null && (
          <p className="small muted">Limite {session.timeLimitMin} min · stima residua ~{remainingEstimate} min{times.active / 60000 + remainingEstimate > session.timeLimitMin ? ' — oltre il limite: puoi saltare esercizi a bassa priorità dalla lista' : ''}</p>
        )}
        {pain && <div className="banner warn"><Icon.alert /><span className="small">Pausa per dolore attiva: nessun invito ad aumentare il carico. Se compaiono segnali d'allarme, interrompi. <a href="#/allenamento/dolore">Dettagli</a></span></div>}

        {rest && (
          <div className="card flat" aria-live="off">
            <div className="row between">
              <div>
                <div className="eyebrow">Recupero</div>
                <div className={`timer ${rest.done ? 'over' : ''}`}>{formatDuration(rest.elapsedMs)}</div>
                <div className="small muted">programmato {formatDuration(rest.plannedMs)}{rest.done ? ' · completato' : ''}</div>
              </div>
              <button className="btn sm ghost" onClick={() => db.sessions.update(session.id, { rest: null })}>Nascondi</button>
            </div>
          </div>
        )}

        {!item || !ex ? (
          <div className="card"><p>Nessun esercizio in questa seduta.</p><button className="btn block" onClick={() => setSheet('add')}><Icon.plus /> Aggiungi esercizio</button></div>
        ) : (
          <>
            <div className="row between mt">
              <button className="iconbtn" aria-label="Esercizio precedente" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><Icon.left /></button>
              <button className="btn ghost grow" onClick={() => setSheet('list')} aria-label="Elenco esercizi">
                <span className="small muted">Esercizio {idx + 1} di {session.items.length}</span>
              </button>
              <button className="iconbtn" aria-label="Esercizio successivo" disabled={idx >= session.items.length - 1} onClick={() => setIdx(idx + 1)}><Icon.right /></button>
            </div>
            <h1 style={{ marginBottom: 4 }}>{ex.name}</h1>
            <p className="small muted" style={{ marginTop: 0 }}>
              {ex.aliases.length ? `“${ex.aliases.join('”, “')}” · ` : ''}{ex.equipment}{ex.variant ? ` · ${ex.variant}` : ''}
              {item.skipped && <span className="badge warn"> saltato</span>}
            </p>
            {(ex.equipmentKind === undefined || ex.equipmentKind === 'macchina' || ex.equipmentKind === 'multipower' || ex.equipmentKind === 'cavo' || ex.machineId) && <MachineButton ex={ex} />}
            {ex.toConfirm.length > 0 && <p className="small"><span className="badge warn">Da confermare</span> {ex.toConfirm[0]}{ex.toConfirm.length > 1 ? ` (+${ex.toConfirm.length - 1})` : ''}</p>}
            <SessionTools session={session} ex={ex} idx={idx} exercises={exercises} />

            {painHere && <PainBanner detail={painHere.painDetail} onStop={() => setPainOpen(true)} />}
            {form && (
              <CompareEntry form={form} setForm={setForm} ex={ex} machine={machine} loadStep={loadStep} item={item}
                prev={prev} itemSets={itemSets} field={field} setField={setField} onEdit={(x) => setSheet({ edit: x })} />
            )}
          </>
        )}
      </main>
      {item && ex && form && (
        <div className="bar-bottom">
          <div className="save-row">
            <button className={`btn pain-btn${form.pain ? ' danger' : ''}`} onClick={() => setPainOpen(true)} aria-label={form.pain ? `Dolore segnato: ${painLabel(form.painDetail)}. Modifica` : 'Fastidio o dolore?'}>{form.pain ? 'Dolore ✓' : 'Fastidio o dolore?'}</button>
            <button className="btn primary xl grow" disabled={saving} onClick={doSave} aria-busy={saving}>
              {saving ? 'Salvataggio…' : form.kind === 'warmup' ? 'Salva riscaldamento' : `Salva serie ${setNo}`}
            </button>
          </div>
        </div>
      )}

      {sheet === 'list' && (
        <Sheet title="Esercizi della seduta" onClose={() => setSheet(null)}>
          <ul className="list">
            {session.items.map((it, i) => {
              const e = exercises.get(it.exerciseId);
              const done = sets.filter((s) => s.itemIndex === i && s.kind === 'working').length;
              return (
                <li key={i} className="row between">
                  <button className="listbtn grow" onClick={() => { setIdx(i); setSheet(null); }}>
                    <span><strong>{e?.name ?? it.exerciseId}</strong><br /><span className="small muted">{done}/{it.sets ?? '?'} serie · ~{Math.round(estimateItemMin(it))} min{it.skipped ? ' · saltato' : ''}</span></span>
                    {i === idx && <span className="badge accent">attuale</span>}
                  </button>
                  <button className="btn sm" onClick={() => db.sessions.update(session.id, { items: session.items.map((x, j) => (j === i ? { ...x, skipped: !x.skipped } : x)) })}>{it.skipped ? 'Ripristina' : 'Salta'}</button>
                </li>
              );
            })}
          </ul>
          <p className="small muted">Saltare un esercizio non è un fallimento e non crea "volume da recuperare".</p>
          <button className="btn block" onClick={() => setSheet('add')}><Icon.plus /> Aggiungi esercizio</button>
        </Sheet>
      )}
      {painOpen && form && ex && <PainSheet form={form} onChange={(f) => setForm(f)} onStop={async () => { await db.sessions.update(session.id, { painReported: true, items: session.items.map((x, j) => (j === idx ? { ...x, skipped: true } : x)), currentIndex: Math.min(idx + 1, session.items.length - 1) }); setPainOpen(false); toast({ text: 'Esercizio interrotto e segnalazione annotata' }); }} onClose={() => setPainOpen(false)} />}
      {sheet === 'add' && <AddExerciseSheet session={session} exercises={exercises} onClose={() => setSheet(null)} />}
      {sheet === 'finish' && <FinishSheet session={session} sets={sets} onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === 'object' && ex && (
        <EditSetSheet set={sheet.edit} ex={exercises.get(sheet.edit.exerciseId) ?? ex} loadStep={loadStep} onClose={() => setSheet(null)} />
      )}
    </>
  );
}

export function SetForm({ form, setForm, ex, machine, loadStep, title, repStart }: {
  form: FormState; setForm: (f: FormState) => void; ex: Exercise; machine: Machine | null | undefined; loadStep: number; title: string; repStart: number | null;
}) {
  const up = (p: Partial<FormState>) => setForm({ ...form, ...p });
  const note = totalLoadNote(ex.loadConvention, form.load, machine);
  return (
    <section className="card" aria-label={title}>
      <div className="row between">
        <h3 className="mb0">{title}</h3>
        <div className="chips">
          <Chip on={form.kind === 'working'} onClick={() => up({ kind: 'working' })}>Allenante</Chip>
          <Chip on={form.kind === 'warmup'} onClick={() => up({ kind: 'warmup' })}>Riscald.</Chip>
        </div>
      </div>
      <div className="col mt">
        <Stepper label={<>Carico <span className="small muted">{CONVENTION_LABEL[ex.loadConvention]}</span></>} value={form.load} step={loadStep} decimals
          onChange={(v) => up({ load: v, loadPrefilledFrom: null })}
          extra={form.loadPrefilledFrom ? <span className="badge accent small">precompilato: {form.loadPrefilledFrom}</span> : null} />
        {note && <p className="small muted" style={{ marginTop: -4 }}>{note}</p>}
        <Stepper label={<>Ripetizioni complete{ex.unilateral ? ' (per lato)' : ''} <span className="small muted">al ROM pianificato</span></>} value={form.fullReps} startAt={repStart}
          onChange={(v) => up({ fullReps: v == null ? null : Math.round(v) })} />
        <div>
          <div className="stepper-label"><span>Di cui conformi alla tecnica</span></div>
          <div className="chips">
            <Chip on={form.conform === 'all'} onClick={() => up({ conform: 'all' })}>Tutte</Chip>
            <Chip on={form.conform === 'some'} onClick={() => up({ conform: 'some', validReps: form.validReps ?? form.fullReps })}>Non tutte</Chip>
            <Chip on={form.conform === 'unknown'} onClick={() => up({ conform: 'unknown' })}>Non valutato</Chip>
          </div>
          {form.conform === 'some' && <div className="mt"><Stepper label="Ripetizioni conformi" value={form.validReps} onChange={(v) => up({ validReps: v == null ? null : Math.round(v) })} /></div>}
        </div>
        <div>
          <div className="stepper-label"><span>RIR <span className="small muted">ripetizioni conformi ancora possibili</span></span></div>
          <div className="chips" role="group" aria-label="RIR">
            {[0, 1, 2, 3, 4, 5].map((r) => <Chip key={r} on={!form.rirUnknown && form.rir === r} onClick={() => up({ rir: form.rir === r && !form.rirUnknown ? null : r, rirUnknown: false })} label={r === 5 ? 'RIR 5 o più' : `RIR ${r}`}>{r === 5 ? '5+' : r}</Chip>)}
            <Chip on={form.rirUnknown} onClick={() => up({ rirUnknown: !form.rirUnknown, rir: null })}>Non so</Chip>
          </div>
          {form.rir == null && !form.rirUnknown && <p className="small muted">Non inserito: resta vuoto, non vale 0.</p>}
        </div>
        <div className="row wrap">
          <Chip danger on={form.pain} onClick={() => up({ pain: !form.pain })}><Icon.alert /> Dolore</Chip>
        </div>
        {form.pain && (
          <div className="card danger flat">
            <Field label="Dove / come (facoltativo)"><input value={form.painNote} onChange={(e) => up({ painNote: e.target.value })} /></Field>
            <p className="small">Con dolore l'app non propone aumenti. Considera di interrompere o modificare l'esercizio. Perdita di sensibilità perineale, nuove alterazioni di vescica/intestino o debolezza importante alle gambe: valutazione medica urgente.</p>
          </div>
        )}
        <details>
          <summary>Dettagli serie</summary>
          <div className="col">
            {ex.unilateral && <NumInput label="Altro lato, se diverso" value={form.otherSide} onChange={(v) => up({ otherSide: v == null ? null : Math.round(v) })} decimals={false} />}
            <div className="grid2">
              <NumInput label="Parziali pianificate" hint="protocollo separato" value={form.plannedPartials} onChange={(v) => up({ plannedPartials: v })} decimals={false} />
              <NumInput label="Parziali extra" hint="dopo il limite, non contano" value={form.extraPartials} onChange={(v) => up({ extraPartials: v })} decimals={false} />
              <NumInput label="Assistite" value={form.assistedReps} onChange={(v) => up({ assistedReps: v })} decimals={false} />
              <NumInput label="Tentativi falliti" value={form.failedAttempts} onChange={(v) => up({ failedAttempts: v })} decimals={false} />
            </div>
            <Check checked={form.techIssue} onChange={(v) => up({ techIssue: v })}>Problema tecnico o di setup</Check>
            <Field label="Note"><textarea value={form.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
            <p className="small muted">Le parziali e le assistite sono categorie separate: non si sommano alle ripetizioni complete e non aggiornano i record a ROM completo.</p>
          </div>
        </details>
      </div>
    </section>
  );
}

function EditSetSheet({ set, ex, loadStep, onClose }: { set: SetEntry; ex: Exercise; loadStep: number; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(fromSet(set));
  const machine = useLiveQuery(async () => (ex.machineId ? db.machines.get(ex.machineId) : undefined), [ex.machineId]);
  return (
    <Sheet title="Modifica serie" onClose={onClose}>
      <SetForm form={form} setForm={setForm} ex={ex} machine={machine} loadStep={loadStep} title={`Salvata alle ${new Date(set.savedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`} repStart={null} />
      <div className="grid2">
        <button className="btn danger" onClick={async () => { await deleteSet(set.id); toast({ text: 'Serie eliminata' }); onClose(); }}><Icon.trash /> Elimina</button>
        <button className="btn primary" onClick={async () => {
          try {
            const full = form.fullReps ?? 0;
            await updateSet(set.id, {
              kind: form.kind, load: form.load, fullReps: full,
              validReps: form.conform === 'all' ? full : form.conform === 'unknown' ? null : Math.min(form.validReps ?? 0, full),
              fullRepsOtherSide: ex.unilateral ? form.otherSide : null, rir: form.rirUnknown ? null : form.rir, rirUnknown: form.rirUnknown,
              plannedPartials: form.plannedPartials ?? 0, extraPartials: form.extraPartials ?? 0, assistedReps: form.assistedReps ?? 0, failedAttempts: form.failedAttempts ?? 0,
              // una serie già segnata con dolore resta tale anche se i dettagli restano ignoti
              pain: form.pain, painNote: form.painNote, painDetail: form.pain ? form.painDetail ?? null : null, techIssue: form.techIssue, notes: form.notes
            });
            toast({ text: 'Modifica salvata ✓' });
            onClose();
          } catch (e) { toast({ text: `Modifica NON salvata: ${e instanceof Error ? e.message : e}`, kind: 'error' }); }
        }}>Salva modifica</button>
      </div>
    </Sheet>
  );
}

function AddExerciseSheet({ session, exercises, onClose }: { session: Session; exercises: Map<string, Exercise>; onClose: () => void }) {
  const [q, setQ] = useState('');
  const list = [...exercises.values()].filter((e) => (e.name + ' ' + e.aliases.join(' ')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Sheet title="Aggiungi esercizio" onClose={onClose}>
      <input type="search" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca esercizio" />
      <ul className="list mt">
        {list.map((e) => (
          <li key={e.id}><button className="listbtn" onClick={async () => {
            const items = [...session.items, { itemId: uid(), exerciseId: e.id, sets: null, repMin: null, repMax: null, rirTargets: [], restSec: 180, skipped: false }];
            await db.sessions.update(session.id, { items, currentIndex: items.length - 1 });
            onClose();
          }}><span>{e.name}{e.aliases.length ? <span className="muted small"> · {e.aliases.join(', ')}</span> : null}</span><Icon.plus /></button></li>
        ))}
      </ul>
    </Sheet>
  );
}

function FinishSheet({ session, sets, onClose }: { session: Session; sets: SetEntry[]; onClose: () => void }) {
  const [notes, setNotes] = useState(session.notes);
  const toast = useToast();
  const working = sets.filter((s) => s.kind === 'working');
  return (
    <Sheet title="Termina seduta" onClose={onClose}>
      <p>{working.length} serie allenanti, {sets.length - working.length} di riscaldamento.</p>
      {working.length === 0 && <p className="small muted">Nessuna serie allenante: va bene anche così. Una seduta ridotta o saltata non è un fallimento.</p>}
      <Field label="Note sulla seduta (facoltative)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sonno, energia, tempo disponibile…" /></Field>
      <div className="col mt">
        <button className="btn primary block" onClick={async () => { await finishSession(session.id, notes); setUnsaved('set-form', false); toast({ text: 'Seduta salvata ✓' }); onClose(); go(`allenamento/storico/${session.id}`); }}>Salva e termina</button>
        <button className="btn block" onClick={onClose}>Continua la seduta</button>
        {sets.length === 0 && (
          <button className="btn danger block" onClick={async () => { await discardSession(session.id); setUnsaved('set-form', false); onClose(); go('allenamento'); }}>Elimina seduta vuota</button>
        )}
      </div>
    </Sheet>
  );
}

let audioCtx: AudioContext | null = null;
function beep() {
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.25);
  } catch { /* audio non disponibile */ }
}

/** "Fastidio o dolore?": compare solo al tocco; tutto facoltativo tranne il fatto stesso. Usabile con una mano. */
function PainSheet({ form, onChange, onStop, onClose }: { form: FormState; onChange: (f: FormState) => void; onStop: () => void; onClose: () => void }) {
  const [d, setD] = useState<PainDetail>(form.painDetail ?? emptyPain());
  const up = (p: Partial<PainDetail>) => setD({ ...d, ...p });
  const save = () => { onChange({ ...form, pain: true, painDetail: d, painNote: d.note || form.painNote }); onClose(); };
  return (
    <Sheet title="Fastidio o dolore" onClose={onClose}>
      <p className="small muted">Facoltativo: indica solo quello che sai. Resta su questo dispositivo. Un indolenzimento dei giorni dopo l'allenamento (DOMS) o lo sforzo muscolare non sono questa segnalazione.</p>
      <strong className="small">Dove</strong>
      <div className="chips" role="group" aria-label="Zona">{(Object.keys(ZONE_LABEL) as PainZone[]).map((z) => <Chip key={z} on={d.zone === z} onClick={() => up({ zone: d.zone === z ? null : z })}>{ZONE_LABEL[z]}</Chip>)}</div>
      <strong className="small">Lato</strong>
      <div className="chips" role="group" aria-label="Lato">{(Object.keys(SIDE_LABEL) as PainSide[]).map((x) => <Chip key={x} on={d.side === x} onClick={() => up({ side: d.side === x ? null : x })}>{SIDE_LABEL[x]}</Chip>)}</div>
      <strong className="small">Quando</strong>
      <div className="chips" role="group" aria-label="Esordio"><Chip on={d.onset === 'durante'} onClick={() => up({ onset: d.onset === 'durante' ? null : 'durante' })}>Durante la serie</Chip><Chip on={d.onset === 'dopo'} onClick={() => up({ onset: d.onset === 'dopo' ? null : 'dopo' })}>Dopo</Chip></div>
      <details><summary className="small">Intensità e nota (facoltative)</summary>
        <div className="chips" role="group" aria-label="Intensità 0–10">{Array.from({ length: 11 }, (_, i) => <Chip key={i} on={d.intensity === i} onClick={() => up({ intensity: d.intensity === i ? null : i })}>{i}</Chip>)}</div>
        <Field label="Nota"><input value={d.note} onChange={(e) => up({ note: e.target.value })} /></Field>
      </details>
      <div className="card warn flat small mt">{urgentSigns(d.zone)}</div>
      <div className="col mt">
        <button className="btn primary block" onClick={save}>Segna sulla serie e continua</button>
        <button className="btn block" onClick={() => { save(); onStop(); }}>Segna e interrompi questo esercizio</button>
        {form.pain && <button className="btn ghost block" onClick={() => { onChange({ ...form, pain: false, painDetail: null }); onClose(); }}>Togli la segnalazione da questa serie</button>}
      </div>
    </Sheet>
  );
}

function PainBanner({ detail, onStop }: { detail: PainDetail | null | undefined; onStop: () => void }) {
  return (
    <div className="banner warn small" data-testid="pain-banner">
      <span>Hai segnalato dolore in questo esercizio oggi ({painLabel(detail)}): l'app non propone carichi più alti su questo movimento. Puoi interromperlo o registrare la segnalazione. {urgentSigns(detail?.zone ?? null)}</span>
      <button className="btn sm" onClick={onStop}>Opzioni</button>
    </div>
  );
}
