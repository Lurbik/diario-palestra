// Selettore unico, accessibile e offline. Modalità globale (più tipi) o contestuale (solo le voci ammesse).
// - A ricerca vuota mostra recenti e preferiti, poi tutto (a blocchi "Mostra altri", anche da tastiera).
// - Filtri con badge, numero risultati e "Azzera"; con zero risultati spiega quale filtro li esclude, senza toglierlo da solo.
// - Selezione singola o multipla ("Aggiungi e continua"); Esc chiude, Invio sceglie il primo risultato.
// - Nessuna voce è preselezionata: si aggiunge solo ciò che l'utente tocca.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EXERCISE_STRUCTURES, structureByKey } from '../catalog/anatomy3d';
import { db, kvGet, kvSet } from '../db/db';
import { search } from '../lib/search';
import { Icon } from './kit';

export interface PickItem {
  id: string; kind: string; name: string; aliases?: string[]; extra?: string;
  subtitle?: string; badge?: string; favorite?: boolean;
  /** valori delle sfaccettature per i filtri (es. muscolo, attrezzo) */
  facets?: Record<string, string | string[] | boolean | undefined>;
  /** motivo per cui la voce non è selezionabile in questo contesto (resta visibile, spiegata) */
  disabled?: string;
}
export interface FilterDef { key: string; label: string; options: { value: string; label: string }[] }

const PAGE = 50;
const KIND_LABEL: Record<string, string> = { exercise: 'Esercizio', program: 'Scheda', muscle: 'Muscolo', food: 'Alimento', recipe: 'Ricetta', machine: 'Macchina' };

export function Picker({ title, items, filters = [], multi = false, recentKey, onPick, onClose, context, footer }: {
  title: string; items: PickItem[]; filters?: FilterDef[]; multi?: boolean; recentKey: string;
  onPick: (picked: PickItem[]) => void; onClose: () => void; context?: string; footer?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState<Record<string, string>>({});
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); kvGet<string[]>(`recent:${recentKey}`, []).then(setRecent); }, [recentKey]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  useEffect(() => { setLimit(PAGE); }, [q, active]);

  const pass = (it: PickItem, f: Record<string, string>) => Object.entries(f).every(([k, v]) => {
    const x = it.facets?.[k];
    return Array.isArray(x) ? x.includes(v) : typeof x === 'boolean' ? String(x) === v : x === v;
  });
  const matched = useMemo(() => search(items, q), [items, q]);
  const results = useMemo(() => matched.filter((it) => pass(it, active)), [matched, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const recents = !q && !Object.keys(active).length ? recent.map((id) => byId.get(id)).filter((x): x is PickItem => !!x) : [];
  const favs = !q && !Object.keys(active).length ? items.filter((i) => i.favorite && !recent.includes(i.id)) : [];
  // Zero risultati: quale filtro li esclude?
  const blockers = !results.length && matched.length ? Object.keys(active).map((k) => ({ k, n: matched.filter((it) => pass(it, Object.fromEntries(Object.entries(active).filter(([kk]) => kk !== k)))).length })).filter((b) => b.n > 0) : [];

  const remember = async (ids: string[]) => { const next = [...ids, ...recent.filter((r) => !ids.includes(r))].slice(0, 8); setRecent(next); await kvSet(`recent:${recentKey}`, next); };
  const choose = async (it: PickItem) => {
    if (it.disabled) return;
    if (multi) { setSel((s) => (s.includes(it.id) ? s.filter((x) => x !== it.id) : [...s, it.id])); return; }
    await remember([it.id]); onPick([it]);
  };
  const confirm = async () => { const picked = sel.map((id) => byId.get(id)!).filter(Boolean); await remember(sel); onPick(picked); setSel([]); };

  const Row = ({ it }: { it: PickItem }) => (
    <li><button className={`listbtn picker-row${sel.includes(it.id) ? ' on' : ''}`} aria-pressed={multi ? sel.includes(it.id) : undefined} aria-disabled={!!it.disabled} onClick={() => choose(it)}>
      <span className="grow"><span>{it.name}</span>{it.badge && <span className="badge"> {it.badge}</span>}<br /><span className="small muted">{[it.subtitle, items.some((x) => x.kind !== it.kind) ? KIND_LABEL[it.kind] : null, it.disabled].filter(Boolean).join(' · ')}</span></span>
      {multi ? <span className="picker-check" aria-hidden>{sel.includes(it.id) ? '✓' : '+'}</span> : <Icon.right />}
    </button></li>
  );

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="picker">
        <div className="sheet-head"><h2>{title}</h2><button className="iconbtn" aria-label="Chiudi" onClick={onClose}><Icon.close /></button></div>
        {context && <p className="small muted mt0">{context}</p>}
        <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nome, alias o muscolo…" aria-label={`Cerca: ${title}`}
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) choose(results[0]); }} />
        {filters.length > 0 && (
          <div className="picker-filters">
            {filters.map((f) => (
              <select key={f.key} aria-label={f.label} value={active[f.key] ?? ''} onChange={(e) => setActive((a) => { const n = { ...a }; if (e.target.value) n[f.key] = e.target.value; else delete n[f.key]; return n; })} className={active[f.key] ? 'on' : ''}>
                <option value="">{f.label}</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ))}
          </div>
        )}
        <p className="small muted picker-count" aria-live="polite">{results.length} risultati{Object.keys(active).length ? ` · ${Object.keys(active).length} filtri attivi ` : ''}{Object.keys(active).length > 0 && <button className="linklike" onClick={() => setActive({})}>Azzera</button>}</p>
        <div className="picker-list">
          {recents.length > 0 && <><p className="small eyebrow">Recenti</p><ul className="list">{recents.map((it) => <Row key={'r' + it.id} it={it} />)}</ul></>}
          {favs.length > 0 && <><p className="small eyebrow">Preferiti</p><ul className="list">{favs.map((it) => <Row key={'f' + it.id} it={it} />)}</ul></>}
          {(recents.length > 0 || favs.length > 0) && <p className="small eyebrow">Tutti</p>}
          <ul className="list" data-testid="picker-results">{results.slice(0, limit).map((it) => <Row key={it.id} it={it} />)}</ul>
          {results.length > limit && <button className="btn block" onClick={() => setLimit(limit + PAGE)}>Mostra altri {Math.min(PAGE, results.length - limit)} (di {results.length - limit})</button>}
          {!results.length && (
            <div className="small" data-testid="picker-empty">
              {blockers.length ? <p>Nessun risultato con tutti i filtri. Senza «{filters.find((f) => f.key === blockers[0].k)?.label}» ce ne sarebbero {blockers[0].n}: <button className="linklike" onClick={() => setActive((a) => { const n = { ...a }; delete n[blockers[0].k]; return n; })}>togli questo filtro</button>.</p>
                : <p>Nessuna voce corrisponde a «{q}». Prova un sinonimo o un nome più breve.</p>}
            </div>
          )}
        </div>
        {multi && <div className="picker-foot"><button className="btn primary block" disabled={!sel.length} onClick={confirm}>{sel.length ? `Aggiungi ${sel.length}` : 'Seleziona una o più voci'}</button>{footer}</div>}
      </div>
    </div>
  );
}

/** Voci "esercizio" per il selettore (con alias privati dell'utente e sfaccettature per i filtri). */
export async function exercisePickItems(allowed?: (id: string) => string | undefined): Promise<PickItem[]> {
  const [exs, machines] = await Promise.all([db.exercises.toArray(), db.machines.toArray()]);
  const mName = new Map(machines.map((m) => [m.id, m.name]));
  // nomi anatomici (atlante) delle strutture in cui l'esercizio ha un ruolo principale o di possibile enfasi: «romboidi» trova i rematori
  const anat = new Map<string, string[]>();
  for (const r of EXERCISE_STRUCTURES) if (r.role !== 'secondario') { const st = structureByKey(r.key); if (st) anat.set(r.exerciseId, [...(anat.get(r.exerciseId) ?? []), st.it, ...st.synonyms]); }
  return exs.filter((e) => !e.archived).map((e) => ({
    id: e.id, kind: 'exercise', name: e.name, aliases: e.aliases, extra: [e.equipment, e.pattern, ...e.primaryMuscles, ...e.secondaryMuscles, e.machineId ? mName.get(e.machineId) : '', ...(anat.get(e.id) ?? [])].filter(Boolean).join(' '),
    subtitle: [e.equipment, e.machineId ? mName.get(e.machineId) : null, e.unilateral ? 'unilaterale' : null, e.measure === 'seconds' ? 'a tempo' : e.measure === 'meters' ? 'a distanza' : null].filter(Boolean).join(' · '),
    favorite: !!e.favorite,
    facets: { primary: e.primaryMuscles, involved: [...e.primaryMuscles, ...e.secondaryMuscles], eq: e.equipmentKind, pattern: e.pattern, uni: e.unilateral ? 'uni' : 'bi', fav: !!e.favorite },
    disabled: allowed?.(e.id)
  }));
}
