# Regole decisionali (sintesi)

Tutte deterministiche, eseguite dal codice, senza IA. Soglie = policy iniziale prudente e configurabile
(Altro → Impostazioni), **non** algoritmi clinicamente validati. Ogni proposta mostra dati usati, motivo, limiti e
pulsanti Accetta / Mantieni / Modifica; la decisione viene salvata con data.

## Serie e ripetizioni (`src/lib/progression.ts`)
- *Complete* = ripetizioni al ROM pianificato. *Conformi* ⊆ complete. *Parziali pianificate*, *parziali extra*,
  *assistite*, *tentativi falliti* sono categorie separate: non si sommano. Lat "6 + 3 parziali" vale 6.
- RIR mancante ≠ 0. "Non so" è registrato come tale. Unilaterali: ripetizioni per lato, mai raddoppiate.
- Confronti solo entro la stessa configurazione (`esercizio | macchina | versione setup | ROM | convenzione`).
  Cambiare macchina, leva, ROM o convenzione avvia una nuova baseline.

## Doppia progressione
1. Dolore segnalato o pausa attiva → nessun aumento.
2. Meno di 2 sedute comparabili → raccogli dati.
3. Carichi diversi tra serie/sedute → non confrontabili.
4. RIR o conformità mancanti → mantieni e completa i dati.
5. Tutte le serie al massimo del range con RIR ≥ minimo del target, senza problemi tecnici, in 2 sedute →
   proponi il più piccolo incremento disponibile della macchina; se il salto supera il 10% → consolidare/microcarichi.
6. Calo delle ripetizioni valide in 3 sedute comparabili → rivedi il contesto (sonno, recuperi, ordine, alimentazione).
7. Altrimenti mantieni.

## Stallo (`src/lib/stall.ts`)
Solo dopo ≥ 4 esposizioni comparabili su ≥ 3 settimane (4 settimane se settimanale); recuperi molto diversi o dati
incompleti → "non confrontabili". Aumenti di carico, di ripetizioni valide o di RIR a parità di carico = progresso.
Poi checklist in 6 punti, una sola modifica alla volta. Nessun deload obbligatorio, nessun cambio esercizio automatico.

## Calorie (`src/lib/calories.ts`)
- Nessun target dai soli peso/altezza; fase di osservazione ~14 giorni o target inserito consapevolmente.
- Proposte solo con: ≥ 14 giorni di storico, ≥ 3 pesate in ciascuna delle ultime 2 settimane, ≥ 10/14 giorni di
  diario dichiarati completi; massimo una modifica ogni 14 giorni.
- Pendenza del peso con regressione lineare ed errore standard: se il segnale è nel rumore → mantieni 3–4 settimane.
- Sotto il ritmo scelto (0,1–0,25%/settimana) seguendo il target → +100 kcal; se non riesci a mangiare il target → prima
  pasti più pratici; sopra il ritmo in modo persistente → −100 kcal. Annotazioni (creatina, viaggio…) → proposta di rinvio.
- Nessun 7700 kcal/kg, nessuna stima delle calorie dell'allenamento aggiunte al budget.

## Cibo e dispensa (`src/lib/nutrition.ts`, `src/lib/inventory.ts`)
- Valori mancanti restano mancanti; ml↔g solo con densità nota; pezzi solo con peso per pezzo noto.
- Ricette: totali = somma ingredienti; il peso finale cotto serve solo a porzionare.
- "Ho preparato N porzioni" scarica una volta gli ingredienti; mangiare una porzione non li scarica di nuovo.
  Pianificare non consuma. Tutto annullabile; nessuna quantità negativa silenziosa.
- Esclusioni (formaggi) e allergeni filtrano suggerimenti, piano e ricette.

## Dolore (`src/lib/safety.ts`)
Perdita di sensibilità perineale, nuove alterazioni di vescica/intestino o debolezza importante/progressiva alle gambe →
indicazione di valutazione urgente. Dolore intenso (≥ 7/10), in rapido peggioramento o limitante → valutazione sanitaria.
Nessuna diagnosi, terapia, riabilitazione o data di guarigione; la ripresa la conferma l'utente.
