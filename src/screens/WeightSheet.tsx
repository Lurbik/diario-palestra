import { useState } from 'react';
import { db } from '../db/db';
import { Chip, Field, NumInput, Sheet, useToast } from '../ui/kit';
import { uid } from '../lib/id';
import { dateKey, timeHM } from '../lib/dates';

export const WEIGHT_FLAGS = ['creatina', 'carboidrati alti', 'sale alto', 'malessere', 'viaggio'];

export function WeightSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [kg, setKg] = useState<number | null>(null);
  const [date, setDate] = useState(dateKey());
  const [time, setTime] = useState(timeHM());
  const [morning, setMorning] = useState<boolean | null>(new Date().getHours() < 11 ? true : null);
  const [flags, setFlags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  return (
    <Sheet title="Registra il peso" onClose={onClose}>
      <div className="col">
        <NumInput label="Peso (kg)" value={kg} onChange={setKg} placeholder="es. 63,2" />
        <div className="grid2">
          <Field label="Data"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Ora"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <div><strong className="small">Condizioni</strong>
          <div className="chips"><Chip on={morning === true} onClick={() => setMorning(morning === true ? null : true)}>Mattino, a digiuno, dopo il bagno</Chip><Chip on={morning === false} onClick={() => setMorning(morning === false ? null : false)}>Altre condizioni</Chip></div>
        </div>
        <div><strong className="small">Possono alterare il peso (facoltativo)</strong>
          <div className="chips">{WEIGHT_FLAGS.map((f) => <Chip key={f} on={flags.includes(f)} onClick={() => setFlags(flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f])}>{f}</Chip>)}</div>
        </div>
        <Field label="Nota"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <p className="small muted">Una singola pesata non cambia nulla: conta l'andamento su più settimane.</p>
        <button className="btn primary block" disabled={kg == null || kg < 25 || kg > 300} onClick={async () => {
          await db.weights.add({ id: uid(), dateKey: date, time, kg: kg!, morning, conditions: morning ? 'mattino, digiuno' : morning === false ? 'altre' : '', flags, note });
          toast({ text: 'Peso salvato ✓' });
          onClose();
        }}>Salva</button>
      </div>
    </Sheet>
  );
}
