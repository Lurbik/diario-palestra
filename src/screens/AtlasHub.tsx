// Atlante unico: 3D (pacchetto facoltativo) o 2D curato (sempre disponibile offline), stessa nomenclatura.
// La selezione vive nell'indirizzo (#/progressi/atlante/<struttura> oppure /ex/<esercizio>): tornando indietro
// da una scheda esercizio si ritrova la stessa struttura.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import type { Muscle } from '../db/types';
import { Chip, go, useSettings, useToast } from '../ui/kit';
import type { Exercise } from '../db/types';
import { AddToDaySheet } from './AddToDay';
import { STRUCTURES, EXERCISE_STRUCTURES, GROUP_IT, MODEL3D, ROLE_LABEL, ANATOMY_SOURCE_URL, structureByKey, type Role } from '../catalog/anatomy3d';
import { downloadModel, isModelReady, loadModelBuffer, removeModel, webglAvailable } from '../lib/model3d';
import { workByMuscle } from '../lib/bodymap';
import { MUSCLE_LABEL } from '../ui/labels';
import { ALLOWED_EQ } from '../lib/substitute';
import { addDays, dateKey, formatDateIt } from '../lib/dates';
import { AtlasScreen } from './Atlas';
import type { Atlas3DHandle, MeshInfo, Paint } from './Atlas3D';

const Atlas3D = lazy(() => import('./Atlas3D').then((m) => ({ default: m.Atlas3D })));

/** Gruppo del diario per ogni struttura del modello: curate dalla scheda, le altre dal gruppo del modello. */
const MODEL_GROUP: Record<string, Muscle> = { Quadriceps: 'quadricipiti', Hamstrings: 'femorali', Glutes: 'glutei', Chest: 'petto', Lats: 'dorsali', 'Upper back': 'schiena_alta', Trapezius: 'schiena_alta', Biceps: 'bicipiti', Triceps: 'tricipiti', Forearms: 'avambracci', Calves: 'polpacci', Abdominals: 'addome', Obliques: 'addome', 'Lower back': 'lombari', 'Spinal extensors': 'lombari', Adductors: 'adduttori', 'Rotator cuff': 'cuffia_rotatori' };
const groupOf = (key: string, modelGroup?: string): Muscle | null => structureByKey(key)?.group ?? (modelGroup ? MODEL_GROUP[modelGroup] ?? null : null);
const binOf = (n: number) => (n >= 12 ? 3 : n >= 6 ? 2 : n >= 1 ? 1 : 0);
const MB = (b: number) => (b / 1048576).toFixed(1).replace('.', ',');

export function AtlasHub({ route }: { route: string[] }) {
  const settings = useSettings();
  const exParam = route[2] === 'ex' ? route[3] ?? null : null;
  const selParam = route[2] && route[2] !== 'ex' ? route[2] : null;
  const [pack, setPack] = useState<'checking' | 'missing' | 'downloading' | 'ready' | 'error'>('checking');
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [paintMode, setPaintMode] = useState<'anatomy' | 'work' | 'focus'>('anatomy');
  const [listN, setListN] = useState(40);
  const [addEx, setAddEx] = useState<Exercise | null>(null);
  const toast = useToast();
  const program = useLiveQuery(() => db.programs.filter((p) => p.isActive && !p.archived).first(), []);
  const [isolate, setIsolate] = useState(false);
  const [keys, setKeys] = useState<MeshInfo[]>([]);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'what' | 'ex' | 'mine'>('ex');
  const [cands, setCands] = useState<MeshInfo[] | null>(null);
  const nameOf = (m: MeshInfo) => structureByKey(m.key)?.it ?? `${GROUP_IT[m.group] ?? m.group}: ${m.sourceName.replace(/.(l|r)$/, '')}`;
  const ctl = useRef<Atlas3DHandle>(null);
  const abort = useRef<AbortController | null>(null);
  const gl = useMemo(() => webglAvailable(), []);
  const selected = selParam;
  const select = (k: string | null) => { location.replace(`#/progressi/atlante${k ? '/' + k : exParam ? '/ex/' + exParam : ''}`); setTab('ex'); };

  useEffect(() => { isModelReady().then((r) => setPack(r ? 'ready' : 'missing')); }, []);
  useEffect(() => { if (pack === 'ready' && gl && !buffer) loadModelBuffer().then(setBuffer); }, [pack, gl, buffer]);

  const today = dateKey();
  const sets = useLiveQuery(() => db.sets.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const focus = (useLiveQuery(() => db.kv.get('muscleFocus'), [])?.value as Muscle[] | undefined) ?? [];
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const work = useMemo(() => workByMuscle(sets, sessions, exMap, addDays(today, -6)), [sets, sessions, exMap, today]);
  const ex = exParam ? exMap.get(exParam) : undefined;
  const rel = exParam ? EXERCISE_STRUCTURES.filter((r) => r.exerciseId === exParam) : [];

  const modelGroupOf = useMemo(() => new Map(keys.map((k) => [k.key, k.group])), [keys]);
  const paint = useMemo(() => {
    const m = new Map<string, Paint>();
    if (exParam) { for (const r of rel) if (!m.has(r.key) || r.role === 'principale') m.set(r.key, r.role); return m; }
    if (cands) { for (const c of cands) m.set(c.key, 'cand'); return m; }
    if (paintMode === 'focus') { for (const k of new Set(keys.map((x) => x.key))) { const g = groupOf(k, modelGroupOf.get(k)); if (g && focus.includes(g)) m.set(k, 'principale'); } return m; }
    if (paintMode === 'work') for (const k of new Set(keys.map((x) => x.key))) { const g = groupOf(k, modelGroupOf.get(k)); if (g) m.set(k, `w${binOf(work.get(g)?.direct ?? 0)}` as Paint); }
    return m;
  }, [exParam, rel, paintMode, keys, work, modelGroupOf, cands, focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const startDownload = async () => {
    abort.current = new AbortController(); setPack('downloading'); setErr(null); setProgress(0);
    try { await downloadModel((d, t) => setProgress(d / t), abort.current.signal); setPack('ready'); }
    catch (e) { setPack((e as Error).name === 'AbortError' ? 'missing' : 'error'); if ((e as Error).name !== 'AbortError') setErr((e as Error).message); }
  };

  const sel = selected ? structureByKey(selected) : null;
  const selInfo = selected ? keys.find((k) => k.key === selected) : undefined;
  const selGroup = selected ? groupOf(selected, selInfo?.group ?? modelGroupOf.get(selected)) : null;
  const allowed = settings.profile.equipment ? ALLOWED_EQ[settings.profile.equipment] : null;
  const exForKey = selected ? EXERCISE_STRUCTURES.filter((r) => r.key === selected) : [];
  const byGroup = selGroup ? exercises.filter((e) => !e.archived && e.primaryMuscles.includes(selGroup) && (!allowed || !e.equipmentKind || allowed.includes(e.equipmentKind)) && !exForKey.some((r) => r.exerciseId === e.id)) : [];
  const listKeys = useMemo(() => {
    const curated = STRUCTURES.map((s) => ({ key: s.key, name: s.it, sub: `${s.region}${s.deep ? ' · profondo' : ''}`, search: [s.it, s.latin, ...s.synonyms].join(' ') }));
    const others = [...new Map(keys.filter((k) => !structureByKey(k.key)).map((k) => [k.key, k])).values()]
      .map((k) => ({ key: k.key, name: `${GROUP_IT[k.group] ?? k.group}: ${k.sourceName.replace(/\.(l|r)$/, '')}`, sub: 'scheda italiana da scrivere', search: `${GROUP_IT[k.group] ?? ''} ${k.sourceName} ${k.label}` }));
    return [...curated, ...others].filter((x) => x.search.toLowerCase().includes(q.toLowerCase()));
  }, [keys, q]);
  const use3d = mode === '3d' && gl && pack === 'ready' && !!buffer;

  return (
    <>
      <div className="chips" role="group" aria-label="Tipo di atlante">
        <Chip on={mode === '3d'} onClick={() => setMode('3d')}>3D</Chip>
        <Chip on={mode === '2d'} onClick={() => setMode('2d')}>2D (sempre offline)</Chip>
      </div>

      {mode === '3d' && !gl && <div className="banner warn small">WebGL non è disponibile su questo dispositivo: l'atlante 2D ha la stessa nomenclatura e funziona offline.</div>}
      {mode === '3d' && gl && pack !== 'ready' && pack !== 'checking' && (
        <section className="card" data-testid="pack">
          <strong>Pacchetto anatomico 3D</strong>
          <p className="small">Modello muscoloscheletrico completo, {MB(MODEL3D.bytes)} MB. Si scarica una volta e poi funziona anche offline. Puoi usare subito l'atlante 2D.</p>
          {pack === 'downloading' ? (
            <><progress value={progress} max={1} style={{ width: '100%' }} /><p className="small">{Math.round(progress * 100)}% di {MB(MODEL3D.bytes)} MB</p><button className="btn sm" onClick={() => abort.current?.abort()}>Annulla</button></>
          ) : (
            <><button className="btn primary" onClick={startDownload}>Scarica ({MB(MODEL3D.bytes)} MB)</button> <button className="btn" onClick={() => setMode('2d')}>Usa il 2D</button></>
          )}
          {pack === 'error' && <p className="small" role="alert">{err} <button className="linklike" onClick={startDownload}>Riprova</button></p>}
        </section>
      )}

      {exParam && (
        <section className="card flat small" data-testid="atlas-ex">
          <strong>{ex?.name ?? exParam}</strong>
          {rel.length ? (['principale', 'secondario', 'possibile_enfasi'] as Role[]).map((role) => { const rs = rel.filter((r) => r.role === role); return rs.length ? (
            <p key={role} className="mb0"><i className={`sw r-${role}`} /> <strong>{ROLE_LABEL[role]}:</strong> {rs.map((r) => structureByKey(r.key)?.it ?? r.key).join(', ')}{role === 'possibile_enfasi' ? <> — <a href={ANATOMY_SOURCE_URL[rs[0].source]} target="_blank" rel="noreferrer">{rs[0].source}</a>, {rs[0].quality}: non è una percentuale di sviluppo</> : null}</p>) : null; })
            : <p className="mb0 muted">Relazioni per singola porzione non ancora scritte per questo esercizio: muscoli principali {ex?.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') || '—'}, secondari {ex?.secondaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') || '—'}.</p>}
          <a href={`#/allenamento/esercizio/${exParam}`}>Torna alla scheda dell'esercizio</a>
        </section>
      )}

      {use3d ? (
        <>
          {!exParam && <div className="chips" role="group" aria-label="Cosa mostrare">
            <Chip on={paintMode === 'anatomy'} onClick={() => setPaintMode('anatomy')}>Anatomia</Chip>
            <Chip on={paintMode === 'work'} onClick={() => setPaintMode('work')}>Il mio lavoro (7 giorni)</Chip>
            <Chip on={paintMode === 'focus'} onClick={() => setPaintMode('focus')}>Le mie priorità</Chip>
          </div>}
          <Suspense fallback={<p className="muted">Avvio del visualizzatore…</p>}>
            <Atlas3D ref={ctl} buffer={buffer!} selected={selected} onSelect={(m) => { setCands(null); select(m?.key ?? null); }} onAmbiguous={(c) => setCands(c)} nameOf={nameOf} paint={paint} isolate={isolate} reduceMotion={settings.reduceMotion} onReady={(k, ms) => { setKeys(k); setLoadMs(ms); }} />
          </Suspense>
          {cands && (
            <section className="card atlas3d-choose" data-testid="atlas3d-choose" aria-live="polite">
              <strong className="small">Quale intendevi? (in giallo sul modello)</strong>
              <div className="chips">{cands.map((c) => <button key={c.key} className="btn sm" onClick={() => { setCands(null); select(c.key); setTimeout(() => ctl.current?.center(), 0); }}>{nameOf(c)}</button>)}</div>
              <button className="linklike small" onClick={() => setCands(null)}>Annulla</button>
            </section>
          )}
          <div className="atlas3d-tools" role="toolbar" aria-label="Comandi del modello">
            <button className="btn sm" onClick={() => ctl.current?.view('front')}>Fronte</button>
            <button className="btn sm" onClick={() => ctl.current?.view('back')}>Retro</button>
            <button className="btn sm" onClick={() => ctl.current?.view('left')}>Lato sx</button>
            <button className="btn sm" onClick={() => ctl.current?.view('right')}>Lato dx</button>
            <button className="btn sm" aria-label="Ruota a sinistra di 30 gradi" onClick={() => ctl.current?.rotate(-30)}>⟲ 30°</button>
            <button className="btn sm" aria-label="Ruota a destra di 30 gradi" onClick={() => ctl.current?.rotate(30)}>⟳ 30°</button>
            <button className="btn sm" aria-label="Avvicina" onClick={() => ctl.current?.zoom(0.75)}>＋</button>
            <button className="btn sm" aria-label="Allontana" onClick={() => ctl.current?.zoom(1.33)}>－</button>
            <button className="btn sm" disabled={!selected} onClick={() => ctl.current?.center()}>Centra</button>
            <button className={`btn sm${isolate ? ' primary' : ''}`} disabled={!selected} aria-pressed={isolate} onClick={() => setIsolate(!isolate)}>Isola</button>
            <button className="btn sm" onClick={() => { setIsolate(false); ctl.current?.reset(); }}>Reset</button>
          </div>
          {paintMode === 'work' && !exParam && (
            <div className="atlas-legend small">
              {['0', '1–5', '6–11', '12 o più'].map((l, i) => <span key={l}><i className={`sw atlas-w${i}`} /> {l} serie dirette</span>)}
              <p className="muted mb0">Scala fissa. Il diario conta le serie per gruppo: tutte le parti di un gruppo hanno lo stesso colore. Non è una misura di sviluppo.</p>
            </div>
          )}
          {paintMode === 'focus' && !exParam && (
            <div className="atlas-legend small" data-testid="atlas-focus-legend">
              <p className="mb0"><i className="sw r-principale" aria-hidden="true" /> In evidenza: gruppi che hai indicato come priorità{focus.length ? ` (${focus.map((g) => MUSCLE_LABEL[g]).join(', ')})` : ' — nessuno indicato: tocca un muscolo e scegli «Voglio dare priorità a…»'}.</p>
              <p className="muted mb0">È l’enfasi che hai dichiarato tu, non una valutazione del fisico.</p>
            </div>
          )}
          {loadMs != null && <p className="small muted" data-testid="atlas3d-load">Modello pronto in {loadMs} ms · {new Set(keys.map((k) => k.key)).size} muscoli selezionabili ({keys.length} regioni, sinistra e destra).</p>}
        </>
      ) : mode === '2d' || !gl || pack === 'missing' || pack === 'error' || pack === 'downloading' ? <AtlasScreen /> : <p className="muted">Caricamento…</p>}

      {use3d && selected && (
        <section className="card" data-testid="atlas3d-card" aria-live="polite">
          <div className="row between"><h3 className="mt0">{sel?.it ?? `${GROUP_IT[selInfo?.group ?? ''] ?? 'Struttura'}: ${selInfo?.sourceName?.replace(/\.(l|r)$/, '') ?? selected}`}</h3><button className="btn sm ghost" onClick={() => select(null)}>Chiudi</button></div>
          <p className="small muted mt0">{sel ? <em>{sel.latin}</em> : 'Nome dal modello; scheda italiana da scrivere'}{sel?.parent === 'deltoide' ? ' · porzione del deltoide' : sel?.parent === 'grande_pettorale' ? ' · porzione del grande pettorale' : ''}{selInfo?.layer === 'deep' || sel?.deep ? ' · strato profondo' : ''}</p>
          {selGroup && (() => { const on = focus.includes(selGroup); return <button className={`btn sm${on ? ' primary' : ''}`} onClick={() => kvSet('muscleFocus', on ? focus.filter((g) => g !== selGroup) : [...focus, selGroup])}>{on ? `${MUSCLE_LABEL[selGroup]}: è una mia priorità · togli` : `Voglio dare priorità a: ${MUSCLE_LABEL[selGroup]}`}</button>; })()}
          <div className="seg mt" role="tablist" aria-label="Sezioni">
            <button role="tab" aria-pressed={tab === 'what'} onClick={() => setTab('what')}>Azione e fonte</button>
            <button role="tab" aria-pressed={tab === 'ex'} onClick={() => setTab('ex')}>Esercizi</button>
            <button role="tab" aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}>Il mio lavoro</button>
          </div>
          {tab === 'what' && <p className="small" data-testid="atlas3d-what">{sel ? sel.action : 'Scheda in preparazione: nessuna azione scritta per questa struttura (non viene inventata).'}{sel && <span className="muted"> Fonte: <a href={ANATOMY_SOURCE_URL[sel.source ?? 'OpenStax A&P 2e, 11.5']} target="_blank" rel="noreferrer">{sel.source ?? 'OpenStax A&P 2e, 11.5'}</a>.</span>}{sel?.focus && <><br /><span className="muted">{sel.focus === 'focus' ? 'Esistono esercizi in cui è un motore principale.' : sel.focus === 'coinvolto' ? 'Lavora soprattutto insieme ad altri muscoli: nessun esercizio lo isola in modo documentato.' : 'Struttura profonda o stabilizzatrice: nessun focus di allenamento distinguibile.'}</span></>}</p>}
          {tab === 'ex' && (() => {
            const focusEx = exForKey.filter((r) => r.role !== 'secondario');
            const alsoEx = exForKey.filter((r) => r.role === 'secondario' && !focusEx.some((f) => f.exerciseId === r.exerciseId));
            const row = (id: string, note: string) => { const e = exMap.get(id); return (
              <li key={id} className="row between"><span><a href={`#/allenamento/esercizio/${id}`}>{e?.name ?? id}</a>{note ? <span className="muted"> — {note}</span> : null}</span>
                {e && <button className="btn sm" data-testid="atlas-add-day" onClick={() => (program ? setAddEx(e) : toast({ text: 'Nessuna scheda attiva: creane una da Schede.' }))}>Aggiungi al giorno…</button>}</li>); };
            return (
              <div className="small" data-testid="atlas3d-ex">
                <strong>Esercizi con focus</strong>
                {focusEx.length ? <ul className="list-plain">{focusEx.map((r) => row(r.exerciseId, `${ROLE_LABEL[r.role]}${r.quality === 'studio limitato' ? ', evidenza limitata' : ''}`))}</ul> : <p className="muted mt0">Nessuno documentato come motore principale per questa struttura.</p>}
                {alsoEx.length > 0 && <><strong>Anche coinvolto</strong><ul className="list-plain">{alsoEx.map((r) => row(r.exerciseId, ''))}</ul></>}
                {byGroup.length > 0 && <><strong>Stesso gruppo ({MUSCLE_LABEL[selGroup!]}){allowed ? ', con la tua attrezzatura' : ''}</strong><p className="muted mt0">Collegati al gruppo, senza dati per questa porzione (non vuol dire che non la allenino).</p><ul className="list-plain">{byGroup.slice(0, 6).map((e) => row(e.id, ''))}</ul></>}
              </div>
            );
          })()}
          {tab === 'mine' && (
            <div className="small" data-testid="atlas3d-mine">
              {selGroup ? <p>{MUSCLE_LABEL[selGroup]}, serie dirette per settimana (ultimi 7 giorni): {work.get(selGroup)?.direct ?? 0} serie dirette · {work.get(selGroup)?.indirect ?? 0} indirette{work.get(selGroup)?.lastDate ? ` · ultima seduta ${formatDateIt(work.get(selGroup)!.lastDate!)}` : ''}.</p> : <p>Il diario non attribuisce serie a questa struttura.</p>}
              <p className="muted">Il diario conta per gruppo muscolare: nessuna informazione per singola porzione, che non significa zero lavoro.</p>
              {selGroup && !(work.get(selGroup)?.direct) && <p className="muted">Nessuna serie diretta registrata: non significa che il muscolo sia poco sviluppato.</p>}
            </div>
          )}
        </section>
      )}

      {use3d && (
        <section className="card flat">
          <label className="small" htmlFor="atlas3d-q"><strong>Cerca una struttura</strong></label>
          <input id="atlas3d-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="es. deltoide laterale, pettorale alto" />
          <ul className="list mt" data-testid="atlas3d-list">
            {listKeys.slice(0, listN).map((x) => <li key={x.key}><button className="listbtn" aria-pressed={selected === x.key} onClick={() => { select(x.key); setTimeout(() => ctl.current?.center(), 0); }}><span>{x.name}<br /><span className="small muted">{x.sub}</span></span></button></li>)}
          </ul>
          {listKeys.length > listN && <button className="btn block sm" data-testid="atlas-more" onClick={() => setListN(listN + 40)}>Mostra altre {Math.min(40, listKeys.length - listN)} (di {listKeys.length - listN})</button>}
        </section>
      )}

      {use3d && <p className="small muted">{MODEL3D.credit} {MODEL3D.links.map((l, i) => <span key={l.url}>{i ? ' · ' : ''}<a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></span>)} · <button className="linklike" onClick={async () => { await removeModel(); setBuffer(null); setPack('missing'); }}>Rimuovi il pacchetto 3D ({MB(MODEL3D.bytes)} MB)</button></p>}
      {addEx && program && <AddToDaySheet ex={addEx} programId={program.id} onClose={() => setAddEx(null)} onDone={(d) => { toast({ text: `${addEx.name} aggiunto a «${d}» ✓` }); setAddEx(null); }} />}
      <button hidden onClick={() => go('progressi/atlante')} />
    </>
  );
}
