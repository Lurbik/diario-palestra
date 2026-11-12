import Dexie, { type EntityTable } from 'dexie';
import type {
  Machine, Exercise, Program, Session, SetEntry, PainEpisode, Food, Recipe, StockLot, PreparedBatch,
  StockTx, DiaryEntry, PlanEntry, ShoppingItem, WeightEntry, WaistEntry, SleepEntry, TargetVersion,
  Decision, Attachment, KV
} from './types';

export const DB_NAME = 'diario-palestra';
/** Versione logica dello schema. Ogni cambio = nuova `.version(n)` con eventuale upgrade. */
export const SCHEMA_VERSION = 2;

export const STORES_V1 = {
  machines: 'id, name',
  exercises: 'id, name, machineId',
  programs: 'id, kind',
  sessions: 'id, dateKey, status, startedAt',
  sets: 'id, sessionId, exerciseId, configKey',
  pain: 'id, status',
  foods: 'id, name, barcode',
  recipes: 'id, name',
  stock: 'id, foodId, expiry',
  batches: 'id, recipeId',
  stockTx: 'id, at',
  diary: 'id, dateKey',
  plan: 'id, dateKey',
  shopping: 'id',
  weights: 'id, dateKey',
  waist: 'id, dateKey',
  sleep: 'id, dateKey',
  targets: 'id, effectiveFrom',
  decisions: 'id, refId, at',
  attachments: 'id',
  kv: 'key'
};

export class AppDB extends Dexie {
  machines!: EntityTable<Machine, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  programs!: EntityTable<Program, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sets!: EntityTable<SetEntry, 'id'>;
  pain!: EntityTable<PainEpisode, 'id'>;
  foods!: EntityTable<Food, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  stock!: EntityTable<StockLot, 'id'>;
  batches!: EntityTable<PreparedBatch, 'id'>;
  stockTx!: EntityTable<StockTx, 'id'>;
  diary!: EntityTable<DiaryEntry, 'id'>;
  plan!: EntityTable<PlanEntry, 'id'>;
  shopping!: EntityTable<ShoppingItem, 'id'>;
  weights!: EntityTable<WeightEntry, 'id'>;
  waist!: EntityTable<WaistEntry, 'id'>;
  sleep!: EntityTable<SleepEntry, 'id'>;
  targets!: EntityTable<TargetVersion, 'id'>;
  decisions!: EntityTable<Decision, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor(name = DB_NAME) {
    super(name);
    // v1: schema iniziale
    this.version(1).stores(STORES_V1);
    // v2: indice temporale sulle serie + normalizzazione di campi aggiunti dopo la v1.
    // L'upgrade gira in una transazione "versionchange": se fallisce, IndexedDB annulla
    // tutto e i dati restano alla v1. In più c'è lo snapshot pre-migrazione (migrate.ts).
    this.version(2).stores({
      sets: 'id, sessionId, exerciseId, configKey, savedAt'
    }).upgrade(async (tx) => {
      await tx.table('sets').toCollection().modify((s: Partial<SetEntry>) => {
        if (s.fullRepsOtherSide === undefined) s.fullRepsOtherSide = null;
        if (s.failedAttempts === undefined) s.failedAttempts = 0;
        if (s.rirUnknown === undefined) s.rirUnknown = false;
      });
    });
  }
}

export let db = new AppDB();

/** Solo per i test: sostituisce l'istanza. */
export function __setDb(next: AppDB) { db = next; }

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}
export async function kvSet(key: string, value: unknown) {
  await db.kv.put({ key, value, updatedAt: Date.now() });
}
