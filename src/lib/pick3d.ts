// Selezione al tocco su strutture piccole: non si decide con un solo raggio sotto il dito.
// Si campiona il punto toccato più un anello di punti intorno (raggio ~ metà polpastrello) e:
// - se una struttura domina (centro + maggioranza dei campioni) → selezione diretta;
// - se più strutture si contendono il punto → si chiede quale, mostrando solo le candidate vicine;
// - se il centro è vuoto ma l'anello tocca qualcosa → stessa logica (tocco "quasi" sul muscolo).

export interface Sample { key: string | null; depth: number | null; center: boolean }
export type PickResult = { kind: 'none' } | { kind: 'select'; key: string } | { kind: 'ambiguous'; keys: string[] };

/** Offsets in pixel CSS: centro + 8 punti a raggio r + 8 a raggio r/2. */
export function sampleOffsets(r = 16): [number, number][] {
  const out: [number, number][] = [[0, 0]];
  for (const rr of [r / 2, r]) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; out.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  return out;
}

export function decidePick(samples: Sample[], maxChoices = 4): PickResult {
  const hits = samples.filter((s) => s.key);
  if (!hits.length) return { kind: 'none' };
  const count = new Map<string, number>();
  for (const s of hits) count.set(s.key!, (count.get(s.key!) ?? 0) + 1);
  const center = samples.find((s) => s.center)?.key ?? null;
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1] || (a[0] === center ? -1 : b[0] === center ? 1 : 0)).map(([k]) => k);
  if (ranked.length === 1) return { kind: 'select', key: ranked[0] };
  const share = (k: string) => (count.get(k) ?? 0) / samples.length;
  // dominante: sotto il dito e in almeno 60% dei campioni
  if (center && share(center) >= 0.6) return { kind: 'select', key: center };
  // nessuno dominante: proponi le candidate vicine (al massimo maxChoices, quella sotto il dito per prima)
  const keys = center ? [center, ...ranked.filter((k) => k !== center)] : ranked;
  return { kind: 'ambiguous', keys: keys.slice(0, maxChoices) };
}
