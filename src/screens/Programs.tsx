import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Program, ProgramDay, ProgramItem, RirTarget } from '../db/types';
import { Check, Field, Icon, NumInput, Sheet, go, useSettings, useToast } from '../ui/kit';
import { WEEKDAYS } from '../lib/dates';
import { uid } from '../lib/id';
import { proposedRir } from '../lib/progression';
import { patchSettings } from '../db/bootstrap';
import { setUnsaved } from '../lib/pwa';

const KIND_LABEL = { declared: 'Dichiarata', template: 'Template dimostrativo', custom: 'Personale' };

export function ProgramsScreen() {
  const programs = useLiveQuery(() => db.programs.toArray(), []) ?? [];
  const toast = useToast();
  const duplicate = async (p: Program) => {
    const copy: Program = { ...structuredClone(p), id: uid(), name: `${p.name} (copia)`, kind: 'custom', isActive: false, createdAt: Date.now() };
    copy.days = copy.days.map((d) => ({ ...d, id: uid(), items: d.items.map((i) => ({ ...i, id: uid() })) }));
    await db.programs.add(copy);
    toast({ text: 'Scheda duplicata' });
    go(`allenamento/scheda/${copy.id}`);
  };
  const activate = async (id: string) => {
    await db.transaction('rw', db.programs, async () => {
      for (const p of await db.programs.toArray()) await db.programs.update(p.id, { isActive: p.id === id });
    });
  };
  const create = async () => {
    const p: Program = { id: uid(), name: 'Nuova scheda', kind: 'custom', isActive: false, notes: '', createdAt: Date.now(), days: [{ id: uid(), name: 'Giorno 1', weekday: 1, items: [] }] };
    await db.programs.add(p);
    go(`allenamento/scheda/${p.id}`);
  };
  return (
    <main className="main">
      <a href="#/allenamento" className="small">‹ Allenamento</a>
      <h1>Schede</h1>
      <p className="small muted">La scheda attiva determina l'allenamento proposto per ogni giorno. Nessuna nuova scheda viene imposta: i template sono modelli dimostrativi modificabili, non piani validati.</p>
      {programs.sort((a, b) => Number(b.isActive) - Number(a.isActive)).map((p) => (
        <div className={`card ${p.isActive ? 'accent' : ''}`} key={p.id}>
          <div className="row between"><span className="badge">{KIND_LABEL[p.kind]}</span>{p.isActive && <span className="badge accent">Attiva</span>}</div>
          <h3 className="mt">{p.name}</h3>
          <p className="small muted">{p.days.map((d) => `${d.weekday ? WEEKDAYS[d.weekday].slice(0, 3) : '—'}: ${d.name}`).join(' · ')}</p>
          <div className="row wrap">
            <a className="btn sm" href={`#/allenamento/scheda/${p.id}`}><Icon.edit /> Apri</a>
            {!p.isActive && <button className="btn sm" onClick={() => activate(p.id)}>Rendi attiva</button>}
            <button className="btn sm" onClick={() => duplicate(p)}>Duplica</button>
          </div>
        </div>
      ))}
      <button className="btn block" onClick={create}><Icon.plus /> Nuova scheda vuota</button>
    </main>
  );
}

const RANGE_PROPOSAL: Record<string, [number, number]> = { heavy_compound: [6, 10], compound: [8, 12], isolation: [10, 15], calves_abs: [10, 15] };

export function ProgramEditor({ id }: { id: string }) {
  const stored = useLiveQuery(() => db.programs.get(id), [id]);
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? [];
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const settings = useSettings();
  const toast = useToast();
  const [p, setP] = useState<Program | null>(null);
  const [dirty, setDirty] = useState(false);
  const [policySheet, setPolicySheet] = useState(false);
  const [del, setDel] = useState(false);
  useEffect(() => { if (stored && !dirty) setP(structuredClone(stored)); }, [stored, dirty]);
  useEffect(() => { setUnsaved('program-editor', dirty); return () => setUnsaved('program-editor', false); }, [dirty]);
  if (!p) return <main className="main"><p className="muted">Caricamento…</p></main>;

  const change = (np: Program) => { setP(np); setDirty(true); };
  const upDay = (di: number, d: Partial<ProgramDay>) => change({ ...p, days: p.days.map((x, i) => (i === di ? { ...x, ...d } : x)) });
  const upItem = (di: number, ii: number, it: Partial<ProgramItem>) => upDay(di, { items: p.days[di].items.map((x, i) => (i === ii ? { ...x, ...it } : x)) });
  const move = (di: number, ii: number, dir: -1 | 1) => {
    const items = [...p.days[di].items];
    const j = ii + dir;
    if (j < 0 || j >= items.length) return;
    [items[ii], items[j]] = [items[j], items[ii]];
    upDay(di, { items });
  };
  const save = async () => {
    await db.programs.put(p);
    setDirty(false);
    toast({ text: 'Scheda salvata ✓' });
  };
  const applyPolicy = async () => {
    const np = { ...p, days: p.days.map((d) => ({ ...d, items: d.items.map((it) => {
      const ex = exMap.get(it.exerciseId);
      return it.sets && ex ? { ...it, rirTargets: proposedRir(ex.policyClass, it.sets) } : it;
    }) })) };
    change(np);
    await db.decisions.add({ id: uid(), at: Date.now(), scope: 'program', refId: p.id, ruleId: 'policy_5A_rir', decision: 'accepted', detail: 'Applicati target RIR proposti (da salvare)', reviewAfter: null });
    setPolicySheet(false);
  };

  return (
    <main className="main">
      <a href="#/allenamento/schede" className="small">‹ Schede</a>
      <Field label="Nome scheda"><input value={p.name} onChange={(e) => change({ ...p, name: e.target.value })} /></Field>
      {p.kind === 'declared' && <div className="banner info mt small">Modello dalla tua descrizione: i carichi indicati sono dichiarati, non record. Nessuna seduta o statistica viene creata da qui.</div>}
      {p.kind === 'template' && <div className="banner warn mt small">Template dimostrativo modificabile: non è un piano personale validato.</div>}
      {p.notes && <details className="mt"><summary>Note della scheda</summary><p className="small">{p.notes}</p></details>}
      <div className="row wrap mt">
        <button className="btn sm" onClick={() => setPolicySheet(true)}>Policy RIR proposta…</button>
      </div>

      {p.days.map((d, di) => (
        <section className="card mt" key={d.id}>
          <div className="grid2">
            <Field label="Nome giorno"><input value={d.name} onChange={(e) => upDay(di, { name: e.target.value })} /></Field>
            <Field label="Giorno settimana">
              <select value={d.weekday ?? ''} onChange={(e) => upDay(di, { weekday: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Non fissato</option>
                {[1, 2, 3, 4, 5, 6, 7].map((w) => <option key={w} value={w}>{WEEKDAYS[w]}</option>)}
              </select>
            </Field>
          </div>
          {d.items.map((it, ii) => {
            const ex = exMap.get(it.exerciseId);
            return (
              <details key={it.id} className="card flat mt">
                <summary>
                  <span className="grow">{ii + 1}. {ex?.name ?? it.exerciseId}<br /><span className="small muted">{it.sets ?? '?'} × {it.repMin ?? '?'}{it.repMax && it.repMax !== it.repMin ? '–' + it.repMax : ''}{it.declaredLoad ? ` · ${it.declaredLoad}` : ''}{it.priority != null ? ` · priorità ${it.priority}` : ''}</span></span>
                </summary>
                <div className="col">
                  <Field label="Esercizio">
                    <select value={it.exerciseId} onChange={(e) => upItem(di, ii, { exerciseId: e.target.value })}>
                      {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </Field>
                  <div className="grid3">
                    <NumInput label="Serie" value={it.sets} decimals={false} onChange={(v) => upItem(di, ii, { sets: v, rirTargets: Array.from({ length: v ?? 0 }, (_, k) => it.rirTargets[k] ?? null) })} />
                    <NumInput label="Rip. min" value={it.repMin} decimals={false} onChange={(v) => upItem(di, ii, { repMin: v })} />
                    <NumInput label="Rip. max" value={it.repMax} decimals={false} onChange={(v) => upItem(di, ii, { repMax: v })} />
                  </div>
                  {it.sets == null && <p className="small"><span className="badge warn">Da confermare</span> numero di serie non noto</p>}
                  <div className="grid2">
                    <NumInput label="Recupero (s)" value={it.restSec} decimals={false} onChange={(v) => upItem(di, ii, { restSec: v })} />
                    <NumInput label="Priorità tempo ridotto" hint="1 = più importante" value={it.priority} decimals={false} onChange={(v) => upItem(di, ii, { priority: v })} />
                  </div>
                  {it.rirTargets.length > 0 && (
                    <div>
                      <div className="small"><strong>RIR target per serie</strong></div>
                      {it.rirTargets.map((t, k) => (
                        <RirEdit key={k} label={`Serie ${k + 1}`} value={t} onChange={(nt) => upItem(di, ii, { rirTargets: it.rirTargets.map((x, j) => (j === k ? nt : x)) })} />
                      ))}
                    </div>
                  )}
                  {ex && RANGE_PROPOSAL[ex.policyClass] && (
                    <button className="btn sm" onClick={() => {
                      const r = ex.primaryMuscles.some((m) => m === 'deltoidi_laterali' || m === 'deltoidi_posteriori') ? [12, 20] : RANGE_PROPOSAL[ex.policyClass];
                      upItem(di, ii, { repMin: r[0], repMax: r[1] });
                      toast({ text: `Range ${r[0]}–${r[1]} proposto: è una scelta pratica, non una zona "magica". Cambiare range avvia una nuova baseline.` });
                    }}>Proponi range più ampio (opzionale)</button>
                  )}
                  {it.declaredLoad && <p className="small muted">Carico dichiarato: {it.declaredLoad} — riferimento, non record. Calibra in palestra.</p>}
                  {it.declaredNotes && <p className="small muted">{it.declaredNotes}</p>}
                  {[...(it.toConfirm ?? []), ...(ex?.toConfirm ?? [])].length > 0 && <p className="small"><span className="badge warn">Da confermare</span> {[...it.toConfirm, ...(ex?.toConfirm ?? [])].join(' · ')}</p>}
                  <div className="row wrap">
                    <button className="iconbtn" aria-label="Sposta su" onClick={() => move(di, ii, -1)}><Icon.up /></button>
                    <button className="iconbtn" aria-label="Sposta giù" onClick={() => move(di, ii, 1)}><Icon.down /></button>
                    {ex && <a className="btn sm" href={`#/allenamento/esercizio/${ex.id}`}>Scheda esercizio</a>}
                    <button className="btn sm danger" onClick={() => upDay(di, { items: d.items.filter((_, j) => j !== ii) })}>Rimuovi</button>
                  </div>
                </div>
              </details>
            );
          })}
          <div className="row wrap mt">
            <button className="btn sm" onClick={() => upDay(di, { items: [...d.items, { id: uid(), exerciseId: exercises[0]?.id ?? '', sets: 2, repMin: 8, repMax: 12, rirTargets: [null, null], restSec: 180, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' }] })}><Icon.plus /> Esercizio</button>
            <button className="btn sm danger" onClick={() => change({ ...p, days: p.days.filter((_, j) => j !== di) })}>Rimuovi giorno</button>
          </div>
        </section>
      ))}
      <button className="btn block mt" onClick={() => change({ ...p, days: [...p.days, { id: uid(), name: `Giorno ${p.days.length + 1}`, weekday: null, items: [] }] })}><Icon.plus /> Aggiungi giorno</button>

      <div className="card mt">
        <h3>Modalità tempo ridotto</h3>
        <p className="small muted">Usa le priorità indicate sopra per saltare gli esercizi meno importanti quando hai poco tempo. Non comprime recuperi e riscaldamento e non aumenta intensità o densità.</p>
        <Check checked={settings.reducedTimePrioritiesConfirmed} onChange={(v) => patchSettings({ reducedTimePrioritiesConfirmed: v })}>Confermo le priorità impostate</Check>
      </div>

      <div className="col mt">
        <button className="btn primary block" disabled={!dirty} onClick={save}>{dirty ? 'Salva scheda' : 'Salvata'}</button>
        {dirty && <button className="btn block" onClick={() => { setDirty(false); }}>Annulla modifiche</button>}
        <button className="btn danger block" onClick={() => setDel(true)}><Icon.trash /> Elimina scheda</button>
      </div>

      {policySheet && (
        <Sheet title="Policy RIR proposta" onClose={() => setPolicySheet(false)}>
          <p className="small">Proposta per allenamenti ordinari <strong>dopo una ripresa appropriata</strong>, non per la gestione del dolore. Da confermare, non legge universale:</p>
          <ul className="small">
            <li>RDL e hack/pressa: circa 2 RIR, niente cedimento assoluto o parziali extra per esaurimento.</li>
            <li>Chest press, lat, T-bar, military, panca multipower: prima serie ~2 RIR, seconda ~1.</li>
            <li>Curl, pushdown, fly, leg curl/extension, laterali: prima 1–2 RIR, ultima 0–1 se esecuzione stabile, senza dolore. 0 RIR facoltativo.</li>
            <li>Polpacci/addome: 1–2 RIR, ROM concordato e controllo.</li>
          </ul>
          <p className="small muted">Primo blocco di osservazione di 2–3 settimane mantenendo esercizi e serie: cambia una cosa alla volta.</p>
          <div className="grid2"><button className="btn" onClick={() => setPolicySheet(false)}>Non ora</button><button className="btn primary" onClick={applyPolicy}>Applica (poi salva)</button></div>
        </Sheet>
      )}
      {del && (
        <Sheet title="Eliminare la scheda?" onClose={() => setDel(false)}>
          <p>Le sedute già registrate restano nello storico.</p>
          <div className="grid2"><button className="btn" onClick={() => setDel(false)}>Annulla</button><button className="btn danger" onClick={async () => { await db.programs.delete(p.id); setDirty(false); go('allenamento/schede'); }}>Elimina</button></div>
        </Sheet>
      )}
    </main>
  );
}

function RirEdit({ label, value, onChange }: { label: string; value: RirTarget | null; onChange: (v: RirTarget | null) => void }) {
  return (
    <div className="row mt">
      <span className="small" style={{ width: 70 }}>{label}</span>
      <select aria-label={`${label} RIR minimo`} value={value?.min ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : { min: Number(e.target.value), max: Math.max(Number(e.target.value), value?.max ?? Number(e.target.value)) })}>
        <option value="">non impostato</option>{[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>min {n}</option>)}
      </select>
      <select aria-label={`${label} RIR massimo`} value={value?.max ?? ''} disabled={!value} onChange={(e) => value && onChange({ ...value, max: Math.max(value.min, Number(e.target.value)) })}>
        {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>max {n}</option>)}
      </select>
    </div>
  );
}
