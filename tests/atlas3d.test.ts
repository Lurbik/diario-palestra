// Atlante 3D: coerenza tra modello (manifest), strutture curate, relazioni esercizio e catalogo.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MODEL3D, STRUCTURES, EXERCISE_STRUCTURES, GROUP_IT } from '../src/catalog/anatomy3d';
import { EXERCISE_CATALOG } from '../src/catalog/exercises';

const manifest = JSON.parse(readFileSync('public/anatomy3d/manifest.json', 'utf8'));
const keys = new Set<string>(manifest.structures.map((s: { key: string }) => s.key));

describe('atlante 3D', () => {
  it('il file distribuito è quello dichiarato (dimensione e SHA-256) con licenza e crediti', () => {
    const buf = readFileSync('public/' + MODEL3D.file);
    expect(buf.length).toBe(MODEL3D.bytes);
    expect(createHash('sha256').update(buf).digest('hex')).toBe(MODEL3D.sha256);
    expect(manifest.sha256).toBe(MODEL3D.sha256);
    expect(manifest.license).toBe('CC BY-SA 4.0');
    expect(MODEL3D.credit).toMatch(/Z-Anatomy/);
    expect(MODEL3D.credit).toMatch(/BodyParts3D/);
  });
  it('primo lotto: tre porzioni del deltoide e capi del grande pettorale esistono come mesh separate, su entrambi i lati', () => {
    for (const k of ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior', 'pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_major_abdominal']) {
      const sides = manifest.structures.filter((s: { key: string }) => s.key === k).map((s: { side: string }) => s.side).sort();
      expect(sides, k).toEqual(['left', 'right']);
    }
  });
  it('ogni struttura curata esiste nel modello; ogni gruppo del modello ha un nome italiano', () => {
    for (const s of STRUCTURES) expect(keys.has(s.key), s.key).toBe(true);
    for (const g of new Set<string>(manifest.structures.map((s: { group: string }) => s.group))) expect(GROUP_IT[g], g).toBeTruthy();
  });
  it('relazioni esercizio → struttura: esercizi e strutture esistono; nessun ruolo inventato', () => {
    const ex = new Set(EXERCISE_CATALOG.map((e) => e.id));
    for (const r of EXERCISE_STRUCTURES) {
      expect(ex.has(r.exerciseId), r.exerciseId).toBe(true);
      expect(STRUCTURES.some((s) => s.key === r.key), r.key).toBe(true);
      expect(['principale', 'secondario', 'possibile_enfasi']).toContain(r.role);
    }
    // l'enfasi regionale della panca inclinata è marcata come evidenza limitata
    for (const r of EXERCISE_STRUCTURES.filter((x) => x.role === 'possibile_enfasi')) expect(['studio limitato', 'anatomia funzionale']).toContain(r.quality);
    for (const r of EXERCISE_STRUCTURES.filter((x) => x.role === 'possibile_enfasi' && x.exerciseId.includes('incl'))) expect(r.quality).toBe('studio limitato');
  });
});
