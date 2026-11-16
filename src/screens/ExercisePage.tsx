import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Icon, go, useToast } from '../ui/kit';
import { ExerciseFigure } from './ExerciseFigure';
import { editorialFor } from '../lib/editorial';
import { CONVENTION_LABEL } from '../ui/labels';
import { configKey, exposuresFor } from '../lib/workout';
import { formatDateIt } from '../lib/dates';
import { fmtNum, uid } from '../lib/id';
import { MachineButton } from './MachinePicker';
import { AddToDaySheet } from './AddToDay';
import { newProgramItem } from '../lib/setTarget';

/** Pagina di consultazione: semplice. La modifica avanzata è un'azione secondaria. */
export function ExercisePage({ id }: { id: string }) {
  const toast = useToast();
  const ex = useLiveQuery(() => db.exercises.get(id), [id]);
  const last = useLiveQuery(async () => { if (!ex) return null; const e = await exposuresFor(configKey(ex)); return e.at(-1) ?? null; }, [ex?.id, ex?.configVersion]);
  const program = useLiveQuery(() => db.programs.filter((p) => p.isActive && !p.archived).first(), []);
  const all = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exNames = new Map(all.map((e) => [e.id, e.name]));
  const [addSheet, setAddSheet] = useState(false);
  if (!ex) return <main className="main"><p className="muted">Caricamento…</p></main>;
  const fav = !!ex.favorite;
  const ed = editorialFor(ex, all);
  return (
    <main className="main">
      <a href="#/allenamento/catalogo" className="small">‹ Esercizi</a>
      <div className="mt">
        <div>
          <h1 style={{ margin: 0 }}>{ex.name}</h1>
          {ex.variant && <p className="small mb0">Variante: {ex.variant}</p>}
          <p className="seg-why">{ex.equipment || 'Attrezzatura non indicata'}{ex.unilateral ? ' · unilaterale' : ''}{ex.difficulty ? ` · difficoltà tecnica ${['', 'bassa', 'media', 'alta'][ex.difficulty]}` : ''}</p>
          {ex.aliases.length > 0 && <p className="small muted">Detto anche: {ex.aliases.join(', ')}</p>}
        </div>
      </div>
      <ExerciseFigure ex={ex} />
      <section className="card" data-testid="ex-action">
        <div className="eyebrow">Il movimento</div>
        {ex.setup && <p className="small"><strong>Posizione:</strong> {ex.setup}</p>}
        {ex.steps?.length ? <ol className="steps">{ex.steps.map((x) => <li key={x}>{x}</li>)}</ol> : <p className="small muted">Istruzioni non presenti per questo esercizio.</p>}
        <a className="small" href={`#/progressi/atlante/ex/${ex.id}`} data-testid="ex-open-atlas">Vedi nell'atlante a schermo intero</a>
      </section>
      <div className="action-row mt">
        <button className="btn" aria-pressed={fav} onClick={async () => { await db.exercises.update(ex.id, { favorite: !fav }); }}>{fav ? <Icon.starFill /> : <Icon.star />} {fav ? 'Preferito' : 'Aggiungi ai preferiti'}</button>
        {program ? <button className="btn primary" onClick={() => setAddSheet(true)}><Icon.plus /> Aggiungi alla scheda</button>
          : <button className="btn primary" onClick={async () => {
            const id = uid();
            await db.programs.add({ id, name: `Scheda con ${ex.name}`, kind: 'custom', origin: 'user', isActive: true, notes: '', createdAt: Date.now(), days: [{ id: uid(), name: 'Giorno 1', weekday: null, items: [newProgramItem(uid(), ex, ex.id)] }] });
            toast({ text: 'Scheda creata e attivata ✓' }); go(`allenamento/scheda/${id}`);
          }}><Icon.plus /> Crea scheda con questo esercizio</button>}
      </div>
      {(ex.equipmentKind === undefined || ex.equipmentKind === 'macchina' || ex.equipmentKind === 'multipower' || ex.equipmentKind === 'cavo' || ex.machineId) && <div className="mt"><MachineButton ex={ex} /></div>}
      <section className="card">
        <div className="eyebrow">Il tuo storico</div>
        {last ? <p className="small">Ultima volta {formatDateIt(last.dateKey, true)}: {last.sets.filter((s) => s.kind === 'working').map((s) => `${fmtNum(s.load, 2)}×${s.validReps ?? '?'}`).join(', ')}</p> : <p className="small muted">Nessuna seduta registrata con questa configurazione.</p>}
        <p className="small muted">Carico: {CONVENTION_LABEL[ex.loadConvention]}. Cambi di macchina, leva o ROM avviano uno storico separato.</p>
      </section>
      <section className="card" data-testid="ex-editorial">
        <div className="eyebrow">Quando e come usarlo{ed.general ? ' · indicazione generale' : ''}</div>
        {ed.whenToChoose && <p className="small"><strong>Quando sceglierlo:</strong> {ed.whenToChoose}</p>}
        {ed.whenToMove && <p className="small"><strong>Dove metterlo nella seduta:</strong> {ed.whenToMove}</p>}
        {ed.comparisonLimits && <p className="small"><strong>Cosa rende i carichi non confrontabili:</strong> {ed.comparisonLimits}</p>}
        {ed.alternatives.length ? <p className="small"><strong>Alternative se è occupato:</strong> {ed.alternatives.map((id, i) => <span key={id}>{i ? ', ' : ''}<a href={`#/allenamento/esercizio/${id}`}>{exNames.get(id) ?? id}</a></span>)}</p> : null}
        {ed.general && <p className="small muted" data-testid="ex-editorial-general">In tutto o in parte ricavata da gesto, classe e convenzione di carico: non è una scheda scritta per questa variante.</p>}
        {ex.measure && ex.measure !== 'reps' && <p className="small muted">Si registra in {ex.measure === 'seconds' ? 'secondi' : 'metri'}, non in ripetizioni.</p>}
      </section>
      <details className="card flat">
        <summary>Errori comuni e video</summary>
        {ex.commonErrors?.length ? <ul className="small">{ex.commonErrors.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="small muted">Nessun errore comune scritto per questo esercizio.</p>}
        <p className="small muted">Video: nessuna dimostrazione verificata collegata per questa variante. Indicazioni generali, non correzione tecnica personale.</p>
      </details>
      <details className="card flat">
        <summary>Fonti e note</summary>
        <p className="small">{(ex.sources ?? ['Esercizio creato dall\'utente']).join('; ')}</p>
        {ex.techNotes && <p className="small">{ex.techNotes}</p>}
      </details>
      <a className="btn ghost block mt" href={`#/allenamento/esercizio/${ex.id}/modifica`}><Icon.edit /> Modifica esercizio (avanzato)</a>
      {addSheet && program && <AddToDaySheet ex={ex} programId={program.id} onClose={() => setAddSheet(false)} onDone={(d) => { toast({ text: `Aggiunto a «${d}» ✓` }); setAddSheet(false); }} />}
    </main>
  );
}

