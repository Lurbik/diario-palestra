// Atlante: coerenza tra schede, SVG adattato e gruppi del diario; attribuzione presente.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ANATOMY, ATLAS_IMAGE_CREDIT, ATLAS_PENDING } from '../src/catalog/anatomy';
import { MUSCLE_LABEL } from '../src/ui/labels';

const svg = readFileSync('src/assets/anatomy/muscles-front-back.svg', 'utf8');

describe('atlante anatomico (anteprima)', () => {
  it('ogni struttura disegnata esiste nell\'SVG su entrambi i lati; quelle profonde non hanno zone', () => {
    for (const a of ANATOMY) {
      const n = (svg.match(new RegExp(`data-s="${a.id}"`, 'g')) ?? []).length;
      if (a.onMap) expect(n, a.id).toBeGreaterThanOrEqual(2);
      else expect(n, a.id).toBe(0);
    }
  });
  it('gruppi del diario validi; nessuna zona inventata per i gruppi non ancora mappati', () => {
    for (const a of ANATOMY) if (a.group) expect(MUSCLE_LABEL[a.group]).toBeTruthy();
    for (const m of ATLAS_PENDING) expect(ANATOMY.some((a) => a.group === m)).toBe(false);
  });
  it('licenza e attribuzione nell\'SVG e nell\'app; nessuno script o risorsa esterna', () => {
    expect(svg).toMatch(/CC BY-SA 4\.0/);
    expect(svg).toMatch(/OpenStax & Tomáš Kebert & umimeto\.org/);
    expect(ATLAS_IMAGE_CREDIT.text).toMatch(/CC BY-SA 4\.0/);
    expect(svg).not.toMatch(/<script|onload=|onclick=/i);
    // restano solo i <use> senza strutture selezionabili (fedeltà all'originale): ognuno punta a elementi senza data-s
    for (const m of svg.matchAll(/<use[^>]*href="#([^"]+)"/g)) expect(svg).not.toMatch(new RegExp('id="' + m[1] + '"[^>]*data-s='));
  });
});
