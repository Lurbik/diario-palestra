# Stato del brief "atlante e coach" (16 novembre 2026)

Legenda: ✅ fatto e verificato · 🟡 parziale · ⏳ da fare · 🔍 da verificare su telefono

## Lotto 1 — Coach, integratori, logging (fatto)

| Punto del brief | Stato | Dove / come verificato |
|---|---|---|
| Farmaci + creatina in uso → la cautela resta dominante, l'uso resta vero | ✅ | `tests/brief3.test.ts`, E2E `brief3_lotto1_e2e.py` |
| Utente nuovo, zero sedute → niente «non serve», «Non so ancora quanto ti alleni» | ✅ | idem |
| Tre assi distinti (uso / cautela / pertinenza); cautele sempre in cima | ✅ | idem |
| Creatina: riferimento 3–5 g/die, esempio 3 g, grammi ≠ misurini, nessun ricalcolo giornaliero | ✅ | scheda Integratori |
| Diario prese: g, data reale (anche passata), presa/saltata/non registrata, nessun doppione | ✅ | `src/lib/supplementLog.ts`, test + E2E |
| Inizio / interruzione / ripresa del periodo d'uso | ✅ | Integratori |
| Grafico peso con l'inizio creatina; blocco calorie etichettato come regola di prodotto | ✅ | Progressi → Peso, E2E |
| Promemoria facoltativo per le prese | ⏳ | — |
| «Fastidio o dolore?» accanto a Salva: zona, lato, esordio, intensità 0–10, nota | ✅ | Seduta, E2E |
| Dolore su una serie → niente proposte di carico più alto sul movimento; nessun blocco perpetuo | ✅ | test progressione |
| Avvisi d'urgenza diversi per articolazioni e schiena | ✅ | `src/lib/painReport.ts` |
| Priorità muscolare: un tocco dall'atlante, visibile e revocabile nel profilo | ✅ | E2E |
| Priorità usata solo a parità di criteri tecnici (alternative e coach) | ✅ | `tests/brief3.test.ts` |
| Coach: «Cosa ho visto → cosa suggerisco → perché → cosa non so», massimo 3 azioni | ✅ | Allenamento |
| Scheda esercizio: campi editoriali visibili; voci senza scheda lo dicono | ✅ | E2E |
| Campi editoriali compilati per tutti gli 85 esercizi | 🟡 | 12 su 85 (più il plank); da completare nel lotto 4 |

## Lotto 2 — Atlante 3D su spalla e petto (fatto, da provare su telefono)

| Punto | Stato | Note |
|---|---|---|
| Modello GLB con licenza e mesh verificate | ✅ | Z-Anatomy/BodyParts3D, adattamento mobile CC BY-SA 4.0; SHA-256 controllato al download e nei test; 2,4 MB; 109 muscoli (218 regioni) |
| Pacchetto facoltativo: dimensione prima, annulla, riprova, rimuovi, offline | ✅ | Cache separata; il GLB non entra nell'installazione |
| Rotazione 360° con dito o pulsanti, fronte/retro/lati, zoom, centra, isola, reset | ✅ | Nessuna rotazione continua; disegno solo quando cambia qualcosa |
| Tre porzioni del deltoide e capi del grande pettorale selezionabili (tocco e lista) | ✅ | mesh separate nella fonte, non poligoni inventati |
| Flusso spalla → porzione laterale → esercizi → alzate laterali al cavo → ritorno alla stessa selezione | ✅ | E2E `tests/e2e/atlas3d_e2e.py` |
| Inverso: panca inclinata → principale / coinvolto / possibile enfasi (evidenza limitata) | ✅ | relazioni esplicite in `src/catalog/anatomy3d.ts` |
| Vecchie sagome BodySvg sostituite in Progressi e scheda esercizio | ✅ | nessun uso residuo |
| Alternative in seduta → link ai muscoli nell'atlante | ✅ | |
| Fallback senza pacchetto o senza WebGL: atlante 2D OpenStax, stessa nomenclatura | ✅ | offline verificato |
| Schede italiane per tutte le 109 strutture | 🟡 | 11 curate (spalla, petto); le altre mostrano gruppo e nome del modello con «scheda da scrivere» |
| Miniatura nella scheda esercizio generata dal modello | ⏳ | per ora elenco ruoli + «Vedi nell'atlante» |
| Misure su Android reale (peso, prima apertura, fluidità) | 🔍 | qui solo emulazione software (SwiftShader): avvio 0,1–0,3 s, non rappresentativo |

## Brief «schede, RIR, ricerca» (16 novembre 2026) — conteggi misurati

- **Esercizi:** 93 nel catalogo (traguardi del brief 150 e 220 **non raggiunti**). Gli 8 nuovi hanno scheda editoriale completa; per gli altri la scheda esercizio mostra un’indicazione generale marcata come tale.
- **Schede:** 20 (2 giorni: 5 · 3 giorni: 5 · 4 giorni: 4 · 5 giorni: 4 · 6 giorni: 2): 9 brevi, 6 medie, 5 estese (almeno una breve per ogni frequenza); durate calcolate, da 23–31 min (5 sedute brevi) a 61–63 min (full body 2 giorni estesa).
- **Atlante:** 109 strutture con scheda italiana, fonte e azione (spalla 7, petto 5, schiena 16, collo 6, tronco 4, braccio 7, avambraccio 24, anca 12, coscia 14, gamba 14); 32 con focus, 36 solo coinvolte, 41 senza focus distinguibile. Matrice e lacune in `docs/MATRICE_ATLANTE.md`, generata e verificata da un test.
- **Selettore unico** (editor, seduta, dispensa, ricette, ricerca globale), **importazione additiva** delle schede, **target per serie**, **correzione di una serie storica**, **«questa settimana ho meno tempo»**: fatti, con test unitari.
- **Scheda esercizio:** figura dal modello 3D se il pacchetto è scaricato (immagine generata sul telefono, poi il contesto 3D viene chiuso), «Ruota / esplora» nella stessa card; senza pacchetto figura schematica 2D. Non ci sono poster 3D preinstallati.
- **Android reale:** non provato; solo emulazione a 390×844 nel browser.

## Lotti successivi

- Lotto 3: estensione dell'atlante a schiena, glutei, posteriori della coscia, braccia, polpacci.
- Lotto 4: esercizi (traguardo 120) e schede (16), campi editoriali per tutte le voci, cruscotto editoriale.
- Lotto 5: alimenti (250) e ricette (100), merende salate senza frigo da 3 a 8 documentate, media verificati.
