// Ricerca comune: normalizzazione, alias, ordine dei risultati, nessuno scambio tra voci simili.
import { describe, it, expect } from 'vitest';
import { search, score, norm, stem } from '../src/lib/search';
import { EXERCISE_CATALOG } from '../src/catalog/exercises';

const ex = EXERCISE_CATALOG.map((e) => ({ id: e.id, name: e.name, aliases: e.aliases, extra: e.equipment }));
const top = (q: string, n = 3) => search(ex, q).slice(0, n).map((x) => x.id);

describe('ricerca', () => {
  it('normalizza accenti, trattini e plurali', () => {
    expect(norm('Alzata-laterale  su Panca')).toBe('alzata laterale su panca');
    expect(stem('alzate')).toBe(stem('alzata'));
    expect(stem('romboidi')).toBe(stem('romboide'));
    expect(stem('rhomboids')).toBe('rhomboid');
  });
  it('"RDL" trova gli stacchi rumeni (alias e sinonimo), prima quelli con l\'alias esatto', () => {
    const r = top('RDL', 5);
    expect(r).toContain('cx_rdl_man');
    expect(r).toContain('cx_rdl_bil');
  });
  it('"stacco rumeno" e "romanian deadlift" portano alle stesse voci', () => {
    expect(top('stacco rumeno', 2).sort()).toEqual(top('rdl', 2).sort());
  });
  it('nome esatto prima del prefisso; prefisso prima della corrispondenza tollerante', () => {
    const items = [{ name: 'Leg curl seduto' }, { name: 'Leg curl sdraiato' }, { name: 'Leg curl' }];
    expect(search(items, 'leg curl')[0].name).toBe('Leg curl');
    expect(score({ name: 'Chest press' }, 'chest press')).toBeGreaterThan(score({ name: 'Chest press inclinata' }, 'chest press'));
  });
  it('tollera un errore di battitura, senza superare una corrispondenza esatta', () => {
    expect(top('alzate laterli', 5).some((id) => id.startsWith('cx_alzate_lat'))).toBe(true);
    expect(score({ name: 'Pulley' }, 'pulley')).toBeGreaterThan(score({ name: 'Pullover al cavo' }, 'pulley'));
  });
  it('alias privati (voci dell\'utente) trovati come gli altri', () => {
    const mine = [...ex, { id: 'u1', name: 'Rematore mio', aliases: ['alias di prova'], extra: '' }];
    expect(search(mine, 'alias di prova')[0].id).toBe('u1');
  });
  it('macchine simili non vengono scambiate: "hack squat" non restituisce per primo un\'altra macchina', () => {
    expect(top('hack squat', 1)).toEqual(['cx_hack_squat']);
  });
});
