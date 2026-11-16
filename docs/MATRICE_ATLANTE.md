# Matrice dell'atlante

Generata dai dati (`src/catalog/anatomy3d.ts`, `anatomyAll.ts`, `exercises.ts`) dal test `tests/atlasMatrix.test.ts`: non modificarla a mano.

Strutture con scheda italiana: 109 · focus 32 · solo coinvolte 36 · nessun focus distinguibile 41.
Esercizi del catalogo: 93; relazioni struttura–esercizio: 352.

La colonna "mesh" è la chiave della regione nel modello 3D (lato sinistro e destro). I ruoli sono descrittivi, non percentuali di attivazione.

| Regione | Struttura | Mesh | Focus | Esercizi con focus | Anche coinvolto | Fonte |
|---|---|---|---|---|---|---|
| anca | Gemello inferiore (*m. gemellus inferior*) | `gemellus_inferior` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| anca | Gemello superiore (*m. gemellus superior*) | `gemellus_superior` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| anca | Grande gluteo (*m. gluteus maximus*) | `gluteus_maximus` | focus | Hyperextension (back extension 45°), Stacco rumeno con bilanciere, Stacco rumeno con manubri, Split squat bulgaro, Affondi camminati con manubri, Split squat statico con manubri, Step-up con manubri, Hip thrust, Ponte glutei a corpo libero, Kickback glutei al cavo | Squat con bilanciere, Hack squat alla macchina, Leg press (pressa), Pendulum squat, Goblet squat, Belt squat | OpenStax A&P 2e, 11.6 |
| anca | Grande psoas (*m. psoas major*) | `psoas_major` | solo coinvolto | — | — | OpenStax A&P 2e, 11.6 |
| anca | Iliaco (*m. iliacus*) | `iliacus` | solo coinvolto | — | — | OpenStax A&P 2e, 11.6 |
| anca | Medio gluteo (*m. gluteus medius*) | `gluteus_medius` | focus | Abductor machine | Split squat bulgaro, Affondi camminati con manubri, Split squat statico con manubri, Step-up con manubri, Plank laterale | OpenStax A&P 2e, 11.6 |
| anca | Otturatore esterno (*m. obturator externus*) | `obturator_externus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| anca | Otturatore interno (*m. obturator internus*) | `obturator_internus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| anca | Piccolo gluteo (*m. gluteus minimus*) | `gluteus_minimus` | solo coinvolto | — | Abductor machine | OpenStax A&P 2e, 11.6 |
| anca | Piriforme (*m. piriformis*) | `piriformis` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| anca | Quadrato del femore (*m. quadratus femoris*) | `quadratus_femoris` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| anca | Tensore della fascia lata (*m. tensor fasciae latae*) | `tensor_fasciae_latae` | solo coinvolto | — | Abductor machine | OpenStax A&P 2e, 11.6 |
| avambraccio | Abduttore lungo del pollice (*m. abductor pollicis longus*) | `abductor_pollicis_longus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Anconeo (*m. anconeus*) | `anconeus_muscle` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Brachioradiale (*m. brachioradialis*) | `brachioradialis_muscle` | focus | Curl a martello, Curl inverso con bilanciere EZ | Curl con bilanciere EZ, Curl con manubri, Curl alla panca Scott, Curl al cavo da dietro (bayesian), Curl alternato su panca inclinata | OpenStax A&P 2e, 11.5 |
| avambraccio | Estensore breve del pollice (*m. extensor pollicis brevis*) | `extensor_pollicis_brevis` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Estensore del mignolo (*m. extensor digiti minimi*) | `extensor_digiti_minimi` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Estensore dell'indice (*m. extensor indicis*) | `extensor_indicis` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Estensore delle dita (*m. extensor digitorum*) | `extensor_digitorum` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Estensore lungo del pollice (*m. extensor pollicis longus*) | `extensor_pollicis_longus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Estensore radiale breve del carpo (*m. extensor carpi radialis brevis*) | `extensor_carpi_radialis_brevis` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Estensore radiale lungo del carpo (*m. extensor carpi radialis longus*) | `extensor_carpi_radialis_longus` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Estensore ulnare del carpo, capo omerale (*m. extensor carpi ulnaris*) | `humeral_head_of_extensor_carpi_ulnaris` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Estensore ulnare del carpo, capo ulnare (*m. extensor carpi ulnaris*) | `ulnar_head_of_extensor_carpi_ulnaris` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Flessore lungo del pollice (*m. flexor pollicis longus*) | `flexor_pollicis_longus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Flessore profondo delle dita (*m. flexor digitorum profundus*) | `flexor_digitorum_profundus` | solo coinvolto | Camminata con manubri (farmer walk) | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Flessore radiale del carpo (*m. flexor carpi radialis*) | `flexor_carpi_radialis` | solo coinvolto | Curl di polso con manubri | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Flessore superficiale delle dita, capo omero-ulnare (*m. flexor digitorum superficialis*) | `humero_ulnar_head_of_flexor_digitorum_superficialis` | solo coinvolto | Camminata con manubri (farmer walk) | Curl di polso con manubri | OpenStax A&P 2e, 11.5 |
| avambraccio | Flessore superficiale delle dita, capo radiale (*m. flexor digitorum superficialis*) | `radial_head_of_flexor_digitorum_superficialis` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Flessore ulnare del carpo, capo omerale (*m. flexor carpi ulnaris*) | `humeral_head_of_flexor_carpi_ulnaris` | solo coinvolto | Curl di polso con manubri | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Flessore ulnare del carpo, capo ulnare (*m. flexor carpi ulnaris*) | `ulnar_head_of_flexor_carpi_ulnaris` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Palmare lungo (*m. palmaris longus*) | `palmaris_longus_muscle` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Pronatore quadrato (*m. pronator quadratus*) | `pronator_quadratus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Pronatore rotondo, capo profondo (*m. pronator teres*) | `deep_head_of_pronator_teres` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Pronatore rotondo, capo superficiale (*m. pronator teres*) | `superficial_head_of_pronator_teres` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| avambraccio | Supinatore (*m. supinator*) | `supinator` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| braccio | Bicipite, capo breve (*m. biceps brachii, caput breve*) | `biceps_brachii_short` | focus | Curl con bilanciere EZ, Curl con manubri, Curl alla panca Scott, Curl al cavo da dietro (bayesian), Curl alternato su panca inclinata | — | OpenStax A&P 2e, 11.5 |
| braccio | Bicipite, capo lungo (*m. biceps brachii, caput longum*) | `biceps_brachii_long` | focus | Curl con bilanciere EZ, Curl con manubri, Curl alla panca Scott, Curl al cavo da dietro (bayesian), Curl alternato su panca inclinata | Lat machine presa larga, Lat machine presa stretta neutra, Trazioni alla sbarra, Trazioni assistite alla macchina, Pulldown unilaterale al cavo, Rematore alla macchina e altri 9 | OpenStax A&P 2e, 11.5 |
| braccio | Brachiale (*m. brachialis*) | `brachialis` | focus | Curl a martello, Curl inverso con bilanciere EZ | Lat machine presa larga, Lat machine presa stretta neutra, Trazioni alla sbarra, Trazioni assistite alla macchina, Pulldown unilaterale al cavo, Curl con bilanciere EZ e altri 4 | OpenStax A&P 2e, 11.5 |
| braccio | Coracobrachiale (*m. coracobrachialis*) | `coracobrachialis` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| braccio | Tricipite, capo laterale (*m. triceps brachii, caput laterale*) | `triceps_lateral` | focus | Pushdown al cavo, Triceps machine, Dip su panca, JM press al multipower | Estensione sopra la testa al cavo, French press con bilanciere EZ | OpenStax A&P 2e, 11.5 |
| braccio | Tricipite, capo lungo (*m. triceps brachii, caput longum*) | `triceps_long` | focus | Estensione sopra la testa al cavo, French press con bilanciere EZ | Pullover al cavo, Pullover con manubrio su panca, Pushdown al cavo, Triceps machine, Dip su panca, JM press al multipower | OpenStax A&P 2e, 11.5 |
| braccio | Tricipite, capo mediale (*m. triceps brachii, caput mediale*) | `triceps_medial` | solo coinvolto | Pushdown al cavo, Triceps machine, Dip su panca, JM press al multipower | Estensione sopra la testa al cavo, French press con bilanciere EZ | OpenStax A&P 2e, 11.5 |
| collo | Scaleno anteriore (*m. scalenus anterior*) | `scalenus_anterior` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.3 |
| collo | Scaleno medio (*m. scalenus medius*) | `scalenus_medius` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.3 |
| collo | Scaleno posteriore (*m. scalenus posterior*) | `scalenus_posterior` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.3 |
| collo | Splenio del collo (*m. splenius cervicis*) | `splenius_colli` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.3 |
| collo | Splenio della testa (*m. splenius capitis*) | `splenius_capitis` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.3 |
| collo | Sternocleidomastoideo (*m. sternocleidomastoideus*) | `sternocleidomastoid` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.3 |
| coscia | Adduttore breve (*m. adductor brevis*) | `adductor_brevis` | solo coinvolto | — | Adductor machine | OpenStax A&P 2e, 11.6 |
| coscia | Adduttore lungo (*m. adductor longus*) | `adductor_longus` | focus | Adductor machine | — | OpenStax A&P 2e, 11.6 |
| coscia | Bicipite femorale, capo breve (*m. biceps femoris, caput breve*) | `biceps_femoris_short` | focus | Leg curl seduto, Leg curl sdraiato, Leg curl in piedi unilaterale, Nordic curl (con assistenza) | — | OpenStax A&P 2e, 11.6 |
| coscia | Bicipite femorale, capo lungo (*m. biceps femoris, caput longum*) | `biceps_femoris_long` | focus | Stacco rumeno con bilanciere, Stacco rumeno con manubri, Leg curl seduto, Leg curl sdraiato, Leg curl in piedi unilaterale, Nordic curl (con assistenza) | Hyperextension (back extension 45°), Hip thrust, Ponte glutei a corpo libero, Kickback glutei al cavo | OpenStax A&P 2e, 11.6 |
| coscia | Gracile (*m. gracilis*) | `gracilis` | solo coinvolto | — | Adductor machine | OpenStax A&P 2e, 11.6 |
| coscia | Grande adduttore (*m. adductor magnus*) | `adductor_magnus` | focus | Adductor machine | Stacco rumeno con bilanciere, Stacco rumeno con manubri, Squat con bilanciere, Hack squat alla macchina, Leg press (pressa), Pendulum squat e altri 6 | OpenStax A&P 2e, 11.6 |
| coscia | Pettineo (*m. pectineus*) | `pectineus` | solo coinvolto | — | Adductor machine | OpenStax A&P 2e, 11.6 |
| coscia | Retto femorale (*m. rectus femoris*) | `rectus_femoris` | focus | Leg extension | Squat con bilanciere, Hack squat alla macchina, Leg press (pressa), Pendulum squat, Goblet squat, Belt squat | OpenStax A&P 2e, 11.6 |
| coscia | Sartorio (*m. sartorius*) | `sartorius` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| coscia | Semimembranoso (*m. semimembranosus*) | `semimembranosus` | focus | Stacco rumeno con bilanciere, Stacco rumeno con manubri, Leg curl seduto, Leg curl sdraiato, Leg curl in piedi unilaterale, Nordic curl (con assistenza) | — | OpenStax A&P 2e, 11.6 |
| coscia | Semitendinoso (*m. semitendinosus*) | `semitendinosus` | focus | Stacco rumeno con bilanciere, Stacco rumeno con manubri, Leg curl seduto, Leg curl sdraiato, Leg curl in piedi unilaterale, Nordic curl (con assistenza) | Hip thrust, Ponte glutei a corpo libero, Kickback glutei al cavo | OpenStax A&P 2e, 11.6 |
| coscia | Vasto intermedio (*m. vastus intermedius*) | `vastus_intermedius` | solo coinvolto | Squat con bilanciere, Hack squat alla macchina, Leg press (pressa), Pendulum squat, Goblet squat, Belt squat, Leg extension | — | OpenStax A&P 2e, 11.6 |
| coscia | Vasto laterale (*m. vastus lateralis*) | `vastus_lateralis` | focus | Squat con bilanciere, Hack squat alla macchina, Leg press (pressa), Pendulum squat, Goblet squat, Belt squat, Split squat bulgaro, Affondi camminati con manubri, Split squat statico con manubri, Step-up con manubri, Leg extension | — | OpenStax A&P 2e, 11.6 |
| coscia | Vasto mediale (*m. vastus medialis*) | `vastus_medialis` | focus | Squat con bilanciere, Hack squat alla macchina, Leg press (pressa), Pendulum squat, Goblet squat, Belt squat, Split squat bulgaro, Affondi camminati con manubri, Split squat statico con manubri, Step-up con manubri, Leg extension | — | OpenStax A&P 2e, 11.6 |
| gamba | Estensore lungo dell'alluce (*m. extensor hallucis longus*) | `extensor_hallucis_longus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Estensore lungo delle dita del piede (*m. extensor digitorum longus*) | `extensor_digitorum_longus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Flessore lungo dell'alluce (*m. flexor hallucis longus*) | `flexor_hallucis_longus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Flessore lungo delle dita del piede (*m. flexor digitorum longus*) | `flexor_digitorum_longus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Gastrocnemio, capo laterale (*m. gastrocnemius, caput laterale*) | `gastrocnemius_lateral` | focus | Calf raise in piedi alla macchina, Calf alla pressa, Calf in piedi su una gamba con manubrio | Calf raise seduto | OpenStax A&P 2e, 11.6 |
| gamba | Gastrocnemio, capo mediale (*m. gastrocnemius, caput mediale*) | `gastrocnemius_medial` | focus | Calf raise in piedi alla macchina, Calf alla pressa, Calf in piedi su una gamba con manubrio | Leg curl seduto, Leg curl sdraiato, Leg curl in piedi unilaterale, Nordic curl (con assistenza), Calf raise seduto | OpenStax A&P 2e, 11.6 |
| gamba | Peroneo breve (*m. fibularis brevis*) | `fibularis_brevis` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Peroneo lungo (*m. fibularis longus*) | `fibularis_longus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Peroneo terzo (*m. fibularis tertius*) | `fibularis_tertius` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Plantare (*m. plantaris*) | `plantaris` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Popliteo (*m. popliteus*) | `popliteus` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Soleo (*m. soleus*) | `soleus` | focus | Calf raise seduto | Calf raise in piedi alla macchina, Calf alla pressa, Calf in piedi su una gamba con manubrio | OpenStax A&P 2e, 11.6 |
| gamba | Tibiale anteriore (*m. tibialis anterior*) | `tibialis_anterior` | solo coinvolto | — | — | OpenStax A&P 2e, 11.6 |
| gamba | Tibiale posteriore (*m. tibialis posterior*) | `tibialis_posterior` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.6 |
| petto | Dentato anteriore (*m. serratus anterior*) | `serratus_anterior` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| petto | Grande pettorale, capo clavicolare (*m. pectoralis major, pars clavicularis*) | `pectoralis_major_clavicular` | focus | Panca inclinata con manubri, Chest press inclinata alla macchina, Panca inclinata al multipower | Military press seduto con manubri, Military press al multipower, Shoulder press alla macchina, Landmine press a un braccio, Panca piana con bilanciere, Panca piana con manubri e altri 3 | OpenStax A&P 2e, 11.5 |
| petto | Grande pettorale, capo sternocostale (*m. pectoralis major, pars sternocostalis*) | `pectoralis_major_sternocostal` | focus | Panca piana con bilanciere, Panca piana con manubri, Chest press alla macchina, Piegamenti sulle braccia, Pec deck (croci alla macchina), Panca inclinata con manubri, Chest press inclinata alla macchina, Panca inclinata al multipower | — | OpenStax A&P 2e, 11.5 |
| petto | Grande pettorale, porzione addominale (*m. pectoralis major, pars abdominalis*) | `pectoralis_major_abdominal` | solo coinvolto | — | Dip alle parallele, Dip su panca | OpenStax A&P 2e, 11.5 |
| petto | Piccolo pettorale (*m. pectoralis minor*) | `pectoralis_minor` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| schiena | Dentato posteriore inferiore (*m. serratus posterior inferior*) | `serratus_posterior_inferior` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.4 |
| schiena | Dentato posteriore superiore (*m. serratus posterior superior*) | `serratus_posterior_superior` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.4 |
| schiena | Elevatore della scapola (*m. levator scapulae*) | `levator_scapulae` | solo coinvolto | — | Scrollate con manubri | OpenStax A&P 2e, 11.5 |
| schiena | Gran dorsale (*m. latissimus dorsi*) | `latissimus_dorsi` | focus | Lat machine presa larga, Lat machine presa stretta neutra, Trazioni alla sbarra, Trazioni assistite alla macchina, Pulldown unilaterale al cavo, Pullover al cavo, Pullover con manubrio su panca, Rematore alla macchina, Low row convergente a bracci indipendenti, T-bar con appoggio al petto, Pulley basso, Rematore unilaterale al cavo, Rematore con manubrio unilaterale, Rematore inverso (inverted row), Rematore con manubri, petto in appoggio, Rematore con bilanciere, High row alla macchina | — | OpenStax A&P 2e, 11.5 |
| schiena | Grande rotondo (*m. teres major*) | `teres_major` | solo coinvolto | — | Lat machine presa larga, Lat machine presa stretta neutra, Trazioni alla sbarra, Trazioni assistite alla macchina, Pulldown unilaterale al cavo, Pullover al cavo e altri 2 | OpenStax A&P 2e, 11.5 |
| schiena | Ileocostale dei lombi (*m. iliocostalis lumborum*) | `iliocostalis_lumborum` | solo coinvolto | Hyperextension (back extension 45°) | Rematore con bilanciere, Stacco rumeno con bilanciere, Stacco rumeno con manubri | OpenStax A&P 2e, 11.3 |
| schiena | Ileocostale del torace (*m. iliocostalis thoracis*) | `iliocostalis_thoracis` | solo coinvolto | — | — | OpenStax A&P 2e, 11.3 |
| schiena | Lunghissimo del torace (*m. longissimus thoracis*) | `longissimus_thoracis` | solo coinvolto | Hyperextension (back extension 45°) | Rematore con bilanciere, Stacco rumeno con bilanciere, Stacco rumeno con manubri | OpenStax A&P 2e, 11.3 |
| schiena | Multifido (zona lombare) (*m. multifidus*) | `multifidus_lumborum` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.3 |
| schiena | Quadrato dei lombi (*m. quadratus lumborum*) | `quadratus_lumborum` | solo coinvolto | — | Camminata con manubri (farmer walk), Plank laterale | OpenStax A&P 2e, 11.4 |
| schiena | Romboide maggiore (*m. rhomboideus major*) | `rhomboid_major` | solo coinvolto | Rematore alla macchina, Low row convergente a bracci indipendenti, T-bar con appoggio al petto, Pulley basso, Rematore unilaterale al cavo, Rematore con manubrio unilaterale, Rematore inverso (inverted row), Rematore con manubri, petto in appoggio, Rematore con bilanciere | Lat machine presa larga, Lat machine presa stretta neutra, Trazioni alla sbarra, Trazioni assistite alla macchina, Pulldown unilaterale al cavo, High row alla macchina | OpenStax A&P 2e, 11.5 |
| schiena | Romboide minore (*m. rhomboideus minor*) | `rhomboid_minor` | solo coinvolto | — | — | OpenStax A&P 2e, 11.5 |
| schiena | Spinale del torace (*m. spinalis thoracis*) | `spinalis_thoracis` | solo coinvolto | — | — | OpenStax A&P 2e, 11.3 |
| schiena | Trapezio, parte inferiore (*m. trapezius, pars ascendens*) | `trapezius_lower` | focus | Alzata a Y su panca inclinata | Lat machine presa larga, Lat machine presa stretta neutra, Trazioni alla sbarra, Trazioni assistite alla macchina, Pulldown unilaterale al cavo, High row alla macchina | OpenStax A&P 2e, 11.5 |
| schiena | Trapezio, parte media (*m. trapezius, pars transversa*) | `trapezius_middle` | focus | Rematore alla macchina, Low row convergente a bracci indipendenti, T-bar con appoggio al petto, Pulley basso, Rematore unilaterale al cavo, Rematore con manubrio unilaterale, Rematore inverso (inverted row), Rematore con manubri, petto in appoggio, Rematore con bilanciere | Face pull al cavo, Alzata a Y su panca inclinata | OpenStax A&P 2e, 11.5 |
| schiena | Trapezio, parte superiore (*m. trapezius, pars descendens*) | `trapezius_upper` | focus | Scrollate con manubri | Camminata con manubri (farmer walk) | OpenStax A&P 2e, 11.5 |
| spalla | Deltoide, porzione anteriore (clavicolare) (*m. deltoideus, pars clavicularis*) | `deltoid_anterior` | focus | Military press seduto con manubri, Military press al multipower, Shoulder press alla macchina, Landmine press a un braccio | Panca piana con bilanciere, Panca piana con manubri, Chest press alla macchina, Piegamenti sulle braccia, Pec deck (croci alla macchina), Panca inclinata con manubri e altri 4 | OpenStax A&P 2e, 11.5 |
| spalla | Deltoide, porzione laterale (acromiale) (*m. deltoideus, pars acromialis*) | `deltoid_lateral` | focus | Alzate laterali con manubri, Alzate laterali al cavo, Alzata laterale su panca inclinata, Alzate laterali alla macchina | Military press seduto con manubri, Military press al multipower, Shoulder press alla macchina, Landmine press a un braccio, Alzata a Y su panca inclinata | OpenStax A&P 2e, 11.5 |
| spalla | Deltoide, porzione posteriore (spinale) (*m. deltoideus, pars spinalis*) | `deltoid_posterior` | focus | Reverse pec deck, Alzate posteriori con manubri a busto flesso, Aperture posteriori ai cavi, Face pull al cavo | Extrarotazione al cavo a gomito vicino al fianco, Rematore alla macchina, Low row convergente a bracci indipendenti, T-bar con appoggio al petto, Pulley basso, Rematore unilaterale al cavo e altri 4 | OpenStax A&P 2e, 11.5 |
| spalla | Infraspinato (*m. infraspinatus*) | `infraspinatus` | focus | Extrarotazione al cavo a gomito vicino al fianco | Reverse pec deck, Alzate posteriori con manubri a busto flesso, Aperture posteriori ai cavi, Face pull al cavo | OpenStax A&P 2e, 11.5 |
| spalla | Piccolo rotondo (*m. teres minor*) | `teres_minor` | solo coinvolto | Extrarotazione al cavo a gomito vicino al fianco | Reverse pec deck, Alzate posteriori con manubri a busto flesso, Aperture posteriori ai cavi, Face pull al cavo | OpenStax A&P 2e, 11.5 |
| spalla | Sottoscapolare (*m. subscapularis*) | `subscapularis` | nessun focus distinguibile | — | — | OpenStax A&P 2e, 11.5 |
| spalla | Sovraspinato (*m. supraspinatus*) | `supraspinatus` | solo coinvolto | — | Alzate laterali con manubri, Alzate laterali al cavo, Alzata laterale su panca inclinata, Alzate laterali alla macchina | OpenStax A&P 2e, 11.5 |
| tronco | Obliquo esterno (*m. obliquus externus abdominis*) | `external_oblique` | focus | Plank laterale, Pallof press | Crunch al cavo in ginocchio, Crunch in allungamento su panca declinata, Sollevamento ginocchia alla sbarra, Plank, Dead bug | OpenStax A&P 2e, 11.4 |
| tronco | Obliquo interno (*m. obliquus internus abdominis*) | `internal_oblique` | solo coinvolto | — | Plank laterale, Pallof press | OpenStax A&P 2e, 11.4 |
| tronco | Retto dell'addome (*m. rectus abdominis*) | `rectus_abdominis` | focus | Crunch al cavo in ginocchio, Crunch in allungamento su panca declinata, Sollevamento ginocchia alla sbarra | Plank, Dead bug | OpenStax A&P 2e, 11.4 |
| tronco | Trasverso dell'addome (*m. transversus abdominis*) | `transversus_abdominis` | nessun focus distinguibile | — | Plank, Dead bug, Pallof press | OpenStax A&P 2e, 11.4 |

## Lacune dichiarate

Strutture con focus i cui esercizi di focus usano un solo tipo di attrezzo (servirebbero alternative con attrezzi diversi):

- Medio gluteo: Abductor machine
- Adduttore lungo: Adductor machine
- Grande adduttore: Adductor machine
- Retto femorale: Leg extension
- Soleo: Calf raise seduto
- Trapezio, parte inferiore: Alzata a Y su panca inclinata
- Trapezio, parte superiore: Scrollate con manubri
- Infraspinato: Extrarotazione al cavo a gomito vicino al fianco
