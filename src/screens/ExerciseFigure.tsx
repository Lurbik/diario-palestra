// Figura anatomica nella scheda esercizio.
// - Pacchetto 3D in cache: un "poster" generato dal modello nella vista più utile, con i ruoli colorati; il contesto
//   WebGL viene liberato subito dopo. "Ruota / esplora" apre il visualizzatore nella stessa card (un solo contesto).
// - Senza pacchetto o senza WebGL: figura schematica 2D, sempre offline (stessi gruppi del diario).
// Le strutture elencate sotto la figura sono pulsanti: portano alla scheda della struttura nell'atlante.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Exercise, Muscle } from '../db/types';
import { EXERCISE_STRUCTURES, ROLE_LABEL, structureByKey, type Role } from '../catalog/anatomy3d';
import { isModelReady, loadModelBuffer, webglAvailable } from '../lib/model3d';
import { BodySvg } from '../ui/visuals';
import { MUSCLE_LABEL } from '../ui/labels';
import { go } from '../ui/kit';
import type { MeshInfo, Paint } from './Atlas3D';

const Atlas3D = lazy(() => import('./Atlas3D').then((m) => ({ default: m.Atlas3D })));
const posterCache = new Map<string, string>();

/** Vista più utile: di lato per il deltoide laterale, dietro per i muscoli posteriori, davanti negli altri casi. */
export function figureView(ex: Pick<Exercise, 'primaryMuscles'>): 'front' | 'back' | 'left' {
  const p = ex.primaryMuscles;
  if (p.length && p.every((m) => m === 'deltoidi_laterali')) return 'left';
  const back: Muscle[] = ['dorsali', 'schiena_alta', 'femorali', 'glutei', 'tricipiti', 'polpacci', 'deltoidi_posteriori', 'lombari'];
  return p.some((m) => back.includes(m)) ? 'back' : 'front';
}

export function ExerciseFigure({ ex }: { ex: Exercise }) {
  const gl = useMemo(() => webglAvailable(), []);
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [pack, setPack] = useState<'checking' | 'ready' | 'missing'>('checking');
  const [poster, setPoster] = useState<string | null>(() => posterCache.get(ex.id) ?? null);
  const [explore, setExplore] = useState(false);
  const [picked, setPicked] = useState<MeshInfo | null>(null);
  const view = figureView(ex);
  const rel = EXERCISE_STRUCTURES.filter((r) => r.exerciseId === ex.id);
  const paint = useMemo(() => { const m = new Map<string, Paint>(); for (const r of rel) if (!m.has(r.key) || r.role === 'principale') m.set(r.key, r.role); return m; }, [ex.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { isModelReady().then((r) => setPack(r ? 'ready' : 'missing')); }, []);
  useEffect(() => { if (pack === 'ready' && gl && !buffer && (!poster || explore)) loadModelBuffer().then(setBuffer); }, [pack, gl, buffer, poster, explore]);
  useEffect(() => { setPoster(posterCache.get(ex.id) ?? null); setExplore(false); setPicked(null); }, [ex.id]);

  const has3d = gl && pack === 'ready';
  const roles = (['principale', 'secondario', 'possibile_enfasi'] as Role[]).map((role) => ({ role, keys: [...new Set(rel.filter((r) => r.role === role).map((r) => r.key))] })).filter((x) => x.keys.length);

  return (
    <section className="card ex-figure" data-testid="ex-figure">
      {has3d ? (
        explore && buffer ? (
          <>
            <Suspense fallback={<p className="muted">Avvio del visualizzatore…</p>}>
              <Atlas3D buffer={buffer} selected={picked?.key ?? null} onSelect={setPicked} paint={paint} initialView={view} nameOf={(m) => structureByKey(m.key)?.it ?? m.label} />
            </Suspense>
            {picked && <p className="small" aria-live="polite"><strong>{structureByKey(picked.key)?.it ?? picked.label}</strong> · <a href={`#/progressi/atlante/${picked.key}`}>apri la scheda della struttura</a></p>}
            <button className="btn sm" onClick={() => { setExplore(false); setPicked(null); }}>Torna alla figura</button>
          </>
        ) : poster ? (
          <>
            <img className="ex-poster" src={poster} alt={`Figura anatomica, vista ${view === 'back' ? 'posteriore' : view === 'left' ? 'laterale' : 'anteriore'}: in evidenza i muscoli di ${ex.name}`} data-testid="ex-poster" />
            <button className="btn sm" data-testid="ex-explore" onClick={() => setExplore(true)}>Ruota / esplora</button>
          </>
        ) : buffer ? (
          <div className="ex-poster-gen" aria-hidden="true">
            <Suspense fallback={null}>
              <Atlas3D buffer={buffer} selected={null} onSelect={() => undefined} paint={paint} initialView={view} reduceMotion snapshot={(url) => { posterCache.set(ex.id, url); setPoster(url); setBuffer(null); }} />
            </Suspense>
            <p className="small muted">Preparo la figura…</p>
          </div>
        ) : <p className="small muted">Preparo la figura…</p>
      ) : (
        <>
          <div className="ex-figure-2d" data-testid="ex-figure-2d">
            <BodySvg view={view === 'left' ? 'front' : view} highlight={{ primary: ex.primaryMuscles, secondary: ex.secondaryMuscles }} label={`Figura schematica: ${ex.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}`} />
          </div>
          <p className="small muted mb0">Figura schematica (sempre offline). {gl ? <>Per la figura anatomica scarica il pacchetto 3D <a href="#/progressi/atlante">dall'atlante</a>.</> : 'WebGL non disponibile su questo dispositivo.'}</p>
        </>
      )}
      {roles.length ? (
        <div className="ex-roles small" data-testid="ex-structures">
          {roles.map(({ role, keys }) => (
            <p key={role} className="mb0"><i className={`sw r-${role}`} aria-hidden="true" /> <strong>{ROLE_LABEL[role]}:</strong>{' '}
              {keys.map((k, i) => <span key={k}>{i ? ', ' : ''}<button className="linklike" onClick={() => go(`progressi/atlante/${k}`)}>{structureByKey(k)?.it ?? k}</button></span>)}{rel.some((r) => r.role === role && r.quality === 'studio limitato') ? <span className="muted"> (evidenza limitata)</span> : null}</p>
          ))}
        </div>
      ) : (
        <p className="small mb0"><strong>Principali:</strong> {ex.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') || '—'} · <strong>Secondari:</strong> {ex.secondaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') || '—'}</p>
      )}
      <p className="small muted mb0">Ruoli descrittivi, non percentuali di attivazione né di crescita.</p>
    </section>
  );
}

