import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Program, ProgramDay, ProgramItem, RirTarget } from '../db/types';
import { Check, Field, Icon, NumInput, Sheet, Tabs, go, useSettings, useToast } from '../ui/kit';
import { parseProgramFile, previewProgramImport, applyProgramImport, exportPrograms, type ProgramFile, type ProgramImportPreview } from '../lib/programImport';
import { rankTemplates } from '../catalog/templates';
import { estimateDayMinutes } from '../lib/duration';
import { EQ_LABEL } from '../ui/labels';
import { downloadText } from '../lib/backup';
import { WEEKDAYS } from '../lib/dates';
import { uid } from '../lib/id';
import { suggestedRirTargets, newProgramItem, RANGE_PROPOSAL } from '../lib/setTarget';
import { Picker, exercisePickItems, type PickItem } from '../ui/Picker';
import { EXERCISE_FILTERS } from '../ui/labels';
import { patchSettings } from '../db/bootstrap';
import { setUnsaved } from '../lib/pwa';
import { activateTemplate } from './Onboarding';

const KIND_LABEL = { declared: 'Dichiarata', template: 'Template dimostrativo', custom: 'Personale' };

export function ProgramsScreen() {
  const programs = useLiveQuery(() => db.programs.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const settings = useSettings();
  const toast = useToast();
  const [tab, setTab] = useState<'mine' | 'reco' | 'all'>('mine');
  const [imp, setImp] = useState<null | { file: ProgramFile; preview: ProgramImportPreview; done?: string[] }>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cls = new Map(exercises.map((e) => [e.id, e.policyClass]));
  const eqOf = new Map(exercises.map((e) => [e.id, e.equipmentKind]));
  const duplicate = async (p: Program) => {
    const copy: Program = { ...structuredClone(p), id: uid(), name: `${p.name} (copia)`, kind: 'custom', origin: 'user', catalogVersion: undefined, isActive: false, createdAt: Date.now(), revision: 1 };
    copy.days = copy.days.map((d) => ({ ...d, id: uid(), items: d.items.map((i) => ({ ...i, id: uid() })) }));
    await db.programs.add(copy);
    toast({ text: 'Scheda duplicata: la versione precedente resta com\'era' });
    go(`allenamento/scheda/${copy.id}`);
  };
  const activate = async (id: string) => {
    await db.transaction('rw', db.programs, async () => {
      for (const p of await db.programs.toArray()) await db.programs.update(p.id, { isActive: p.id === id });
    });
    toast({ text: 'Scheda attiva' });
  };
  const create = async () => {
    const p: Program = { id: uid(), name: 'Nuova scheda', kind: 'custom', origin: 'user', isActive: false, notes: '', createdAt: Date.now(), days: [{ id: uid(), name: 'Giorno 1', weekday: 1, items: [] }] };
    await db.programs.add(p);
    go(`allenamento/scheda/${p.id}`);
  };
  const exportOne = async (p: Program) => downloadText(`scheda-${p.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`, await exportPrograms([p.id]), 'application/json');
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { const file = parseProgramFile(await f.text()); setImp({ file, preview: await previewProgramImport(file) }); }
    catch (e) { toast({ text: String(e instanceof Error ? e.message : e), kind: 'error' }); }
    if (fileInput.current) fileInput.current.value = '';
  };
  const week = (p: Program) => {
    const mins = p.days.filter((d) => d.items.length).map((d) => estimateDayMinutes(d.items, (id) => cls.get(id)));
    const eq = [...new Set(p.days.flatMap((d) => d.items.map((i) => eqOf.get(i.exerciseId))).filter(Boolean))] as string[];
    return `${p.days.length} giorni · ${mins.length ? (Math.min(...mins) === Math.max(...mins) ? Math.min(...mins) : Math.min(...mins) + '–' + Math.max(...mins)) + ' min a seduta' : 'vuota'}${eq.length ? ' · ' + eq.map((x) => EQ_LABEL[x as keyof typeof EQ_LABEL] ?? x).join(', ') : ''}`;
  };
  const prof = settings.profile;
  const ranked = rankTemplates({ days: prof.trainingDaysPerWeek, equipment: prof.equipment, experience: prof.experience, minutes: prof.sessionMinutes });
  const list = programs.filter((p) => !p.archived && (tab === 'mine' ? p.kind !== 'template' : tab === 'all'))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || Number(a.kind === 'template') - Number(b.kind === 'template'));
  const Card = ({ p, reasons }: { p: Program; reasons?: string[] }) => (
    <div className={`card ${p.isActive ? 'accent' : ''}`} data-testid="program-card">
      <div className="row between"><span className="badge">{KIND_LABEL[p.kind]}</span>{p.isActive && <span className="badge accent">Attiva</span>}</div>
      <h3 className="mt">{p.name}</h3>
      <p className="small" data-testid="program-week">{week(p)}</p>
      <p className="small muted">{p.days.map((d) => `${d.weekday ? WEEKDAYS[d.weekday].slice(0, 3) : '—'}: ${d.name}`).join(' · ')}</p>
      {reasons && <p className="small muted">{reasons.join(' · ')}</p>}
      {p.origin === 'legacy_seed' && p.kind !== 'template' && (
        <div className="row wrap mb0" style={{ marginBottom: 8 }}>
          <span className="small grow">Scheda del vecchio avvio precompilato: resta solo su questo dispositivo.</span>
          <button className="btn sm primary" onClick={async () => { await db.programs.update(p.id, { origin: 'user', kind: 'custom' }); toast({ text: 'Ora è una tua scheda personale' }); }}>Mantieni come mia</button>
          <button className="btn sm" onClick={async () => { await db.programs.update(p.id, { archived: true, isActive: false }); toast({ text: 'Archiviata (non cancellata): lo storico resta.' }); }}>Archivia</button>
        </div>
      )}
      <div className="row wrap">
        <a className="btn sm" href={`#/allenamento/scheda/${p.id}`}><Icon.edit /> Apri</a>
        {!p.isActive && p.kind === 'template' && <button className="btn sm primary" onClick={async () => { await activateTemplate(p.id); toast({ text: 'Copia creata e attivata ✓' }); }}>Usa come mia scheda</button>}
        {!p.isActive && p.kind !== 'template' && <button className="btn sm" onClick={() => activate(p.id)}>Rendi attiva</button>}
        <button className="btn sm" onClick={() => duplicate(p)}>Duplica</button>
        {p.kind !== 'template' && <button className="btn sm" onClick={() => exportOne(p)}>Esporta</button>}
      </div>
    </div>
  );
  return (
    <main className="main">
      <a href="#/allenamento" className="small">‹ Allenamento</a>
      <h1>Schede</h1>
      <div className="row wrap" style={{ marginBottom: 10 }}>
        <button className="btn sm primary" onClick={create}><Icon.plus /> Crea</button>
        <button className="btn sm" onClick={() => fileInput.current?.click()}>Importa una scheda</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden aria-label="File della scheda da importare" onChange={(e) => onFile(e.target.files?.[0])} data-testid="import-input" />
      </div>
      <Tabs value={tab} onChange={setTab} items={[['mine', 'La mia'], ['reco', 'Consigliate'], ['all', 'Tutte']]} />
      {tab === 'reco' && (
        <>
          <p className="small muted">Prima i vincoli (giorni, attrezzatura, minuti a seduta), poi esperienza e preferenze. Durate calcolate da serie, recuperi, avvicinamenti e transizioni. {prof.trainingDaysPerWeek == null || prof.sessionMinutes == null ? 'Indica giorni e minuti nel profilo per consigli più precisi.' : ''}</p>
          {ranked.slice(0, 3).map((t) => { const p = programs.find((x) => x.id === t.id); if (!p) return null; const exact = prof.trainingDaysPerWeek == null || t.days === prof.trainingDaysPerWeek; const fits = prof.sessionMinutes == null || t.minutes <= prof.sessionMinutes;
            return <div key={t.id}>{(!exact || !fits) && <p className="small banner warn">Compromesso: {!exact ? `${t.days} giorni invece di ${prof.trainingDaysPerWeek}` : ''}{!exact && !fits ? ' · ' : ''}{!fits ? `circa ${t.minutes} min contro ${prof.sessionMinutes}` : ''}</p>}<Card p={p} reasons={[...t.reasons, t.path]} /></div>; })}
        </>
      )}
      {tab !== 'reco' && list.map((p) => <Card key={p.id} p={p} />)}
      {tab === 'mine' && !list.length && <p className="empty">Nessuna scheda personale. <button className="linklike" onClick={() => setTab('reco')}>Guarda le consigliate</button> oppure crea o importa una scheda.</p>}
      {programs.some((p) => p.archived) && (
        <details className="card flat mt"><summary>Archiviate ({programs.filter((p) => p.archived).length})</summary>
          <ul className="list">{programs.filter((p) => p.archived).map((p) => <li key={p.id} className="row between"><span className="small">{p.name}</span><button className="btn sm" onClick={() => db.programs.update(p.id, { archived: false })}>Ripristina</button></li>)}</ul>
        </details>
      )}
      {imp && (
        <Sheet title="Importa una scheda" onClose={() => setImp(null)}>
          <div data-testid="import-preview" className="small">
            <p><strong>Importazione aggiuntiva:</strong> non sostituisce il diario, non cambia la scheda attiva e non crea sedute.</p>
            <ul>{imp.preview.programs.map((x) => <li key={x.id}>{x.name} ({x.days} giorni): <strong>{x.status === 'nuova' ? 'nuova' : x.status === 'identica' ? 'già presente, identica (saltata)' : 'diversa dalla tua: tengo la tua'}</strong></li>)}</ul>
            <p>Esercizi personali: {imp.preview.exercises.added} nuovi, {imp.preview.exercises.identical} già presenti{imp.preview.exercises.conflicts ? `, ${imp.preview.exercises.conflicts} diversi (tengo i tuoi)` : ''}. Macchine: {imp.preview.machines.added} nuove.</p>
            {imp.preview.missing.length > 0 && <p className="banner warn">Mancano {imp.preview.missing.length} esercizi richiesti ({[...new Set(imp.preview.missing.map((m) => m.exerciseId))].slice(0, 5).join(', ')}): l'importazione non è possibile finché il file non li contiene.</p>}
            {imp.preview.ignored.length > 0 && <p className="muted">Ignorati dal file (non riguardano le schede): {imp.preview.ignored.join(', ')}.</p>}
          </div>
          {!imp.done ? (
            <div className="grid2"><button className="btn" onClick={() => setImp(null)}>Annulla</button>
              <button className="btn primary" disabled={imp.preview.missing.length > 0} onClick={async () => {
                try { const r = await applyProgramImport(imp.file); toast({ text: `Importate ${r.programs} schede, ${r.exercises} esercizi; ${r.skipped} voci già presenti saltate` }); setImp({ ...imp, done: imp.file.programs.map((x) => x.id) }); }
                catch (e) { toast({ text: String(e instanceof Error ? e.message : e), kind: 'error' }); }
              }}>Importa</button></div>
          ) : (
            <div className="col"><p className="small">Fatto. Vuoi usarne una adesso?</p>
              {imp.file.programs.map((x) => <button key={x.id} className="btn primary" onClick={async () => { await activate(x.id); setImp(null); setTab('mine'); }}>Rendi attiva «{x.name}»</button>)}
              <button className="btn" onClick={() => { setImp(null); setTab('mine'); }}>Più tardi</button></div>
          )}
        </Sheet>
      )}
    </main>
  );
}


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
  // selettore: aggiunta multipla a un giorno, oppure cambio di un esercizio
  const [pick, setPick] = useState<null | { di: number; ii?: number }>(null);
  const [pickItems, setPickItems] = useState<PickItem[]>([]);
  useEffect(() => { if (pick) exercisePickItems().then(setPickItems); }, [pick]);
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
    await db.programs.put({ ...p, userModified: p.origin === 'catalog' ? true : p.userModified });
    setDirty(false);
    toast({ text: 'Scheda salvata ✓' });
  };
  const applyPolicy = async () => {
    const np = { ...p, days: p.days.map((d) => ({ ...d, items: d.items.map((it) => {
      const ex = exMap.get(it.exerciseId);
      return it.sets && ex ? { ...it, rirTargets: suggestedRirTargets(ex.policyClass, it.sets, 3), rirManual: false } : it;
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
                  <button className="btn sm" onClick={() => setPick({ di, ii })}>Cambia esercizio…</button>
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
                  {ex && it.sets ? <p className="small" data-testid="rir-source">{it.rirManual ? <><span className="badge accent">prescritto da te</span> {it.rirTargets.map((t, k) => `S${k + 1}: ${t ? (t.min === t.max ? t.min : t.min + '–' + t.max) : '—'}`).join(' · ')} <button className="linklike" onClick={() => upItem(di, ii, { rirManual: false, rirTargets: suggestedRirTargets(ex.policyClass, it.sets!, 3) })}>Torna ai suggerimenti</button></> : <><span className="badge">suggerito</span> {suggestedRirTargets(ex.policyClass, it.sets, 3).map((t, k) => `S${k + 1}: RIR ${t.min === t.max ? t.min : t.min + '–' + t.max}`).join(' · ')} <span className="muted">(prima volta con la variante: margine più ampio). In seduta il target si adatta ai riscontri che inserisci.</span></>}</p> : null}
                  {it.rirTargets.length > 0 && (
                    <div>
                      <div className="small"><strong>RIR target per serie</strong> <span className="muted">(cambiarli li rende «prescritti da te»)</span></div>
                      {it.rirTargets.map((t, k) => (
                        <RirEdit key={k} label={`Serie ${k + 1}`} value={t} onChange={(nt) => upItem(di, ii, { rirManual: true, rirTargets: it.rirTargets.map((x, j) => (j === k ? nt : x)) })} />
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
            <button className="btn sm" onClick={() => setPick({ di })}><Icon.plus /> Aggiungi esercizi</button>
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

      {pick && (
        <Picker title={pick.ii == null ? `Aggiungi a «${p.days[pick.di].name}»` : 'Cambia esercizio'} multi={pick.ii == null} recentKey="exercise" items={pickItems} filters={EXERCISE_FILTERS}
          context={pick.ii == null ? 'Tocca uno o più esercizi, poi «Aggiungi». Nulla viene aggiunto finché non scegli.' : 'Cambiare esercizio avvia uno storico separato per la nuova variante.'}
          onClose={() => setPick(null)}
          onPick={(picked) => {
            if (pick.ii != null) { upItem(pick.di, pick.ii, { exerciseId: picked[0].id }); setPick(null); return; }
            const add = picked.map((x) => newProgramItem(uid(), exMap.get(x.id), x.id));
            upDay(pick.di, { items: [...p.days[pick.di].items, ...add] });
            toast({ text: `${add.length} esercizi aggiunti a «${p.days[pick.di].name}» (2 serie di partenza, modificabili). Ricorda di salvare.` });
            setPick(null);
          }} />
      )}
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
