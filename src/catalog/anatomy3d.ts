// Modello dati dell'atlante 3D: strutture (con genitore e mesh sinistra/destra), nomi IT/latino, azioni,
// e relazioni esplicite esercizio → struttura con ruolo e fonte. Il viewer NON deduce l'anatomia dal nome di un esercizio.
// Quattro viste distinte: anatomia (questo file), lavoro registrato (serie per gruppo), priorità (preferenza), dolore (segnalazioni).
import type { Muscle } from '../db/types';
import { STRUCTURES_MORE, type Focus } from './anatomyAll';

export const MODEL3D = {
  file: 'anatomy3d/full-body-male-mobile.glb',
  bytes: 2545068,
  sha256: 'd80bebc4045069b660ca8e7afe599d76d15ccc7d96410b3727c600ef01d24e54',
  cache: 'anatomy3d-v1',
  credit: 'Modello 3D: Z-Anatomy (CC BY-SA 4.0), da BodyParts3D © The Database Center for Life Science (CC BY 4.0; in origine CC BY-SA 2.1 JP); adattamento mobile Fit Mit With anatomy atlas (CC BY-SA 4.0). Geometria non rivista da un anatomista (dichiarato dalla fonte). Nessuna modifica alla geometria.',
  links: [
    { label: 'Licenza CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    { label: 'Z-Anatomy', url: 'https://github.com/Z-Anatomy/Models-of-human-anatomy' },
    { label: 'Adattamento mobile (fonte del file)', url: 'https://github.com/slfresh/fitmitwith-anatomy-atlas' },
    { label: 'BodyParts3D', url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html' }
  ]
} as const;

export interface Structure3D {
  /** chiave della struttura nel modello (extras.key) */
  key: string;
  parent: string | null;
  it: string;
  latin: string;
  synonyms: string[];
  region: string;
  /** focus documentabile / solo coinvolto / nessun focus distinguibile */
  focus?: Focus;
  source?: keyof typeof ANATOMY_SOURCE_URL;
  action: string;
  /** gruppo del diario a cui sono attribuite le serie; null = non tracciato separatamente */
  group: Muscle | null;
  deep?: boolean;
}

const OS = 'OpenStax A&P 2e, 11.5';
const S3 = 'OpenStax A&P 2e, 11.3' as const, S4 = 'OpenStax A&P 2e, 11.4' as const, S5 = 'OpenStax A&P 2e, 11.5' as const, S6 = 'OpenStax A&P 2e, 11.6' as const;
export const ANATOMY_SOURCE_URL = { 'OpenStax A&P 2e, 11.3': 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back', 'OpenStax A&P 2e, 11.4': 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax', 'OpenStax A&P 2e, 11.5': 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs', 'OpenStax A&P 2e, 11.6': 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs', 'Chaves et al. 2020': 'https://pubmed.ncbi.nlm.nih.gov/32922646/' } as const;

/** Spalla e petto (primo lotto, curati a mano). */
const CURATED: Structure3D[] = [
  { key: 'deltoid_anterior', parent: 'deltoide', it: 'Deltoide, porzione anteriore (clavicolare)', latin: 'm. deltoideus, pars clavicularis', synonyms: ['deltoide anteriore', 'spalla anteriore', 'deltoide clavicolare'], region: 'spalla', group: 'deltoidi_anteriori',
    action: 'Porta il braccio in avanti (flessione) e lo ruota verso l\'interno; partecipa a sollevarlo di lato.' },
  { key: 'deltoid_lateral', parent: 'deltoide', it: 'Deltoide, porzione laterale (acromiale)', latin: 'm. deltoideus, pars acromialis', synonyms: ['deltoide laterale', 'deltoide medio', 'spalla laterale'], region: 'spalla', group: 'deltoidi_laterali',
    action: 'Solleva il braccio di lato (abduzione), soprattutto oltre i primi gradi del movimento.' },
  { key: 'deltoid_posterior', parent: 'deltoide', it: 'Deltoide, porzione posteriore (spinale)', latin: 'm. deltoideus, pars spinalis', synonyms: ['deltoide posteriore', 'spalla posteriore', 'deltoide spinale'], region: 'spalla', group: 'deltoidi_posteriori',
    action: 'Porta il braccio indietro (estensione), anche quando è sollevato lateralmente, e lo ruota verso l\'esterno.' },
  { key: 'supraspinatus', parent: 'cuffia', it: 'Sovraspinato', latin: 'm. supraspinatus', synonyms: ['cuffia dei rotatori'], region: 'spalla', group: 'cuffia_rotatori', deep: true, action: 'Inizia il sollevamento laterale del braccio e stabilizza la testa dell\'omero.' },
  { key: 'infraspinatus', parent: 'cuffia', it: 'Infraspinato', latin: 'm. infraspinatus', synonyms: ['cuffia dei rotatori'], region: 'spalla', group: 'cuffia_rotatori', action: 'Ruota il braccio verso l\'esterno e stabilizza la spalla.' },
  { key: 'teres_minor', parent: 'cuffia', it: 'Piccolo rotondo', latin: 'm. teres minor', synonyms: ['cuffia dei rotatori'], region: 'spalla', group: 'cuffia_rotatori', action: 'Ruota il braccio verso l\'esterno e stabilizza la spalla.' },
  { key: 'subscapularis', parent: 'cuffia', it: 'Sottoscapolare', latin: 'm. subscapularis', synonyms: ['cuffia dei rotatori'], region: 'spalla', group: 'cuffia_rotatori', deep: true, action: 'Ruota il braccio verso l\'interno e stabilizza la spalla.' },
  { key: 'pectoralis_major_clavicular', parent: 'grande_pettorale', it: 'Grande pettorale, capo clavicolare', latin: 'm. pectoralis major, pars clavicularis', synonyms: ['pettorale alto', 'petto alto'], region: 'petto', group: 'petto',
    action: 'Porta il braccio in avanti e verso l\'alto (flessione) e verso il centro del corpo.' },
  { key: 'pectoralis_major_sternocostal', parent: 'grande_pettorale', it: 'Grande pettorale, capo sternocostale', latin: 'm. pectoralis major, pars sternocostalis', synonyms: ['pettorale', 'petto centrale'], region: 'petto', group: 'petto',
    action: 'Avvicina il braccio al corpo (adduzione), lo riporta indietro da una posizione in avanti e lo ruota verso l\'interno.' },
  { key: 'pectoralis_major_abdominal', parent: 'grande_pettorale', it: 'Grande pettorale, porzione addominale', latin: 'm. pectoralis major, pars abdominalis', synonyms: ['pettorale basso', 'petto basso'], region: 'petto', group: 'petto',
    action: 'Porta in basso il braccio sollevato e lo avvicina al corpo.' },
  { key: 'pectoralis_minor', parent: null, it: 'Piccolo pettorale', latin: 'm. pectoralis minor', synonyms: [], region: 'petto', group: null, deep: true, action: 'Porta la scapola in avanti e in basso e la stabilizza contro il torace.' }
];
const CURATED_FOCUS: Record<string, Focus> = { deltoid_anterior: 'focus', deltoid_lateral: 'focus', deltoid_posterior: 'focus', supraspinatus: 'coinvolto', infraspinatus: 'focus', teres_minor: 'coinvolto', subscapularis: 'nessuno', pectoralis_major_clavicular: 'focus', pectoralis_major_sternocostal: 'focus', pectoralis_major_abdominal: 'coinvolto', pectoralis_minor: 'nessuno' };

/** Tutte le strutture del modello con scheda italiana: 11 curate (spalla, petto) + le altre (anatomyAll.ts). */
export const STRUCTURES: Structure3D[] = [
  ...CURATED.map((x) => ({ ...x, focus: CURATED_FOCUS[x.key], source: OS as keyof typeof ANATOMY_SOURCE_URL })),
  ...STRUCTURES_MORE.map((x): Structure3D => ({ key: x.key, parent: null, it: x.it, latin: x.latin, synonyms: x.synonyms ?? [], region: x.region, action: x.action, group: x.group, deep: x.deep, focus: x.focus, source: x.source }))
];

/** Nomi italiani dei gruppi del modello, per le strutture non ancora curate (scheda "da scrivere", mai inventata). */
export const GROUP_IT: Record<string, string> = {
  Deltoids: 'Deltoidi', 'Rotator cuff': 'Cuffia dei rotatori', 'Teres major': 'Grande rotondo', Quadriceps: 'Quadricipite', Hamstrings: 'Ischiocrurali (femorali)', Sartorius: 'Sartorio', Adductors: 'Adduttori',
  Chest: 'Petto', Serratus: 'Dentato', Trapezius: 'Trapezio', Lats: 'Gran dorsale', 'Upper back': 'Schiena alta', 'Spinal extensors': 'Erettori della colonna', Abdominals: 'Addominali', Obliques: 'Obliqui',
  'Lower back': 'Zona lombare', Neck: 'Collo', Biceps: 'Bicipite', 'Upper arms': 'Braccio', Triceps: 'Tricipite', Forearms: 'Avambraccio', Glutes: 'Glutei', 'Hip flexors': 'Flessori dell\'anca',
  'Hip rotators': 'Rotatori dell\'anca', Calves: 'Polpacci', 'Lower legs': 'Gamba'
};

export type Role = 'principale' | 'secondario' | 'possibile_enfasi';
export interface ExerciseStructure { exerciseId: string; key: string; role: Role; source: keyof typeof ANATOMY_SOURCE_URL; quality: 'anatomia funzionale' | 'studio limitato' }

/**
 * Relazioni esplicite (non dedotte dal nome). "Coinvolto", "possibile enfasi" e "isolato" non sono sinonimi.
 * Una serie di panca resta UNA serie di petto nel diario: queste relazioni servono a spiegare, non a contare per capo.
 */
const R = (exerciseId: string, rows: [string, Role][], source: ExerciseStructure['source'] = OS, quality: ExerciseStructure['quality'] = 'anatomia funzionale'): ExerciseStructure[] =>
  rows.map(([key, role]) => ({ exerciseId, key, role, source, quality }));

export const EXERCISE_STRUCTURES: ExerciseStructure[] = [
  ...['cx_alzate_lat_man', 'cx_alzate_lat_cavo', 'cx_alzate_lat_panca', 'cx_lateral_machine'].flatMap((id) => R(id, [['deltoid_lateral', 'principale'], ['supraspinatus', 'secondario']])),
  ...['cx_military_man', 'cx_military_mp', 'cx_shoulder_press', 'cx_landmine_press'].flatMap((id) => R(id, [['deltoid_anterior', 'principale'], ['deltoid_lateral', 'secondario'], ['pectoralis_major_clavicular', 'secondario']])),
  ...['cx_reverse_pec', 'cx_alzate_post_man', 'cx_rear_fly_cavi', 'cx_face_pull'].flatMap((id) => R(id, [['deltoid_posterior', 'principale'], ['infraspinatus', 'secondario'], ['teres_minor', 'secondario']])),
  ...R('cx_extrarotazione_cavo', [['infraspinatus', 'principale'], ['teres_minor', 'principale'], ['deltoid_posterior', 'secondario']]),
  ...['cx_panca_piana_bil', 'cx_panca_piana_man', 'cx_chest_press', 'cx_piegamenti', 'cx_pec_deck'].flatMap((id) => R(id, [['pectoralis_major_sternocostal', 'principale'], ['pectoralis_major_clavicular', 'secondario'], ['deltoid_anterior', 'secondario']])),
  // Panca inclinata: enfasi possibile sul capo clavicolare. Evidenza longitudinale limitata (giovani uomini non allenati, misure per sede):
  // non diventa una percentuale di "petto alto" né vale per ogni macchina o persona.
  ...['cx_panca_incl_man', 'cx_chest_press_incl', 'cx_panca_incl_mp'].flatMap((id) => [
    ...R(id, [['pectoralis_major_sternocostal', 'principale'], ['deltoid_anterior', 'secondario']]),
    ...R(id, [['pectoralis_major_clavicular', 'possibile_enfasi']], 'Chaves et al. 2020', 'studio limitato')
  ]),
  ...['cx_dip_petto', 'cx_dip_panca'].flatMap((id) => R(id, [['pectoralis_major_abdominal', 'secondario'], ['deltoid_anterior', 'secondario']])),
  // ---- Schiena (11.3, 11.5)
  ...['cx_lat_larga', 'cx_lat_stretta', 'cx_trazioni', 'cx_trazioni_assistite', 'cx_pulldown_unil'].flatMap((id) => R(id, [['latissimus_dorsi', 'principale'], ['teres_major', 'secondario'], ['trapezius_lower', 'secondario'], ['rhomboid_major', 'secondario'], ['biceps_brachii_long', 'secondario'], ['brachialis', 'secondario']], S5)),
  ...['cx_pullover_cavo', 'cx_pullover_man'].flatMap((id) => R(id, [['latissimus_dorsi', 'principale'], ['teres_major', 'secondario'], ['triceps_long', 'secondario']], S5)),
  // tirate orizzontali: dorsali e retrattori della scapola insieme; con il petto in appoggio meno lavoro di stabilizzazione per gli erettori
  ...['cx_row_macchina', 'cx_low_row_indip', 'cx_tbar', 'cx_pulley', 'cx_row_cavo_unil', 'cx_rematore_man', 'cx_inverted_row', 'cx_rematore_appoggio'].flatMap((id) => R(id, [['trapezius_middle', 'principale'], ['rhomboid_major', 'principale'], ['latissimus_dorsi', 'principale'], ['deltoid_posterior', 'secondario'], ['biceps_brachii_long', 'secondario']], S5)),
  ...R('cx_rematore_bil', [['trapezius_middle', 'principale'], ['rhomboid_major', 'principale'], ['latissimus_dorsi', 'principale'], ['deltoid_posterior', 'secondario'], ['longissimus_thoracis', 'secondario'], ['iliocostalis_lumborum', 'secondario']], S5),
  // high row: tirata dall'alto, NON un isolamento dei romboidi
  ...R('cx_high_row', [['latissimus_dorsi', 'principale'], ['teres_major', 'secondario'], ['trapezius_lower', 'secondario'], ['rhomboid_major', 'secondario']], S5),
  ...R('cx_face_pull', [['trapezius_middle', 'secondario']], S5),
  ...R('cx_scrollate_man', [['trapezius_upper', 'principale'], ['levator_scapulae', 'secondario']], S5),
  ...R('cx_alzata_y', [['trapezius_lower', 'possibile_enfasi'], ['trapezius_middle', 'secondario'], ['deltoid_lateral', 'secondario']], S5),
  ...R('cx_back_ext', [['longissimus_thoracis', 'principale'], ['iliocostalis_lumborum', 'principale'], ['gluteus_maximus', 'principale'], ['biceps_femoris_long', 'secondario']], S3),
  // ---- Anca, coscia (11.6)
  ...['cx_rdl_bil', 'cx_rdl_man'].flatMap((id) => R(id, [['biceps_femoris_long', 'principale'], ['semitendinosus', 'principale'], ['semimembranosus', 'principale'], ['gluteus_maximus', 'principale'], ['adductor_magnus', 'secondario'], ['longissimus_thoracis', 'secondario'], ['iliocostalis_lumborum', 'secondario']], S6)),
  ...['cx_squat_bil', 'cx_hack_squat', 'cx_leg_press', 'cx_pendulum', 'cx_goblet_squat', 'cx_belt_squat'].flatMap((id) => R(id, [['vastus_lateralis', 'principale'], ['vastus_medialis', 'principale'], ['vastus_intermedius', 'principale'], ['rectus_femoris', 'secondario'], ['gluteus_maximus', 'secondario'], ['adductor_magnus', 'secondario']], S6)),
  ...['cx_bulgaro', 'cx_affondi', 'cx_split_squat', 'cx_step_up'].flatMap((id) => R(id, [['vastus_lateralis', 'principale'], ['vastus_medialis', 'principale'], ['gluteus_maximus', 'principale'], ['adductor_magnus', 'secondario'], ['gluteus_medius', 'secondario']], S6)),
  ...R('cx_leg_ext', [['rectus_femoris', 'principale'], ['vastus_lateralis', 'principale'], ['vastus_medialis', 'principale'], ['vastus_intermedius', 'principale']], S6),
  ...['cx_leg_curl_seduto', 'cx_leg_curl_sdraiato', 'cx_leg_curl_piedi', 'cx_nordic'].flatMap((id) => R(id, [['biceps_femoris_long', 'principale'], ['biceps_femoris_short', 'principale'], ['semitendinosus', 'principale'], ['semimembranosus', 'principale'], ['gastrocnemius_medial', 'secondario']], S6)),
  ...['cx_hip_thrust', 'cx_ponte_glutei', 'cx_kickback_cavo'].flatMap((id) => R(id, [['gluteus_maximus', 'principale'], ['biceps_femoris_long', 'secondario'], ['semitendinosus', 'secondario']], S6)),
  ...R('cx_adductor', [['adductor_longus', 'principale'], ['adductor_magnus', 'principale'], ['adductor_brevis', 'secondario'], ['gracilis', 'secondario'], ['pectineus', 'secondario']], S6),
  ...R('cx_abductor', [['gluteus_medius', 'principale'], ['gluteus_minimus', 'secondario'], ['tensor_fasciae_latae', 'secondario']], S6),
  ...['cx_calf_piedi', 'cx_calf_pressa', 'cx_calf_mono_man'].flatMap((id) => R(id, [['gastrocnemius_medial', 'principale'], ['gastrocnemius_lateral', 'principale'], ['soleus', 'secondario']], S6)),
  ...R('cx_calf_seduto', [['soleus', 'principale'], ['gastrocnemius_medial', 'secondario'], ['gastrocnemius_lateral', 'secondario']], S6),
  // ---- Braccio e avambraccio (11.5)
  ...['cx_curl_ez', 'cx_curl_man', 'cx_curl_scott', 'cx_curl_cavo_bayes', 'cx_curl_inclinata'].flatMap((id) => R(id, [['biceps_brachii_long', 'principale'], ['biceps_brachii_short', 'principale'], ['brachialis', 'secondario'], ['brachioradialis_muscle', 'secondario']], S5)),
  ...['cx_curl_martello', 'cx_curl_inverso'].flatMap((id) => R(id, [['brachialis', 'principale'], ['brachioradialis_muscle', 'principale'], ['biceps_brachii_long', 'secondario']], S5)),
  ...['cx_pushdown', 'cx_triceps_machine', 'cx_dip_panca', 'cx_jm_press_mp'].flatMap((id) => R(id, [['triceps_lateral', 'principale'], ['triceps_medial', 'principale'], ['triceps_long', 'secondario']], S5)),
  ...['cx_estensione_cavo_testa', 'cx_french_ez'].flatMap((id) => R(id, [['triceps_long', 'principale'], ['triceps_lateral', 'secondario'], ['triceps_medial', 'secondario']], S5)),
  ...R('cx_curl_polso', [['flexor_carpi_radialis', 'principale'], ['humeral_head_of_flexor_carpi_ulnaris', 'principale'], ['humero_ulnar_head_of_flexor_digitorum_superficialis', 'secondario']], S5),
  ...R('cx_farmer_walk', [['humero_ulnar_head_of_flexor_digitorum_superficialis', 'principale'], ['flexor_digitorum_profundus', 'principale'], ['trapezius_upper', 'secondario'], ['quadratus_lumborum', 'secondario']], S5),
  // ---- Tronco (11.4)
  ...['cx_crunch_cavo', 'cx_crunch_allungamento', 'cx_leg_raise'].flatMap((id) => R(id, [['rectus_abdominis', 'principale'], ['external_oblique', 'secondario']], S4)),
  ...['cx_plank', 'cx_dead_bug'].flatMap((id) => R(id, [['rectus_abdominis', 'secondario'], ['transversus_abdominis', 'secondario'], ['external_oblique', 'secondario']], S4)),
  ...R('cx_side_plank', [['external_oblique', 'principale'], ['internal_oblique', 'secondario'], ['quadratus_lumborum', 'secondario'], ['gluteus_medius', 'secondario']], S4),
  ...R('cx_pallof', [['external_oblique', 'principale'], ['internal_oblique', 'secondario'], ['transversus_abdominis', 'secondario']], S4)
];

export const ROLE_LABEL: Record<Role, string> = { principale: 'principale', secondario: 'coinvolto', possibile_enfasi: 'possibile enfasi' };
export const structureByKey = (k: string) => STRUCTURES.find((s) => s.key === k) ?? null;
