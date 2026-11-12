# Recupero dati

## Come sono protetti i dati durante gli aggiornamenti

1. **Service worker in attesa**: una nuova versione non si attiva da sola; l'avviso compare e il pulsante "Aggiorna"
   è disabilitato durante una seduta attiva o con moduli non salvati. Le vecchie cache vengono pulite, IndexedDB mai.
2. **Snapshot pre-migrazione**: se il database ha una versione di schema più vecchia, prima di migrare l'app copia
   tutti i dati grezzi nel database separato `diario-palestra-snapshots`.
3. **Migrazione atomica**: l'aggiornamento dello schema avviene in una transazione IndexedDB "versionchange":
   se fallisce, viene annullata e i dati restano alla versione precedente.

## Se compare la schermata "Recupero dati"

1. Tocca **Scarica copia grezza del database** e, se presenti, **Scarica snapshot pre-migrazione**. Conserva i file.
2. Chiudi le altre schede/finestre dell'app (possono bloccare l'apertura del database) e tocca **Ricarica**.
3. Se il problema resta: installa/apri una versione funzionante dell'app, vai su Altro → Backup → Importa e scegli
   la copia grezza o lo snapshot (formati riconosciuti automaticamente). Le foto delle macchine non sono incluse
   nelle copie grezze; lo sono nei backup normali.
4. Non cancellare i dati del browser finché non hai una copia verificata.
