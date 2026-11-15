// Dispensa, lotti preparati e diario in transazioni coerenti (Dexie/IndexedDB).
// - Preparare N porzioni scarica UNA volta gli ingredienti crudi e crea N porzioni.
// - Mangiare una porzione scarica la porzione (non gli ingredienti) e scrive il diario.
// - Pianificare non scarica nulla.
// - Nessuna quantità negativa silenziosa: le mancanze bloccano o vengono registrate esplicitamente.
// - Ogni operazione è annullabile tramite il registro StockTx.
import { db } from '../db/db';
import type { DiaryEntry, Food, MealSlot, Nutrients, PreparedBatch, StockLot, StockMove, StockTx } from '../db/types';
import { uid } from './id';
import { dateKey as todayKey } from './dates';
import { batchPortion, nutrientsFor, recipeTotals, strictTotals, scaleNutrients } from './nutrition';
import { lotStatus, fefo } from './lots';

export class ShortfallError extends Error {
  constructor(public shortfalls: { foodId: string; name: string; missing: number; unit: string }[]) {
    super('Scorte insufficienti: ' + shortfalls.map((s) => `${s.name} (mancano ${Math.round(s.missing * 10) / 10} ${s.unit})`).join(', '));
  }
}

const EPS = 1e-9;

/** Pianifica il prelievo FIFO per scadenza dai lotti con la stessa unità. Non scrive nulla. */
export function planDeduction(lots: StockLot[], foodId: string, qty: number, unit: string, today = todayKey()) {
  // FEFO tra lotti ammissibili: mai lotti oltre "da consumarsi entro"; quelli "da valutare" solo dopo i validi
  // (lo scarico avviene su conferma esplicita di un consumo/preparazione reale).
  const rank = (l: StockLot) => (lotStatus(l, today) === 'usable' ? 0 : 1);
  const usable = lots
    .filter((l) => l.foodId === foodId && l.unit === unit && ['usable', 'review'].includes(lotStatus(l, today)))
    .sort((a, b) => rank(a) - rank(b) || fefo(a, b));
  let need = qty;
  const takes: { lot: StockLot; take: number }[] = [];
  for (const l of usable) {
    if (need <= EPS) break;
    const take = Math.min(l.qty, need);
    takes.push({ lot: l, take });
    need -= take;
  }
  return { takes, missing: need > EPS ? need : 0 };
}

const TABLES = () => [db.stock, db.batches, db.stockTx, db.diary, db.foods, db.recipes, db.kv];

export async function prepareBatch(opts: {
  recipeId: string; servingsMade: number; finalWeightG: number | null; location?: PreparedBatch['location'];
  allowShortfall?: boolean; note?: string; at?: number;
}): Promise<{ batch: PreparedBatch; tx: StockTx }> {
  if (!(opts.servingsMade > 0)) throw new Error('Numero di porzioni non valido');
  return db.transaction('rw', TABLES(), async () => {
    const recipe = await db.recipes.get(opts.recipeId);
    if (!recipe) throw new Error('Ricetta non trovata');
    const scale = opts.servingsMade / recipe.servings;
    const foods = new Map((await db.foods.bulkGet(recipe.ingredients.map((i) => i.foodId))).filter(Boolean).map((f) => [f!.id, f!]));
    const lots = await db.stock.toArray();
    const moves: StockMove[] = [];
    const shortfalls: StockTx['shortfalls'] = [];
    const named: { foodId: string; name: string; missing: number; unit: string }[] = [];
    // Aggrega le quantità per (alimento, unità) per non scaricare due volte.
    const need = new Map<string, number>();
    for (const ing of recipe.ingredients) {
      const k = `${ing.foodId}|${ing.unit}`;
      need.set(k, (need.get(k) ?? 0) + ing.qty * scale);
    }
    const plans: { lot: StockLot; take: number }[] = [];
    for (const [k, q] of need) {
      const [foodId, unit] = k.split('|');
      const p = planDeduction(lots, foodId, q, unit);
      plans.push(...p.takes);
      if (p.missing > 0) {
        shortfalls.push({ foodId, missing: p.missing, unit });
        named.push({ foodId, name: foods.get(foodId)?.name ?? foodId, missing: p.missing, unit });
      }
    }
    if (named.length && !opts.allowShortfall) throw new ShortfallError(named);
    for (const { lot, take } of plans) {
      await db.stock.update(lot.id, { qty: lot.qty - take });
      moves.push({ table: 'stock', id: lot.id, field: 'qty', delta: -take });
    }
    const totals = strictTotals(recipeTotals(recipe, foods, scale).sum);
    const at = opts.at ?? Date.now();
    const txId = uid();
    const batch: PreparedBatch = {
      id: uid(), recipeId: recipe.id, name: recipe.name, preparedAt: at, dateKey: todayKey(at),
      servingsTotal: opts.servingsMade, servingsLeft: opts.servingsMade, finalWeightG: opts.finalWeightG,
      totals, location: opts.location ?? 'frigo', note: opts.note ?? '', txId, unitLabel: recipe.unitLabel ?? 'porzioni'
    };
    await db.batches.add(batch);
    moves.push({ table: 'batches', id: batch.id, field: 'servingsLeft', delta: opts.servingsMade, created: true });
    const tx: StockTx = { id: txId, at, kind: 'prepare', label: `Preparato: ${recipe.name} × ${opts.servingsMade}`, moves, diaryIds: [], shortfalls, undone: false };
    await db.stockTx.add(tx);
    return { batch, tx };
  });
}

export async function eatBatchPortion(opts: { batchId: string; servings: number; meal: MealSlot; dateKey?: string; at?: number }): Promise<{ entry: DiaryEntry; tx: StockTx }> {
  if (!(opts.servings > 0)) throw new Error('Porzione non valida');
  return db.transaction('rw', TABLES(), async () => {
    const b = await db.batches.get(opts.batchId);
    if (!b) throw new Error('Lotto non trovato');
    if (b.servingsLeft + EPS < opts.servings) throw new Error(`Restano solo ${b.servingsLeft} ${b.unitLabel ?? 'porzioni'} di "${b.name}"`);
    await db.batches.update(b.id, { servingsLeft: b.servingsLeft - opts.servings });
    const at = opts.at ?? Date.now();
    const txId = uid();
    const entry: DiaryEntry = {
      id: uid(), dateKey: opts.dateKey ?? todayKey(at), meal: opts.meal, kind: 'batch', label: b.name,
      foodId: null, batchId: b.id, recipeId: b.recipeId, qty: opts.servings, unit: 'porzione',
      nutrients: batchPortion(b, opts.servings), estimated: false, txId, createdAt: at
    };
    await db.diary.add(entry);
    const tx: StockTx = {
      id: txId, at, kind: 'consume_batch', label: `Mangiato: ${b.name} × ${opts.servings}`,
      moves: [{ table: 'batches', id: b.id, field: 'servingsLeft', delta: -opts.servings }], diaryIds: [entry.id], shortfalls: [], undone: false
    };
    await db.stockTx.add(tx);
    return { entry, tx };
  });
}

/** Alimento singolo nel diario, con scarico facoltativo dalla dispensa. */
export async function logFood(opts: {
  food: Food; qty: number; unit: 'g' | 'ml' | 'pz'; meal: MealSlot; dateKey?: string; deductStock: boolean;
  allowShortfall?: boolean; estimated?: boolean; at?: number;
}): Promise<{ entry: DiaryEntry; tx: StockTx | null }> {
  return db.transaction('rw', TABLES(), async () => {
    const at = opts.at ?? Date.now();
    const txId = opts.deductStock ? uid() : null;
    const moves: StockMove[] = [];
    const shortfalls: StockTx['shortfalls'] = [];
    if (opts.deductStock) {
      const p = planDeduction(await db.stock.where('foodId').equals(opts.food.id).toArray(), opts.food.id, opts.qty, opts.unit);
      if (p.missing > 0 && !opts.allowShortfall) throw new ShortfallError([{ foodId: opts.food.id, name: opts.food.name, missing: p.missing, unit: opts.unit }]);
      if (p.missing > 0) shortfalls.push({ foodId: opts.food.id, missing: p.missing, unit: opts.unit });
      for (const { lot, take } of p.takes) {
        await db.stock.update(lot.id, { qty: lot.qty - take });
        moves.push({ table: 'stock', id: lot.id, field: 'qty', delta: -take });
      }
    }
    const entry: DiaryEntry = {
      id: uid(), dateKey: opts.dateKey ?? todayKey(at), meal: opts.meal, kind: 'food', label: opts.food.name,
      foodId: opts.food.id, batchId: null, recipeId: null, qty: opts.qty, unit: opts.unit,
      nutrients: nutrientsFor(opts.food, opts.qty, opts.unit), estimated: !!opts.estimated || opts.food.source === 'estimate', txId, createdAt: at
    };
    await db.diary.add(entry);
    let tx: StockTx | null = null;
    if (txId) {
      tx = { id: txId, at, kind: 'consume_direct', label: `Consumato: ${opts.food.name}`, moves, diaryIds: [entry.id], shortfalls, undone: false };
      await db.stockTx.add(tx);
    }
    return { entry, tx };
  });
}

/** Pasto assemblato al momento da una ricetta: consuma direttamente gli ingredienti. */
export async function eatRecipeDirect(opts: { recipeId: string; servings: number; meal: MealSlot; dateKey?: string; deductStock: boolean; allowShortfall?: boolean; at?: number }) {
  return db.transaction('rw', TABLES(), async () => {
    const r = await db.recipes.get(opts.recipeId);
    if (!r) throw new Error('Ricetta non trovata');
    const scale = opts.servings / r.servings;
    const foods = new Map((await db.foods.bulkGet(r.ingredients.map((i) => i.foodId))).filter(Boolean).map((f) => [f!.id, f!]));
    const at = opts.at ?? Date.now();
    const txId = uid();
    const moves: StockMove[] = [];
    const shortfalls: StockTx['shortfalls'] = [];
    if (opts.deductStock) {
      const lots = await db.stock.toArray();
      const named: { foodId: string; name: string; missing: number; unit: string }[] = [];
      const plans: { lot: StockLot; take: number }[] = [];
      const need = new Map<string, number>();
      for (const ing of r.ingredients) need.set(`${ing.foodId}|${ing.unit}`, (need.get(`${ing.foodId}|${ing.unit}`) ?? 0) + ing.qty * scale);
      for (const [k, q] of need) {
        const [foodId, unit] = k.split('|');
        const p = planDeduction(lots, foodId, q, unit);
        plans.push(...p.takes);
        if (p.missing > 0) { shortfalls.push({ foodId, missing: p.missing, unit }); named.push({ foodId, name: foods.get(foodId)?.name ?? foodId, missing: p.missing, unit }); }
      }
      if (named.length && !opts.allowShortfall) throw new ShortfallError(named);
      for (const { lot, take } of plans) {
        const cur = (await db.stock.get(lot.id))!;
        await db.stock.update(lot.id, { qty: cur.qty - take });
        moves.push({ table: 'stock', id: lot.id, field: 'qty', delta: -take });
      }
    }
    const nutrients = strictTotals(recipeTotals(r, foods, scale).sum);
    const entry: DiaryEntry = {
      id: uid(), dateKey: opts.dateKey ?? todayKey(at), meal: opts.meal, kind: 'recipe_direct', label: r.name,
      foodId: null, batchId: null, recipeId: r.id, qty: opts.servings, unit: 'porzione', nutrients,
      estimated: [...foods.values()].some((f) => f.source === 'estimate'), txId, createdAt: at
    };
    await db.diary.add(entry);
    const tx: StockTx = { id: txId, at, kind: 'consume_direct', label: `Mangiato: ${r.name}`, moves, diaryIds: [entry.id], shortfalls, undone: false };
    await db.stockTx.add(tx);
    return { entry, tx };
  });
}

export async function logEstimate(opts: { label: string; nutrients: Nutrients; meal: MealSlot; dateKey?: string; at?: number }) {
  const at = opts.at ?? Date.now();
  const entry: DiaryEntry = {
    id: uid(), dateKey: opts.dateKey ?? todayKey(at), meal: opts.meal, kind: 'estimate', label: opts.label,
    foodId: null, batchId: null, recipeId: null, qty: null, unit: 'porzione', nutrients: opts.nutrients, estimated: true, txId: null, createdAt: at
  };
  await db.diary.add(entry);
  return entry;
}

export async function purchase(opts: { foodId: string; qty: number; unit: 'g' | 'ml' | 'pz'; location: StockLot['location']; expiry: string | null; expiryType?: StockLot['expiryType']; note?: string; at?: number }) {
  if (!(opts.qty > 0)) throw new Error('Quantità non valida');
  return db.transaction('rw', TABLES(), async () => {
    const at = opts.at ?? Date.now();
    const lot: StockLot = { id: uid(), foodId: opts.foodId, qty: opts.qty, unit: opts.unit, location: opts.location, purchasedAt: todayKey(at), expiry: opts.expiry, expiryType: opts.expiryType ?? null, openedAt: null, note: opts.note ?? '' };
    await db.stock.add(lot);
    const f = await db.foods.get(opts.foodId);
    const tx: StockTx = { id: uid(), at, kind: 'purchase', label: `Comprato: ${f?.name ?? opts.foodId}`, moves: [{ table: 'stock', id: lot.id, field: 'qty', delta: opts.qty, created: true }], diaryIds: [], shortfalls: [], undone: false };
    await db.stockTx.add(tx);
    await db.kv.put({ key: 'pantryTracking', value: true, updatedAt: at });
    return { lot, tx };
  });
}

/**
 * Annulla una transazione: ripristina le quantità, elimina ciò che aveva creato e le voci di diario.
 * Rifiuta l'annullamento di una preparazione se alcune porzioni sono già state mangiate
 * (bisogna prima annullare quei consumi), così i conti restano coerenti.
 */
export async function undoTx(txId: string): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const tx = await db.stockTx.get(txId);
    if (!tx) throw new Error('Operazione non trovata');
    if (tx.undone) throw new Error('Operazione già annullata');
    for (const m of tx.moves) {
      if (m.table === 'batches') {
        const b = await db.batches.get(m.id);
        if (!b) throw new Error('Lotto preparato non più presente');
        if (m.created) {
          if (Math.abs(b.servingsLeft - b.servingsTotal) > EPS) throw new Error('Alcune porzioni di questo lotto risultano mangiate: annulla prima quei pasti.');
        }
      } else if (m.created) {
        const l = await db.stock.get(m.id);
        if (l && Math.abs(l.qty - m.delta) > EPS) throw new Error('Questo acquisto è già stato in parte usato: correggi la quantità dalla dispensa.');
      }
    }
    for (const m of tx.moves) {
      if (m.table === 'batches') {
        if (m.created) await db.batches.delete(m.id);
        else { const b = (await db.batches.get(m.id))!; await db.batches.update(m.id, { servingsLeft: b.servingsLeft - m.delta }); }
      } else {
        if (m.created) await db.stock.delete(m.id);
        else {
          const l = await db.stock.get(m.id);
          if (l) await db.stock.update(m.id, { qty: l.qty - m.delta });
        }
      }
    }
    if (tx.diaryIds.length) await db.diary.bulkDelete(tx.diaryIds);
    await db.stockTx.update(tx.id, { undone: true });
  });
}

/** Elimina una voce di diario: se collegata a una transazione, annulla anche quella. */
export async function deleteDiaryEntry(id: string) {
  const e = await db.diary.get(id);
  if (!e) return;
  if (e.txId) {
    const tx = await db.stockTx.get(e.txId);
    if (tx && !tx.undone) return undoTx(e.txId);
  }
  await db.diary.delete(id);
}

/** Copia un pasto (solo diario, senza scaricare la dispensa: è una registrazione rapida). */
export async function copyMeal(fromDate: string, meal: MealSlot, toDate: string, toMeal: MealSlot = meal) {
  const src = await db.diary.where('dateKey').equals(fromDate).filter((d) => d.meal === meal).toArray();
  const now = Date.now();
  const copies = src.map((d, i) => ({ ...d, id: uid(), dateKey: toDate, meal: toMeal, txId: null, createdAt: now + i }));
  await db.diary.bulkAdd(copies);
  return copies.length;
}

export { scaleNutrients };
