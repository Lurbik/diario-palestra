// Catalogo palestra, esercizi e scheda dichiarata dall'utente (novembre 2026).
// IMPORTANTE: la scheda è un MODELLO. Non genera sedute, record o statistiche.
// I carichi sono "dichiarati" (testo), non risultati verificati.
import type { Exercise, Machine, Program, ProgramItem, Muscle, LoadConvention } from '../db/types';

const M = (id: string, name: string, category: string, extra: Partial<Machine> = {}): Machine => ({
  id, name, category, brand: '', model: '', seat: '', backrest: '', rollers: '', grip: '', camLever: '',
  loadPoints: '', minLoadKg: null, increments: [], barWeightKg: null, pulleyRatio: null, maxedOut: false,
  photoId: null, notes: '', toConfirm: [], ...extra
});

export const SEED_MACHINES: Machine[] = [
  M('m_lat_larga', 'Lat machine (presa larga)', 'Tirate', { grip: 'Prese diverse disponibili' }),
  M('m_lat_singola', 'Lat machine singola ("ciuf ciuf")', 'Tirate', { toConfirm: ['Unilaterale o bilaterale?', 'Convenzione del carico (pacco o dischi?)'] }),
  M('m_pulley', 'Pulley', 'Tirate'),
  M('m_tbar', 'T-bar', 'Tirate', { toConfirm: ['Configurazione: carico a dischi? appoggio petto?'] }),
  M('m_highpull', 'High-pull', 'Tirate'),
  M('m_lowrow', 'Low-row', 'Tirate'),
  M('m_pulldown', 'Pull-down', 'Tirate'),
  M('m_backext', 'Back-extension', 'Tirate'),
  M('m_chest_incl_conv', 'Chest press convergente inclinata', 'Spinte', { toConfirm: ['Convenzione del carico'] }),
  M('m_chest_a', 'Chest press normale A', 'Spinte'),
  M('m_chest_b', 'Chest press normale B (più impegnativa in allungamento, dichiarato)', 'Spinte'),
  M('m_chest_sdraiato', 'Chest press da sdraiato', 'Spinte'),
  M('m_pecfly', 'Peck fly', 'Spinte', { toConfirm: ['Convenzione del carico (90 kg indicati)'] }),
  M('m_multipower', 'Multipower', 'Liberi e guidati', { notes: 'Registrare dischi per lato. Peso effettivo barra separato: sconosciuto finché non verificato.', toConfirm: ['Peso effettivo barra (manuale/istruttore)'] }),
  M('m_panche', 'Panche regolabili', 'Liberi e guidati'),
  M('m_manubri', 'Manubri (fino a 70 kg)', 'Liberi e guidati'),
  M('m_bilancieri', 'Bilancieri dritti / EZ', 'Liberi e guidati', { toConfirm: ['Peso delle barre'] }),
  M('m_rack', 'Rack squat', 'Liberi e guidati'),
  M('m_cavi', 'Cavi (maniglie, polsiere, corde, Vulkan, altre prese)', 'Cavi', { notes: 'Carico selezionato ≠ resistenza effettiva: rapporto carrucole non noto.', toConfirm: ['Rapporto carrucole'] }),
  M('m_curl_machine', 'Curl machine', 'Braccia'),
  M('m_triceps_machine', 'Triceps machine', 'Braccia'),
  M('m_scott', 'Panca Scott', 'Braccia'),
  M('m_multiflight', 'Standing multi flight', 'Spalle'),
  M('m_lateral_machine', 'Lateral deltoids machine', 'Spalle'),
  M('m_shoulder_stack', 'Shoulder press a pacco pesi', 'Spalle'),
  M('m_shoulder_plate', 'Shoulder press a carico diretto', 'Spalle'),
  M('m_hack_1', 'Hack squat 1', 'Gambe', { toConfirm: ['Marca/modello', 'Peso slitta', 'ROM'] }),
  M('m_hack_2', 'Hack squat 2', 'Gambe', { toConfirm: ['Marca/modello', 'Peso slitta', 'ROM'] }),
  M('m_hack_3', 'Hack squat 3', 'Gambe', { toConfirm: ['Marca/modello', 'Peso slitta', 'ROM'] }),
  M('m_presse', 'Presse (varie angolazioni)', 'Gambe'),
  M('m_pressa_orizz', 'Pressa orizzontale (parzialmente pendolare, dichiarato)', 'Gambe'),
  M('m_pendulum', 'Pendulum squat', 'Gambe'),
  M('m_belt_squat', 'Belt squat', 'Gambe'),
  M('m_legext_prime', 'Leg extension PRIME (carico diretto)', 'Gambe', {
    loadPoints: 'Dischi al centro e sopra (dichiarato)',
    notes: 'La funzione dei punti di carico "centro/sopra" NON è dedotta dal nome: verificare manuale/modello o con istruttore.',
    toConfirm: ['Modello/manuale', 'Effetto dei punti di carico sulla curva di resistenza']
  }),
  M('m_legext_stack', 'Leg extension a pacco pesi', 'Gambe'),
  M('m_legcurl_sdr_1', 'Leg curl sdraiato 1', 'Gambe'),
  M('m_legcurl_sdr_2', 'Leg curl sdraiato 2', 'Gambe'),
  M('m_legcurl_seduto', 'Leg curl seduto', 'Gambe'),
  M('m_adductor', 'Adductor machine', 'Gambe', { maxedOut: true, notes: 'Riferita già al massimo del carico: non significa inutile. Nessun carico aggiuntivo non approvato dal produttore.' }),
  M('m_abductor', 'Abductor machine', 'Gambe', { maxedOut: true, notes: 'Riferita già al massimo del carico: non significa inutile. Nessun carico aggiuntivo non approvato dal produttore.' }),
  M('m_kickback', 'Kickback glutei (macchina)', 'Gambe', { maxedOut: true, notes: 'Riferita già al massimo del carico. Progressione via ripetizioni/configurazioni consentite.' }),
  M('m_hipthrust', 'Hip thrust a cintura / supporto', 'Gambe'),
  M('m_trazioni_dip', 'Postazione trazioni / dip', 'Corpo libero')
];

const E = (
  id: string, name: string, machineId: string | null, equipment: string, primary: Muscle[], secondary: Muscle[],
  loadConvention: LoadConvention, policyClass: Exercise['policyClass'], extra: Partial<Exercise> = {}
): Exercise => ({
  id, name, aliases: [], variant: '', machineId, equipment, primaryMuscles: primary, secondaryMuscles: secondary,
  loadConvention, unilateral: false, romType: 'full', configVersion: 1, configNote: '', techNotes: '', toConfirm: [],
  policyClass, ...extra
});

export const SEED_EXERCISES: Exercise[] = [
  E('ex_chest_incl_conv', 'Chest press convergente inclinata', 'm_chest_incl_conv', 'Macchina', ['petto'], ['deltoidi_anteriori', 'tricipiti'], 'unknown', 'compound', { toConfirm: ['Convenzione del carico'] }),
  E('ex_lat_singola', 'Lat machine singola', 'm_lat_singola', 'Macchina', ['dorsali'], ['bicipiti', 'deltoidi_posteriori'], 'unknown', 'compound', {
    aliases: ['ciuf ciuf'], unilateral: true,
    toConfirm: ['Unilaterale? (ora registrata per lato: modifica se sbagliato)', 'Convenzione del carico'],
    techNotes: 'Riferimento di fine ROM individuale e riproducibile (presa, tronco, macchina coerenti), non "mento" universale. Le parziali dopo il limite vanno in "parziali extra".'
  }),
  E('ex_pecfly', 'Peck fly', 'm_pecfly', 'Macchina', ['petto'], [], 'unknown', 'isolation', { variant: 'Focus dichiarato in accorciamento', toConfirm: ['Convenzione del carico'] }),
  E('ex_tbar', 'T-bar presa larga', 'm_tbar', 'T-bar', ['schiena_alta', 'dorsali'], ['bicipiti', 'deltoidi_posteriori'], 'unknown', 'compound', { variant: 'Enfasi dichiarata scapole', toConfirm: ['Configurazione e convenzione del carico'] }),
  E('ex_hack', 'Hack squat', null, 'Hack squat (uno dei tre)', ['quadricipiti'], ['glutei', 'adduttori'], 'unknown', 'heavy_compound', {
    variant: 'Alternativa: pressa', toConfirm: ['Quale dei tre hack squat?', 'ROM', 'Peso della slitta'],
    techNotes: 'Cambiare macchina avvia uno storico distinto: i kg tra macchine diverse non sono confrontabili.'
  }),
  E('ex_legcurl_seduto', 'Leg curl seduto', 'm_legcurl_seduto', 'Macchina', ['femorali'], [], 'machine_stack', 'isolation', { toConfirm: ['Convenzione del carico (90 kg indicati)'] }),
  E('ex_legext_prime', 'Leg extension PRIME', 'm_legext_prime', 'Macchina a carico diretto', ['quadricipiti'], [], 'unknown', 'isolation', {
    variant: 'Dischi al centro e sopra', toConfirm: ['Convenzione del carico (160 kg)', 'Variante identica il venerdì?', 'Curva di resistenza: da verificare, non dedotta']
  }),
  E('ex_calf_pressa', 'Polpacci alla pressa orizzontale', 'm_pressa_orizz', 'Pressa', ['polpacci'], [], 'unknown', 'calves_abs', { toConfirm: ['Convenzione del carico (220 kg)'] }),
  E('ex_crunch_dannunzio', 'Crunch in allungamento', null, 'Da identificare', ['addome'], [], 'bodyweight_added', 'calves_abs', {
    aliases: ["D'Annunzio"], variant: '20 kg tenuti a braccia allungate',
    toConfirm: ['Descrizione o video per identificare attrezzo e movimento']
  }),
  E('ex_military_mp', 'Military press seduto al multipower', 'm_multipower', 'Multipower, panca 75°', ['deltoidi_anteriori'], ['deltoidi_laterali', 'tricipiti'], 'plates_per_side', 'compound', { variant: 'Panca 75°', toConfirm: ['Peso effettivo barra'] }),
  E('ex_curl_esorcista', 'Curl alla Scott (gomiti appoggiati)', 'm_scott', 'Da confermare', ['bicipiti'], [], 'unknown', 'isolation', { aliases: ['esorcista'], toConfirm: ['Attrezzo (bilanciere/EZ/manubri?)', 'Convenzione del carico (22 kg)'] }),
  E('ex_french_cavo', 'French press singola al cavo basso', 'm_cavi', 'Cavo basso', ['tricipiti'], [], 'cable_stack', 'isolation', { unilateral: true, toConfirm: ['Unilaterale? (ora per lato)'] }),
  E('ex_alzate_panca30', 'Alzate laterali singole su panca 30°', 'm_manubri', 'Manubrio + panca 30°', ['deltoidi_laterali'], [], 'per_dumbbell', 'isolation', { unilateral: true, toConfirm: ['12 kg per manubrio?'] }),
  E('ex_hammer_alt', 'Curl a martello alternato in piedi', 'm_manubri', 'Manubri', ['bicipiti'], ['avambracci'], 'per_dumbbell', 'isolation', { unilateral: true, toConfirm: ['22 kg per manubrio?', 'Conteggio ripetizioni per lato'] }),
  E('ex_pushdown_vulkan', 'Pushdown singolo presa Vulkan', 'm_cavi', 'Cavo alto, presa Vulkan', ['tricipiti'], [], 'cable_stack', 'isolation', { unilateral: true, toConfirm: ['Unilaterale? (ora per lato)'] }),
  E('ex_rdl', 'Romanian deadlift con bilanciere', 'm_bilancieri', 'Bilanciere', ['femorali', 'glutei'], ['lombari', 'avambracci'], 'barbell_total', 'heavy_compound', { toConfirm: ['130 kg totale barra inclusa?'] }),
  E('ex_panca_incl_mp', 'Panca inclinata 30° al multipower', 'm_multipower', 'Multipower + panca 30°', ['petto'], ['deltoidi_anteriori', 'tricipiti'], 'plates_per_side', 'compound', { toConfirm: ['Peso effettivo barra'] }),
  E('ex_lat_larga', 'Lat machine presa larga', 'm_lat_larga', 'Macchina', ['dorsali'], ['bicipiti', 'deltoidi_posteriori'], 'unknown', 'compound', { toConfirm: ['Convenzione del carico (100 kg)'] }),
  E('ex_bayesian', 'Bayesian curl singolo', 'm_cavi', 'Cavo ad altezza bacino', ['bicipiti'], [], 'cable_stack', 'isolation', { unilateral: true, toConfirm: ['Numero di serie', 'Unilaterale? (ora per lato)'] }),
  E('ex_jm_mp', 'JM press al multipower', 'm_multipower', 'Multipower', ['tricipiti'], [], 'plates_per_side', 'compound', { toConfirm: ['Peso effettivo barra'] }),
  E('ex_alzate_piedi', 'Alzate laterali in piedi', 'm_manubri', 'Manubri', ['deltoidi_laterali'], [], 'unknown', 'isolation', { toConfirm: ['Convenzione (16–18 kg per manubrio?)', 'ROM'] }),
  // Esercizi aggiuntivi per i template (non nella scheda dichiarata)
  E('ex_pulley', 'Pulley (rematore al cavo)', 'm_pulley', 'Macchina', ['schiena_alta', 'dorsali'], ['bicipiti', 'deltoidi_posteriori'], 'machine_stack', 'compound'),
  E('ex_lowrow', 'Low-row', 'm_lowrow', 'Macchina', ['schiena_alta', 'dorsali'], ['bicipiti'], 'unknown', 'compound'),
  E('ex_chest_a', 'Chest press', 'm_chest_a', 'Macchina', ['petto'], ['deltoidi_anteriori', 'tricipiti'], 'machine_stack', 'compound'),
  E('ex_shoulder_press', 'Shoulder press macchina', 'm_shoulder_stack', 'Macchina', ['deltoidi_anteriori'], ['deltoidi_laterali', 'tricipiti'], 'machine_stack', 'compound'),
  E('ex_pressa', 'Pressa', 'm_presse', 'Pressa', ['quadricipiti'], ['glutei', 'adduttori'], 'unknown', 'heavy_compound'),
  E('ex_legcurl_sdr', 'Leg curl sdraiato', 'm_legcurl_sdr_1', 'Macchina', ['femorali'], [], 'machine_stack', 'isolation'),
  E('ex_reverse_fly', 'Alzate posteriori (multi flight)', 'm_multiflight', 'Macchina', ['deltoidi_posteriori'], [], 'machine_stack', 'isolation'),
  E('ex_triceps_machine', 'Triceps machine', 'm_triceps_machine', 'Macchina', ['tricipiti'], [], 'machine_stack', 'isolation'),
  E('ex_curl_machine', 'Curl machine', 'm_curl_machine', 'Macchina', ['bicipiti'], [], 'machine_stack', 'isolation')
];

let n = 0;
const I = (exerciseId: string, sets: number | null, repMin: number | null, repMax: number | null, declaredLoad: string, extra: Partial<ProgramItem> = {}): ProgramItem => ({
  id: `pi_${++n}`, exerciseId, sets, repMin, repMax, rirTargets: Array.from({ length: sets ?? 0 }, () => null),
  restSec: null, declaredLoad, declaredNotes: '', toConfirm: [], priority: null, sameAs: '', ...extra
});

export const DECLARED_PROGRAM_ID = 'prog_dichiarata_2026_11';

export function declaredProgram(): Program {
  n = 0;
  const rest = 'Recupero abituale dichiarato: circa 3 minuti.';
  return {
    id: DECLARED_PROGRAM_ID,
    name: 'Scheda attuale dichiarata — novembre 2026',
    kind: 'declared',
    isActive: true,
    createdAt: Date.UTC(2026, 10, 12),
    notes:
      'Modello dalla descrizione dell\'utente. I carichi sono abituali DICHIARATI, non prove verificate: non generano sedute, record o statistiche. ' +
      'Prima della pausa le serie erano dichiarate tutte a cedimento: non è un obiettivo predefinito di questa app. ' +
      'Riscaldamento: già sul primo esercizio di ogni gruppo (gambe: più serie progressive). Le serie di riscaldamento non contano come allenanti. ' + rest +
      ' Mercoledì: alcuni esercizi alternati con circa 1 minuto tra esercizi diversi; il ritorno allo stesso esercizio può richiedere di più. L\'app registra ordine e orari, senza classificare tutto come "recupero di 1 minuto".',
    days: [
      { id: 'd_lun', name: 'Petto / Schiena', weekday: 1, items: [
        I('ex_chest_incl_conv', 2, 6, 8, '90 kg (convenzione da confermare)'),
        I('ex_lat_singola', 2, 6, 8, '95–100 kg (unilaterale e convenzione da chiarire)', { declaredNotes: 'A volte seguivano 3–4 parziali con escursione decrescente: si registrano come "parziali extra", separate.' }),
        I('ex_pecfly', 2, 8, 8, '90 kg indicati'),
        I('ex_tbar', 2, 6, 8, '70 kg (configurazione da confermare)')
      ] },
      { id: 'd_mar', name: 'Gambe — enfasi quadricipiti / addome', weekday: 2, items: [
        I('ex_hack', 2, 6, 7, '110 kg (modello, ROM e peso slitta non noti)'),
        I('ex_legcurl_seduto', 2, 7, 7, '90 kg indicati'),
        I('ex_legext_prime', 2, 6, 8, '160 kg, dischi al centro e sopra (curva dichiarata, non verificata)'),
        I('ex_calf_pressa', 2, 8, 8, '220 kg indicati'),
        I('ex_crunch_dannunzio', 2, 7, 10, '20 kg tenuti a braccia allungate')
      ] },
      { id: 'd_mer', name: 'Spalle / Braccia', weekday: 3, items: [
        I('ex_military_mp', 2, 6, 8, '30 kg per lato (barra sconosciuta)'),
        I('ex_curl_esorcista', 2, 6, 8, '22 kg (attrezzo e convenzione da confermare)'),
        I('ex_french_cavo', 2, 6, 8, '21 kg indicati'),
        I('ex_alzate_panca30', 2, 6, 8, '12 kg (per manubrio da confermare)'),
        I('ex_hammer_alt', 2, 6, 8, '22 kg (per manubrio e conteggio per lato da confermare)'),
        I('ex_pushdown_vulkan', 2, 6, 8, '17,5–20 kg indicati')
      ] },
      { id: 'd_ven', name: 'Gambe — enfasi femorali / addome', weekday: 5, items: [
        I('ex_rdl', 2, 6, 8, '130 kg (totale barra inclusa da confermare)'),
        I('ex_legext_prime', 2, 6, 8, 'Come martedì', { sameAs: 'Come martedì', toConfirm: ['Stessa variante del martedì?'] }),
        I('ex_legcurl_seduto', 2, 7, 7, 'Come martedì', { sameAs: 'Come martedì', toConfirm: ['Stessa variante del martedì?'] }),
        I('ex_calf_pressa', 2, 8, 8, 'Come martedì', { sameAs: 'Come martedì' }),
        I('ex_crunch_dannunzio', 2, 7, 10, 'Come martedì', { sameAs: 'Come martedì' })
      ] },
      { id: 'd_sab', name: 'Upper', weekday: 6, items: [
        I('ex_panca_incl_mp', 2, 6, 8, '30–32 kg per lato (barra sconosciuta)'),
        I('ex_lat_larga', 2, 6, 8, '100 kg indicati'),
        I('ex_bayesian', null, 6, 8, '25 kg indicati', { toConfirm: ['Numero di serie (non inventato)'] }),
        I('ex_jm_mp', 2, 6, 8, '35 kg per lato (barra sconosciuta)'),
        I('ex_alzate_piedi', 2, 6, 8, '16–18 kg (convenzione e ROM da confermare)')
      ] }
    ].map((d) => ({ ...d, items: d.items.map((it) => (d.id === 'd_mer' ? it : { ...it, restSec: 180 })) }))
  };
}

/** Template dimostrativi: modificabili, NON un piano personale validato. */
export function templates(): Program[] {
  const t = (id: string, name: string, days: [string, number | null, [string, number, number, number][]][]): Program => ({
    id, name, kind: 'template', isActive: false, createdAt: Date.UTC(2026, 10, 12),
    notes: 'Template dimostrativo modificabile. Non è un piano personale validato. Range e RIR sono proposte da confermare.',
    days: days.map(([dn, wd, items], i) => ({
      id: `${id}_d${i}`, name: dn, weekday: wd,
      items: items.map(([ex, s, a, b], j) => ({
        id: `${id}_d${i}_${j}`, exerciseId: ex, sets: s, repMin: a, repMax: b, rirTargets: Array.from({ length: s }, () => ({ min: 1, max: 3 })),
        restSec: 150, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: ''
      }))
    }))
  });
  return [
    t('tpl_fb3', 'Template full-body 3 giorni', [
      ['Full-body A', 1, [['ex_hack', 2, 6, 10], ['ex_chest_a', 2, 6, 10], ['ex_lat_larga', 2, 8, 12], ['ex_legcurl_seduto', 2, 10, 15], ['ex_alzate_piedi', 2, 12, 20]]],
      ['Full-body B', 3, [['ex_rdl', 2, 6, 10], ['ex_panca_incl_mp', 2, 6, 10], ['ex_pulley', 2, 8, 12], ['ex_legext_prime', 2, 10, 15], ['ex_bayesian', 2, 10, 15]]],
      ['Full-body C', 5, [['ex_pressa', 2, 8, 12], ['ex_shoulder_press', 2, 6, 10], ['ex_tbar', 2, 8, 12], ['ex_legcurl_sdr', 2, 10, 15], ['ex_triceps_machine', 2, 10, 15]]]
    ]),
    t('tpl_ul4', 'Template upper/lower 4 giorni', [
      ['Upper A', 1, [['ex_chest_incl_conv', 2, 6, 10], ['ex_lat_larga', 2, 8, 12], ['ex_military_mp', 2, 6, 10], ['ex_pulley', 2, 8, 12], ['ex_alzate_panca30', 2, 12, 20], ['ex_curl_machine', 2, 10, 15]]],
      ['Lower A', 2, [['ex_hack', 2, 6, 10], ['ex_legcurl_seduto', 2, 10, 15], ['ex_legext_prime', 2, 10, 15], ['ex_calf_pressa', 2, 10, 15], ['ex_crunch_dannunzio', 2, 10, 15]]],
      ['Upper B', 4, [['ex_panca_incl_mp', 2, 6, 10], ['ex_tbar', 2, 8, 12], ['ex_pecfly', 2, 10, 15], ['ex_lat_singola', 2, 8, 12], ['ex_reverse_fly', 2, 12, 20], ['ex_pushdown_vulkan', 2, 10, 15]]],
      ['Lower B', 5, [['ex_rdl', 2, 6, 10], ['ex_pressa', 2, 8, 12], ['ex_legcurl_sdr', 2, 10, 15], ['ex_calf_pressa', 2, 10, 15], ['ex_crunch_dannunzio', 2, 10, 15]]]
    ]),
    t('tpl_ulppl5', 'Template upper/lower + push/pull/legs 5 giorni', [
      ['Upper', 1, [['ex_chest_incl_conv', 2, 6, 10], ['ex_lat_larga', 2, 8, 12], ['ex_military_mp', 2, 6, 10], ['ex_pulley', 2, 8, 12], ['ex_alzate_piedi', 2, 12, 20]]],
      ['Lower', 2, [['ex_hack', 2, 6, 10], ['ex_rdl', 2, 6, 10], ['ex_legext_prime', 2, 10, 15], ['ex_calf_pressa', 2, 10, 15]]],
      ['Push', 3, [['ex_panca_incl_mp', 2, 6, 10], ['ex_pecfly', 2, 10, 15], ['ex_alzate_panca30', 2, 12, 20], ['ex_pushdown_vulkan', 2, 10, 15]]],
      ['Pull', 5, [['ex_lat_singola', 2, 8, 12], ['ex_tbar', 2, 8, 12], ['ex_reverse_fly', 2, 12, 20], ['ex_bayesian', 2, 10, 15]]],
      ['Legs', 6, [['ex_pressa', 2, 8, 12], ['ex_legcurl_seduto', 2, 10, 15], ['ex_legext_prime', 2, 10, 15], ['ex_crunch_dannunzio', 2, 10, 15]]]
    ])
  ];
}
