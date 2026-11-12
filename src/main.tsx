import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { db } from './db/db';
import { snapshotIfMigrating } from './db/migrate';
import { bootstrap } from './db/bootstrap';
import { App } from './App';
import { Recovery } from './screens/Recovery';
import { requestPersistence } from './lib/pwa';

const root = createRoot(document.getElementById('root')!);

async function start() {
  try {
    // 1) Se il DB esistente è di una versione precedente, copia i dati grezzi prima di migrare.
    try { await snapshotIfMigrating(); } catch (e) { console.warn('Snapshot pre-migrazione non riuscito', e); }
    // 2) Apertura (eventuale migrazione in transazione atomica).
    await db.open();
    // 3) Primo avvio: catalogo e modelli (nessun dato personale nel diario senza conferma).
    await bootstrap();
    requestPersistence().catch(() => {});
    root.render(<StrictMode><App /></StrictMode>);
  } catch (e) {
    console.error(e);
    root.render(<Recovery error={e instanceof Error ? e.message : String(e)} />);
  }
}
start();
