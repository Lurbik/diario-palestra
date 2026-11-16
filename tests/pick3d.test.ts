// Tocco su strutture piccole: campioni intorno al dito → selezione diretta o scelta tra le vicine.
import { describe, it, expect } from 'vitest';
import { decidePick, sampleOffsets, type Sample } from '../src/lib/pick3d';

const S = (center: string | null, ring: (string | null)[]): Sample[] => [{ key: center, depth: 1, center: true }, ...ring.map((k) => ({ key: k, depth: 1, center: false }))];

describe('selezione al tocco', () => {
  it('17 campioni: centro + due anelli', () => { expect(sampleOffsets(16).length).toBe(17); });
  it('muscolo grande sotto il dito: selezione diretta', () => {
    expect(decidePick(S('deltoid_lateral', Array(16).fill('deltoid_lateral')))).toEqual({ kind: 'select', key: 'deltoid_lateral' });
  });
  it('dominante (≥ 60%) con un vicino ai bordi: selezione diretta', () => {
    expect(decidePick(S('a', [...Array(11).fill('a'), ...Array(5).fill('b')]))).toEqual({ kind: 'select', key: 'a' });
  });
  it('struttura piccola contesa: si chiede quale, quella sotto il dito per prima', () => {
    const r = decidePick(S('small', [...Array(3).fill('small'), ...Array(7).fill('big'), ...Array(6).fill('other')]));
    expect(r).toEqual({ kind: 'ambiguous', keys: ['small', 'big', 'other'] });
  });
  it('dito appena fuori dal muscolo (centro vuoto): conta l\'anello', () => {
    expect(decidePick(S(null, [...Array(4).fill('thin'), ...Array(12).fill(null)]))).toEqual({ kind: 'select', key: 'thin' });
  });
  it('nessuna struttura vicina: niente selezione', () => {
    expect(decidePick(S(null, Array(16).fill(null)))).toEqual({ kind: 'none' });
  });
  it('al massimo 4 scelte', () => {
    const r = decidePick(S('a', ['b', 'c', 'd', 'e', 'f', 'g', 'a', 'b', 'c', 'd', 'e', 'f', 'g', null, null, null]));
    expect(r.kind === 'ambiguous' && r.keys.length).toBe(4);
  });
});
