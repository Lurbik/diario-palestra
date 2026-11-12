# Diario Palestra & Cucina

App personale in italiano, offline, per registrare allenamenti, alimentazione, dispensa, spesa, peso e sonno.
React + TypeScript + Vite, PWA installabile, dati in IndexedDB (Dexie) **solo sul dispositivo**.

> Non è un dispositivo medico e non sostituisce medico, dietista o personal trainer. I suggerimenti sono
> regole deterministiche e spiegabili, con soglie prudenti e configurabili, **non** algoritmi validati clinicamente.

## Avvio rapido (Windows)

Requisiti: Node.js ≥ 20.19 (testato con 22.17) e npm.

```bash
npm install
```

```bash
npm run dev
```

Apri http://localhost:5173 (sviluppo: il service worker è disattivato in dev).

Per provare la versione installabile e offline:

```bash
npm run build
```

```bash
npm run preview
```

Apri http://localhost:4173 in Edge o Chrome → icona "Installa" nella barra degli indirizzi.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | typecheck + build di produzione in `dist/` (con service worker) |
| `npm run build:public` | come sopra ma **senza i dati personali precompilati** (da usare se ospiti l'app su un indirizzo pubblico) |
| `npm run preview` | serve `dist/` su http://localhost:4173 (anche in rete locale con `--host`) |
| `npm test` | test automatici (Vitest + fake-indexeddb) |
| `npm run cap:sync` | build + copia nel progetto Android (Capacitor) |
| `npm run icons` | rigenera le icone PNG |

Versioni bloccate nel `package-lock.json`: React 19.3, Dexie 4.4, Vite 8.3, vite-plugin-pwa 2.0, TypeScript 7.0, Vitest 5.1, Capacitor 8.6.

## Installazione sul telefono Android

Una PWA richiede **HTTPS oppure localhost**: aprire `index.html` con doppio clic, o un indirizzo `http://192.168…`, non basta
per l'installazione completa né per l'offline. Due strade:

1. **Privata, senza pubblicare nulla (consigliata ora)** — vedi [docs/INSTALLAZIONE.md](docs/INSTALLAZIONE.md):
   cavo USB + "Port forwarding" di Chrome (`chrome://inspect`) → sul telefono l'app gira su `http://localhost:4173`,
   che il browser considera sicuro → "Installa app".
2. **Hosting HTTPS** (Netlify, Cloudflare Pages, GitHub Pages…): richiede una tua decisione separata; usa
   `npm run build:public` così i dati personali precompilati non finiscono online.

APK di prova: **non compilato** in questo ambiente (manca Android SDK). Istruzioni esatte in [docs/ANDROID.md](docs/ANDROID.md).

**Telefono e PC non si sincronizzano**: ogni dispositivo ha il suo archivio. Per spostare i dati: Altro → Backup → esporta/importa.

## Struttura

```
src/
  db/        schema Dexie (types, db, migrate, bootstrap, settings)
  data/      seed: catalogo palestra, scheda dichiarata, template, alimenti/ricette di esempio, fonti
  lib/       logica pura e testabile: nutrition, inventory, workout, progression, stall, calories,
             recipes, backup, dates, safety, ics, notify, pwa
  screens/   Oggi, Allenamento (seduta, schede, catalogo, storico, dolore), Cibo (diario, ricette,
             dispensa, spesa, barrette), Progressi, Altro (calendario, sonno, fonti, impostazioni, backup)
  ui/        componenti (stepper, sheet, toast, grafico SVG) e etichette
tests/       logic.test.ts, db.test.ts
android/     progetto Capacitor generato
docs/        installazione, Android/APK, checklist prove, recupero dati, regole decisionali
```

## Cosa è stato verificato (e come)

Vedi [docs/VERIFICHE.md](docs/VERIFICHE.md) per l'elenco completo: 48 test automatici + prove manuali nel browser
(Chromium, viewport mobile) incluse modalità offline a server spento, ripresa della seduta dopo ricarica,
aggiornamento della PWA con seduta attiva e migrazione reale dello schema v1→v2.
**Non** verificato su telefono reale: vedi [docs/CHECKLIST-ANDROID.md](docs/CHECKLIST-ANDROID.md).

## Regole decisionali

Sintesi in [docs/REGOLE.md](docs/REGOLE.md).
