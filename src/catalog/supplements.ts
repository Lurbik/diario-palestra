// Catalogo integratori: informazioni GENERALI e verificabili, separate dai dati dell'utente.
// Regole editoriali:
// - Grado di evidenza riferito a forza/ipertrofia o alla carenza indicata, non a "salute" in generale.
// - Dosi = intervalli citati da posizioni ufficiali per adulti sani, come riferimento: NON prescrizioni.
// - Nessun integratore viene "consigliato" a chi segnala condizioni a rischio: si rimanda a medico o farmacista.
// - Niente promesse di effetto individuale: le risposte variano molto fra persone (IOC 2018).

export type EvidenceGrade = 'forte' | 'moderata' | 'debole' | 'insufficiente';

export interface SupplementInfo {
  id: string;
  name: string;
  /** a cosa serve, secondo le fonti, in una frase */
  purpose: string;
  evidence: EvidenceGrade;
  /** cosa dicono le prove, in breve, con i limiti */
  evidenceNote: string;
  /** riferimento generale per adulti sani; null = nessuna dose da proporre senza esami/medico */
  dose: string | null;
  sideEffects: string[];
  /** quando parlarne prima con medico o farmacista */
  cautions: string[];
  sources: { title: string; url: string }[];
}

const S = {
  ioc: { title: 'IOC consensus 2018 — integratori e atleti (Maughan et al.)', url: 'https://researchonline.ljmu.ac.uk/id/eprint/16307/' },
  creat: { title: 'ISSN 2017 — sicurezza ed efficacia della creatina (Kreider et al.)', url: 'https://pubmed.ncbi.nlm.nih.gov/28615996/' },
  caff: { title: 'ISSN 2021 — caffeina e prestazione (Guest et al.)', url: 'https://doi.org/10.1186/s12970-020-00383-4' },
  caffSleep: { title: 'Drake et al. 2013 — caffeina 0, 3 o 6 ore prima di dormire', url: 'https://doi.org/10.5664/jcsm.3170' },
  efsaCaff: { title: 'EFSA 2015 — parere sulla sicurezza della caffeina', url: 'https://doi.org/10.2903/j.efsa.2015.4102' },
  morton: { title: 'Morton et al. 2018 — proteine e adattamenti ai pesi', url: 'https://pubmed.ncbi.nlm.nih.gov/28698222/' },
  schoenfeld: { title: 'Schoenfeld e Aragon 2018 — proteine per pasto e distribuzione', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5828430/' },
  vitdA: { title: 'Meta-analisi 2023 — vitamina D e forza negli atleti (RCT)', url: 'https://pubmed.ncbi.nlm.nih.gov/37841405/' },
  vitdB: { title: 'Meta-analisi 2019 — vitamina D, forza e potenza negli atleti', url: 'https://pubmed.ncbi.nlm.nih.gov/31039170/' },
  omega: { title: 'Meta-analisi 2024 — omega-3 e allenamento con i pesi', url: 'https://pubmed.ncbi.nlm.nih.gov/38777432/' },
  omegaOld: { title: 'Meta-analisi 2022 — omega-3 e muscolo negli adulti più anziani', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9182791/' },
  b12: { title: 'Academy of Nutrition and Dietetics 2016 — diete vegetariane', url: 'https://pubmed.ncbi.nlm.nih.gov/27886704/' },
  iron: { title: 'Società svizzera di medicina dello sport — carenza di ferro negli sportivi', url: 'https://smw.ch/index.php/smw/article/download/2087/3053' },
  ais: { title: 'Australian Institute of Sport — scheda ferro', url: 'https://www.ais.gov.au/__data/assets/pdf_file/0014/1000490/Sport-supplement-fact-sheets-Iron-v4.pdf' },
  beta: { title: 'ISSN 2015 — beta-alanina (Trexler et al.)', url: 'https://doi.org/10.1186/s12970-015-0090-y' },
  bcaa: { title: 'Wolfe 2017 — BCAA e sintesi proteica: mito o realtà?', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5568273/' },
  helms: { title: 'Helms et al. 2014 — preparazione natural: nutrizione e integrazione', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/' },
  contam: { title: 'Revisione sistematica 2022 — integratori e doping involontario', url: 'https://pubmed.ncbi.nlm.nih.gov/35496041/' }
};

export const SUPPLEMENTS: SupplementInfo[] = [
  { id: 'creatina', name: 'Creatina monoidrato', purpose: 'Più forza e lavoro negli sforzi brevi e intensi; nel tempo, più massa magra se ti alleni con i pesi.', evidence: 'forte',
    evidenceNote: 'È l\'integratore con le prove più ampie e coerenti per l\'allenamento con i pesi. Nelle prime settimane il peso può salire di circa 1–2 kg per acqua trattenuta nei muscoli: non è grasso.',
    dose: '3–5 g al giorno, in qualunque momento; la fase di carico non è necessaria.',
    sideEffects: ['Aumento di peso iniziale (acqua).', 'Disturbi gastrointestinali con dosi alte in un\'unica volta.'],
    cautions: ['Malattia renale nota o farmaci che agiscono sui reni.', 'Gravidanza o allattamento; minore età.', 'Esami del sangue: la creatina alza la creatinina sierica e può far sembrare peggiore la funzione renale stimata. Dillo al medico prima degli esami.'],
    sources: [S.creat, S.ioc] },
  { id: 'caffeina', name: 'Caffeina', purpose: 'Migliora in modo acuto molte prestazioni, anche nell\'allenamento con i pesi.', evidence: 'forte',
    evidenceNote: 'Effetto acuto documentato da 3–6 mg/kg (a volte da 2 mg/kg) circa 60 minuti prima; dosi molto alte aumentano gli effetti collaterali senza vantaggi. Anche 6 ore prima di dormire può ridurre il sonno di oltre un\'ora, spesso senza accorgersene.',
    dose: '2–6 mg per kg di peso circa un\'ora prima. Per gli adulti sani EFSA considera sicuri fino a 200 mg in una volta e 400 mg al giorno da tutte le fonti (caffè compreso).',
    sideEffects: ['Insonnia, ansia, tachicardia, disturbi gastrici.'],
    cautions: ['Problemi cardiaci, ipertensione, ansia o disturbi del sonno.', 'Gravidanza o allattamento (EFSA: massimo 200 mg al giorno); minore età.', 'Farmaci che interagiscono con la caffeina.'],
    sources: [S.caff, S.caffSleep, S.efsaCaff] },
  { id: 'proteine_polvere', name: 'Proteine in polvere (siero del latte o vegetali)', purpose: 'Comodità: aiutano a raggiungere la quota proteica quando con il cibo è difficile.', evidence: 'forte',
    evidenceNote: 'Conta la quota proteica totale della giornata (riferimento medio 1,6 g/kg, fino a 2,2 g/kg), non la polvere in sé: se la raggiungi con i pasti, non aggiungono nulla.',
    dose: 'Una dose da 20–40 g di proteine quando serve a colmare la differenza.',
    sideEffects: ['Disturbi digestivi in chi non tollera il lattosio (preferire isolato o proteine vegetali).'],
    cautions: ['Allergia alle proteine del latte (siero) o alla soia.', 'Malattia renale con indicazione a limitare le proteine.'],
    sources: [S.morton, S.schoenfeld] },
  { id: 'vitamina_d', name: 'Vitamina D', purpose: 'Correggere una carenza documentata.', evidence: 'debole',
    evidenceNote: 'Negli atleti le meta-analisi di studi controllati non mostrano un aumento affidabile di forza o potenza. Ha senso correggere una carenza misurata con un esame del sangue.',
    dose: null,
    sideEffects: ['Dosi alte prese a lungo senza controllo possono essere dannose.'],
    cautions: ['Prima un esame (25-OH vitamina D) e l\'indicazione del medico, soprattutto per dosi alte.'],
    sources: [S.vitdA, S.vitdB] },
  { id: 'omega3', name: 'Omega-3 (olio di pesce)', purpose: 'Utile se mangi poco pesce; effetti piccoli e incerti sulla forza.', evidence: 'debole',
    evidenceNote: 'Le meta-analisi trovano al più un piccolo effetto sulla forza (più negli adulti anziani) e nessun effetto affidabile sulla massa muscolare. Prima il cibo: pesce, soprattutto azzurro.',
    dose: null,
    sideEffects: ['Disturbi digestivi, retrogusto.'],
    cautions: ['Farmaci anticoagulanti o antiaggreganti.'],
    sources: [S.omega, S.omegaOld] },
  { id: 'b12', name: 'Vitamina B12', purpose: 'Necessaria a chi segue un\'alimentazione vegana; da valutare per i vegetariani.', evidence: 'forte',
    evidenceNote: 'Chi è vegano ha bisogno di una fonte affidabile di B12 (alimenti fortificati o integratore): non è una scelta di prestazione ma di prevenzione di una carenza.',
    dose: null,
    sideEffects: ['Ben tollerata alle dosi abituali.'],
    cautions: ['Chiedi a medico o farmacista dose e forma; un esame può confermare lo stato.'],
    sources: [S.b12] },
  { id: 'ferro', name: 'Ferro', purpose: 'Solo per correggere una carenza diagnosticata.', evidence: 'moderata',
    evidenceNote: 'Integrare ferro con riserve normali non migliora la prestazione e può essere dannoso. Serve un esame (ferritina e altri valori) e l\'indicazione del medico.',
    dose: null,
    sideEffects: ['Disturbi gastrointestinali; accumulo se non serve.'],
    cautions: ['Mai senza esami: alcune condizioni causano accumulo di ferro.'],
    sources: [S.iron, S.ais] },
  { id: 'beta_alanina', name: 'Beta-alanina', purpose: 'Sforzi intensi che durano circa 1–4 minuti.', evidence: 'moderata',
    evidenceNote: 'Benefici soprattutto in prove continue di 1–4 minuti dopo 2–4 settimane di assunzione. Le serie di un allenamento con i pesi durano in genere meno: vantaggio piccolo o assente.',
    dose: '4–6 g al giorno in dosi frazionate, per almeno 2–4 settimane.',
    sideEffects: ['Formicolio transitorio (parestesia), innocuo, ridotto con dosi frazionate.'],
    cautions: [],
    sources: [S.beta] },
  { id: 'bcaa', name: 'BCAA / aminoacidi ramificati', purpose: 'Venduti per la massa muscolare.', evidence: 'insufficiente',
    evidenceNote: 'Da soli non sostengono la sintesi proteica come una fonte proteica completa. Con proteine sufficienti nella giornata non aggiungono nulla.',
    dose: null, sideEffects: [], cautions: [],
    sources: [S.bcaa] },
  { id: 'booster', name: 'Booster del testosterone, brucia-grassi e termogenici', purpose: 'Venduti per aumentare testosterone o "bruciare grassi".', evidence: 'insufficiente',
    evidenceNote: 'Non ci sono prove solide di benefici sulla composizione corporea in persone sane. Sono la categoria più esposta a sostanze non dichiarate (stimolanti, steroidi).',
    dose: null, sideEffects: ['Variabili: alcuni contengono stimolanti non dichiarati.'], cautions: ['Rischio di contaminazione e di doping involontario.'],
    sources: [S.ioc, S.contam] }
];

export const SUPPLEMENT_GENERAL_SOURCES = [S.ioc, S.contam, S.helms];
