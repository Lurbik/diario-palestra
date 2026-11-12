# Verifiche eseguite (12/11/2026)

Ambiente: Windows 11, Node 22.17, Chromium del pannello browser con viewport 375×812 (emulazione telefono).
**Nessuna prova su telefono reale; APK non compilato.**

## Test automatici — `npm test` → 48/48 superati

Nutrienti: 360 kcal/100 g → 50 g = 180 kcal; nutriente sconosciuto resta sconosciuto; somme incomplete marcate;
ml→g senza densità = sconosciuto; ricetta 100 g A + 200 g B con peso finale misurato; barrette per lotto/100 g/pezzo; virgola italiana.
Seed: nessuna ricetta con formaggi esclusi; niente yogurt di default; Bayesian con serie sconosciute; scheda = modello senza
sedute; conteggio serie dirette della scheda (petto 6, quadricipiti 6, femorali 6, tricipiti 6, bicipiti 4, laterali 4, anteriori 2…).
Progressione: 12/12 in due sedute → incremento; una seduta non basta; 8 eseguite/6 valide ≠ 8 valide; RIR mancante ≠ RIR 0;
lat 6 + 4 parziali extra = 6; dolore → nessun aumento; salto troppo grande → consolidamento con %; cambio macchina/leva → storico distinto;
carico per manubrio non convertito; multipower senza peso barra → totale ignoto; tonnellaggio solo stessa configurazione.
Stallo: 5 settimane stesso carico con ripetizioni crescenti → progresso; recuperi diversi → non confrontabili; 2 sedute identiche
→ insufficienti; 4 esposizioni in < 3 settimane → periodo breve; 4 settimane identiche → possibile stallo.
Calorie: poche pesate/diario incompleto → nessun aumento; picco in una sola pesata → nessuna riduzione; target non seguito →
praticabilità; max un cambio ogni 2 settimane.
Date Europe/Rome: mezzanotte (23:30 UTC → giorno dopo), estate, giornata di 25 ore del 25/10/2026, marzo 2026.
Timer: durata attiva/totale/pause dai timestamp. Sicurezza: segnali d'allarme → urgente.
Database (fake-indexeddb): preparare 4 porzioni scarica una volta → mangiarne 1 lascia 3 e registra ¼ → annullamenti in ordine
ripristinano tutto; annullare la preparazione con porzioni mangiate è rifiutato; scorte insufficienti bloccano senza negativi;
pianificare non scarica; scarico ed eliminazione voce ripristinano la scorta; primo avvio senza sedute/pesate; salvataggio
idempotente (doppio tocco); ripresa seduta attiva con recupero; conformi > complete rifiutato; backup export→import con
allegato binario e reimport senza duplicati; cifratura con password errata che fallisce; migrazione v1→v2 con snapshot.

## Prove manuali nel browser (build di produzione + `vite preview`)
- Avvio seduta "Petto / Schiena" dalla scheda dichiarata, serie 90 × 7 RIR 1 salvata: conferma mostrata solo a scrittura
  completata; doppio clic → 1 sola serie in IndexedDB; modulo azzerato senza ricopiare ripetizioni/RIR (carico mantenuto).
- Ripetizioni inserite e non salvate → ricarica pagina → seduta, bozza (90 kg / 6) e timer di recupero ripristinati dai timestamp.
- "Pronta offline" mostrato solo dopo verifica di service worker attivo + risorse in cache.
- **Server spento** → ricarica → app caricata dal service worker; seconda serie (RIR "non so") salvata offline.
- Nuova build con seduta attiva → banner "Nuova versione disponibile — aggiorna dopo la seduta", pulsante disabilitato;
  seduta terminata → aggiornamento → 2 serie e seduta conclusa preservate.
- **Migrazione reale**: database ricreato a schema v1 con una seduta → ricarica → schema v2, snapshot pre-migrazione
  salvato, seduta visibile nello storico, campi nuovi normalizzati. (Questa prova ha rivelato e fatto correggere un bug:
  lo snapshot falliva se il DB degli snapshot esisteva senza archivio.)
- Onboarding: pesata dichiarata e pausa per dolore inserite solo dopo conferma, data d'esordio vuota; yogurt "no"; target proteico 115 g.
- Ricetta "Riso con pollo" preparata ×4 senza scorte → avviso mancanze → "Registra comunque" → porzione mangiata dal diario:
  restano 3 porzioni, diario con ¼ dei nutrienti.
- 26 schermate aperte senza errori in console; temi chiaro e scuro su viewport mobile.
- Build `build:public` verificata senza nome, autodescrizione del dolore o dati di studio nel bundle.

## Non verificato
Telefono reale (vedi CHECKLIST-ANDROID.md), APK, notifiche locali Capacitor, Wake Lock/vibrazione, lettori di schermo,
zoom di sistema, ricerca Open Food Facts (richiede rete: non chiamata durante i test).
