// "Aggiungi al giorno…": stesso foglio dalla scheda esercizio e dall'atlante. Aggiunge in coda al giorno scelto
// della scheda attiva, con la funzione unica di creazione (serie, range e RIR suggeriti, nessun carico).
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Exercise } from '../db/types';
import { Icon, Sheet, go } from '../ui/kit';
import { WEEKDAYS } from '../lib/dates';
import { uid } from '../lib/id';
import { newProgramItem } from '../lib/setTarget';

export function AddToDaySheet({ ex, programId, onClose, onDone }: { ex: Exercise; programId: string; onClose: () => void; onDone: (dayName: string) => void }) {
  const program = useLiveQuery(() => db.programs.get(programId), [programId]);
  if (!program) return null;
  return (
    <Sheet title={`Aggiungi ${ex.name} a "${program.name}"`} onClose={onClose}>
      <ul className="list" data-testid="add-to-day">
        {program.days.map((d) => {
          const has = d.items.some((i) => i.exerciseId === ex.id);
          return (
            <li key={d.id}><button className="listbtn" disabled={has} onClick={async () => {
              const fresh = await db.programs.get(program.id);
              if (!fresh) return;
              const days = fresh.days.map((x) => x.id === d.id ? { ...x, items: [...x.items, newProgramItem(uid(), ex, ex.id)] } : x);
              await db.programs.update(program.id, { days });
              onDone(d.name);
            }}><span>{d.weekday ? WEEKDAYS[d.weekday] + ' · ' : ''}{d.name}{has ? <><br /><span className="small muted">già presente</span></> : null}</span><Icon.plus /></button></li>
          );
        })}
      </ul>
      <p className="small muted">Aggiunto in coda con serie, ripetizioni e RIR suggeriti, modificabili: nessun carico assegnato.</p>
      <button className="btn block" onClick={() => go(`allenamento/scheda/${program.id}`)}>Apri la scheda</button>
    </Sheet>
  );
}
