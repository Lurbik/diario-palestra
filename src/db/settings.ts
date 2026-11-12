import type { MealSlot } from './types';
import { DEFAULT_POLICY, type PolicySettings } from '../lib/progression';
import { DEFAULT_CAL_RULES, type CalorieRules } from '../lib/calories';
import type { PersonalPain } from '../data/personal.example';

export type DayType = 'palestra_pomeriggio' | 'palestra_sera' | 'riposo' | 'universita';

export interface MealWindow { slot: MealSlot; from: string; to: string; enabled: boolean }

export interface Reminder { id: string; label: string; time: string; weekdays: number[]; enabled: boolean }

export type Answer = 'si' | 'no' | null;

export interface Profile {
  name: string;
  age: number | null;
  heightCm: number | null;
  sex: 'M' | 'F' | null;          // chiesto solo se si sceglie una formula che lo richiede
  declaredWeightKg: number | null;
  declaredWeightDate: string | null;
  declaredWeightNote: string;
  trainingDaysPerWeek: number | null;
  workHours: string;
  study: string;
  sleepAvgDeclared: string;
  devices: string;
  androidModel: string;            // da confermare solo per compatibilità
  goal: string;
  priorities: string;              // preferenze soggettive, non diagnosi
  likes: string[];
  dislikes: string[];
  allergies: string[];             // distinte dalle preferenze
  yogurt: Answer;                  // chiesto separatamente
  pestoOwnTolerated: Answer;
  coolerBag: Answer;               // possiede borsa termica con elementi refrigeranti?
  stepsMeasured: number | null;
  equipmentHome: string;
  workConstraints: string;
}

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  highContrast: boolean;
  reduceMotion: boolean;
  loadStepKg: number;
  dailyTimeLimitMin: number | null;
  reducedTimePrioritiesConfirmed: boolean;
  sound: boolean;
  vibration: boolean;
  keepAwake: boolean;
  quietFrom: string;
  quietTo: string;
  excludedTags: string[];
  proteinTargetG: number | null;
  observationStart: string | null;
  policy: PolicySettings;
  calorieRules: CalorieRules;
  indirectFraction: number | null; // conversione facoltativa delle serie indirette (approssimazione)
  showE1rm: boolean;
  sleepTargetH: number;
  lastBackupAt: number | null;
  prepWeekdays: number[];
  mealWindows: Record<DayType, MealWindow[]>;
  reminders: Reminder[];
  onboardingDone: boolean;
  prefillConfirmed: boolean;
  profile: Profile;
}

const W = (slot: MealSlot, from: string, to: string, enabled = true): MealWindow => ({ slot, from, to, enabled });

export function defaultSettings(): Settings {
  return {
    theme: 'system',
    highContrast: false,
    reduceMotion: false,
    loadStepKg: 2.5,
    dailyTimeLimitMin: 90,
    reducedTimePrioritiesConfirmed: false,
    sound: false,
    vibration: false,
    keepAwake: false,
    quietFrom: '23:00',
    quietTo: '07:00',
    excludedTags: ['formaggio'],
    proteinTargetG: null,
    observationStart: null,
    policy: DEFAULT_POLICY,
    calorieRules: DEFAULT_CAL_RULES,
    indirectFraction: null,
    showE1rm: false,
    sleepTargetH: 7,
    lastBackupAt: null,
    prepWeekdays: [7, 3],
    // Finestre organizzative, non orari biologicamente obbligatori.
    mealWindows: {
      palestra_pomeriggio: [W('colazione', '07:00', '08:00'), W('spuntino_mattina', '10:00', '11:00'), W('pranzo', '14:15', '14:45'), W('merenda', '17:15', '18:00'), W('cena', '20:00', '21:00'), W('spuntino_sera', '22:00', '22:30', false)],
      palestra_sera: [W('colazione', '07:00', '08:00'), W('spuntino_mattina', '10:00', '11:00'), W('pranzo', '14:15', '14:45'), W('merenda', '18:30', '19:15'), W('cena', '22:15', '23:00'), W('spuntino_sera', '23:00', '23:15', false)],
      riposo: [W('colazione', '07:00', '08:00'), W('spuntino_mattina', '10:00', '11:00'), W('pranzo', '14:15', '14:45'), W('merenda', '17:00', '17:30'), W('cena', '20:00', '21:00'), W('spuntino_sera', '22:00', '22:30', false)],
      universita: [W('colazione', '07:00', '08:00'), W('spuntino_mattina', '10:00', '11:00'), W('pranzo', '13:00', '14:00'), W('merenda', '16:30', '17:30'), W('cena', '20:00', '21:00'), W('spuntino_sera', '22:00', '22:30', false)]
    },
    reminders: [
      { id: 'rem_borsa', label: 'Prepara la borsa per domani (pasti e spuntini)', time: '21:30', weekdays: [7, 1, 2, 3, 4], enabled: false },
      { id: 'rem_prep', label: 'Sessione di preparazione pasti', time: '17:00', weekdays: [7, 3], enabled: false }
    ],
    onboardingDone: false,
    prefillConfirmed: !PREFILL_ENABLED,
    profile: PREFILL_ENABLED ? prefillProfile() : emptyProfile()
  };
}

/**
 * Build con VITE_PREFILL=off: nessun dato personale nel pacchetto JS
 * (utile se l'app viene ospitata su un indirizzo pubblico).
 */

export function emptyProfile(): Profile {
  return {
    name: '', age: null, heightCm: null, sex: null, declaredWeightKg: null, declaredWeightDate: null, declaredWeightNote: '',
    trainingDaysPerWeek: null, workHours: '', study: '', sleepAvgDeclared: '', devices: '', androidModel: '', goal: '', priorities: '',
    likes: [], dislikes: [], allergies: [], yogurt: null, pestoOwnTolerated: null, coolerBag: null, stepsMeasured: null, equipmentHome: '', workConstraints: ''
  };
}

/**
 * Dati di precompilazione: letti dal file locale src/data/personal.local.ts (escluso da Git).
 * Se il file manca (repository pubblico, CI) o con VITE_PREFILL=off, il profilo parte vuoto.
 */
const personalModules = import.meta.glob<{ PERSONAL_PROFILE: Profile; PERSONAL_PAIN: PersonalPain | null }>('../data/personal.local.ts', { eager: true });
const personal = Object.values(personalModules)[0] ?? null;
export const PERSONAL_PAIN: PersonalPain | null = personal?.PERSONAL_PAIN ?? null;
export const PREFILL_ENABLED = import.meta.env?.VITE_PREFILL !== 'off' && personal != null;

export function prefillProfile(): Profile {
  return personal ? structuredClone(personal.PERSONAL_PROFILE) : emptyProfile();
}

export const MEAL_LABEL: Record<MealSlot, string> = {
  colazione: 'Colazione', spuntino_mattina: 'Spuntino mattina', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', spuntino_sera: 'Spuntino sera'
};
export const MEAL_ORDER: MealSlot[] = ['colazione', 'spuntino_mattina', 'pranzo', 'merenda', 'cena', 'spuntino_sera'];
export const DAYTYPE_LABEL: Record<DayType, string> = {
  palestra_pomeriggio: 'Palestra 15–16', palestra_sera: 'Palestra 20:30–21', riposo: 'Riposo / pausa', universita: 'Università'
};
