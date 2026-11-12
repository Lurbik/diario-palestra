# Installazione

## Windows (Edge o Chrome)

1. Nella cartella del progetto: `npm install` (solo la prima volta), poi `npm run build` e `npm run preview`.
2. Apri **http://localhost:4173** in Edge o Chrome.
3. Attendi che in fondo alla schermata **Oggi** compaia "● Pronta offline" (verifica reale della cache).
4. Icona **Installa** nella barra degli indirizzi (Edge: menu … → App → Installa questo sito come app).
5. Da quel momento l'app si apre dal menu Start anche senza server acceso e senza rete.
   Per ricevere una nuova versione: riavvia `npm run preview` con la nuova build e apri l'app: comparirà
   "Nuova versione disponibile" (mai durante una seduta).

## Android — via cavo USB, senza pubblicare nulla

Il telefono vede l'app come `http://localhost:4173`, che Chrome considera un contesto sicuro: installazione e offline funzionano.

1. Sul telefono: Impostazioni → Info telefono → tocca 7 volte "Numero build" → Opzioni sviluppatore → attiva **Debug USB**.
2. Collega il telefono al PC con il cavo e accetta l'autorizzazione di debug sul telefono.
3. Sul PC: `npm run build` e `npm run preview` (lascia il terminale aperto).
4. Sul PC apri Chrome all'indirizzo `chrome://inspect/#devices` → **Port forwarding…** → aggiungi
   porta `4173` → `localhost:4173` → spunta "Enable port forwarding" → Done.
5. Sul telefono apri **Chrome** e vai su `http://localhost:4173`.
6. Attendi "● Pronta offline" nella schermata Oggi.
7. Menu ⋮ → **Installa app** (o "Aggiungi a schermata Home" → Installa).
8. Scollega il cavo, attiva la modalità aereo e apri l'app dall'icona: deve funzionare.

Aggiornamenti: ricollega il cavo con il port forwarding attivo e apri l'app; dopo la seduta tocca "Aggiorna".

## Android — hosting HTTPS (scelta separata)

Se in futuro vuoi un indirizzo HTTPS stabile, usa `npm run build:public` (esclude i dati personali precompilati dal pacchetto)
e pubblica la cartella `dist/` su un servizio statico. Non è stato fatto: richiede una tua decisione esplicita.

## Promemoria importanti

- Telefono e PC **non condividono** lo storico: usa Altro → Backup.
- Prima di cancellare i dati di Chrome, disinstallare l'app o cambiare telefono: **fai un backup**.
- In Altro → Backup puoi richiedere l'archiviazione persistente; il browser può comunque rifiutarla.
