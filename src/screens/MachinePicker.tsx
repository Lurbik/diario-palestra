// Scelta della macchina per un esercizio: due macchine simili (es. tre hack squat della stessa sala)
// hanno regolazioni, incrementi e storico SEPARATI. I kg di una macchina non vengono usati per l'altra.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Exercise, Machine } from '../db/types';
import { Field, Icon, NumInput, Sheet, useToast } from '../ui/kit';
import { configKey, createMachine, exposuresFor, switchMachine } from '../lib/workout';
import { formatDateIt } from '../lib/dates';
import { fmtNum, parseNum } from '../lib/id';

export function machineSummary(m: Machine | null | undefined): string {
  if (!m) return 'Macchina non indicata';
  const parts = [m.name];
  if (m.seat) parts.push(`sedile ${m.seat}`);
  if (m.backrest) parts.push(`schienale ${m.backrest}`);
  if (m.grip) parts.push(m.grip);
  if (m.increments.length) parts.push(`incremento ${m.increments.map((x) => fmtNum(x, 2)).join('/')} kg`);
  return parts.join(' · ');
}

export function MachineButton({ ex }: { ex: Exercise }) {
  const machine = useLiveQuery(async () => (ex.machineId ? db.machines.get(ex.machineId) : null), [ex.machineId]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="machine-btn" onClick={() => setOpen(true)} aria-label={`Macchina: ${machine?.name ?? 'non indicata'}. Cambia macchina`}>
        <span className="grow"><span className="small muted">Macchina</span><br /><strong>{machineSummary(machine)}</strong></span>
        <span className="small"><Icon.swap /> Cambia</span>
      </button>
      {open && <MachinePickerSheet ex={ex} onClose={() => setOpen(false)} />}
    </>
  );
}

export function MachinePickerSheet({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const toast = useToast();
  const machines = useLiveQuery(() => db.machines.orderBy('name').toArray(), []) ?? [];
  const history = useLiveQuery(async () => {
    const out = new Map<string, { n: number; last: string | null; top: number | null }>();
    for (const m of [{ id: null as string | null }, ...(await db.machines.toArray())]) {
      const exps = await exposuresFor(configKey({ ...ex, machineId: m.id }));
      if (exps.length) {
        const last = exps[exps.length - 1];
        out.set(m.id ?? 'nd', { n: exps.length, last: last.dateKey, top: Math.max(...last.sets.filter((s) => s.kind === 'working').map((s) => s.load ?? 0)) });
      }
    }
    return out;
  }, [ex.id, ex.configVersion]) ?? new Map();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [seat, setSeat] = useState('');
  const [backrest, setBackrest] = useState('');
  const [inc, setInc] = useState<number | null>(null);
  const cur = ex.machineId;
  // Prima quelle già usate con questo esercizio, poi la stessa categoria, poi le altre
  const curCat = machines.find((m) => m.id === cur)?.category;
  const list = machines.filter((m) => !m.archived && (m.name + ' ' + m.category).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(history.has(b.id)) - Number(history.has(a.id)) || Number(b.category === curCat) - Number(a.category === curCat) || a.name.localeCompare(b.name));
  const choose = async (id: string | null) => {
    await switchMachine(ex.id, id);
    const h = history.get(id ?? 'nd');
    toast({ text: h ? `Macchina cambiata: riprendi lo storico di questa macchina (${h.n} sedute)` : 'Macchina cambiata: storico nuovo, nessun carico ripreso dall\'altra macchina' });
    onClose();
  };
  return (
    <Sheet title={`Macchina per ${ex.name}`} onClose={onClose}>
      <p className="small muted">Ogni macchina ha regolazioni, incrementi e storico propri: i kg di una non vengono usati per suggerire carichi sull'altra.</p>
      {!adding ? (
        <>
          <input type="search" placeholder="Cerca macchina…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca macchina" />
          <ul className="list mt">
            {list.map((m) => {
              const h = history.get(m.id);
              return (
                <li key={m.id}>
                  <button type="button" className="listbtn" onClick={() => choose(m.id)} aria-pressed={m.id === cur}>
                    <span><strong>{m.name}</strong>{m.id === cur ? ' · in uso' : ''}<br />
                      <span className="small muted">{machineSummary(m).replace(m.name, '').replace(/^ · /, '') || 'regolazioni non indicate'}{h ? ` · ${h.n} sedute, ultima ${formatDateIt(h.last!)} a ${fmtNum(h.top, 2)} kg` : ' · nessuna seduta con questo esercizio'}</span>
                    </span>
                    {m.id === cur ? <Icon.check /> : <Icon.right />}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn block mt" onClick={() => { setAdding(true); setName(q); }}><Icon.plus /> Nuova macchina</button>
        </>
      ) : (
        <div className="col">
          <Field label="Nome (come la riconosci in sala)"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Hack squat 2 (vicino alle presse)" /></Field>
          <div className="grid2">
            <Field label="Sedile / posizione"><input value={seat} onChange={(e) => setSeat(e.target.value)} placeholder="es. foro 4" /></Field>
            <Field label="Schienale"><input value={backrest} onChange={(e) => setBackrest(e.target.value)} /></Field>
          </div>
          <NumInput label="Incremento più piccolo (kg)" hint="Facoltativo: serve per proporre aumenti realistici" value={inc} onChange={setInc} />
          <button type="button" className="btn primary block" disabled={!name.trim()} onClick={async () => {
            const m = await createMachine({ name, seat, backrest, increments: inc ? [inc] : [], category: machines.find((x) => x.id === cur)?.category ?? '' });
            await choose(m.id);
          }}>Crea e usa questa macchina</button>
          <button type="button" className="btn block" onClick={() => setAdding(false)}>Annulla</button>
        </div>
      )}
    </Sheet>
  );
}

export { parseNum };
