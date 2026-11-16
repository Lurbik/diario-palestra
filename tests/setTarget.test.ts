// Target della singola serie: priorità delle regole, riscontri reali, frase "prima della serie".
import { describe, it, expect } from 'vitest';
import { setTarget, suggestedRir, suggestedRirTargets } from '../src/lib/setTarget';

const RDL = { policyClass: 'heavy_compound' as const, measure: 'reps' as const, name: 'RDL' };
const CHEST = { policyClass: 'compound' as const, measure: 'reps' as const, name: 'Chest press' };
const ISO = { policyClass: 'isolation' as const, measure: 'reps' as const, name: 'Alzate laterali' };
const item = (o = {}) => ({ sets: 2, repMin: 6, repMax: 8, rirTargets: [{ min: 1, max: 3 }, { min: 1, max: 3 }], restSec: 180, ...o });

describe('target per serie', () => {
  it('frase prima della serie: esercizio, serie, range, RIR mirato, recupero', () => {
    const t = setTarget({ exercise: RDL, item: item(), exposures: 4, position: { index: 2, count: 5 } });
    expect(t.sentence).toBe('Esercizio 2 di 5 · serie 1 di 2 · 6–8 ripetizioni · mira a RIR 2–3 · recupero 3 min');
    expect(t.source).toBe('suggerito');
  });
  it('esempi del brief come impostazioni prudenti: RDL 2–3 poi 2; chest press 2 poi 1–2; isolamento 1–2 poi 1', () => {
    expect(suggestedRirTargets('heavy_compound', 2, 5)).toEqual([{ min: 2, max: 3 }, { min: 2, max: 2 }]);
    expect(suggestedRirTargets('compound', 2, 5)).toEqual([{ min: 2, max: 2 }, { min: 1, max: 2 }]);
    expect(suggestedRirTargets('isolation', 2, 5)).toEqual([{ min: 1, max: 2 }, { min: 1, max: 1 }]);
  });
  it('primo approccio o tecnica incerta: margine più ampio', () => {
    expect(suggestedRir('heavy_compound', 0, false)[0]).toEqual({ min: 3, max: 4 });
    expect(suggestedRir('isolation', 6, true)[0].min).toBeGreaterThanOrEqual(2);
  });
  it('la scelta manuale esplicita resta tale (anche RIR 0 deciso da un esperto su un isolamento)', () => {
    const t = setTarget({ exercise: ISO, item: item({ rirManual: true, rirTargets: [{ min: 1, max: 1 }, { min: 0, max: 0 }] }), exposures: 5, done: [{ fullReps: 14, validReps: 14, rir: 1, rirUnknown: false, extraPartials: 0, load: 8 }] });
    expect(t.source).toBe('prescritto');
    expect(t.rir).toEqual({ min: 0, max: 0 });
  });
  it('i target dei template (RIR 1–3 non scelti a mano) vengono sostituiti dal suggerimento', () => {
    expect(setTarget({ exercise: CHEST, item: item(), exposures: 3 }).rir).toEqual({ min: 2, max: 2 });
  });
  it('dolore: nessun invito a spingere, anche se la scheda dice RIR 0', () => {
    const t = setTarget({ exercise: ISO, item: item({ rirManual: true, rirTargets: [{ min: 0, max: 0 }, { min: 0, max: 0 }] }), exposures: 5, pain: true });
    expect(t.rir!.min).toBeGreaterThanOrEqual(3);
    expect(t.why.join(' ')).toMatch(/nessun invito a spingere/);
  });
  it('dopo 5 valide a RIR 0 con target 6–8 a RIR 2: niente record, recupero, set-up, gradino inferiore', () => {
    const t = setTarget({ exercise: CHEST, item: item(), exposures: 3, done: [{ fullReps: 5, validReps: 5, rir: 0, rirUnknown: false, extraPartials: 0, load: 60 }], lowerStep: 55 });
    expect(t.setNo).toBe(2);
    expect(t.live).toMatch(/5 valide a RIR 0, sotto il range/);
    expect(t.live).toMatch(/gradino inferiore \(55 kg\)/);
    expect(t.live).toMatch(/Non serve battere il record/);
  });
  it('"non so" non è zero; 6 complete + 4 parziali = 6 complete, parziali a parte', () => {
    expect(setTarget({ exercise: CHEST, item: item(), exposures: 3, done: [{ fullReps: 6, validReps: 6, rir: null, rirUnknown: true, extraPartials: 0, load: 60 }] }).live).toMatch(/non indicato: nessuna deduzione/);
    const t = setTarget({ exercise: CHEST, item: item(), exposures: 3, done: [{ fullReps: 6, validReps: 6, rir: 2, rirUnknown: false, extraPartials: 4, load: 60 }] });
    expect(t.live).toMatch(/4 parziali restano annotate a parte/);
    expect(t.dataUsed.join(' ')).toMatch(/6 valide/);
  });
  it('esercizio a tempo: nessun RIR richiesto', () => {
    const t = setTarget({ exercise: { policyClass: 'calves_abs', measure: 'seconds', name: 'Plank' }, item: item({ repMin: 20, repMax: 45 }), exposures: 2 });
    expect(t.rir).toBeNull();
    expect(t.sentence).toMatch(/20–45 s/);
    expect(t.sentence).not.toMatch(/RIR/);
  });
  it('la posizione nella seduta non cambia il margine', () => {
    const a = setTarget({ exercise: ISO, item: item(), exposures: 4, position: { index: 1, count: 5 } }).rir;
    const b = setTarget({ exercise: ISO, item: item(), exposures: 4, position: { index: 4, count: 5 } }).rir;
    expect(a).toEqual(b);
  });
});
