import { useEffect, useState } from 'react';
import { listSnapshots, dumpRaw, type Snapshot } from '../db/migrate';
import { DB_NAME } from '../db/db';

/**
 * Schermata di recupero: mostrata se l'apertura/migrazione del database fallisce.
 * I dati originali NON vengono cancellati. Si possono scaricare lo snapshot pre-migrazione
 * e una copia grezza del database attuale, poi riprovare.
 */
export function Recovery({ error }: { error: string }) {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  useEffect(() => { listSnapshots().then(setSnaps).catch(() => {}); }, []);
  const dl = (name: string, data: unknown) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = name; a.click();
  };
  return (
    <main className="main" style={{ paddingBottom: 40 }}>
      <h1>Recupero dati</h1>
      <div className="card danger">
        <h3>Il database non si è aperto</h3>
        <p className="small">{error}</p>
        <p>I tuoi dati originali non sono stati cancellati. Non svuotare i dati del browser.</p>
      </div>
      <div className="card">
        <h3>1. Scarica una copia di sicurezza</h3>
        <button className="btn block" onClick={async () => dl(`copia-grezza-${Date.now()}.json`, await dumpRaw(indexedDB, DB_NAME))}>Scarica copia grezza del database</button>
        {snaps.map((s) => (
          <button key={s.id} className="btn block mt" onClick={() => dl(`${s.id}.json`, s)}>Scarica snapshot pre-migrazione ({new Date(s.at).toLocaleString('it-IT')})</button>
        ))}
      </div>
      <div className="card">
        <h3>2. Riprova</h3>
        <p className="small muted">Chiudi le altre schede dell'app (possono bloccare l'aggiornamento del database) e ricarica.</p>
        <button className="btn primary block" onClick={() => location.reload()}>Ricarica</button>
      </div>
      <p className="small muted">Procedura documentata in docs/RECUPERO.md: la copia grezza può essere importata da "Altro → Backup" in una versione funzionante dell'app.</p>
    </main>
  );
}
