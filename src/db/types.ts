// Modello dati dell'app. Regola generale: `null` significa "dato non noto / non inserito",
// MAI zero. Nessun campo viene inventato quando l'utente non l'ha fornito.

export type ID = string;
export type DateKey = string; // 'YYYY-MM-DD' calcolata in Europe/Rome

export type Muscle =
  | 'petto' | 'dorsali' | 'schiena_alta' | 'deltoidi_anteriori' | 'deltoidi_laterali' | 'deltoidi_posteriori'
  | 'bicipiti' | 'tricipiti' | 'avambracci' | 'quadricipiti' | 'femorali' | 'glutei' | 'adduttori'
  | 'polpacci' | 'addome' | 'lombari' | 'abduttori'
  /** muscoli profondi: nessuna zona superficiale sulla mappa, solo scheda testuale */
  | 'cuffia_rotatori';

/** Provenienza di un record: catalogo pubblico, creato dall'utente, seed di versioni precedenti, importazione privata. */
export type Origin = 'catalog' | 'user' | 'legacy_seed' | 'private_import';
export interface CatalogMeta { origin?: Origin; catalogVersion?: number; userModified?: boolean; archived?: boolean; /** voce di catalogo ritirata: ID della voce che la sostituisce */ replacedBy?: string }

/** Convenzione del carico. Convenzioni diverse non si sommano né si confrontano. */
export type LoadConvention =
  | 'barbell_total'      // totale bilanciere, barra inclusa
  | 'per_dumbbell'       // per singolo manubrio
  | 'machine_stack'      // pacco pesi macchina (valore selezionato)
  | 'plates_per_side'    // dischi per lato (multipower, macchine a carico diretto)
  | 'plates_total'       // dischi totali caricati (es. leg extension a carico diretto)
  | 'cable_stack'        // pacco pesi al cavo (rapporto carrucole spesso ignoto)
  | 'bodyweight_added'   // zavorra aggiunta
  | 'assisted'           // assistenza (più carico = più facile)
  | 'unknown';

export interface Machine extends CatalogMeta {
  id: ID;
  name: string;
  category: string;
  brand: string;
  model: string;
  seat: string;
  backrest: string;
  rollers: string;
  grip: string;
  camLever: string;
  loadPoints: string;
  minLoadKg: number | null;
  increments: number[]; // incrementi disponibili (kg), vuoto = non noti
  /** Multipower: peso effettivo barra. null = sconosciuto, non inventarlo. */
  barWeightKg: number | null;
  /** Cavi: rapporto carrucole. null = sconosciuto. */
  pulleyRatio: string | null;
  maxedOut: boolean; // carico già al massimo (non significa inutile)
  photoId: ID | null; // allegato locale facoltativo
  notes: string;
  toConfirm: string[];
}

export type RomType = 'full' | 'partial_planned';

export type MovementPattern = 'spinta_orizzontale' | 'spinta_verticale' | 'tirata_verticale' | 'tirata_orizzontale' | 'accosciata' | 'estensione_anca' | 'flessione_ginocchio' | 'estensione_ginocchio' | 'polpacci' | 'adduzione' | 'abduzione' | 'bicipiti' | 'tricipiti' | 'alzate_laterali' | 'deltoidi_posteriori' | 'addome' | 'stabilizzazione' | 'altro';
export type EquipmentKind = 'macchina' | 'cavo' | 'manubri' | 'bilanciere' | 'multipower' | 'corpo_libero';

export interface Exercise extends CatalogMeta {
  id: ID;
  name: string;
  aliases: string[];
  variant: string;
  machineId: ID | null;
  equipment: string;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  loadConvention: LoadConvention;
  unilateral: boolean; // ripetizioni registrate PER LATO
  romType: RomType;
  /** Incrementato quando cambia macchina/leva/ROM/convenzione → nuova baseline. */
  configVersion: number;
  configNote: string;
  techNotes: string;
  toConfirm: string[];
  /** Esercizi di base (RDL, hack...) per la policy RIR proposta. */
  policyClass: 'heavy_compound' | 'compound' | 'isolation' | 'calves_abs';
  // Campi del catalogo (facoltativi per gli esercizi creati dall'utente o di versioni precedenti)
  pattern?: MovementPattern;
  equipmentKind?: EquipmentKind;
  family?: string;
  difficulty?: 1 | 2 | 3;
  setup?: string;
  steps?: string[];
  commonErrors?: string[];
  favorite?: boolean;
  sources?: string[];
  /** Cosa si registra in ogni serie: ripetizioni (default), secondi o metri. */
  measure?: 'reps' | 'seconds' | 'meters';
  /** Campi editoriali: quando sceglierlo, quando anticiparlo/posticiparlo, cosa interrompe il confronto. */
  whenToChoose?: string;
  whenToMove?: string;
  comparisonLimits?: string;
  alternatives?: string[];
}

export interface RirTarget { min: number; max: number }

export interface ProgramItem {
  id: ID;
  exerciseId: ID;
  sets: number | null;        // null = da confermare (es. Bayesian)
  repMin: number | null;
  repMax: number | null;
  rirTargets: (RirTarget | null)[]; // per serie; null = non impostato
  restSec: number | null;
  declaredLoad: string;       // testo dichiarato, NON un record
  declaredNotes: string;
  toConfirm: string[];
  /** Priorità per la modalità "tempo ridotto": confermata dall'utente (1 = massima). null = non confermata */
  priority: number | null;
  sameAs: string;             // es. "Come martedì"
}

export interface ProgramDay {
  id: ID;
  name: string;
  weekday: number | null; // 1=lun ... 7=dom
  items: ProgramItem[];
}

export interface Program extends CatalogMeta {
  id: ID;
  name: string;
  kind: 'declared' | 'template' | 'custom';
  isActive: boolean;
  notes: string;
  days: ProgramDay[];
  createdAt: number;
}

export interface SessionItem {
  itemId: ID;
  exerciseId: ID;
  sets: number | null;
  repMin: number | null;
  repMax: number | null;
  rirTargets: (RirTarget | null)[];
  restSec: number | null;
  skipped: boolean;
}

export interface Session {
  id: ID;
  programId: ID | null;
  dayId: ID | null;
  title: string;
  dateKey: DateKey;
  startedAt: number;
  endedAt: number | null;
  pauses: { start: number; end: number | null }[];
  status: 'active' | 'done';
  items: SessionItem[];
  currentIndex: number;
  reducedTime: boolean;
  timeLimitMin: number | null;
  rest: { startedAt: number; plannedSec: number } | null;
  notes: string;
  painReported: boolean;
}

export interface SetEntry {
  id: ID;
  sessionId: ID;
  exerciseId: ID;
  configKey: string;
  itemIndex: number;
  kind: 'warmup' | 'working';
  order: number;               // ordine globale nella seduta
  load: number | null;
  loadConvention: LoadConvention;
  unilateral: boolean;
  romType: RomType;
  /** Ripetizioni complete al ROM pianificato (per lato se unilaterale). */
  fullReps: number;
  /** Sottoinsieme di fullReps conformi alla tecnica concordata. null = non dichiarato. */
  validReps: number | null;
  /** Lato opposto, solo se diverso (unilaterale). */
  fullRepsOtherSide: number | null;
  /** Categorie SEPARATE, non incluse in fullReps: */
  plannedPartials: number;
  extraPartials: number;
  assistedReps: number;
  failedAttempts: number;
  /** RIR stimato al termine delle ripetizioni conformi. null = non inserito (NON zero). */
  rir: number | null;
  rirUnknown: boolean;
  restBeforeSec: number | null;
  pain: boolean;
  painNote: string;
  techIssue: boolean;
  notes: string;
  savedAt: number;
}

export interface PainEpisode {
  id: ID;
  area: string;
  selfDescription: string;
  startDate: DateKey | null; // inserita dall'utente, non dedotta
  symptoms: string;
  intensity: number | null; // 0-10 autovalutato
  limitsActivities: boolean | null;
  worsening: boolean | null;
  redFlags: { perineal: boolean; bladderBowel: boolean; legWeakness: boolean };
  professionalNotes: string;
  status: 'active' | 'closed';
  resume: { confirmedAt: number; notes: string } | null;
  createdAt: number;
  log: { at: number; note: string; intensity: number | null }[];
}

export interface Nutrients {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}

export type FoodState = 'raw' | 'cooked' | 'drained' | 'as_sold';
export type FoodSource = 'label' | 'database' | 'estimate';

export interface Food extends CatalogMeta {
  id: ID;
  name: string;
  brand: string;
  source: FoodSource;
  sourceNote: string;
  sourceDate: DateKey | null;
  verified: boolean;
  state: FoodState;
  basis: '100g' | '100ml';
  per100: Nutrients;
  /** Densità g/ml: solo se nota. Mai assunta 1. */
  densityGPerMl: number | null;
  gramsPerPiece: number | null;
  defaultPortion: number | null;
  defaultUnit: 'g' | 'ml' | 'pz';
  barcode: string;
  /** Tag di esclusione/allergeni usati per filtrare ricette e sostituzioni. */
  tags: string[];
  shelfStable: 'yes' | 'no' | 'until_opened' | 'unknown';
  seed: boolean;
  favorite: boolean;
  synonyms?: string[];
  slug?: string;
  originalName?: string;
  sourceId?: string;
  license?: string;
  /** Informazione allergeni: dichiarata (tags affidabili) o sconosciuta. Sconosciuta ≠ assenza di allergeni. */
  allergenInfo?: 'declared' | 'unknown';
  category?: string;
}

export interface Ingredient { foodId: ID; qty: number; unit: 'g' | 'ml' | 'pz' }

export type RecipeCategory = 'colazione' | 'pranzo' | 'cena' | 'spuntino' | 'multiporzione';

export interface Recipe extends CatalogMeta {
  id: ID;
  name: string;
  ingredients: Ingredient[];
  servings: number;
  steps: string[];
  equipment: string[];
  activeMin: number | null;
  totalMin: number | null;
  portable: boolean;
  eatCold: boolean;
  needsColdChain: boolean;
  storage: string;
  storageSource: string;
  mealSlots: MealSlot[];
  notes: string;
  seed: boolean;
  favorite: boolean;
  category?: RecipeCategory;
  difficulty?: 'assemblaggio' | 'facile' | 'intermedia';
  /** Praticità nel consumo */
  eating?: { oneHand: boolean; needsCutlery: boolean; needsReheat: boolean };
  /** Moltiplicatori di porzione ammessi (porzioni realistiche), es. [0.75, 1, 1.25, 1.5] */
  portionSteps?: number[];
  tags?: string[];
  /** Fuori frigorifero: distinto da "trasportabile". ok = secondo la fonte indicata; requires_cold = serve freddo; not_verified = nessuna fonte. */
  ambient?: 'ok' | 'requires_cold' | 'not_verified';
  ambientSource?: string;
  /** Unità delle porzioni di un lotto (es. barrette in pezzi). */
  unitLabel?: 'porzioni' | 'pezzi';
}

export type MealSlot = 'colazione' | 'spuntino_mattina' | 'pranzo' | 'merenda' | 'cena' | 'spuntino_sera';

export interface StockLot {
  id: ID;
  foodId: ID;
  qty: number;
  unit: 'g' | 'ml' | 'pz';
  location: 'dispensa' | 'frigo' | 'freezer';
  purchasedAt: DateKey | null;
  expiry: DateKey | null;
  openedAt: DateKey | null;
  note: string;
  /** use_by = da consumarsi entro (sicurezza); best_before = preferibilmente entro (qualità). */
  expiryType?: 'use_by' | 'best_before' | null;
}

export interface PreparedBatch {
  id: ID;
  recipeId: ID | null;
  name: string;
  preparedAt: number;
  dateKey: DateKey;
  servingsTotal: number;
  servingsLeft: number;
  finalWeightG: number | null;
  totals: Nutrients;
  location: 'frigo' | 'freezer' | 'dispensa';
  note: string;
  txId: ID;
  /** Come si contano le unità del lotto (es. barrette: pezzi). */
  unitLabel?: 'porzioni' | 'pezzi';
}

export interface StockMove { table: 'stock' | 'batches'; id: ID; field: 'qty' | 'servingsLeft'; delta: number; created?: boolean }

export interface StockTx {
  id: ID;
  at: number;
  kind: 'prepare' | 'consume_batch' | 'consume_direct' | 'purchase' | 'adjust';
  label: string;
  moves: StockMove[];
  diaryIds: ID[];
  shortfalls: { foodId: ID; missing: number; unit: string }[];
  undone: boolean;
}

export interface DiaryEntry {
  id: ID;
  dateKey: DateKey;
  meal: MealSlot;
  kind: 'food' | 'batch' | 'recipe_direct' | 'estimate';
  label: string;
  foodId: ID | null;
  batchId: ID | null;
  recipeId: ID | null;
  qty: number | null;
  unit: 'g' | 'ml' | 'pz' | 'porzione';
  nutrients: Nutrients;
  estimated: boolean;
  txId: ID | null;
  createdAt: number;
}

export interface PlanEntry {
  /** proposto dal motore / confermato dall'utente (preparato e consumato sono tracciati da lotti e diario) */
  status?: 'proposed' | 'confirmed';
  id: ID;
  dateKey: DateKey;
  slot: MealSlot;
  recipeId: ID | null;
  foodId: ID | null;
  servings: number;   // porzioni ricetta, oppure grammi se foodId
  locked: boolean;
  done: boolean;
}

export interface ShoppingItem {
  id: ID;
  foodId: ID | null;
  name: string;
  qty: number | null;
  unit: 'g' | 'ml' | 'pz' | '';
  checked: boolean;
  note: string;
  createdAt: number;
}

export interface WeightEntry {
  id: ID;
  dateKey: DateKey;
  time: string;
  kg: number;
  morning: boolean | null;
  conditions: string;
  flags: string[]; // creatina, viaggio, malessere, sale, carboidrati
  note: string;
}

export interface WaistEntry { id: ID; dateKey: DateKey; cm: number; note: string }

export interface SleepEntry {
  id: ID;
  dateKey: DateKey; // data del risveglio
  bedTime: string | null;
  wakeTime: string | null;
  sleepHours: number | null; // stimata dall'utente (≠ tempo a letto)
  quality: number | null;    // 1-5
  napMin: number | null;
  note: string;
}

export interface TargetVersion {
  id: ID;
  createdAt: number;
  effectiveFrom: DateKey;
  kcal: number | null;
  proteinG: number | null;
  mode: 'manual' | 'professional' | 'formula' | 'calibrated';
  reason: string;
}

export interface Decision {
  id: ID;
  at: number;
  scope: 'exercise' | 'calories' | 'program';
  refId: ID | null;
  ruleId: string;
  decision: 'accepted' | 'kept' | 'modified' | 'postponed';
  detail: string;
  reviewAfter: DateKey | null;
}

export interface Attachment { id: ID; blob: Blob; mime: string; createdAt: number }

export interface KV { key: string; value: unknown; updatedAt: number }
