import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Exercise } from '../db/types';
import { Icon, Sheet, go, useToast } from '../ui/kit';
import { BodySvg, PatternIcon } from '../ui/visuals';
import { MUSCLE_LABEL, CONVENTION_LABEL } from '../ui/labels';
import { configKey, exposuresFor } from '../lib/workout';
import { formatDateIt, WEEKDAYS } from '../lib/dates';
import { fmtNum, uid } from '../lib/id';

/** Pagina di consultazione: semplice. La modifica avanzata è un'azione secondaria. */
export function ExercisePage({ id }: { id: string }) {
  const toast = useToast();
  const ex = useLiveQuery(() => db.exercises.get(id), [id]);
  const last = useLiveQuery(async () => { if (!ex) return null; const e = await exposuresFor(configKey(ex)); return e.at(-1) ?? null; }, [ex?.id, ex?.configVersion]);
  const program = useLiveQuery(() => db.programs.filter((p) => p.isActive && !p.archived).first(), []);
  const [addSheet, setAddSheet] = useState(false);
  if (!ex) return <main className="main"><p className="muted">Caricamento…</p></main>;
  const fav = !!ex.favorite;
  return (
    <main className="main">
      <a href="#/allenamento/catalogo" className="small">‹ Esercizi</a>
      <div className="row mt" style={{ alignItems: 'flex-start' }}>
        <span className="thumb lg"><PatternIcon pattern={ex.pattern} /></span>
        <div className="grow">
          <h1 style={{ margin: 0 }}>{ex.name}</h1>
          <p className="seg-why">{ex.equipment || 'Attrezzatura non indicata'}{ex.unilateral ? ' · unilaterale' : ''}{ex.difficulty ? ` · difficoltà tecnica ${['', 'bassa', 'media', 'alta'][ex.difficulty]}` : ''}</p>
          {ex.aliases.length > 0 && <p className="small muted">Detto anche: {ex.aliases.join(', ')}</p>}
        </div>
      </div>
      <div className="action-row mt">
        <button className="btn" aria-pressed={fav} onClick={async () => { await db.exercises.update(ex.id, { favorite: !fav }); }}>{fav ? <Icon.starFill /> : <Icon.star />} {fav ? 'Preferito' : 'Aggiungi ai preferiti'}</button>
        <button className="btn primary" disabled={!program} onClick={() => setAddSheet(true)}><Icon.plus /> Aggiungi alla scheda</button>
      </div>
      <div className="grid-desktop mt">
        <section className="card">
          <div className="eyebrow">Muscoli coinvolti</div>
          <div className="grid2">
            <BodySvg view="front" label="Vista anteriore" highlight={{ primary: ex.primaryMuscles, secondary: ex.secondaryMuscles }} />
            <BodySvg view="back" label="Vista posteriore" highlight={{ primary: ex.primaryMuscles, secondary: ex.secondaryMuscles }} />
          </div>
          <p className="small"><strong>Principali:</strong> {ex.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') || '—'}<br /><strong>Secondari:</strong> {ex.secondaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') || '—'}</p>
          <p className="small muted">Silhouette schematica: indica le regioni coinvolte, non quanto un muscolo lavora o cresce.</p>
        </section>
        <section className="card">
          <div className="eyebrow">Come si fa</div>
          {ex.setup && <p className="small"><strong>Posizione:</strong> {ex.setup}</p>}
          {ex.steps?.length ? <ol className="steps">{ex.steps.map((s) => <li key={s}>{s}</li>)}</ol> : <p className="small muted">Istruzioni non presenti per questo esercizio.</p>}
          {ex.commonErrors?.length ? <><strong className="small">Errori comuni</strong><ul className="small">{ex.commonErrors.map((s) => <li key={s}>{s}</li>)}</ul></> : null}
          <p className="small muted">Video: nessuna dimostrazione verificata collegata per questa variante. Indicazioni generali, non correzione tecnica personale.</p>
        </section>
      </div>
      <section className="card">
        <div className="eyebrow">Il tuo storico</div>
        {last ? <p className="small">Ultima volta {formatDateIt(last.dateKey, true)}: {last.sets.filter((s) => s.kind === 'working').map((s) => `${fmtNum(s.load, 2)}×${s.validReps ?? '?'}`).join(', ')}</p> : <p className="small muted">Nessuna seduta registrata con questa configurazione.</p>}
        <p className="small muted">Carico: {CONVENTION_LABEL[ex.loadConvention]}. Cambi di macchina, leva o ROM avviano uno storico separato.</p>
      </section>
      <details className="card flat">
        <summary>Fonti e note</summary>
        <p className="small">{(ex.sources ?? ['Esercizio creato dall\'utente']).join('; ')}</p>
        {ex.techNotes && <p className="small">{ex.techNotes}</p>}
      </details>
      <a className="btn ghost block mt" href={`#/allenamento/esercizio/${ex.id}/modifica`}><Icon.edit /> Modifica esercizio (avanzato)</a>
      {addSheet && program && <AddToProgramSheet ex={ex} programId={program.id} onClose={() => setAddSheet(false)} onDone={() => { toast({ text: 'Aggiunto alla scheda ✓' }); setAddSheet(false); }} />}
    </main>
  );
}

function AddToProgramSheet({ ex, programId, onClose, onDone }: { ex: Exercise; programId: string; onClose: () => void; onDone: () => void }) {
  const program = useLiveQuery(() => db.programs.get(programId), [programId]);
  if (!program) return null;
  return (
    <Sheet title={`Aggiungi a "${program.name}"`} onClose={onClose}>
      <ul className="list">
        {program.days.map((d) => (
          <li key={d.id}><button className="listbtn" onClick={async () => {
            const days = program.days.map((x) => x.id === d.id ? { ...x, items: [...x.items, { id: uid(), exerciseId: ex.id, sets: 2, repMin: ex.policyClass === 'isolation' ? 10 : 8, repMax: ex.policyClass === 'isolation' ? 15 : 12, rirTargets: [{ min: 1, max: 3 }, { min: 1, max: 3 }], restSec: 150, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' }] } : x);
            await db.programs.update(program.id, { days });
            onDone();
          }}><span>{d.weekday ? WEEKDAYS[d.weekday] + ' · ' : ''}{d.name}</span><Icon.plus /></button></li>
        ))}
      </ul>
      <p className="small muted">Aggiunto con 2 serie e un range iniziale modificabile: nessun carico assegnato.</p>
      <button className="btn block" onClick={() => go(`allenamento/scheda/${program.id}`)}>Apri la scheda</button>
    </Sheet>
  );
}
