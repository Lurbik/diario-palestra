// Pianificazione organizzativa del sonno (non una previsione dell'addormentamento).
//   inizio sonno = sveglia − durata desiderata
//   a letto      = inizio sonno − latenza stimata dall'utente
//   routine      = a letto − tempo per prepararsi
// Calcolo su istanti assoluti a partire dalla sveglia locale Europe/Rome: mezzanotte e ora legale sono gestite.
import { addDays, dateKey, romeLocalToEpoch, timeHM } from './dates';

export interface SleepPlanInput { wakeDateKey: string; wakeTime: string; sleepHours: number; latencyMin: number; routineMin: number }
export interface SleepPlanResult {
  wakeAt: number; sleepAt: number; bedAt: number; routineAt: number;
  label: { wake: string; sleep: string; bed: string; routine: string; bedDate: string };
}

export function planSleep(i: SleepPlanInput): SleepPlanResult {
  const wakeAt = romeLocalToEpoch(i.wakeDateKey, i.wakeTime);
  const sleepAt = wakeAt - Math.round(i.sleepHours * 3600e3);
  const bedAt = sleepAt - i.latencyMin * 60e3;
  const routineAt = bedAt - i.routineMin * 60e3;
  return { wakeAt, sleepAt, bedAt, routineAt, label: { wake: timeHM(wakeAt), sleep: timeHM(sleepAt), bed: timeHM(bedAt), routine: timeHM(routineAt), bedDate: dateKey(bedAt) } };
}

/** Sveglia di domani: eccezione del giorno se presente, altrimenti ricorrente. */
export function tomorrowWake(today: string, recurring: string | null, overrides: Record<string, string | null>): { dateKey: string; time: string | null } {
  const d = addDays(today, 1);
  return { dateKey: d, time: d in overrides ? overrides[d] : recurring };
}

export interface EveningEvent { label: string; endAt: number }

/** Conflitti espliciti con impegni serali (es. allenamento o cena che finiscono dopo l'inizio della routine). */
export function sleepConflicts(plan: SleepPlanResult, events: EveningEvent[]): string[] {
  return events.filter((e) => e.endAt > plan.routineAt).map((e) => {
    const late = Math.round((e.endAt - plan.routineAt) / 60000);
    return `${e.label} finisce ${late} min dopo l'inizio della routine serale (${plan.label.routine}). Possibili alternative: preparare prima il necessario, anticipare l'impegno o ridurre le attività serali. L'app non sposta nulla da sola.`;
  });
}
