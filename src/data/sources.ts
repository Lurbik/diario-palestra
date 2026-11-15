// Bibliografia iniziale fornita dall'utente. Le fonti supportano principi generali;
// NON validano il motore decisionale dell'app.
export interface Source { title: string; url: string; note: string; area: string }

export const SOURCES: Source[] = [
  { area: 'Salute', title: 'NHS — Mal di schiena', url: 'https://www.nhs.uk/conditions/back-pain/', note: 'Attività quotidiane e segnali che richiedono valutazione.' },
  { area: 'Allenamento', title: 'ACSM Position Stand 2026 — prescrizione dell\'allenamento', url: 'https://pubmed.ncbi.nlm.nih.gov/41843416/', note: 'Revisione delle raccomandazioni generali.' },
  { area: 'Allenamento', title: 'Pelland et al., 2026 (online 2025) — dose-risposta volume/frequenza', url: 'https://pubmed.ncbi.nlm.nih.gov/41343037/', note: 'Relazioni medie, non dosi personali.' },
  { area: 'Allenamento', title: 'Robinson et al., 2024 — vicinanza al cedimento', url: 'https://pubmed.ncbi.nlm.nih.gov/38970765/', note: 'Base per lavorare con RIR stimati.' },
  { area: 'Allenamento', title: 'Refalo et al., 2024 — 1–2 RIR vs cedimento in allenati', url: 'https://pubmed.ncbi.nlm.nih.gov/38393985/', note: 'Ipertrofia quadricipiti e fatica.' },
  { area: 'Allenamento', title: 'Studio 2025 — serie singole a cedimento vs 2 RIR', url: 'https://pubmed.ncbi.nlm.nih.gov/40249908/', note: 'Alcune misure favoriscono modestamente il cedimento: non significa cedimento su tutte le serie.' },
  { area: 'Allenamento', title: 'Ramos-Campo et al., 2024 — split vs full-body', url: 'https://pubmed.ncbi.nlm.nih.gov/38595233/', note: 'Organizzazione della settimana.' },
  { area: 'Allenamento', title: 'Singer et al., 2024 — recuperi tra le serie', url: 'https://pubmed.ncbi.nlm.nih.gov/39205815/', note: 'Motivo per non comprimere i recuperi in "tempo ridotto".' },
  { area: 'Allenamento', title: 'Meta-analisi carichi differenti', url: 'https://pubmed.ncbi.nlm.nih.gov/35015560/', note: 'Range di ripetizioni ampi come scelta pratica.' },
  { area: 'Allenamento', title: 'Wolf et al., 2025 — parziali in allungamento vs ROM completo', url: 'https://pubmed.ncbi.nlm.nih.gov/39959841/', note: 'Misure su flessori/estensori del gomito: non generalizzare ai dorsali.' },
  { area: 'Allenamento', title: 'Larsen et al., 2025 — parziali post-cedimento nei polpacci', url: 'https://pubmed.ncbi.nlm.nih.gov/39995432/', note: 'Non allenati, risultato specifico: non prova di utilità alla lat.' },
  { area: 'Allenamento', title: 'Studio esplorativo 2026 — parziali in allungamento, vasto laterale', url: 'https://pubmed.ncbi.nlm.nih.gov/42841600/', note: 'Esplorativo, soggetti allenati.' },
  { area: 'Allenamento', title: 'Coleman et al., 2024 — una settimana di cessazione', url: 'https://pubmed.ncbi.nlm.nih.gov/38274324/', note: 'Non ha migliorato l\'ipertrofia: non equivale a testare ogni strategia di scarico.' },
  { area: 'Nutrizione', title: 'Morton et al., 2018 — proteine e adattamenti ai pesi', url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/', note: 'Riferimento 1,6–2,2 g/kg come informazione, non prescrizione.' },
  { area: 'Nutrizione', title: 'Helms et al., 2023 — surplus piccoli/grandi in allenati', url: 'https://pubmed.ncbi.nlm.nih.gov/37914977/', note: 'Piccolo studio.' },
  { area: 'Nutrizione', title: 'Iraki et al., 2019 — alimentazione in off-season', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6680710/', note: 'Revisione narrativa.' },
  { area: 'Nutrizione', title: 'Deficit energetico e adattamenti ai pesi', url: 'https://pubmed.ncbi.nlm.nih.gov/34623696/', note: 'Contesto per non sottostimare l\'energia.' },
  { area: 'Nutrizione', title: 'CREA — Tabelle di composizione degli alimenti', url: 'https://www.crea.gov.it/-/Tabella-Di-Composizione-Degli-Alimenti', note: 'Riferimento consultabile (nessuna API). Verificare i termini prima di ridistribuire dati.' },
  { area: 'Nutrizione', title: 'Open Food Facts — documentazione', url: 'https://openfoodfacts.github.io/documentation/docs/', note: 'Integrazione facoltativa per codice a barre.' },
  { area: 'Nutrizione', title: 'Open Food Facts — licenza', url: 'https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/', note: 'Dati ODbL: attribuzione e verifica.' },
  { area: 'Sicurezza alimentare', title: 'FSA — guida studenti a igiene e conservazione', url: 'https://www.gov.uk/government/publications/student-guide-to-food-safety-and-hygiene/student-guide-to-food-safety-and-hygiene', note: 'Preparazione, avanzi, frigo.' },
  { area: 'Sicurezza alimentare', title: 'USDA FSIS — Shelf-Stable Food Safety', url: 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/shelf-stable-food', note: 'Cosa si conserva fuori frigo; non tutte le conserve sono stabili ("Keep Refrigerated").' },
  { area: 'Sicurezza alimentare', title: 'USDA FSIS — pranzo al sacco sicuro', url: 'https://ask.fsis.usda.gov/article/How-do-you-keep-a-bag-lunch-safe', note: 'Trasporto con fonti refrigeranti.' },
  { area: 'Sonno', title: 'AASM/SRS — durata del sonno negli adulti', url: 'https://aasm.org/resources/pdf/adultsleepdurationconsensus.pdf', note: 'Riferimento generale di almeno 7 ore.' },
  { area: 'Tecnica', title: 'web.dev — aggiornamenti PWA', url: 'https://web.dev/learn/pwa/update', note: 'Ciclo di aggiornamento del service worker.' },
  { area: 'Tecnica', title: 'MDN — PWA installabili', url: 'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable', note: 'Requisiti di installazione.' },
  { area: 'Tecnica', title: 'Capacitor — introduzione', url: 'https://capacitorjs.com/docs/getting-started', note: 'Pacchetto Android.' },
  { area: 'Tecnica', title: 'Capacitor — notifiche locali', url: 'https://capacitorjs.com/docs/apis/local-notifications', note: 'Promemoria nell\'app Android.' }
];
