// Matrice dell'atlante: regione → struttura → mesh → focus → esercizi → fonte, generata dai dati.
// docs/MATRICE_ATLANTE.md deve coincidere con i dati (rigenerare con UPDATE_MATRIX=1 npx vitest run tests/atlasMatrix.test.ts).
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { STRUCTURES, EXERCISE_STRUCTURES } from '../src/catalog/anatomy3d';
import { EXERCISE_CATALOG } from '../src/catalog/exercises';

const exById = new Map(EXERCISE_CATALOG.map((e) => [e.id, e]));
const FOCUS_IT = { focus: 'focus', coinvolto: 'solo coinvolto', nessuno: 'nessun focus distinguibile' } as const;

function focusExercises(key: string) {
  return [...new Set(EXERCISE_STRUCTURES.filter((r) => r.key === key && r.role !== 'secondario').map((r) => r.exerciseId))].filter((id) => exById.has(id));
}
function alsoExercises(key: string) {
  const f = new Set(focusExercises(key));
  return [...new Set(EXERCISE_STRUCTURES.filter((r) => r.key === key && r.role === 'secondario').map((r) => r.exerciseId))].filter((id) => exById.has(id) && !f.has(id));
}

function matrix(): string {
  const rows = [...STRUCTURES].sort((a, b) => a.region.localeCompare(b.region) || a.it.localeCompare(b.it));
  const count = (f: string) => STRUCTURES.filter((s) => (s.focus ?? 'nessuno') === f).length;
  const lines = [
    '# Matrice dell\'atlante',
    '',
    'Generata dai dati (`src/catalog/anatomy3d.ts`, `anatomyAll.ts`, `exercises.ts`) dal test `tests/atlasMatrix.test.ts`: non modificarla a mano.',
    '',
    `Strutture con scheda italiana: ${STRUCTURES.length} · focus ${count('focus')} · solo coinvolte ${count('coinvolto')} · nessun focus distinguibile ${count('nessuno')}.`,
    `Esercizi del catalogo: ${EXERCISE_CATALOG.length}; relazioni struttura–esercizio: ${EXERCISE_STRUCTURES.length}.`,
    '',
    'La colonna "mesh" è la chiave della regione nel modello 3D (lato sinistro e destro). I ruoli sono descrittivi, non percentuali di attivazione.',
    '',
    '| Regione | Struttura | Mesh | Focus | Esercizi con focus | Anche coinvolto | Fonte |',
    '|---|---|---|---|---|---|---|'
  ];
  for (const s of rows) {
    const fx = focusExercises(s.key).map((id) => exById.get(id)!.name);
    const ax = alsoExercises(s.key).map((id) => exById.get(id)!.name);
    lines.push(`| ${s.region} | ${s.it} (*${s.latin}*) | \`${s.key}\` | ${FOCUS_IT[s.focus ?? 'nessuno']} | ${fx.join(', ') || '—'} | ${ax.slice(0, 6).join(', ')}${ax.length > 6 ? ` e altri ${ax.length - 6}` : ''}${ax.length ? '' : '—'} | ${s.source ?? '—'} |`);
  }
  const kinds = (key: string) => new Set(focusExercises(key).map((id) => exById.get(id)!.equipmentKind ?? exById.get(id)!.equipment)).size;
  const thin = rows.filter((s) => s.focus === 'focus' && kinds(s.key) < 2);
  lines.push('', '## Lacune dichiarate', '', 'Strutture con focus i cui esercizi di focus usano un solo tipo di attrezzo (servirebbero alternative con attrezzi diversi):', '', ...thin.map((s) => `- ${s.it}: ${focusExercises(s.key).map((id) => exById.get(id)!.name).join(', ')}`));
  return lines.join('\n') + '\n';
}

describe('matrice dell\'atlante', () => {
  it('ogni struttura con focus ha almeno un esercizio in cui è motore principale', () => {
    const missing = STRUCTURES.filter((s) => s.focus === 'focus' && focusExercises(s.key).length === 0).map((s) => s.key);
    expect(missing).toEqual([]);
  });
  it('ogni struttura ha fonte e azione scritte', () => {
    expect(STRUCTURES.filter((s) => !s.source || !s.action).map((s) => s.key)).toEqual([]);
  });
  it('le relazioni puntano a esercizi e strutture esistenti', () => {
    const keys = new Set(STRUCTURES.map((s) => s.key));
    expect(EXERCISE_STRUCTURES.filter((r) => !exById.has(r.exerciseId) || !keys.has(r.key)).map((r) => `${r.exerciseId}→${r.key}`)).toEqual([]);
  });
  it('docs/MATRICE_ATLANTE.md è allineata ai dati', () => {
    const p = 'docs/MATRICE_ATLANTE.md';
    const m = matrix();
    if (process.env.UPDATE_MATRIX || !existsSync(p)) writeFileSync(p, m);
    expect(readFileSync(p, 'utf8').split('\r\n').join('\n')).toBe(m);
  });
});
