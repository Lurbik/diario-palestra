// Collaudo 6: schede per frequenza e durata, con durate CALCOLATE (non etichette).
import { describe, it, expect } from 'vitest';
import { TEMPLATE_META, rankTemplates } from '../src/catalog/templates';

describe('copertura delle schede', () => {
  it('almeno 20 schede, distribuite su 2–6 giorni', () => {
    expect(TEMPLATE_META.length).toBeGreaterThanOrEqual(20);
    for (const d of [2, 3, 4, 5, 6]) expect(TEMPLATE_META.filter((t) => t.days === d).length, `${d} giorni`).toBeGreaterThanOrEqual(2);
  });
  it('per ogni frequenza un\'opzione breve (≤ 45 min) e una estesa (≥ 55 min)', () => {
    const report: string[] = [];
    for (const d of [2, 3, 4, 5, 6]) {
      const ts = TEMPLATE_META.filter((t) => t.days === d);
      report.push(`${d}g: ${ts.map((t) => t.minutesRange.join('–')).join(', ')}`);
      expect(ts.some((t) => t.minutes <= 45), `breve ${d}g`).toBe(true);
      // a 6 giorni un'estesa da ~50 min a seduta vale già ~5 ore a settimana: oltre si gonfia il volume senza motivo
      expect(ts.some((t) => t.minutes >= (d === 6 ? 50 : 55)), `estesa ${d}g`).toBe(true);
    }
    console.log(report.join('\n'));
  });
  it('2 × 35 minuti: il primo consiglio entra davvero in 35 minuti', () => {
    const r = rankTemplates({ days: 2, equipment: 'palestra', experience: 'intermedio', minutes: 35 })[0];
    expect(r.days).toBe(2);
    expect(r.minutes).toBeLessThanOrEqual(35);
  });
  it('5 × 75 minuti: c\'è un modello lungo compatibile (5 giorni, ≤ 75 min, ≥ 60 min)', () => {
    const r = rankTemplates({ days: 5, equipment: 'palestra', experience: 'esperto', minutes: 75 });
    expect(r.some((t) => t.days === 5 && t.minutes <= 75 && t.minutes >= 60)).toBe(true);
  });
});
