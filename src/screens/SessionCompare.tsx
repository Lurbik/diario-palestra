// Proposta B · Confronto in evidenza: oggi accanto all'ultima seduta comparabile, serie per serie.
// Solo presentazione: bozza, salvataggio, correzione e ripresa restano quelli di Session.tsx.
// - L'ultima volta è mostrata solo se è la STESSA configurazione (esercizio, macchina, ROM, convenzione).
// - Le parziali sono una riga propria e non si sommano alle complete.
// - Ripetizioni e RIR non vengono mai copiati dalla volta precedente; il carico è precompilato e va confermato.
import type { Exercise, Machine, SessionItem, SetEntry } from '../db/types';
import type { Exposure } from '../lib/progression';
import type { FormState } from './Session';
import { Check, Chip, Field, Icon, NumInput } from '../ui/kit';
import { CONVENTION_LABEL, totalLoadNote } from '../ui/labels';
import { formatDateIt } from '../lib/dates';
import { fmtNum } from '../lib/id';

export type CompareField = 'load' | 'reps' | 'part' | 'rir';

const rirText = (rir: number | null, unknown: boolean) => (unknown ? 'RIR non so' : rir == null ? 'RIR —' : `RIR ${rir}`);
function cellText(load: number | null, reps: number | null, part: number, rir: number | null, rirUnknown: boolean, unilateral: boolean) {
  return {
    main: `${load == null ? '— kg' : `${fmtNum(load, 2)} kg`} × ${reps == null ? '—' : reps}${unilateral ? '/lato' : ''}`,
    sub: `${part ? `+${part} parziali` : '0 parziali'} · ${rirText(rir, rirUnknown)}`
  };
}

export function CompareEntry({ form, setForm, ex, machine, loadStep, item, prev, itemSets, field, setField, onEdit }: {
  form: FormState; setForm: (f: FormState) => void; ex: Exercise; machine: Machine | null | undefined; loadStep: number; item: SessionItem;
  prev: Exposure | null | undefined; itemSets: SetEntry[]; field: CompareField; setField: (f: CompareField) => void; onEdit: (s: SetEntry) => void;
}) {
  const up = (p: Partial<FormState>) => setForm({ ...form, ...p });
  const prevW = prev ? prev.sets.filter((s) => s.kind === 'working').sort((a, b) => a.order - b.order) : [];
  const doneW = itemSets.filter((s) => s.kind === 'working');
  const warm = itemSets.filter((s) => s.kind === 'warmup');
  const current = form.kind === 'working' ? doneW.length + 1 : null;
  const rows = Math.max(item.sets ?? 0, prevW.length, doneW.length + (form.kind === 'working' ? 1 : 0), 1);
  const prevLabel = prev ? formatDateIt(prev.dateKey) : 'Ultima volta';
  const cmpPrev = current ? prevW[current - 1] : undefined;
  const target = `${item.sets ?? '?'} × ${item.repMin ?? '?'}${item.repMax != null && item.repMax !== item.repMin ? '–' + item.repMax : ''}`;
  const rirT = current ? item.rirTargets[current - 1] : null;

  let delta: { cls: string; text: string };
  if (!current) delta = { cls: 'eq', text: 'Riscaldamento: non entra nel confronto né nella progressione.' };
  else if (!cmpPrev) delta = { cls: 'eq', text: prev === null ? 'Nessuna seduta precedente con questa configurazione.' : `Serie ${current}: nessuna serie ${current} l'ultima volta.` };
  else if (form.fullReps == null) delta = { cls: 'eq', text: `Serie ${current}: inserisci le complete per vedere la differenza.` };
  else if (form.load !== cmpPrev.load) delta = { cls: 'eq', text: `Carico diverso dal ${prevLabel}: le ripetizioni non sono confrontabili direttamente.` };
  else {
    const d = form.fullReps - cmpPrev.fullReps;
    delta = { cls: d > 0 ? 'up' : d < 0 ? 'down' : 'eq', text: `Serie ${current} a parità di carico: ${d > 0 ? '+' : ''}${d} complete rispetto al ${prevLabel} (le parziali non contano).` };
  }

  const fieldValue = field === 'load' ? form.load : field === 'reps' ? form.fullReps : field === 'part' ? form.extraPartials : form.rir;
  const setFieldValue = (v: number | null) => {
    if (field === 'load') up({ load: v, loadPrefilledFrom: null });
    else if (field === 'reps') up({ fullReps: v == null ? null : Math.max(0, Math.round(v)) });
    else if (field === 'part') up({ extraPartials: v == null ? null : Math.max(0, Math.round(v)) });
  };
  const step = field === 'load' ? loadStep : 1;
  const bump = (dir: 1 | -1) => {
    if (field === 'reps' && form.fullReps == null) { up({ fullReps: dir > 0 ? item.repMin ?? 1 : 0 }); return; }
    const cur = fieldValue ?? 0;
    setFieldValue(Math.max(0, Math.round((cur + dir * step) * 1000) / 1000));
  };
  const note = totalLoadNote(ex.loadConvention, form.load, machine);

  return (
    <>
      <section className="card flat cmp-card" aria-label="Confronto con l'ultima volta">
        <div className="row between">
          <span className="small muted">Obiettivo <strong className="num">{target}</strong>{rirT ? ` · RIR ${rirT.min === rirT.max ? rirT.min : `${rirT.min}–${rirT.max}`}` : ''}</span>
          {form.loadPrefilledFrom && <span className="badge accent small" title={`Carico precompilato: ${form.loadPrefilledFrom}`}>carico precompilato</span>}
        </div>
        <table className="cmp num">
          <thead><tr><th scope="col">Serie</th><th scope="col">{prevLabel}</th><th scope="col">Oggi</th></tr></thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => {
              const n = i + 1;
              const p = prevW[i];
              const d = doneW[i];
              const isCur = current === n;
              const pc = p ? cellText(p.load, p.fullReps, p.extraPartials, p.rir, p.rirUnknown, p.unilateral) : null;
              const dc = d ? cellText(d.load, d.fullReps, d.extraPartials, d.rir, d.rirUnknown, d.unilateral) : isCur ? cellText(form.load, form.fullReps, form.extraPartials ?? 0, form.rir, form.rirUnknown, ex.unilateral) : null;
              return (
                <tr key={n} className={isCur ? 'cur' : ''}>
                  <th scope="row">{n}</th>
                  <td>{pc ? <><div>{pc.main}{p!.validReps != null && p!.validReps !== p!.fullReps ? ` (${p!.validReps} conf.)` : ''}</div><div className="sub">{pc.sub}</div></> : <span className="muted">—</span>}</td>
                  <td className={`today ${isCur ? 'active' : ''}`}>
                    {d ? (
                      <button type="button" className="cellbtn" onClick={() => onEdit(d)} aria-label={`Correggi serie ${n}`}>
                        <div>{dc!.main}{d.validReps != null && d.validReps !== d.fullReps ? ` (${d.validReps} conf.)` : ''}</div><div className="sub">{dc!.sub}{d.pain ? ' · dolore' : ''} · <u>Correggi</u></div>
                      </button>
                    ) : dc ? <><div>{dc.main}</div><div className="sub">{dc.sub}</div></> : <span className="muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={`delta ${delta.cls}`} aria-live="polite">{delta.text}</p>
        {warm.length > 0 && <p className="small muted">Riscaldamento: {warm.map((w) => `${fmtNum(w.load, 2)}×${w.fullReps}`).join(', ')} <button type="button" className="linkish" onClick={() => onEdit(warm[warm.length - 1])}>Correggi</button></p>}
      </section>

      <section aria-label={form.kind === 'warmup' ? 'Riscaldamento' : `Serie ${current}`}>
        <div className="seg" role="group" aria-label="Valore da modificare">
          {([['load', 'Carico'], ['reps', 'Complete'], ['part', 'Parziali'], ['rir', 'RIR']] as [CompareField, string][]).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={field === k} onClick={() => setField(k)}>{l}</button>
          ))}
        </div>
        <p className="small muted field-hint">
          {field === 'load' ? CONVENTION_LABEL[ex.loadConvention] : field === 'reps' ? `Ripetizioni complete al ROM pianificato${ex.unilateral ? ', per lato' : ''}` : field === 'part' ? 'Parziali extra dopo l\'ultima completa: non contano per la progressione' : 'Ripetizioni conformi ancora possibili; "non so" non vale 0'}
        </p>
        {field === 'rir' ? (
          <div className="chips" role="group" aria-label="RIR">
            {[0, 1, 2, 3, 4, 5].map((r) => <Chip key={r} on={!form.rirUnknown && form.rir === r} onClick={() => up({ rir: form.rir === r && !form.rirUnknown ? null : r, rirUnknown: false })} label={r === 5 ? 'RIR 5 o più' : `RIR ${r}`}>{r === 5 ? '5+' : r}</Chip>)}
            <Chip on={form.rirUnknown} onClick={() => up({ rirUnknown: !form.rirUnknown, rir: null })}>Non so</Chip>
          </div>
        ) : (
          <div className="stepper">
            <button type="button" aria-label="Diminuisci" onClick={() => bump(-1)}>−</button>
            <NumInput value={fieldValue} onChange={setFieldValue} decimals={field === 'load'} placeholder="—" id="cmp-value" />
            <button type="button" aria-label="Aumenta" onClick={() => bump(1)}>+</button>
          </div>
        )}
        {field === 'load' && note && <p className="small muted">{note}</p>}
        <div className="chips mt">
          <Chip on={form.kind === 'warmup'} onClick={() => up({ kind: form.kind === 'warmup' ? 'working' : 'warmup' })}>Riscaldamento</Chip>
          <Chip danger on={form.pain} onClick={() => up({ pain: !form.pain })}><Icon.alert /> Dolore</Chip>
        </div>
        {form.pain && (
          <div className="card danger flat mt">
            <Field label="Dove / come (facoltativo)"><input value={form.painNote} onChange={(e) => up({ painNote: e.target.value })} /></Field>
            <p className="small">Con dolore l'app non propone aumenti. Perdita di sensibilità perineale, nuove alterazioni di vescica/intestino o debolezza importante alle gambe: valutazione medica urgente.</p>
          </div>
        )}
        <details className="mt">
          <summary>Dettagli serie</summary>
          <div className="col">
            <div>
              <div className="small"><strong>Di cui conformi alla tecnica</strong></div>
              <div className="chips">
                <Chip on={form.conform === 'all'} onClick={() => up({ conform: 'all' })}>Tutte</Chip>
                <Chip on={form.conform === 'some'} onClick={() => up({ conform: 'some', validReps: form.validReps ?? form.fullReps })}>Non tutte</Chip>
                <Chip on={form.conform === 'unknown'} onClick={() => up({ conform: 'unknown' })}>Non valutato</Chip>
              </div>
              {form.conform === 'some' && <NumInput label="Ripetizioni conformi" value={form.validReps} onChange={(v) => up({ validReps: v == null ? null : Math.round(v) })} decimals={false} />}
            </div>
            {ex.unilateral && <NumInput label="Altro lato, se diverso" value={form.otherSide} onChange={(v) => up({ otherSide: v == null ? null : Math.round(v) })} decimals={false} />}
            <div className="grid2">
              <NumInput label="Parziali pianificate" hint="protocollo separato" value={form.plannedPartials} onChange={(v) => up({ plannedPartials: v })} decimals={false} />
              <NumInput label="Assistite" value={form.assistedReps} onChange={(v) => up({ assistedReps: v })} decimals={false} />
              <NumInput label="Tentativi falliti" value={form.failedAttempts} onChange={(v) => up({ failedAttempts: v })} decimals={false} />
            </div>
            <Check checked={form.techIssue} onChange={(v) => up({ techIssue: v })}>Problema tecnico o di setup</Check>
            <Field label="Note"><textarea value={form.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
          </div>
        </details>
      </section>
    </>
  );
}
