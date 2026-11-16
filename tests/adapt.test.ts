// Cibo adattivo: stessa ricetta, obiettivi diversi; nutrienti e spesa coerenti (catalogo pubblico, nessun dato personale).
import { describe, it, expect } from 'vitest';
import { loadCatalog } from '../src/catalog/load';
import { recipeVariants, applyVariant, splitMeal } from '../src/lib/adapt';
import { shoppingNeeds } from '../src/lib/recipes';
import { proposeCalories } from '../src/lib/calories';

describe('varianti di ricetta per obiettivo', async () => {
  const c = await loadCatalog();
  const foods = new Map(c.foods.map((f) => [f.id, f]));
  const panino = c.recipes.find((r) => r.id === 'cr_esp_panino_mozz')!;
  const pane = c.foods.find((f) => f.slug === 'pane_integrale')!.id;
  const mozz = c.foods.find((f) => f.slug === 'mozzarella')!.id;

  it('panino: più energetica = pane in più; meno energetica = meno pane e più verdura, mozzarella invariata', () => {
    const vs = recipeVariants(panino, foods, 'mantenimento');
    const more = vs.find((v) => v.kind === 'more_energy')!;
    expect(more.changes.find((x) => x.foodId === pane)).toMatchObject({ fromG: 85, toG: 110 });
    expect(more.dKcal!).toBeGreaterThan(40);
    const less = vs.find((v) => v.kind === 'less_energy')!;
    expect(less.changes.find((x) => x.foodId === pane)).toMatchObject({ fromG: 85, toG: 65 });
    expect(less.changes.some((x) => x.foodId === mozz)).toBe(false); // le proteine non si tagliano in definizione
    expect(less.dKcal!).toBeLessThan(0);
    const prot = vs.find((v) => v.kind === 'more_protein')!;
    expect(prot.changes.map((x) => x.foodId)).toEqual([mozz]);
    expect(prot.dProtein!).toBeGreaterThan(0);
  });
  it('l\'obiettivo ordina le varianti, non le impone', () => {
    expect(recipeVariants(panino, foods, 'massa')[0].kind).toBe('more_energy');
    expect(recipeVariants(panino, foods, 'dimagrimento')[0].kind).toBe('less_energy');
  });
  it('versione con pane modificato: nutrienti e lista della spesa coerenti', () => {
    const v = recipeVariants(panino, foods, 'massa')[0];
    const mine = { ...panino, id: 'mio', ingredients: applyVariant(panino, v), origin: 'user' as const };
    const plan = [{ id: 'p', dateKey: '2026-11-24', slot: 'colazione' as const, recipeId: 'mio', foodId: null, servings: 1, locked: true, done: false, status: 'confirmed' as const }];
    const shop = shoppingNeeds({ plan, recipes: new Map([['mio', mine]]), foods, lots: [], batches: [], today: '2026-11-23' });
    expect(shop.find((s) => s.foodId === pane)!.toBuy).toBe(110);
  });
  it('colazione troppo abbondante: divisa in due momenti, totale invariato', () => {
    const s = splitMeal(600)!;
    expect(s.nowKcal + s.laterKcal).toBe(600);
    expect(s.laterServings).toBeCloseTo(0.33, 2);
    expect(splitMeal(null)).toBeNull();
  });
  it('"solo diario": nessuna proposta calorica', () => {
    const p = proposeCalories({ weights: [], completeDiaryDays: [], avgIntakeKcal: null, targetKcal: 2500, lastTargetChange: null, today: '2026-11-23', goal: 'solo_diario' });
    expect(p.kind).toBe('no_target');
    expect(p.deltaKcal).toBeNull();
  });
});
