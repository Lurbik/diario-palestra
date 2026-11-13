import type { MealSlot } from './types';
import { DEFAULT_POLICY, type PolicySettings } from '../lib/progression';
import { DEFAULT_CAL_RULES, type CalorieRules } from '../lib/calories';

// Valori predefiniti NEUTRI: nessun dato, orario o preferenza di una persona specifica.
// I dati dell'utente vengono raccolti dall'onboarding o importati a runtime dal dispositivo.

/** Chiavi storiche mantenute per compatibilità con i dati già salvati; le etichette sono generiche. */
export type DayType = 'palestra_pomeriggio' | 'palestra_sera' | 'riposo' | 'universita';

export interface MealWindow { slot: MealSlot; from: string; to: string; enabled: boolean }

export interface Reminder { id: string; label: string; time: string; weekdays: number[]; enabled: boolean }

export type Answer = 'si' | 'no' | null;
export type Goal = 'massa' | 'mantenimento' | 'dimagrimento';
export type Experience = 'principiante' | 'intermedio' | 'esperto';
export type EquipmentAccess = 'palestra' | 'casa_manubri' | 'corpo_libero';

export interface Profile {
  name: string;
  goal: Goal | null;
  experience: Experience | null;
  trainingDaysPerWeek: number | null;
  sessionMinutes: number | null;
  equipment: EquipmentAccess | null;
  allergies: string[];             // distinte dalle preferenze
  fridgeAway: Answer;              // frigo disponibile fuori casa (lavoro/studio)?
  coolerBag: Answer;               // borsa termica con elementi refrigeranti?
  defaultCookMin: number | null;   // tempo attivo abituale in cucina (min), salvato una volta
  // Dati usati SOLO se si sceglie la stima da formula
  age: number | null;
  heightCm: number | null;
  sex: 'M' | 'F' | null;
  // Campi storici (versioni precedenti), mantenuti se già presenti sul dispositivo
  declaredWeightKg?: number | null;
  declaredWeightDate?: string | null;
  declaredWeightNote?: string;
  likes?: string[];
  dislikes?: string[];
  [legacy: string]: unknown;
}

export interface SleepPlan {
  wakeTime: string | null;      // sveglia ricorrente
  latencyMin: number;           // tempo stimato per addormentarsi (dichiarato)
  routineMin: number;           // tempo per prepararsi
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
  indirectFraction: number | null;
  showE1rm: boolean;
  sleepTargetH: number;
  sleepPlan: SleepPlan;
  lastBackupAt: number | null;
  prepWeekdays: number[];
  mealWindows: Record<DayType, MealWindow[]>;
  reminders: Reminder[];
  onboardingDone: boolean;
  prefillConfirmed: boolean;
  assistMode: 'manuale' | 'assistita' | 'automatica';
  profile: Profile;
}

const W = (slot: MealSlot, from: string, to: string, enabled = true): MealWindow => ({ slot, from, to, enabled });

export function emptyProfile(): Profile {
  return {
    name: '', goal: null, experience: null, trainingDaysPerWeek: null, sessionMinutes: null, equipment: null, allergies: [],
    fridgeAway: null, coolerBag: null, defaultCookMin: null, age: null, heightCm: null, sex: null
  };
}

export function defaultSettings(): Settings {
  return {
    theme: 'system',
    highContrast: false,
    reduceMotion: false,
    loadStepKg: 2.5,
    dailyTimeLimitMin: null,
    reducedTimePrioritiesConfirmed: false,
    sound: false,
    vibration: false,
    keepAwake: false,
    quietFrom: '23:00',
    quietTo: '07:00',
    excludedTags: [],
    proteinTargetG: null,
    observationStart: null,
    policy: DEFAULT_POLICY,
    calorieRules: DEFAULT_CAL_RULES,
    indirectFraction: null,
    showE1rm: false,
    sleepTargetH: 8,
    sleepPlan: { wakeTime: null, latencyMin: 15, routineMin: 30 },
    lastBackupAt: null,
    prepWeekdays: [],
    // Finestre organizzative generiche, modificabili: non orari biologicamente obbligatori.
    mealWindows: {
      palestra_pomeriggio: [W('colazione', '07:30', '08:30'), W('spuntino_mattina', '10:30', '11:00'), W('pranzo', '13:00', '14:00'), W('merenda', '16:30', '17:00'), W('cena', '20:00', '21:00'), W('spuntino_sera', '22:00', '22:30', false)],
      palestra_sera: [W('colazione', '07:30', '08:30'), W('spuntino_mattina', '10:30', '11:00'), W('pranzo', '13:00', '14:00'), W('merenda', '17:30', '18:30'), W('cena', '21:00', '22:00'), W('spuntino_sera', '22:30', '23:00', false)],
      riposo: [W('colazione', '07:30', '08:30'), W('spuntino_mattina', '10:30', '11:00'), W('pranzo', '13:00', '14:00'), W('merenda', '16:30', '17:00'), W('cena', '20:00', '21:00'), W('spuntino_sera', '22:00', '22:30', false)],
      universita: [W('colazione', '07:00', '08:00'), W('spuntino_mattina', '10:30', '11:00'), W('pranzo', '13:00', '14:00'), W('merenda', '16:30', '17:30'), W('cena', '20:00', '21:00'), W('spuntino_sera', '22:00', '22:30', false)]
    },
    reminders: [
      { id: 'rem_domani', label: 'Prepara pasti e borsa per domani', time: '21:00', weekdays: [7, 1, 2, 3, 4], enabled: false },
      { id: 'rem_prep', label: 'Sessione di preparazione pasti', time: '17:00', weekdays: [7], enabled: false }
    ],
    onboardingDone: false,
    prefillConfirmed: true,
    assistMode: 'assistita',
    profile: emptyProfile()
  };
}

/** Unisce impostazioni salvate (anche di versioni precedenti) con i default, senza perdere valori dell'utente. */
export function mergeSettings(saved: Partial<Settings> | undefined): Settings {
  const d = defaultSettings();
  const s = saved ?? {};
  return {
    ...d, ...s,
    sleepPlan: { ...d.sleepPlan, ...(s.sleepPlan ?? {}) },
    policy: { ...d.policy, ...(s.policy ?? {}) },
    calorieRules: { ...d.calorieRules, ...(s.calorieRules ?? {}) },
    mealWindows: { ...d.mealWindows, ...(s.mealWindows ?? {}) },
    profile: { ...d.profile, ...(s.profile ?? {}) }
  };
}

export const MEAL_LABEL: Record<MealSlot, string> = {
  colazione: 'Colazione', spuntino_mattina: 'Spuntino mattina', pranzo: 'Pranzo', merenda: 'Merenda', cena: 'Cena', spuntino_sera: 'Spuntino sera'
};
export const MEAL_ORDER: MealSlot[] = ['colazione', 'spuntino_mattina', 'pranzo', 'merenda', 'cena', 'spuntino_sera'];
export const DAYTYPE_LABEL: Record<DayType, string> = {
  palestra_pomeriggio: 'Allenamento di giorno', palestra_sera: 'Allenamento di sera', riposo: 'Riposo', universita: 'Giornata fuori casa'
};
export const GOAL_LABEL: Record<Goal, string> = { massa: 'Aumentare massa', mantenimento: 'Mantenere', dimagrimento: 'Ridurre il grasso' };
