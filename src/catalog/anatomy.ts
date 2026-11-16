// Schede anatomiche dell'atlante (anteprima: spalla, petto, coscia).
// Contenuti generali di anatomia, separati dai dati dell'utente. Fonte: OpenStax, Anatomy and Physiology 2e
// (CC BY 4.0), capitoli 11.5 e 11.6. Nessuna percentuale di attivazione, nessuna promessa di crescita.
import type { Muscle } from '../db/types';

export interface AnatomyStructure {
  id: string;
  name: string;
  /** nome anatomico */
  latin: string;
  /** zona dell'anteprima */
  region: 'spalla' | 'petto' | 'coscia';
  /** visibile sulla mappa (data-s nell'SVG) oppure solo scheda testuale (muscolo profondo) */
  onMap: boolean;
  view: ('front' | 'back')[];
  position: string;
  action: string;
  /** gruppo del diario a cui sono attribuite le serie (null = il diario non lo traccia separatamente) */
  group: Muscle | null;
  /** quando ha senso dargli priorità, in termini generali */
  focus: string;
  note?: string;
}

export const ANATOMY_SOURCES = [
  { title: 'OpenStax, Anatomy and Physiology 2e — 11.5 Muscoli del cingolo scapolare e degli arti superiori', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs' },
  { title: 'OpenStax, Anatomy and Physiology 2e — 11.6 Muscoli del cingolo pelvico e degli arti inferiori', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs' }
];

export const ATLAS_IMAGE_CREDIT = {
  text: 'Illustrazione: "Muscles front and back" di OpenStax & Tomáš Kebert & umimeto.org, Wikimedia Commons, CC BY-SA 4.0. Adattata (strutture etichettate e rese selezionabili), stessa licenza.',
  url: 'https://commons.wikimedia.org/wiki/File:Muscles_front_and_back.svg',
  license: 'https://creativecommons.org/licenses/by-sa/4.0/'
};

export const ANATOMY: AnatomyStructure[] = [
  { id: 'deltoide', name: 'Deltoide', latin: 'm. deltoideus', region: 'spalla', onMap: true, view: ['front', 'back'],
    position: 'Riveste la spalla come un cappuccio, dalla clavicola e dalla scapola fino a metà dell\'omero. Ha tre porzioni: anteriore, laterale e posteriore.',
    action: 'Insieme sollevano il braccio di lato (abduzione). La porzione anteriore porta il braccio in avanti e lo ruota verso l\'interno; la posteriore lo porta indietro, anche quando è sollevato lateralmente, e lo ruota verso l\'esterno.',
    group: null, focus: 'Le tre porzioni lavorano in movimenti diversi: le spinte sopra la testa e in avanti coinvolgono di più l\'anteriore, le alzate laterali la laterale, le aperture posteriori e le tirate la posteriore.',
    note: 'Nel diario le tre porzioni sono gruppi separati (deltoidi anteriori, laterali, posteriori), attribuiti in base ai muscoli indicati per ogni esercizio, non dedotti dalla mappa.' },
  { id: 'pettorale_clavicolare', name: 'Grande pettorale, capo clavicolare', latin: 'm. pectoralis major, pars clavicularis', region: 'petto', onMap: true, view: ['front'],
    position: 'Parte alta del petto, dalla metà interna della clavicola all\'omero.',
    action: 'Porta il braccio in avanti e verso l\'alto (flessione della spalla) e verso il centro del corpo.',
    group: 'petto', focus: 'Le spinte inclinate lo coinvolgono di più rispetto a quelle piane; utile se la parte alta del petto è una tua priorità.',
    note: 'Il diario conta le serie per "petto": non le attribuisce automaticamente al singolo capo.' },
  { id: 'pettorale_sternocostale', name: 'Grande pettorale, capo sternocostale', latin: 'm. pectoralis major, pars sternocostalis', region: 'petto', onMap: true, view: ['front'],
    position: 'La parte più ampia del petto, dallo sterno e dalle cartilagini delle costole all\'omero.',
    action: 'Avvicina il braccio al corpo (adduzione), lo porta indietro da una posizione sollevata in avanti e lo ruota verso l\'interno.',
    group: 'petto', focus: 'Spinte orizzontali (panca, chest press, piegamenti) e aperture lo allenano direttamente.',
    note: 'Il diario conta le serie per "petto": non le attribuisce automaticamente al singolo capo.' },
  { id: 'piccolo_pettorale', name: 'Piccolo pettorale', latin: 'm. pectoralis minor', region: 'petto', onMap: false, view: ['front'],
    position: 'Sotto il grande pettorale, dalle costole alla scapola: non è visibile in superficie.',
    action: 'Porta la scapola in avanti e in basso e la stabilizza contro il torace.',
    group: null, focus: 'Non ha esercizi dedicati nel catalogo: lavora con le spinte e nei movimenti della scapola.' },
  { id: 'cuffia', name: 'Cuffia dei rotatori', latin: 'mm. supraspinatus, infraspinatus, teres minor, subscapularis', region: 'spalla', onMap: false, view: ['back'],
    position: 'Quattro muscoli profondi che avvolgono la testa dell\'omero: sovraspinato, infraspinato, piccolo rotondo, sottoscapolare.',
    action: 'Stabilizzano la spalla durante tutti i movimenti; infraspinato e piccolo rotondo ruotano il braccio verso l\'esterno, il sottoscapolare verso l\'interno.',
    group: 'cuffia_rotatori', focus: 'Esercizi accessori come l\'extrarotazione al cavo. L\'atlante non dà indicazioni per il dolore: per un dolore alla spalla serve una valutazione qualificata.' },
  { id: 'retto_femorale', name: 'Retto femorale', latin: 'm. rectus femoris', region: 'coscia', onMap: true, view: ['front'],
    position: 'Al centro della parte anteriore della coscia, dal bacino alla rotula. È l\'unico capo del quadricipite che attraversa anche l\'anca.',
    action: 'Estende il ginocchio e contribuisce a flettere l\'anca.',
    group: 'quadricipiti', focus: 'Lavora negli accosciamenti e nella pressa; la leg extension lo allena con l\'anca ferma.',
    note: 'Il diario conta le serie per "quadricipiti", non per singolo capo.' },
  { id: 'vasti', name: 'Vasto mediale e vasto laterale', latin: 'mm. vastus medialis et lateralis', region: 'coscia', onMap: true, view: ['front'],
    position: 'Ai lati del retto femorale: il mediale sul lato interno sopra il ginocchio, il laterale sul lato esterno della coscia.',
    action: 'Estendono il ginocchio.',
    group: 'quadricipiti', focus: 'Accosciamenti, hack squat, pressa, affondi e leg extension. Multiarticolari (più muscoli insieme, carichi alti) e isolamento (leg extension, solo il ginocchio) sono complementari.',
    note: 'Il diario non stima quanto lavoro fa il singolo vasto.' },
  { id: 'vasto_laterale', name: 'Vasto laterale', latin: 'm. vastus lateralis', region: 'coscia', onMap: true, view: ['front'],
    position: 'Il capo più esterno del quadricipite, sul lato della coscia.',
    action: 'Estende il ginocchio.', group: 'quadricipiti', focus: 'Come per gli altri vasti: accosciamenti, pressa, leg extension.' },
  { id: 'vasto_intermedio', name: 'Vasto intermedio', latin: 'm. vastus intermedius', region: 'coscia', onMap: false, view: ['front'],
    position: 'Sotto il retto femorale, a contatto con il femore: non visibile in superficie.',
    action: 'Estende il ginocchio.', group: 'quadricipiti', focus: 'Lavora con gli altri capi del quadricipite in tutti gli esercizi che estendono il ginocchio.' },
  { id: 'sartorio', name: 'Sartorio', latin: 'm. sartorius', region: 'coscia', onMap: true, view: ['front'],
    position: 'Il muscolo più lungo del corpo: attraversa la coscia in diagonale, dal bacino al lato interno del ginocchio.',
    action: 'Flette l\'anca e il ginocchio e ruota la coscia verso l\'esterno (la posizione "a gambe incrociate").',
    group: null, focus: 'Non è un obiettivo tipico dell\'allenamento con i pesi e il diario non lo traccia separatamente.' },
  { id: 'adduttori', name: 'Adduttori', latin: 'mm. adductores, pectineus, gracilis', region: 'coscia', onMap: true, view: ['front'],
    position: 'Lato interno della coscia: adduttore lungo, breve e grande, pettineo e gracile.',
    action: 'Avvicinano la coscia alla linea centrale del corpo; l\'adduttore grande contribuisce anche a estendere l\'anca.',
    group: 'adduttori', focus: 'Macchina per adduttori; lavorano anche negli accosciamenti profondi e negli affondi.' }
];

/** Gruppi del diario ancora senza zona nell'anteprima: elencati, mai inventati. */
export const ATLAS_PENDING: Muscle[] = ['dorsali', 'schiena_alta', 'bicipiti', 'tricipiti', 'avambracci', 'femorali', 'glutei', 'polpacci', 'addome', 'lombari', 'abduttori'];
