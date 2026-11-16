// Agenda personale FACOLTATIVA: un'unica fonte di orari per Oggi, sonno, preparazione ed export calendario.
// Tutti gli orari sono istanti assoluti (Europe/Rome): un impegno che passa la mezzanotte finisce il giorno dopo.
// Nessun orario preimpostato: senza agenda l'app lo dice, invece di usare valori di comodo nascosti.
import { addDays, romeLocalToEpoch, timeHM, dateKey } from './dates';

export interface Agenda {
  /** orario abituale di inizio allenamento; eccezioni per giorno della settimana (1=lun … 7=dom) */
  trainingStart: string | null;
  trainingByWeekday: Record<string, string | null>;
  /** minuti per rientrare a casa dopo la palestra */
  commuteMin: number | null;
  /** fuori casa nei giorni lavoro/università */
  awayFrom: string | null;
  awayTo: string | null;
  /** orario abituale della preparazione pasti */
  prepStart: string | null;
  prepMin: number | null;
}

export const emptyAgenda = (): Agenda => ({ trainingStart: null, trainingByWeekday: {}, commuteMin: null, awayFrom: null, awayTo: null, prepStart: null, prepMin: null });

/** Orario di inizio allenamento per una data: eccezione del giorno della settimana, poi orario abituale. */
export function trainingStartFor(a: Agenda, weekday: number): string | null {
  const k = String(weekday);
  return k in a.trainingByWeekday ? a.trainingByWeekday[k] : a.trainingStart;
}

export interface TimeWindow { startAt: number; endAt: number; homeAt: number; label: string; endsNextDay: boolean }

/** Finestra di allenamento: inizio, fine (durata stimata dalla scheda), rientro a casa. */
export function trainingWindow(a: Agenda, day: string, weekday: number, durationMin: number): TimeWindow | null {
  const start = trainingStartFor(a, weekday);
  if (!start) return null;
  const startAt = romeLocalToEpoch(day, start);
  const endAt = startAt + Math.round(durationMin) * 60e3;
  const homeAt = endAt + (a.commuteMin ?? 0) * 60e3;
  return { startAt, endAt, homeAt, label: `${start}–${timeHM(endAt)}${dateKey(endAt) !== day ? ' (giorno dopo)' : ''}`, endsNextDay: dateKey(endAt) !== day };
}

/** Durata dell'evento in minuti, anche se attraversa la mezzanotte. */
export function spanMinutes(startHM: string, endHM: string) {
  const [h1, m1] = startHM.split(':').map(Number), [h2, m2] = endHM.split(':').map(Number);
  const d = h2 * 60 + m2 - (h1 * 60 + m1);
  return d > 0 ? d : d + 1440;
}

export { addDays };
