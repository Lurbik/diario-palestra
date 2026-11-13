// Componenti visivi: icone vettoriali (offline) e silhouette SCHEMATICHE del corpo.
// Le silhouette non sono anatomia realistica: regioni approssimate e toccabili, con alternativa a elenco.
import type { Muscle, MovementPattern, RecipeCategory } from '../db/types';
import { MUSCLE_LABEL } from './labels';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function CategoryIcon({ cat }: { cat: RecipeCategory | undefined }) {
  switch (cat) {
    case 'colazione': return <svg viewBox="0 0 24 24" {...P} aria-hidden><path d="M4 10h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-4zM17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3" /></svg>;
    case 'spuntino': return <svg viewBox="0 0 24 24" {...P} aria-hidden><path d="M12 7c-3-3-8-1-8 4 0 5 4 9 8 9s8-4 8-9c0-5-5-7-8-4zM12 7c0-2 1-4 3-4" /></svg>;
    case 'multiporzione': return <svg viewBox="0 0 24 24" {...P} aria-hidden><rect x="3" y="5" width="8" height="6" rx="1.5" /><rect x="13" y="5" width="8" height="6" rx="1.5" /><rect x="3" y="13" width="8" height="6" rx="1.5" /><rect x="13" y="13" width="8" height="6" rx="1.5" /></svg>;
    case 'cena': return <svg viewBox="0 0 24 24" {...P} aria-hidden><path d="M3 13h18a9 9 0 0 1-18 0zM12 4v3M8 6l1 2M16 6l-1 2" /></svg>;
    default: return <svg viewBox="0 0 24 24" {...P} aria-hidden><circle cx="12" cy="13" r="7" /><path d="M5 13h14M9 6V3M15 6V3" /></svg>;
  }
}

export function PatternIcon({ pattern }: { pattern?: MovementPattern }) {
  if (pattern === 'accosciata' || pattern === 'estensione_ginocchio' || pattern === 'flessione_ginocchio' || pattern === 'polpacci' || pattern === 'adduzione' || pattern === 'abduzione' || pattern === 'estensione_anca')
    return <svg viewBox="0 0 24 24" {...P} aria-hidden><circle cx="12" cy="4" r="2" /><path d="M12 6v6l-4 4v5M12 12l4 4v5M8 9h8" /></svg>;
  if (pattern === 'tirata_verticale' || pattern === 'tirata_orizzontale' || pattern === 'deltoidi_posteriori')
    return <svg viewBox="0 0 24 24" {...P} aria-hidden><path d="M4 4h16M8 4v4M16 4v4" /><circle cx="12" cy="11" r="2" /><path d="M12 13v5M8 9l4 4 4-4M10 21l2-3 2 3" /></svg>;
  if (pattern === 'addome' || pattern === 'stabilizzazione')
    return <svg viewBox="0 0 24 24" {...P} aria-hidden><rect x="7" y="4" width="10" height="16" rx="4" /><path d="M12 4v16M7 9h10M7 14h10" /></svg>;
  return <svg viewBox="0 0 24 24" {...P} aria-hidden><path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" /></svg>;
}

// Regioni schematiche: [muscolo, vista, forma]
type Shape = { kind: 'e'; cx: number; cy: number; rx: number; ry: number } | { kind: 'r'; x: number; y: number; w: number; h: number; r?: number };
const E = (cx: number, cy: number, rx: number, ry: number): Shape => ({ kind: 'e', cx, cy, rx, ry });
const Rr = (x: number, y: number, w: number, h: number, r = 8): Shape => ({ kind: 'r', x, y, w, h, r });
const REGIONS: [Muscle, 'front' | 'back', Shape[]][] = [
  ['deltoidi_anteriori', 'front', [E(64, 82, 11, 12), E(136, 82, 11, 12)]],
  ['deltoidi_laterali', 'front', [E(52, 88, 7, 13), E(148, 88, 7, 13)]],
  ['petto', 'front', [Rr(72, 76, 56, 34, 12)]],
  ['bicipiti', 'front', [E(54, 118, 8, 18), E(146, 118, 8, 18)]],
  ['avambracci', 'front', [E(50, 160, 7, 20), E(150, 160, 7, 20)]],
  ['addome', 'front', [Rr(80, 114, 40, 58, 10)]],
  ['adduttori', 'front', [E(92, 206, 7, 20), E(108, 206, 7, 20)]],
  ['quadricipiti', 'front', [E(80, 222, 13, 34), E(120, 222, 13, 34)]],
  ['schiena_alta', 'back', [Rr(76, 70, 48, 30, 10)]],
  ['deltoidi_posteriori', 'back', [E(62, 84, 11, 11), E(138, 84, 11, 11)]],
  ['dorsali', 'back', [Rr(70, 100, 60, 40, 14)]],
  ['tricipiti', 'back', [E(53, 120, 8, 18), E(147, 120, 8, 18)]],
  ['lombari', 'back', [Rr(86, 142, 28, 26, 8)]],
  ['glutei', 'back', [E(88, 184, 15, 14), E(112, 184, 15, 14)]],
  ['abduttori', 'back', [E(70, 182, 6, 12), E(130, 182, 6, 12)]],
  ['femorali', 'back', [E(84, 230, 12, 30), E(116, 230, 12, 30)]],
  ['polpacci', 'back', [E(84, 290, 9, 22), E(116, 290, 9, 22)]]
];

function Outline() {
  return (
    <g className="outline" aria-hidden>
      <circle cx="100" cy="36" r="20" />
      <rect x="60" y="62" width="80" height="120" rx="26" />
      <rect x="40" y="72" width="22" height="118" rx="11" />
      <rect x="138" y="72" width="22" height="118" rx="11" />
      <rect x="66" y="170" width="32" height="150" rx="14" />
      <rect x="102" y="170" width="32" height="150" rx="14" />
    </g>
  );
}

/** Livelli di riempimento neutri (stessa tinta, intensità diversa) + sempre testo/legenda. */
export function fillFor(v: number, max: number): string {
  if (!v || !max) return 'var(--surface)';
  const r = v / max;
  const pct = r > 0.66 ? 85 : r > 0.33 ? 55 : 28;
  return `color-mix(in srgb, var(--accent-bg) ${pct}%, var(--surface))`;
}

export function BodySvg({ view, values, selected, onSelect, highlight, label }: {
  view: 'front' | 'back'; values?: Map<Muscle, number>; selected?: Muscle | null; onSelect?: (m: Muscle) => void; highlight?: { primary: Muscle[]; secondary: Muscle[] }; label: string;
}) {
  const max = values ? Math.max(0, ...values.values()) : 0;
  return (
    <svg className="body-svg" viewBox="0 0 200 330" role="group" aria-label={label}>
      <Outline />
      {REGIONS.filter(([, v]) => v === view).map(([m, , shapes]) => {
        let fill = 'var(--surface)';
        if (highlight) fill = highlight.primary.includes(m) ? 'var(--accent-bg)' : highlight.secondary.includes(m) ? 'color-mix(in srgb, var(--accent-bg) 35%, var(--surface))' : 'var(--surface)';
        else if (values) fill = fillFor(values.get(m) ?? 0, max);
        const interactive = !!onSelect;
        return (
          <g key={m} className="region" tabIndex={interactive ? 0 : -1} role={interactive ? 'button' : 'img'}
            aria-label={`${MUSCLE_LABEL[m]}${values ? `: ${values.get(m) ?? 0} serie` : ''}`} aria-pressed={interactive ? selected === m : undefined}
            onClick={() => onSelect?.(m)} onKeyDown={(e) => { if (interactive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect!(m); } }}
            style={{ fill }} stroke={selected === m ? 'var(--accent)' : undefined} strokeWidth={selected === m ? 3 : undefined}>
            <title>{MUSCLE_LABEL[m]}</title>
            {shapes.map((s, i) => (s.kind === 'e' ? <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} /> : <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} />))}
          </g>
        );
      })}
    </svg>
  );
}

export const MUSCLE_VIEW: Record<Muscle, 'front' | 'back'> = Object.fromEntries(REGIONS.map(([m, v]) => [m, v])) as Record<Muscle, 'front' | 'back'>;
