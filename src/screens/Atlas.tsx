// Atlante anatomico 2D (anteprima: spalla, petto, coscia). Due domande diverse:
//   Esplora      → dov'è, cosa fa, come si allena con la mia attrezzatura
//   Il mio lavoro → cosa ho registrato per questa zona (serie dirette e indirette, con numeri)
// Mappa e lista sono sincronizzate; la lista è ricercabile e accessibile da tastiera e lettore di schermo.
// Il colore non stima lo sviluppo muscolare: rappresenta solo serie registrate, su scala fissa e con numeri.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import type { Muscle } from '../db/types';
import { Chip, useSettings } from '../ui/kit';
import { ANATOMY, ANATOMY_SOURCES, ATLAS_IMAGE_CREDIT, ATLAS_PENDING, type AnatomyStructure } from '../catalog/anatomy';
import { MUSCLE_LABEL } from '../ui/labels';
import { workByMuscle } from '../lib/bodymap';
import { ALLOWED_EQ } from '../lib/substitute';
import { addDays, dateKey, formatDateIt } from '../lib/dates';

const VIEWBOX = { front: '0 0 205 354.4', back: '203 0 204 354.4', shoulders: '40 52 125 72' } as const;
type ViewKey = keyof typeof VIEWBOX;
const groupsOf = (s: AnatomyStructure): Muscle[] => (s.id === 'deltoide' ? ['deltoidi_anteriori', 'deltoidi_laterali', 'deltoidi_posteriori'] : s.group ? [s.group] : []);
/** Scala FISSA (serie dirette nel periodo): confrontabile tra settimane, mai relativa al massimo. */
const BINS = [{ min: 0, label: '0' }, { min: 1, label: '1–5' }, { min: 6, label: '6–11' }, { min: 12, label: '12 o più' }];
const binOf = (n: number) => (n >= 12 ? 3 : n >= 6 ? 2 : n >= 1 ? 1 : 0);

export function AtlasScreen() {
  const settings = useSettings();
  const [mode, setMode] = useState<'explore' | 'work'>('explore');
  const [view, setView] = useState<ViewKey>('front');
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'what' | 'how' | 'mine'>('what');
  const [days, setDays] = useState<7 | 28>(7);
  const [svg, setSvg] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const today = dateKey();
  const sets = useLiveQuery(() => db.sets.toArray(), []) ?? [];
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) ?? [];
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const focus = (useLiveQuery(() => db.kv.get('muscleFocus'), [])?.value as Muscle[] | undefined) ?? [];
  const work = useMemo(() => workByMuscle(sets, sessions, exMap, addDays(today, -(days - 1))), [sets, sessions, exMap, today, days]);
  const direct = (s: AnatomyStructure) => groupsOf(s).reduce((a, g) => a + (work.get(g)?.direct ?? 0), 0);
  const indirect = (s: AnatomyStructure) => groupsOf(s).reduce((a, g) => a + (work.get(g)?.indirect ?? 0), 0);

  // SVG caricato come modulo separato (in cache offline con il resto dell'app)
  useEffect(() => { import('../assets/anatomy/muscles-front-back.svg?raw').then((m) => setSvg(m.default)); }, []);

  // Stato visivo delle strutture: selezione (contorno) ed eventuale colore del lavoro registrato
  useEffect(() => {
    const root = box.current?.querySelector('svg');
    if (!root) return;
    root.setAttribute('viewBox', VIEWBOX[view]);
    // tratteggio per 'solo serie indirette': distinguibile anche senza percepire il colore
    if (!root.querySelector('#atlas-hatch')) {
      const NS = 'http://www.w3.org/2000/svg';
      const defs = root.querySelector('defs') ?? root.insertBefore(document.createElementNS(NS, 'defs'), root.firstChild);
      const pat = document.createElementNS(NS, 'pattern');
      pat.setAttribute('id', 'atlas-hatch'); pat.setAttribute('patternUnits', 'userSpaceOnUse'); pat.setAttribute('width', '2'); pat.setAttribute('height', '2'); pat.setAttribute('patternTransform', 'rotate(45)');
      pat.innerHTML = '<rect width="2" height="2" fill="#ddd6cb"/><rect width="0.8" height="2" fill="#e07a4f"/>';
      defs.appendChild(pat);
    }
    root.querySelectorAll<SVGElement>('[data-s]').forEach((el) => {
      const id = el.getAttribute('data-s')!;
      const st = ANATOMY.find((a) => a.id === id);
      el.classList.toggle('atlas-sel', id === sel);
      for (let i = 0; i < 4; i++) el.classList.remove(`atlas-w${i}`);
      el.classList.remove('atlas-ind');
      if (mode === 'work' && st) {
        const d = direct(st);
        el.classList.add(`atlas-w${binOf(d)}`);
        if (d === 0 && indirect(st) > 0) el.classList.add('atlas-ind');
      }
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', st?.name ?? id);
    });
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const onMapClick = (e: React.MouseEvent) => {
    const t = (e.target as Element).closest('[data-s]');
    if (t) { setSel(t.getAttribute('data-s')); setTab(mode === 'work' ? 'mine' : 'what'); }
  };
  const s = ANATOMY.find((a) => a.id === sel) ?? null;
  const list = ANATOMY.filter((a) => (a.name + ' ' + a.latin + ' ' + a.region).toLowerCase().includes(q.toLowerCase()));
  const allowed = settings.profile.equipment ? ALLOWED_EQ[settings.profile.equipment] : null;
  const exFor = (s: AnatomyStructure, kind: 'primary' | 'secondary') => exercises.filter((e) => !e.archived && groupsOf(s).some((g) => (kind === 'primary' ? e.primaryMuscles : e.secondaryMuscles).includes(g)) && (!allowed || !e.equipmentKind || allowed.includes(e.equipmentKind)));

  return (
    <>
      <div className="chips" role="group" aria-label="Modalità">
        <Chip on={mode === 'explore'} onClick={() => setMode('explore')}>Esplora</Chip>
        <Chip on={mode === 'work'} onClick={() => setMode('work')}>Il mio lavoro</Chip>
      </div>
      <div className="chips" role="group" aria-label="Vista">
        <Chip on={view === 'front'} onClick={() => setView('front')}>Davanti</Chip>
        <Chip on={view === 'back'} onClick={() => setView('back')}>Dietro</Chip>
        <Chip on={view === 'shoulders'} onClick={() => setView('shoulders')}>Zoom spalle e petto</Chip>
        {mode === 'work' && <><Chip on={days === 7} onClick={() => setDays(7)}>7 giorni</Chip><Chip on={days === 28} onClick={() => setDays(28)}>28 giorni</Chip></>}
      </div>
      <div ref={box} className={`atlas card flat atlas-${mode}`} data-testid="atlas-map" onClick={onMapClick}
        dangerouslySetInnerHTML={svg ? { __html: svg.replace(/^<!--[\s\S]*?-->\s*/, '') } : undefined}>
      </div>
      {!svg && <p className="muted">Caricamento dell'atlante…</p>}
      {mode === 'work' && (
        <div className="atlas-legend small" aria-label="Legenda">
          {BINS.map((b, i) => <span key={b.label}><i className={`sw atlas-w${i}`} /> {b.label} serie dirette</span>)}
          <span><i className="sw atlas-ind" /> solo serie indirette</span>
          <p className="muted mb0">Scala fissa per poter confrontare periodi diversi. Il colore riassume serie registrate, non lo sviluppo del muscolo.</p>
        </div>
      )}

      {s && (
        <section className="card" data-testid="atlas-card" aria-live="polite">
          <div className="row between"><h3 className="mt0">{s.name}</h3><button className="btn sm ghost" onClick={() => setSel(null)}>Chiudi</button></div>
          <p className="small muted mt0"><em>{s.latin}</em>{s.onMap ? '' : ' · muscolo profondo: solo scheda, nessuna zona disegnata'}</p>
          {groupsOf(s).length > 0 && (() => { const on = groupsOf(s).every((g) => focus.includes(g)); return (
            <button className={`btn sm${on ? ' primary' : ''}`} data-testid="atlas-focus" onClick={() => kvSet('muscleFocus', on ? focus.filter((g) => !groupsOf(s).includes(g)) : [...new Set([...focus, ...groupsOf(s)])])}>
              {on ? 'È una mia priorità · togli' : 'Voglio dare priorità a questa zona'}
            </button>); })()}
          <div className="seg" role="tablist" aria-label="Sezioni">
            <button role="tab" aria-pressed={tab === 'what'} onClick={() => setTab('what')}>Cosa fa</button>
            <button role="tab" aria-pressed={tab === 'how'} onClick={() => setTab('how')}>Come allenarlo</button>
            <button role="tab" aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}>Cosa ho fatto io</button>
          </div>
          {tab === 'what' && (
            <div className="small" data-testid="atlas-what">
              <p><strong>Dove:</strong> {s.position}</p>
              <p><strong>Cosa fa:</strong> {s.action}</p>
              <p><strong>Quando ha senso focalizzarlo:</strong> {s.focus}</p>
              {s.note && <p className="muted">{s.note}</p>}
              <p className="muted">Fonte: {ANATOMY_SOURCES.map((x, i) => <span key={x.url}>{i ? ' · ' : ''}<a href={x.url} target="_blank" rel="noreferrer">{x.title}</a></span>)}</p>
            </div>
          )}
          {tab === 'how' && (
            <div className="small" data-testid="atlas-how">
              {!groupsOf(s).length ? <p>Il diario non lo traccia come gruppo separato.</p> : (
                <>
                  <p className="mb0"><strong>Lavoro diretto</strong>{allowed ? ' con la tua attrezzatura' : ' (indica l\'attrezzatura nel profilo per filtrare)'}:</p>
                  <ul>{exFor(s, 'primary').slice(0, 10).map((e) => <li key={e.id}><a href={`#/allenamento/esercizio/${e.id}`}>{e.name}</a></li>)}</ul>
                  {exFor(s, 'secondary').length > 0 && <p className="muted">Lo coinvolgono anche, in modo indiretto: {exFor(s, 'secondary').slice(0, 6).map((e) => e.name).join(', ')}.</p>}
                </>
              )}
            </div>
          )}
          {tab === 'mine' && (
            <div className="small" data-testid="atlas-mine">
              {!groupsOf(s).length ? <p>Il diario non attribuisce serie a questa struttura.</p> : groupsOf(s).map((g) => {
                const w = work.get(g);
                return (
                  <p key={g}><strong>{MUSCLE_LABEL[g]}</strong>, ultimi {days} giorni: {w?.direct ?? 0} serie dirette · {w?.indirect ?? 0} indirette
                    {w?.exercises.size ? ` · esercizi: ${[...w.exercises].map((id) => exMap.get(id)?.name ?? id).join(', ')}` : ''}{w?.lastDate ? ` · ultima seduta ${formatDateIt(w.lastDate)}` : ''}</p>
                );
              })}
              {groupsOf(s).length > 0 && direct(s) === 0 && <p className="muted">Nessuna serie diretta registrata nel periodo: non significa che il muscolo sia poco sviluppato, solo che non risulta lavoro diretto nel diario.</p>}
            </div>
          )}
        </section>
      )}

      <section className="card flat">
        <label className="small" htmlFor="atlas-q"><strong>Cerca una struttura</strong></label>
        <input id="atlas-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="es. deltoide, quadricipite, vasto" />
        <ul className="list mt" data-testid="atlas-list">
          {list.map((a) => (
            <li key={a.id}>
              <button className="listbtn" aria-pressed={sel === a.id} onClick={() => { setSel(a.id); setTab(mode === 'work' ? 'mine' : 'what'); if (a.onMap && !a.view.includes(view === 'back' ? 'back' : 'front')) setView(a.view[0]); }}>
                <span>{a.name}<br /><span className="small muted">{a.region}{a.onMap ? '' : ' · profondo, solo scheda'}{mode === 'work' ? ` · ${direct(a)} dirette, ${indirect(a)} indirette` : ''}</span></span>
              </button>
            </li>
          ))}
        </ul>
        <p className="small muted">Anteprima: spalla, petto e coscia. Ancora senza zona sulla mappa: {ATLAS_PENDING.map((m) => MUSCLE_LABEL[m]).join(', ')}.</p>
      </section>
      <p className="small muted">{ATLAS_IMAGE_CREDIT.text} <a href={ATLAS_IMAGE_CREDIT.url} target="_blank" rel="noreferrer">Originale</a> · <a href={ATLAS_IMAGE_CREDIT.license} target="_blank" rel="noreferrer">Licenza</a></p>
    </>
  );
}
