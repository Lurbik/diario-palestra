// Modello dati dell'atlante 3D: strutture (con genitore e mesh sinistra/destra), nomi IT/latino, azioni,
// e relazioni esplicite esercizio → struttura con ruolo e fonte. Il viewer NON deduce l'anatomia dal nome di un esercizio.
// Quattro viste distinte: anatomia (questo file), lavoro registrato (serie per gruppo), priorità (preferenza), dolore (segnalazioni).
import type { Muscle } from '../db/types';

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
  region: 'spalla' | 'petto' | 'coscia' | 'altro';
  action: string;
  /** gruppo del diario a cui sono attribuite le serie; null = non tracciato separatamente */
  group: Muscle | null;
  deep?: boolean;
}

const OS = 'OpenStax A&P 2e, 11.5';
export const ANATOMY_SOURCE_URL = { 'OpenStax A&P 2e, 11.5': 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs', 'OpenStax A&P 2e, 11.6': 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs', 'Chaves et al. 2020': 'https://pubmed.ncbi.nlm.nih.gov/32922646/' } as const;

/** Primo lotto curato: spalla e petto (più la coscia già presente in 2D). */
export const STRUCTURES: Structure3D[] = [
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
  ...['cx_dip_petto', 'cx_dip_panca'].flatMap((id) => R(id, [['pectoralis_major_abdominal', 'secondario'], ['deltoid_anterior', 'secondario']]))
];

export const ROLE_LABEL: Record<Role, string> = { principale: 'principale', secondario: 'coinvolto', possibile_enfasi: 'possibile enfasi' };
export const structureByKey = (k: string) => STRUCTURES.find((s) => s.key === k) ?? null;
