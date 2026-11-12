// Protezione delle migrazioni: prima di aprire il database con una versione più recente,
// copia TUTTI i dati grezzi in un database separato ("snapshot pre-migrazione").
// Se la migrazione fallisce, i dati originali restano intatti (transazione annullata)
// e lo snapshot è scaricabile come JSON dalla schermata di recupero.
import { DB_NAME, SCHEMA_VERSION } from './db';

const SNAP_DB = 'diario-palestra-snapshots';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

/** Legge la versione IDB esistente senza modificarla (null se il DB non esiste). */
export async function existingVersion(idb: IDBFactory = indexedDB, name = DB_NAME): Promise<number | null> {
  if (typeof idb.databases === 'function') {
    const list = await idb.databases();
    const f = list.find((d) => d.name === name);
    return f?.version ?? null;
  }
  return null;
}

export async function dumpRaw(idb: IDBFactory, name: string): Promise<Record<string, unknown[]>> {
  const raw = await req(idb.open(name));
  const out: Record<string, unknown[]> = {};
  try {
    const stores = Array.from(raw.objectStoreNames);
    if (stores.length) {
      const tx = raw.transaction(stores, 'readonly');
      for (const s of stores) out[s] = await req(tx.objectStore(s).getAll());
    }
  } finally { raw.close(); }
  return out;
}

/** Apre il DB degli snapshot creando l'archivio se manca (anche se il DB esiste già vuoto). */
async function openSnaps(idb: IDBFactory): Promise<IDBDatabase> {
  const ensure = (r: IDBOpenDBRequest) => { r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('snaps')) r.result.createObjectStore('snaps', { keyPath: 'id' }); }; return r; };
  const db = await req(ensure(idb.open(SNAP_DB)));
  if (db.objectStoreNames.contains('snaps')) return db;
  const v = db.version + 1;
  db.close();
  return req(ensure(idb.open(SNAP_DB, v)));
}

export async function saveSnapshot(idb: IDBFactory, data: unknown, fromVersion: number) {
  const sdb = await openSnaps(idb);
  try {
    const tx = sdb.transaction('snaps', 'readwrite');
    await req(tx.objectStore('snaps').put({ id: `pre-v${SCHEMA_VERSION}-da-v${fromVersion}-${Date.now()}`, at: Date.now(), fromVersion, data }));
  } finally { sdb.close(); }
}

export interface Snapshot { id: string; at: number; fromVersion: number; data: Record<string, unknown[]> }

export async function listSnapshots(idb: IDBFactory = indexedDB): Promise<Snapshot[]> {
  const sdb = await openSnaps(idb);
  try { return await req(sdb.transaction('snaps').objectStore('snaps').getAll()); } finally { sdb.close(); }
}

/** Dexie salva la versione IDB come versione×10. Restituisce true se ha creato uno snapshot. */
export async function snapshotIfMigrating(idb: IDBFactory = indexedDB, name = DB_NAME, target = SCHEMA_VERSION): Promise<boolean> {
  const v = await existingVersion(idb, name);
  if (v == null || v === 0) return false;
  if (v / 10 >= target) return false;
  const data = await dumpRaw(idb, name);
  await saveSnapshot(idb, data, v / 10);
  return true;
}
