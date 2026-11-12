import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Exercise, LoadConvention, Machine, Muscle } from '../db/types';
import { Check, Field, Icon, NumInput, Tabs, go, useToast } from '../ui/kit';
import { ALL_MUSCLES, CONVENTION_LABEL, MUSCLE_LABEL } from '../ui/labels';
import { uid, parseNum, fmtNum } from '../lib/id';
import { dateKey, formatDateIt } from '../lib/dates';
import { setUnsaved } from '../lib/pwa';

export function CatalogScreen() {
  const [tab, setTab] = useState<'ex' | 'mac'>('ex');
  const [q, setQ] = useState('');
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? [];
  const machines = useLiveQuery(() => db.machines.orderBy('name').toArray(), []) ?? [];
  const f = (s: string) => s.toLowerCase().includes(q.toLowerCase());
  const create = async () => {
    if (tab === 'ex') {
      const e: Exercise = { id: uid(), name: 'Nuovo esercizio', aliases: [], variant: '', machineId: null, equipment: '', primaryMuscles: [], secondaryMuscles: [], loadConvention: 'unknown', unilateral: false, romType: 'full', configVersion: 1, configNote: '', techNotes: '', toConfirm: [], policyClass: 'isolation' };
      await db.exercises.add(e); go(`allenamento/esercizio/${e.id}`);
    } else {
      const m: Machine = { id: uid(), name: 'Nuova attrezzatura', category: '', brand: '', model: '', seat: '', backrest: '', rollers: '', grip: '', camLever: '', loadPoints: '', minLoadKg: null, increments: [], barWeightKg: null, pulleyRatio: null, maxedOut: false, photoId: null, notes: '', toConfirm: [] };
      await db.machines.add(m); go(`allenamento/macchina/${m.id}`);
    }
  };
  return (
    <main className="main">
      <a href="#/allenamento" className="small">‹ Allenamento</a>
      <h1>Esercizi e macchine</h1>
      <Tabs value={tab} onChange={setTab} items={[['ex', `Esercizi (${exercises.length})`], ['mac', `Macchine (${machines.length})`]]} />
      <input type="search" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca" />
      <ul className="list mt">
        {tab === 'ex' && exercises.filter((e) => f(e.name + e.aliases.join(' '))).map((e) => (
          <li key={e.id}><a className="listbtn" href={`#/allenamento/esercizio/${e.id}`}><span>{e.name}{e.aliases.length ? <span className="small muted"> · “{e.aliases.join('”, “')}”</span> : null}{e.toConfirm.length ? <><br /><span className="badge warn">{e.toConfirm.length} da confermare</span></> : null}</span><Icon.right /></a></li>
        ))}
        {tab === 'mac' && machines.filter((m) => f(m.name + m.category)).map((m) => (
          <li key={m.id}><a className="listbtn" href={`#/allenamento/macchina/${m.id}`}><span>{m.name}<br /><span className="small muted">{m.category}{m.maxedOut ? ' · carico già al massimo' : ''}</span></span><Icon.right /></a></li>
        ))}
      </ul>
      <button className="btn block mt" onClick={create}><Icon.plus /> {tab === 'ex' ? 'Nuovo esercizio' : 'Nuova macchina'}</button>
    </main>
  );
}

export function ExerciseEditor({ id }: { id: string }) {
  const stored = useLiveQuery(() => db.exercises.get(id), [id]);
  const machines = useLiveQuery(() => db.machines.orderBy('name').toArray(), []) ?? [];
  const history = useLiveQuery(async () => {
    const sets = await db.sets.where('exerciseId').equals(id).toArray();
    const m = new Map<string, number>();
    for (const s of sets) m.set(s.configKey, (m.get(s.configKey) ?? 0) + 1);
    return m;
  }, [id]) ?? new Map();
  const toast = useToast();
  const [e, setE] = useState<Exercise | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (stored && !dirty) setE(structuredClone(stored)); }, [stored, dirty]);
  useEffect(() => { setUnsaved('exercise-editor', dirty); return () => setUnsaved('exercise-editor', false); }, [dirty]);
  if (!e || !stored) return <main className="main"><p className="muted">Caricamento…</p></main>;
  const up = (p: Partial<Exercise>) => { setE({ ...e, ...p }); setDirty(true); };
  const configChanged = e.machineId !== stored.machineId || e.romType !== stored.romType || e.loadConvention !== stored.loadConvention;
  const save = async (bump = false) => {
    const next = { ...e };
    if (configChanged || bump) {
      next.configVersion = stored.configVersion + 1;
      next.configNote = `Nuova configurazione dal ${formatDateIt(dateKey(), true)}${bump ? ' (setup/leva cambiati)' : ''}. Lo storico precedente resta separato.`;
    }
    await db.exercises.put(next);
    setDirty(false);
    toast({ text: configChanged || bump ? 'Salvato ✓ — nuova baseline: i confronti ripartono da qui' : 'Salvato ✓' });
  };
  const toggleMuscle = (key: 'primaryMuscles' | 'secondaryMuscles', m: Muscle) => up({ [key]: e[key].includes(m) ? e[key].filter((x) => x !== m) : [...e[key], m] } as Partial<Exercise>);
  return (
    <main className="main">
      <a href="#/allenamento/catalogo" className="small">‹ Catalogo</a>
      <div className="col mt">
        <Field label="Nome"><input value={e.name} onChange={(x) => up({ name: x.target.value })} /></Field>
        <Field label="Alias" hint="Nomi informali, separati da virgola: restano alias, non descrizioni biomeccaniche."><input value={e.aliases.join(', ')} onChange={(x) => up({ aliases: x.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
        <Field label="Variante"><input value={e.variant} onChange={(x) => up({ variant: x.target.value })} /></Field>
        <Field label="Macchina / attrezzatura">
          <select value={e.machineId ?? ''} onChange={(x) => up({ machineId: x.target.value || null })}>
            <option value="">Non specificata</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Convenzione del carico" hint="Convenzioni diverse non vengono sommate né confrontate.">
          <select value={e.loadConvention} onChange={(x) => up({ loadConvention: x.target.value as LoadConvention })}>
            {Object.entries(CONVENTION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="ROM pianificato">
          <select value={e.romType} onChange={(x) => up({ romType: x.target.value as Exercise['romType'] })}>
            <option value="full">Completo confortevole</option>
            <option value="partial_planned">Parziale intenzionale (protocollo separato)</option>
          </select>
        </Field>
        <Check checked={e.unilateral} onChange={(v) => up({ unilateral: v })}>Unilaterale: ripetizioni registrate per lato (mai raddoppiate)</Check>
        <Field label="Classe per la policy RIR">
          <select value={e.policyClass} onChange={(x) => up({ policyClass: x.target.value as Exercise['policyClass'] })}>
            <option value="heavy_compound">Multiarticolare pesante (RDL, hack, pressa)</option>
            <option value="compound">Multiarticolare</option>
            <option value="isolation">Isolamento</option>
            <option value="calves_abs">Polpacci / addome</option>
          </select>
        </Field>
        <fieldset className="card flat"><legend className="small"><strong>Muscoli principali</strong></legend>
          <div className="chips">{ALL_MUSCLES.map((m) => <button key={m} type="button" className="chip" aria-pressed={e.primaryMuscles.includes(m)} onClick={() => toggleMuscle('primaryMuscles', m)}>{MUSCLE_LABEL[m]}</button>)}</div>
        </fieldset>
        <fieldset className="card flat"><legend className="small"><strong>Muscoli secondari (indiretti)</strong></legend>
          <div className="chips">{ALL_MUSCLES.map((m) => <button key={m} type="button" className="chip" aria-pressed={e.secondaryMuscles.includes(m)} onClick={() => toggleMuscle('secondaryMuscles', m)}>{MUSCLE_LABEL[m]}</button>)}</div>
        </fieldset>
        <Field label="Note tecniche e riferimento di fine ROM"><textarea value={e.techNotes} onChange={(x) => up({ techNotes: x.target.value })} /></Field>
        <Field label="Da confermare" hint="Una voce per riga"><textarea value={e.toConfirm.join('\n')} onChange={(x) => up({ toConfirm: x.target.value.split('\n').filter((s) => s.trim()) })} /></Field>
        {configChanged && <div className="banner warn small">Hai cambiato macchina, ROM o convenzione: salvando inizia una nuova configurazione con storico distinto. I kg diversi non verranno letti come guadagno o perdita di forza.</div>}
        <p className="small muted">Configurazione attuale v{stored.configVersion}. {stored.configNote}</p>
        {history.size > 0 && <p className="small muted">Serie registrate per configurazione: {[...history.entries()].map(([k, n]) => `${k.split('|')[2]} (${n})`).join(', ')}</p>}
        <button className="btn primary block" disabled={!dirty} onClick={() => save(false)}>{dirty ? 'Salva' : 'Salvato'}</button>
        <button className="btn block" onClick={() => save(true)}>Ho cambiato setup o leva: avvia nuova baseline</button>
      </div>
    </main>
  );
}

export function MachineEditor({ id }: { id: string }) {
  const stored = useLiveQuery(() => db.machines.get(id), [id]);
  const photo = useLiveQuery(async () => (stored?.photoId ? db.attachments.get(stored.photoId) : undefined), [stored?.photoId]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!photo) { setUrl(null); return; } const u = URL.createObjectURL(photo.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [photo]);
  const toast = useToast();
  const [m, setM] = useState<Machine | null>(null);
  const [dirty, setDirty] = useState(false);
  const [incText, setIncText] = useState('');
  useEffect(() => { if (stored && !dirty) { setM(structuredClone(stored)); setIncText(stored.increments.map((x) => fmtNum(x, 2)).join('; ')); } }, [stored, dirty]);
  useEffect(() => { setUnsaved('machine-editor', dirty); return () => setUnsaved('machine-editor', false); }, [dirty]);
  if (!m) return <main className="main"><p className="muted">Caricamento…</p></main>;
  const up = (p: Partial<Machine>) => { setM({ ...m, ...p }); setDirty(true); };
  const T = (k: keyof Machine, label: string, hint?: string) => <Field label={label} hint={hint}><input value={String(m[k] ?? '')} onChange={(e) => up({ [k]: e.target.value } as Partial<Machine>)} /></Field>;
  return (
    <main className="main">
      <a href="#/allenamento/catalogo" className="small">‹ Catalogo</a>
      <div className="col mt">
        {T('name', 'Nome')}
        <p className="small muted">ID: {m.id}</p>
        {T('category', 'Categoria')}
        <div className="grid2">{T('brand', 'Marca')}{T('model', 'Modello')}</div>
        <div className="grid2">{T('seat', 'Sedile')}{T('backrest', 'Schienale')}</div>
        <div className="grid2">{T('rollers', 'Rulli')}{T('grip', 'Presa')}</div>
        {T('camLever', 'Impostazione camma / leva')}
        {T('loadPoints', 'Punti di carico', 'La funzione non viene dedotta dal nome: verifica manuale o istruttore.')}
        <NumInput label="Carico minimo (kg)" value={m.minLoadKg} onChange={(v) => up({ minLoadKg: v })} />
        <Field label="Incrementi disponibili (kg)" hint="Separati da punto e virgola, es. 1,25; 2,5; 5">
          <input value={incText} inputMode="decimal" onChange={(e) => { setIncText(e.target.value); up({ increments: e.target.value.split(';').map((s) => parseNum(s)).filter((x): x is number => x != null && x > 0) }); }} />
        </Field>
        <NumInput label="Peso effettivo barra (kg) — multipower/bilancieri" hint="Lascia vuoto se non noto: non viene inventato." value={m.barWeightKg} onChange={(v) => up({ barWeightKg: v })} />
        <Field label="Rapporto carrucole (cavi)" hint="Vuoto = sconosciuto"><input value={m.pulleyRatio ?? ''} onChange={(e) => up({ pulleyRatio: e.target.value || null })} /></Field>
        <Check checked={m.maxedOut} onChange={(v) => up({ maxedOut: v })}>Carico già al massimo (progressione con ripetizioni/configurazioni consentite, nessuna aggiunta non approvata)</Check>
        <Field label="Note"><textarea value={m.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
        <Field label="Da confermare" hint="Una voce per riga"><textarea value={m.toConfirm.join('\n')} onChange={(e) => up({ toConfirm: e.target.value.split('\n').filter((s) => s.trim()) })} /></Field>
        <div className="card flat">
          <div className="small"><strong>Foto (facoltativa, solo locale)</strong></div>
          {url && <img src={url} alt={`Foto ${m.name}`} style={{ width: '100%', borderRadius: 12, marginTop: 8 }} />}
          <input type="file" accept="image/*" aria-label="Scegli foto" onChange={async (ev) => {
            const f = ev.target.files?.[0]; if (!f) return;
            const aid = uid();
            await db.attachments.add({ id: aid, blob: f, mime: f.type, createdAt: Date.now() });
            if (m.photoId) await db.attachments.delete(m.photoId);
            await db.machines.update(m.id, { photoId: aid });
            toast({ text: 'Foto salvata sul dispositivo ✓' });
          }} />
          {m.photoId && <button className="btn sm mt" onClick={async () => { await db.attachments.delete(m.photoId!); await db.machines.update(m.id, { photoId: null }); }}>Rimuovi foto</button>}
        </div>
        <button className="btn primary block" disabled={!dirty} onClick={async () => { await db.machines.put(m); setDirty(false); toast({ text: 'Salvato ✓' }); }}>{dirty ? 'Salva' : 'Salvato'}</button>
      </div>
    </main>
  );
}
