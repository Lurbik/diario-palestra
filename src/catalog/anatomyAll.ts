// Schede italiane per tutte le strutture del modello 3D oltre a spalla e petto.
// Fonte di anatomia funzionale per ogni voce (OpenStax A&P 2e, capitoli 11.3–11.6). Classificazione dell'allenabilità:
//   focus     = esiste almeno un esercizio comune in cui la struttura è tra i principali motori (relazione documentabile);
//   coinvolto = lavora dentro movimenti più ampi, senza un focus distinguibile da proporre;
//   nessuno   = stabilizzatore piccolo/profondo o muscolo della mano/del piede: nessun focus sensato nell'app.
// Un modello con 218 regioni NON equivale a 218 bersagli indipendenti.
import type { Muscle } from '../db/types';

export type Focus = 'focus' | 'coinvolto' | 'nessuno';
export type Src = 'OpenStax A&P 2e, 11.3' | 'OpenStax A&P 2e, 11.4' | 'OpenStax A&P 2e, 11.5' | 'OpenStax A&P 2e, 11.6';
export interface StructureInfo { key: string; it: string; latin: string; region: string; action: string; group: Muscle | null; focus: Focus; source: Src; synonyms?: string[]; deep?: boolean }

const S3: Src = 'OpenStax A&P 2e, 11.3', S4: Src = 'OpenStax A&P 2e, 11.4', S5: Src = 'OpenStax A&P 2e, 11.5', S6: Src = 'OpenStax A&P 2e, 11.6';
const E = (key: string, it: string, latin: string, region: string, group: Muscle | null, focus: Focus, source: Src, action: string, synonyms: string[] = [], deep = false): StructureInfo => ({ key, it, latin, region, group, focus, source, action, synonyms, deep });

export const STRUCTURES_MORE: StructureInfo[] = [
  // ---- Schiena (prima consegna)
  E('latissimus_dorsi', 'Gran dorsale', 'm. latissimus dorsi', 'schiena', 'dorsali', 'focus', S5, 'Porta il braccio in basso e indietro (estensione e adduzione) e lo ruota verso l\'interno: è il motore principale delle tirate verticali.', ['dorsale', 'lat', 'lats']),
  E('teres_major', 'Grande rotondo', 'm. teres major', 'schiena', 'dorsali', 'coinvolto', S5, 'Aiuta il gran dorsale a portare il braccio in basso e indietro e a ruotarlo verso l\'interno.', ['teres major']),
  E('trapezius_upper', 'Trapezio, parte superiore', 'm. trapezius, pars descendens', 'schiena', 'schiena_alta', 'focus', S5, 'Solleva la scapola (scrollata) e contribuisce a ruotarla verso l\'alto quando il braccio sale sopra la testa.', ['trapezio alto', 'trapezio superiore']),
  E('trapezius_middle', 'Trapezio, parte media', 'm. trapezius, pars transversa', 'schiena', 'schiena_alta', 'focus', S5, 'Avvicina le scapole alla colonna (retrazione).', ['trapezio medio']),
  E('trapezius_lower', 'Trapezio, parte inferiore', 'm. trapezius, pars ascendens', 'schiena', 'schiena_alta', 'focus', S5, 'Abbassa la scapola e la ruota verso l\'alto insieme alla parte superiore.', ['trapezio basso', 'trapezio inferiore']),
  E('rhomboid_major', 'Romboide maggiore', 'm. rhomboideus major', 'schiena', 'schiena_alta', 'coinvolto', S5, 'Avvicina la scapola alla colonna e la ruota verso il basso; è sotto il trapezio.', ['romboidi', 'rhomboid'], true),
  E('rhomboid_minor', 'Romboide minore', 'm. rhomboideus minor', 'schiena', 'schiena_alta', 'coinvolto', S5, 'Come il romboide maggiore: retrazione e rotazione verso il basso della scapola.', ['romboidi', 'rhomboid'], true),
  E('levator_scapulae', 'Elevatore della scapola', 'm. levator scapulae', 'schiena', null, 'coinvolto', S5, 'Solleva la scapola e inclina il collo dallo stesso lato.', ['elevatore della scapola']),
  E('serratus_posterior_superior', 'Dentato posteriore superiore', 'm. serratus posterior superior', 'schiena', null, 'nessuno', S4, 'Muscolo sottile della parete toracica posteriore, coinvolto nella respirazione.'),
  E('serratus_posterior_inferior', 'Dentato posteriore inferiore', 'm. serratus posterior inferior', 'schiena', null, 'nessuno', S4, 'Muscolo sottile della parete toracica posteriore, coinvolto nella respirazione.'),
  E('iliocostalis_lumborum', 'Ileocostale dei lombi', 'm. iliocostalis lumborum', 'schiena', 'lombari', 'coinvolto', S3, 'Parte degli erettori della colonna: estende e stabilizza la colonna lombare.', ['erettori', 'erettori spinali'], true),
  E('iliocostalis_thoracis', 'Ileocostale del torace', 'm. iliocostalis thoracis', 'schiena', 'lombari', 'coinvolto', S3, 'Parte degli erettori: estende la colonna toracica e ne controlla la flessione.', ['erettori'], true),
  E('longissimus_thoracis', 'Lunghissimo del torace', 'm. longissimus thoracis', 'schiena', 'lombari', 'coinvolto', S3, 'Il più lungo degli erettori: estende la colonna e la mantiene in posizione nei piegamenti del busto.', ['erettori'], true),
  E('spinalis_thoracis', 'Spinale del torace', 'm. spinalis thoracis', 'schiena', 'lombari', 'coinvolto', S3, 'Erettore vicino alle vertebre: estende la colonna toracica.', ['erettori'], true),
  E('multifidus_lumborum', 'Multifido (zona lombare)', 'm. multifidus', 'schiena', 'lombari', 'nessuno', S3, 'Piccoli fasci profondi che stabilizzano segmento per segmento la colonna.', [], true),
  E('quadratus_lumborum', 'Quadrato dei lombi', 'm. quadratus lumborum', 'schiena', 'lombari', 'coinvolto', S4, 'Inclina il busto di lato e stabilizza bacino e colonna lombare.', [], true),
  E('serratus_anterior', 'Dentato anteriore', 'm. serratus anterior', 'petto', null, 'coinvolto', S5, 'Porta la scapola in avanti contro il torace e la ruota verso l\'alto quando il braccio sale.', ['serrato']),
  // ---- Collo
  E('sternocleidomastoid', 'Sternocleidomastoideo', 'm. sternocleidomastoideus', 'collo', null, 'nessuno', S3, 'Flette il collo e ruota la testa dal lato opposto.'),
  E('scalenus_anterior', 'Scaleno anteriore', 'm. scalenus anterior', 'collo', null, 'nessuno', S3, 'Inclina il collo e solleva la prima costola nella respirazione.'),
  E('scalenus_medius', 'Scaleno medio', 'm. scalenus medius', 'collo', null, 'nessuno', S3, 'Inclina il collo e solleva la prima costola.'),
  E('scalenus_posterior', 'Scaleno posteriore', 'm. scalenus posterior', 'collo', null, 'nessuno', S3, 'Inclina il collo e solleva la seconda costola.'),
  E('splenius_capitis', 'Splenio della testa', 'm. splenius capitis', 'collo', null, 'nessuno', S3, 'Estende e ruota la testa.'),
  E('splenius_colli', 'Splenio del collo', 'm. splenius cervicis', 'collo', null, 'nessuno', S3, 'Estende e ruota il collo.'),
  // ---- Tronco
  E('rectus_abdominis', 'Retto dell\'addome', 'm. rectus abdominis', 'tronco', 'addome', 'focus', S4, 'Flette il busto avvicinando costole e bacino.', ['addominali', 'abs', 'retto addominale']),
  E('external_oblique', 'Obliquo esterno', 'm. obliquus externus abdominis', 'tronco', 'addome', 'focus', S4, 'Ruota e inclina il busto e comprime l\'addome; resiste alle rotazioni.', ['obliqui']),
  E('internal_oblique', 'Obliquo interno', 'm. obliquus internus abdominis', 'tronco', 'addome', 'coinvolto', S4, 'Lavora con l\'obliquo esterno nella rotazione e nell\'inclinazione del busto.', ['obliqui'], true),
  E('transversus_abdominis', 'Trasverso dell\'addome', 'm. transversus abdominis', 'tronco', 'addome', 'nessuno', S4, 'Comprime l\'addome e contribuisce alla stabilità del tronco.', [], true),
  // ---- Braccio
  E('biceps_brachii_long', 'Bicipite, capo lungo', 'm. biceps brachii, caput longum', 'braccio', 'bicipiti', 'focus', S5, 'Flette il gomito e ruota l\'avambraccio con il palmo in su; attraversa anche la spalla.', ['bicipite']),
  E('biceps_brachii_short', 'Bicipite, capo breve', 'm. biceps brachii, caput breve', 'braccio', 'bicipiti', 'focus', S5, 'Flette il gomito e ruota l\'avambraccio con il palmo in su.', ['bicipite']),
  E('brachialis', 'Brachiale', 'm. brachialis', 'braccio', 'bicipiti', 'focus', S5, 'Flette il gomito in qualunque posizione dell\'avambraccio; è sotto il bicipite.', ['brachiale anteriore']),
  E('coracobrachialis', 'Coracobrachiale', 'm. coracobrachialis', 'braccio', null, 'coinvolto', S5, 'Porta il braccio in avanti e verso il corpo.'),
  E('triceps_long', 'Tricipite, capo lungo', 'm. triceps brachii, caput longum', 'braccio', 'tricipiti', 'focus', S5, 'Estende il gomito; attraversa la spalla e aiuta a portare il braccio indietro.', ['tricipite']),
  E('triceps_lateral', 'Tricipite, capo laterale', 'm. triceps brachii, caput laterale', 'braccio', 'tricipiti', 'focus', S5, 'Estende il gomito.', ['tricipite']),
  E('triceps_medial', 'Tricipite, capo mediale', 'm. triceps brachii, caput mediale', 'braccio', 'tricipiti', 'coinvolto', S5, 'Estende il gomito; è in profondità.', ['tricipite'], true),
  // ---- Avambraccio
  E('brachioradialis_muscle', 'Brachioradiale', 'm. brachioradialis', 'avambraccio', 'avambracci', 'focus', S5, 'Flette il gomito, soprattutto con il pollice in alto (presa neutra).', ['brachioradiale']),
  E('flexor_carpi_radialis', 'Flessore radiale del carpo', 'm. flexor carpi radialis', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Flette il polso e lo inclina dal lato del pollice.', ['flessori del polso']),
  E('palmaris_longus_muscle', 'Palmare lungo', 'm. palmaris longus', 'avambraccio', null, 'nessuno', S5, 'Debole flessore del polso; manca in parte delle persone.'),
  E('humeral_head_of_flexor_carpi_ulnaris', 'Flessore ulnare del carpo, capo omerale', 'm. flexor carpi ulnaris', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Flette il polso e lo inclina dal lato del mignolo.', ['flessori del polso']),
  E('ulnar_head_of_flexor_carpi_ulnaris', 'Flessore ulnare del carpo, capo ulnare', 'm. flexor carpi ulnaris', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Flette il polso e lo inclina dal lato del mignolo.', ['flessori del polso']),
  E('humero_ulnar_head_of_flexor_digitorum_superficialis', 'Flessore superficiale delle dita, capo omero-ulnare', 'm. flexor digitorum superficialis', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Flette le dita e il polso: lavora in ogni presa salda.', ['flessori delle dita', 'presa']),
  E('radial_head_of_flexor_digitorum_superficialis', 'Flessore superficiale delle dita, capo radiale', 'm. flexor digitorum superficialis', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Flette le dita e il polso.', ['flessori delle dita', 'presa']),
  E('flexor_digitorum_profundus', 'Flessore profondo delle dita', 'm. flexor digitorum profundus', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Flette le ultime falangi: chiude la presa.', ['presa'], true),
  E('flexor_pollicis_longus', 'Flessore lungo del pollice', 'm. flexor pollicis longus', 'avambraccio', null, 'nessuno', S5, 'Flette il pollice.', [], true),
  E('pronator_quadratus', 'Pronatore quadrato', 'm. pronator quadratus', 'avambraccio', null, 'nessuno', S5, 'Ruota l\'avambraccio con il palmo in giù.', [], true),
  E('superficial_head_of_pronator_teres', 'Pronatore rotondo, capo superficiale', 'm. pronator teres', 'avambraccio', null, 'nessuno', S5, 'Ruota l\'avambraccio con il palmo in giù e aiuta a flettere il gomito.'),
  E('deep_head_of_pronator_teres', 'Pronatore rotondo, capo profondo', 'm. pronator teres', 'avambraccio', null, 'nessuno', S5, 'Ruota l\'avambraccio con il palmo in giù.', [], true),
  E('supinator', 'Supinatore', 'm. supinator', 'avambraccio', null, 'nessuno', S5, 'Ruota l\'avambraccio con il palmo in su.', [], true),
  E('extensor_digitorum', 'Estensore delle dita', 'm. extensor digitorum', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Estende le dita e il polso.', ['estensori']),
  E('ulnar_head_of_extensor_carpi_ulnaris', 'Estensore ulnare del carpo, capo ulnare', 'm. extensor carpi ulnaris', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Estende il polso e lo inclina dal lato del mignolo.', ['estensori del polso']),
  E('humeral_head_of_extensor_carpi_ulnaris', 'Estensore ulnare del carpo, capo omerale', 'm. extensor carpi ulnaris', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Estende il polso e lo inclina dal lato del mignolo.', ['estensori del polso']),
  E('extensor_carpi_radialis_longus', 'Estensore radiale lungo del carpo', 'm. extensor carpi radialis longus', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Estende il polso e lo inclina dal lato del pollice.', ['estensori del polso']),
  E('extensor_carpi_radialis_brevis', 'Estensore radiale breve del carpo', 'm. extensor carpi radialis brevis', 'avambraccio', 'avambracci', 'coinvolto', S5, 'Estende il polso.', ['estensori del polso']),
  E('anconeus_muscle', 'Anconeo', 'm. anconeus', 'avambraccio', null, 'nessuno', S5, 'Piccolo muscolo che aiuta il tricipite a estendere il gomito.'),
  E('extensor_digiti_minimi', 'Estensore del mignolo', 'm. extensor digiti minimi', 'avambraccio', null, 'nessuno', S5, 'Estende il mignolo.'),
  E('abductor_pollicis_longus', 'Abduttore lungo del pollice', 'm. abductor pollicis longus', 'avambraccio', null, 'nessuno', S5, 'Allontana il pollice dal palmo.'),
  E('extensor_indicis', 'Estensore dell\'indice', 'm. extensor indicis', 'avambraccio', null, 'nessuno', S5, 'Estende l\'indice.', [], true),
  E('extensor_pollicis_brevis', 'Estensore breve del pollice', 'm. extensor pollicis brevis', 'avambraccio', null, 'nessuno', S5, 'Estende il pollice.'),
  E('extensor_pollicis_longus', 'Estensore lungo del pollice', 'm. extensor pollicis longus', 'avambraccio', null, 'nessuno', S5, 'Estende il pollice.'),
  // ---- Anca e glutei
  E('gluteus_maximus', 'Grande gluteo', 'm. gluteus maximus', 'anca', 'glutei', 'focus', S6, 'Estende l\'anca (porta la coscia indietro) e la ruota verso l\'esterno.', ['gluteo', 'glutei']),
  E('gluteus_medius', 'Medio gluteo', 'm. gluteus medius', 'anca', 'abduttori', 'focus', S6, 'Allontana la coscia dal corpo (abduzione) e stabilizza il bacino in appoggio su una gamba.', ['gluteo medio']),
  E('gluteus_minimus', 'Piccolo gluteo', 'm. gluteus minimus', 'anca', 'abduttori', 'coinvolto', S6, 'Collabora con il medio gluteo nell\'abduzione e nella stabilità del bacino.', [], true),
  E('tensor_fasciae_latae', 'Tensore della fascia lata', 'm. tensor fasciae latae', 'anca', 'abduttori', 'coinvolto', S6, 'Flette e abduce l\'anca e tende la fascia sul lato della coscia.'),
  E('iliacus', 'Iliaco', 'm. iliacus', 'anca', null, 'coinvolto', S6, 'Con lo psoas flette l\'anca (porta la coscia in avanti).', ['ileopsoas', 'flessori dell\'anca'], true),
  E('psoas_major', 'Grande psoas', 'm. psoas major', 'anca', null, 'coinvolto', S6, 'Con l\'iliaco flette l\'anca; parte dalle vertebre lombari.', ['ileopsoas', 'psoas'], true),
  E('piriformis', 'Piriforme', 'm. piriformis', 'anca', null, 'nessuno', S6, 'Ruota la coscia verso l\'esterno.', [], true),
  E('quadratus_femoris', 'Quadrato del femore', 'm. quadratus femoris', 'anca', null, 'nessuno', S6, 'Ruota la coscia verso l\'esterno.', [], true),
  E('obturator_internus', 'Otturatore interno', 'm. obturator internus', 'anca', null, 'nessuno', S6, 'Ruota la coscia verso l\'esterno.', [], true),
  E('obturator_externus', 'Otturatore esterno', 'm. obturator externus', 'anca', null, 'nessuno', S6, 'Ruota la coscia verso l\'esterno.', [], true),
  E('gemellus_superior', 'Gemello superiore', 'm. gemellus superior', 'anca', null, 'nessuno', S6, 'Ruota la coscia verso l\'esterno.', [], true),
  E('gemellus_inferior', 'Gemello inferiore', 'm. gemellus inferior', 'anca', null, 'nessuno', S6, 'Ruota la coscia verso l\'esterno.', [], true),
  // ---- Coscia
  E('rectus_femoris', 'Retto femorale', 'm. rectus femoris', 'coscia', 'quadricipiti', 'focus', S6, 'Estende il ginocchio e flette l\'anca: è l\'unico capo del quadricipite che attraversa l\'anca.', ['quadricipite']),
  E('vastus_lateralis', 'Vasto laterale', 'm. vastus lateralis', 'coscia', 'quadricipiti', 'focus', S6, 'Estende il ginocchio; è il capo più esterno del quadricipite.', ['quadricipite']),
  E('vastus_medialis', 'Vasto mediale', 'm. vastus medialis', 'coscia', 'quadricipiti', 'focus', S6, 'Estende il ginocchio; è il capo interno sopra la rotula.', ['quadricipite']),
  E('vastus_intermedius', 'Vasto intermedio', 'm. vastus intermedius', 'coscia', 'quadricipiti', 'coinvolto', S6, 'Estende il ginocchio; è sotto il retto femorale.', ['quadricipite'], true),
  E('biceps_femoris_long', 'Bicipite femorale, capo lungo', 'm. biceps femoris, caput longum', 'coscia', 'femorali', 'focus', S6, 'Flette il ginocchio ed estende l\'anca.', ['femorali', 'ischiocrurali', 'hamstring']),
  E('biceps_femoris_short', 'Bicipite femorale, capo breve', 'm. biceps femoris, caput breve', 'coscia', 'femorali', 'focus', S6, 'Flette il ginocchio (non attraversa l\'anca).', ['femorali'], true),
  E('semitendinosus', 'Semitendinoso', 'm. semitendinosus', 'coscia', 'femorali', 'focus', S6, 'Flette il ginocchio ed estende l\'anca.', ['femorali', 'ischiocrurali']),
  E('semimembranosus', 'Semimembranoso', 'm. semimembranosus', 'coscia', 'femorali', 'focus', S6, 'Flette il ginocchio ed estende l\'anca.', ['femorali', 'ischiocrurali'], true),
  E('sartorius', 'Sartorio', 'm. sartorius', 'coscia', null, 'nessuno', S6, 'Flette anca e ginocchio e ruota la coscia verso l\'esterno.'),
  E('adductor_magnus', 'Grande adduttore', 'm. adductor magnus', 'coscia', 'adduttori', 'focus', S6, 'Avvicina la coscia al corpo e contribuisce a estendere l\'anca.', ['adduttori'], true),
  E('adductor_longus', 'Adduttore lungo', 'm. adductor longus', 'coscia', 'adduttori', 'focus', S6, 'Avvicina la coscia al corpo.', ['adduttori']),
  E('adductor_brevis', 'Adduttore breve', 'm. adductor brevis', 'coscia', 'adduttori', 'coinvolto', S6, 'Avvicina la coscia al corpo.', ['adduttori'], true),
  E('gracilis', 'Gracile', 'm. gracilis', 'coscia', 'adduttori', 'coinvolto', S6, 'Avvicina la coscia e flette il ginocchio.', ['adduttori']),
  E('pectineus', 'Pettineo', 'm. pectineus', 'coscia', 'adduttori', 'coinvolto', S6, 'Avvicina e flette la coscia.', ['adduttori'], true),
  // ---- Gamba e polpaccio
  E('gastrocnemius_medial', 'Gastrocnemio, capo mediale', 'm. gastrocnemius, caput mediale', 'gamba', 'polpacci', 'focus', S6, 'Porta in punta di piedi (flessione plantare) e aiuta a flettere il ginocchio: lavora di più a ginocchio teso.', ['polpaccio', 'gemelli']),
  E('gastrocnemius_lateral', 'Gastrocnemio, capo laterale', 'm. gastrocnemius, caput laterale', 'gamba', 'polpacci', 'focus', S6, 'Porta in punta di piedi e aiuta a flettere il ginocchio: lavora di più a ginocchio teso.', ['polpaccio', 'gemelli']),
  E('soleus', 'Soleo', 'm. soleus', 'gamba', 'polpacci', 'focus', S6, 'Porta in punta di piedi; non attraversa il ginocchio, per questo lavora anche a ginocchio piegato (calf da seduto).', ['polpaccio']),
  E('plantaris', 'Plantare', 'm. plantaris', 'gamba', null, 'nessuno', S6, 'Piccolo muscolo che affianca il gastrocnemio; può mancare.', [], true),
  E('tibialis_anterior', 'Tibiale anteriore', 'm. tibialis anterior', 'gamba', null, 'coinvolto', S6, 'Solleva la punta del piede (flessione dorsale).', ['tibiale']),
  E('tibialis_posterior', 'Tibiale posteriore', 'm. tibialis posterior', 'gamba', null, 'nessuno', S6, 'Sostiene l\'arco del piede e lo ruota verso l\'interno.', [], true),
  E('fibularis_longus', 'Peroneo lungo', 'm. fibularis longus', 'gamba', null, 'nessuno', S6, 'Ruota il piede verso l\'esterno e aiuta la spinta in punta.', ['peroniero lungo']),
  E('fibularis_brevis', 'Peroneo breve', 'm. fibularis brevis', 'gamba', null, 'nessuno', S6, 'Ruota il piede verso l\'esterno.', ['peroniero breve']),
  E('fibularis_tertius', 'Peroneo terzo', 'm. fibularis tertius', 'gamba', null, 'nessuno', S6, 'Solleva e ruota verso l\'esterno il piede.', []),
  E('extensor_digitorum_longus', 'Estensore lungo delle dita del piede', 'm. extensor digitorum longus', 'gamba', null, 'nessuno', S6, 'Solleva le dita e la punta del piede.'),
  E('extensor_hallucis_longus', 'Estensore lungo dell\'alluce', 'm. extensor hallucis longus', 'gamba', null, 'nessuno', S6, 'Solleva l\'alluce.'),
  E('flexor_digitorum_longus', 'Flessore lungo delle dita del piede', 'm. flexor digitorum longus', 'gamba', null, 'nessuno', S6, 'Flette le dita del piede.', [], true),
  E('flexor_hallucis_longus', 'Flessore lungo dell\'alluce', 'm. flexor hallucis longus', 'gamba', null, 'nessuno', S6, 'Flette l\'alluce e aiuta la spinta del piede.', [], true),
  E('popliteus', 'Popliteo', 'm. popliteus', 'gamba', null, 'nessuno', S6, 'Sblocca il ginocchio iniziando la flessione.', [], true)
];
