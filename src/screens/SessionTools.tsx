// Azioni rapide durante la seduta. Ogni pulsante ha conseguenze DIVERSE:
// - Macchina occupata: rimanda o sostituisce per oggi; NON insegna che l'esercizio è sgradito.
// - Ho meno tempo: salta esercizi scelti (a priorità più bassa per primi); non aumenta intensità o densità.
// - Non mi piace: preferenza registrata (meno proposte in futuro) + alternativa.
// - Segnala fastidio: evento datato e soggettivo; propone di fermarsi, sostituire o saltare. Nessuna diagnosi.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvGet, kvSet } from '../db/db';
import type { Exercise, Session } from '../db/types';
import { Check, Icon, Sheet, useSettings, useToast } from '../ui/kit';
import { MUSCLE_LABEL } from '../ui/labels';
import { alternatives, type ExercisePrefs } from '../lib/substitute';
import { estimateItemMin } from '../lib/workout';

export async function getPrefs(): Promise<ExercisePrefs> { return kvGet<ExercisePrefs>('exercisePrefs', { disliked: [], favorites: [], discomfort: [] }); }
async function logEvent(type: 'busy' | 'less_time' | 'dislike' | 'discomfort' | 'substitute', exerciseId: string, note = '') {
  const ev = await kvGet<{ type: string; exerciseId: string; at: number; note: string }[]>('exerciseEvents', []);
  await kvSet('exerciseEvents', [...ev, { type, exerciseId, at: Date.now(), note }].slice(-300));
}

type Mode = null | 'how' | 'busy' | 'time' | 'dislike' | 'pain';

export function SessionTools({ session, ex, idx, exercises }: { session: Session; ex: Exercise; idx: number; exercises: Map<string, Exercise> }) {
  const [mode, setMode] = useState<Mode>(null);
  return (
    <>
      <p className="small muted" style={{ marginTop: 0 }}>{ex.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}{ex.secondaryMuscles.length ? ` · secondari: ${ex.secondaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}` : ''}</p>
      <div className="chips scroll-x" role="group" aria-label="Azioni sull'esercizio">
        <button className="chip" onClick={() => setMode('how')}><Icon.info /> Come si fa</button>
        <button className="chip" onClick={() => setMode('busy')}>Macchina occupata</button>
        <button className="chip" onClick={() => setMode('time')}><Icon.clock /> Ho meno tempo</button>
        <button className="chip" onClick={() => setMode('dislike')}>Non mi piace</button>
        <button className="chip danger" aria-pressed={false} onClick={() => setMode('pain')}><Icon.alert /> Fastidio</button>
      </div>
      {mode === 'how' && (
        <Sheet title={ex.name} onClose={() => setMode(null)}>
          {ex.setup && <p><strong>Posizione:</strong> {ex.setup}</p>}
          {ex.steps?.length ? <ol className="steps">{ex.steps.map((s) => <li key={s}>{s}</li>)}</ol> : <p className="muted">Nessuna istruzione salvata per questo esercizio.</p>}
          {ex.commonErrors?.length ? <><strong>Errori comuni</strong><ul>{ex.commonErrors.map((s) => <li key={s}>{s}</li>)}</ul></> : null}
          <a className="btn block" href={`#/allenamento/esercizio/${ex.id}`} onClick={() => setMode(null)}>Scheda completa</a>
        </Sheet>
      )}
      {mode === 'busy' && <BusySheet session={session} ex={ex} idx={idx} exercises={exercises} onClose={() => setMode(null)} />}
      {mode === 'time' && <LessTimeSheet session={session} idx={idx} exercises={exercises} onClose={() => setMode(null)} />}
      {mode === 'dislike' && <SubstituteSheet title="Non mi piace" intro="Lo proporrò meno spesso. Vuoi sostituirlo già oggi?" session={session} ex={ex} idx={idx} exercises={exercises} reason="dislike" onClose={() => setMode(null)} />}
      {mode === 'pain' && <PainSheet session={session} ex={ex} idx={idx} exercises={exercises} onClose={() => setMode(null)} />}
    </>
  );
}

function BusySheet({ session, ex, idx, exercises, onClose }: { session: Session; ex: Exercise; idx: number; exercises: Map<string, Exercise>; onClose: () => void }) {
  const toast = useToast();
  const [alt, setAlt] = useState(false);
  if (alt) return <SubstituteSheet title="Alternativa per oggi" intro="Solo per questa seduta: la scheda non cambia." session={session} ex={ex} idx={idx} exercises={exercises} reason="busy" onClose={onClose} />;
  return (
    <Sheet title="Macchina occupata" onClose={onClose}>
      <p className="small muted">Non conta come preferenza: l'esercizio resta nella scheda.</p>
      <div className="col">
        <button className="btn primary block" disabled={idx >= session.items.length - 1} onClick={async () => {
          const items = [...session.items];
          const [it] = items.splice(idx, 1);
          items.push(it);
          await db.sessions.update(session.id, { items, currentIndex: idx });
          // Le serie già salvate fanno riferimento all'indice: le riallineo
          const sets = await db.sets.where('sessionId').equals(session.id).toArray();
          for (const s of sets) {
            const ni = s.itemIndex === idx ? items.length - 1 : s.itemIndex > idx ? s.itemIndex - 1 : s.itemIndex;
            if (ni !== s.itemIndex) await db.sets.update(s.id, { itemIndex: ni });
          }
          await logEvent('busy', ex.id);
          toast({ text: 'Spostato in fondo: lo riprendi più tardi' });
          onClose();
        }}>Lo faccio più tardi</button>
        <button className="btn block" onClick={() => setAlt(true)}><Icon.swap /> Usa un'alternativa oggi</button>
      </div>
    </Sheet>
  );
}

function LessTimeSheet({ session, idx, exercises, onClose }: { session: Session; idx: number; exercises: Map<string, Exercise>; onClose: () => void }) {
  const toast = useToast();
  const program = useLiveQuery(async () => (session.programId ? db.programs.get(session.programId) : undefined), [session.programId]);
  const prio = (itemId: string) => program?.days.flatMap((d) => d.items).find((i) => i.id === itemId)?.priority ?? null;
  const remaining = session.items.map((it, i) => ({ it, i })).filter(({ it, i }) => i > idx && !it.skipped);
  // Proposta: salta per primi quelli a priorità più bassa (o senza priorità, dal fondo)
  const order = [...remaining].sort((a, b) => (prio(b.it.itemId) ?? 99) - (prio(a.it.itemId) ?? 99) || b.i - a.i);
  const [skip, setSkip] = useState<number[]>(order.slice(0, Math.ceil(remaining.length / 2)).map((x) => x.i));
  const saved = skip.reduce((a, i) => a + estimateItemMin(session.items[i]), 0);
  return (
    <Sheet title="Ho meno tempo" onClose={onClose}>
      <p className="small">Scegli cosa saltare oggi. Recuperi, riscaldamento e intensità restano invariati; gli esercizi saltati non diventano "volume da recuperare".</p>
      {!remaining.length && <p className="muted">Non ci sono altri esercizi dopo questo.</p>}
      {remaining.map(({ it, i }) => (
        <Check key={i} checked={skip.includes(i)} onChange={(v) => setSkip(v ? [...skip, i] : skip.filter((x) => x !== i))}>
          {exercises.get(it.exerciseId)?.name ?? it.exerciseId} <span className="muted small">~{Math.round(estimateItemMin(it))} min{prio(it.itemId) != null ? ` · priorità ${prio(it.itemId)}` : ''}</span>
        </Check>
      ))}
      <p className="small muted">Risparmio stimato ~{Math.round(saved)} min.</p>
      <button className="btn primary block" disabled={!skip.length} onClick={async () => {
        await db.sessions.update(session.id, { items: session.items.map((x, j) => (skip.includes(j) ? { ...x, skipped: true } : x)), reducedTime: true });
        await logEvent('less_time', session.items[idx].exerciseId, `${skip.length} saltati`);
        toast({ text: `${skip.length} esercizi saltati per oggi` });
        onClose();
      }}>Conferma</button>
    </Sheet>
  );
}

function SubstituteSheet({ title, intro, session, ex, idx, exercises, reason, onClose }: { title: string; intro: string; session: Session; ex: Exercise; idx: number; exercises: Map<string, Exercise>; reason: 'busy' | 'dislike' | 'discomfort'; onClose: () => void }) {
  const toast = useToast();
  const settings = useSettings();
  const prefs = useLiveQuery(() => getPrefs(), []);
  const [alsoProgram, setAlsoProgram] = useState(false);
  if (!prefs) return null;
  const alts = alternatives(ex, [...exercises.values()], { access: settings.profile.equipment, prefs, busyMachineId: reason === 'busy' ? ex.machineId : null, inSession: session.items.map((i) => i.exerciseId), max: 3 });
  const record = async () => {
    if (reason === 'dislike') await kvSet('exercisePrefs', { ...prefs, disliked: [...new Set([...prefs.disliked, ex.id])] });
    if (reason === 'discomfort') await kvSet('exercisePrefs', { ...prefs, discomfort: [...new Set([...prefs.discomfort, ex.id])] });
    await logEvent(reason, ex.id);
  };
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="small">{intro}</p>
      {!alts.length && <p className="muted">Nessuna alternativa adatta con l'attrezzatura indicata. Puoi saltare l'esercizio e annotarlo.</p>}
      {alts.map((a) => (
        <div className="card flat" key={a.exercise.id}>
          <strong>{a.exercise.name}</strong>
          <p className="seg-why">{a.reasons.join(' · ')}</p>
          <button className="btn sm primary" onClick={async () => {
            await record();
            await db.sessions.update(session.id, { items: session.items.map((x, j) => (j === idx ? { ...x, exerciseId: a.exercise.id } : x)) });
            if (alsoProgram && session.programId) {
              const p = await db.programs.get(session.programId);
              if (p) await db.programs.update(p.id, { days: p.days.map((d) => ({ ...d, items: d.items.map((i) => (i.id === session.items[idx].itemId ? { ...i, exerciseId: a.exercise.id } : i)) })) });
            }
            await logEvent('substitute', ex.id, a.exercise.id);
            toast({ text: `Sostituito con ${a.exercise.name}${alsoProgram ? ' anche nella scheda' : ' per oggi'}` });
            onClose();
          }}>Usa questo</button>
        </div>
      ))}
      {reason !== 'busy' && session.programId && <Check checked={alsoProgram} onChange={setAlsoProgram}>Cambia anche nella scheda (nuova versione dell'esercizio, storico separato)</Check>}
      {reason !== 'busy' && <button className="btn block" onClick={async () => { await record(); toast({ text: 'Preferenza registrata' }); onClose(); }}>Registra solo la preferenza</button>}
    </Sheet>
  );
}

function PainSheet({ session, ex, idx, exercises, onClose }: { session: Session; ex: Exercise; idx: number; exercises: Map<string, Exercise>; onClose: () => void }) {
  const toast = useToast();
  const [sub, setSub] = useState(false);
  if (sub) return <SubstituteSheet title="Alternativa" intro="Fastidio registrato. Scegli un'alternativa solo se ti senti di proseguire." session={session} ex={ex} idx={idx} exercises={exercises} reason="discomfort" onClose={onClose} />;
  return (
    <Sheet title="Fastidio o dolore" onClose={onClose}>
      <p>Interrompi o modifica l'esercizio. L'app non fa diagnosi e non propone esercizi riabilitativi.</p>
      <div className="card danger flat small">Perdita di sensibilità perineale, nuove alterazioni di vescica/intestino o debolezza importante alle gambe: valutazione medica urgente. Dolore intenso o in peggioramento: valutazione sanitaria.</div>
      <div className="col mt">
        <button className="btn block" onClick={async () => {
          await db.sessions.update(session.id, { painReported: true, items: session.items.map((x, j) => (j === idx ? { ...x, skipped: true } : x)), currentIndex: Math.min(idx + 1, session.items.length - 1) });
          await logEvent('discomfort', ex.id, 'saltato');
          toast({ text: 'Fastidio annotato, esercizio saltato' });
          onClose();
        }}>Salta questo esercizio</button>
        <button className="btn block" onClick={() => setSub(true)}><Icon.swap /> Sostituisci</button>
        <a className="btn block" href="#/allenamento/dolore" onClick={onClose}>Registra un episodio di dolore</a>
      </div>
    </Sheet>
  );
}
