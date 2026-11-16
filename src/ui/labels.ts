import type { LoadConvention, Muscle, SetEntry, Machine, EquipmentKind } from '../db/types';
import { fmtNum } from '../lib/id';
import { smithTotal } from '../lib/workout';

export const CONVENTION_LABEL: Record<LoadConvention, string> = {
  barbell_total: 'kg totali (barra inclusa)',
  per_dumbbell: 'kg per manubrio',
  machine_stack: 'kg pacco pesi',
  plates_per_side: 'kg dischi per lato',
  plates_total: 'kg dischi totali',
  cable_stack: 'kg al cavo (rapporto carrucole ignoto)',
  bodyweight_added: 'kg zavorra',
  assisted: 'kg assistenza',
  unknown: 'kg (convenzione da confermare)'
};

export const MUSCLE_LABEL: Record<Muscle, string> = {
  petto: 'Petto', dorsali: 'Dorsali', schiena_alta: 'Schiena alta', deltoidi_anteriori: 'Deltoidi anteriori', deltoidi_laterali: 'Deltoidi laterali',
  deltoidi_posteriori: 'Deltoidi posteriori', bicipiti: 'Bicipiti', tricipiti: 'Tricipiti', avambracci: 'Avambracci', quadricipiti: 'Quadricipiti',
  femorali: 'Femorali', glutei: 'Glutei', adduttori: 'Adduttori', polpacci: 'Polpacci', addome: 'Addome', lombari: 'Lombari', abduttori: 'Abduttori',
  cuffia_rotatori: 'Cuffia dei rotatori (profondo)'
};
/** Etichetta dell'unità registrata per serie. */
export const MEASURE_LABEL = { reps: 'Complete', seconds: 'Secondi', meters: 'Metri' } as const;
export const MEASURE_UNIT = { reps: '', seconds: ' s', meters: ' m' } as const;
export const ALL_MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];

export function describeSet(s: SetEntry): string {
  const parts: string[] = [];
  parts.push(`${s.load == null ? '— kg' : fmtNum(s.load, 2) + ' kg'} × ${s.fullReps}${s.unilateral ? '/lato' : ''}`); // per secondi/metri l'unità è indicata dall'esercizio
  if (s.fullRepsOtherSide != null) parts.push(`altro lato ${s.fullRepsOtherSide}`);
  parts.push(s.validReps == null ? 'conformità non valutata' : s.validReps === s.fullReps ? 'tutte conformi' : `${s.validReps} conformi`);
  parts.push(s.rir != null ? `RIR ${s.rir}` : s.rirUnknown ? 'RIR non so' : 'RIR —');
  if (s.plannedPartials) parts.push(`${s.plannedPartials} parziali pianificate`);
  if (s.extraPartials) parts.push(`+${s.extraPartials} parziali extra`);
  if (s.assistedReps) parts.push(`${s.assistedReps} assistite`);
  if (s.failedAttempts) parts.push(`${s.failedAttempts} tentativi falliti`);
  return parts.join(' · ');
}

export function totalLoadNote(convention: LoadConvention, load: number | null, machine: Machine | null | undefined): string | null {
  if (load == null) return null;
  if (convention === 'plates_per_side') {
    const t = smithTotal(load, machine?.barWeightKg ?? null);
    return t == null ? 'Totale non calcolabile: peso effettivo barra non noto.' : `Totale con barra: ${fmtNum(t, 2)} kg`;
  }
  if (convention === 'per_dumbbell') return 'Per singolo manubrio (nessuna conversione automatica in totale).';
  if (convention === 'cable_stack') return 'Carico selezionato: la resistenza effettiva dipende dal rapporto carrucole (non noto).';
  return null;
}

export const EQ_LABEL: Record<EquipmentKind, string> = {
  macchina: 'Macchina', cavo: 'Cavo', manubri: 'Manubri', bilanciere: 'Bilanciere', multipower: 'Multipower', corpo_libero: 'Corpo libero'
};


export const PATTERN_LABEL: Record<string, string> = {
  spinta_orizzontale: 'Spinta orizzontale', spinta_verticale: 'Spinta verticale', tirata_verticale: 'Tirata verticale', tirata_orizzontale: 'Tirata orizzontale',
  accosciata: 'Accosciata', estensione_anca: 'Estensione d’anca', flessione_ginocchio: 'Flessione del ginocchio', estensione_ginocchio: 'Estensione del ginocchio',
  polpacci: 'Polpacci', adduzione: 'Adduzione', abduzione: 'Abduzione', bicipiti: 'Flessione del gomito', tricipiti: 'Estensione del gomito',
  alzate_laterali: 'Abduzione della spalla', deltoidi_posteriori: 'Estensione orizzontale della spalla', addome: 'Addome', stabilizzazione: 'Stabilizzazione', altro: 'Altro'
};

/** Filtri standard del selettore esercizi. */
export const EXERCISE_FILTERS = [
  { key: 'involved', label: 'Muscolo', options: (Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => ({ value: m, label: MUSCLE_LABEL[m] })) },
  { key: 'eq', label: 'Attrezzo', options: Object.entries(EQ_LABEL).map(([value, label]) => ({ value, label })) },
  { key: 'pattern', label: 'Gesto', options: Object.entries(PATTERN_LABEL).map(([value, label]) => ({ value, label })) },
  { key: 'uni', label: 'Lato', options: [{ value: 'bi', label: 'Bilaterale' }, { value: 'uni', label: 'Unilaterale' }] },
  { key: 'fav', label: 'Preferiti', options: [{ value: 'true', label: 'Solo preferiti' }] }
];
