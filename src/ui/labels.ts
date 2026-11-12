import type { LoadConvention, Muscle, SetEntry, Machine } from '../db/types';
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
  femorali: 'Femorali', glutei: 'Glutei', adduttori: 'Adduttori', polpacci: 'Polpacci', addome: 'Addome', lombari: 'Lombari'
};
export const ALL_MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];

export function describeSet(s: SetEntry): string {
  const parts: string[] = [];
  parts.push(`${s.load == null ? '— kg' : fmtNum(s.load, 2) + ' kg'} × ${s.fullReps}${s.unilateral ? '/lato' : ''}`);
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
