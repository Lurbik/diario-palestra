// Coach allenamento: proposte spiegate e annullabili, per portata crescente.
//   mantieni → solo oggi → modifica un esercizio → modifica un giorno → cambia modello
// Non sono livelli obbligatori: se i giorni disponibili cambiano davvero, si propone subito un modello diverso.
// Regole di prodotto (scelte modificabili, non leggi fisiologiche):
// - L'età della scheda NON è un motivo per cambiarla.
// - Uno skip occasionale non cambia nulla; uno abituale (3 delle ultime 4 volte) apre una proposta.
// - Una seduta con notte molto breve, dolore o "ho meno tempo" non conta come prova di stallo.
// - Ogni proposta dice: osservazione verificabile, dati usati, cosa manca, alternativa, portata.
import type { Program, Session, SetEntry, SleepEntry } from '../db/types';
import { addDays, daysBetween, weekStart } from './dates';

export type CoachScope = 'keep' | 'today' | 'exercise' | 'day' | 'model';
export type CoachAction =
  | { kind: 'keep' }
  | { kind: 'move_item'; programId: string; dayId: string; itemId: string; toIndex: number }
  | { kind: 'set_optional'; programId: string; dayId: string; itemId: string; optional: boolean }
  | { kind: 'change_model'; templateId: string }
  | { kind: 'open'; href: string };

export interface CoachProposal {
  id: string; scope: CoachScope; title: string;
  observation: string; dataUsed: string[]; missing: string[]; note?: string;
  actions: { label: string; action: CoachAction; primary?: boolean }[];
}

export const SCOPE_LABEL: Record<CoachScope, string> = { keep: 'Mantieni', today: 'Solo oggi', exercise: 'Un esercizio', day: 'Un giorno', model: 'Tutta la scheda' };

/** Sedute in un contesto anomalo: escluse dai confronti di prestazione (mai "stallo"). */
export function sessionContext(sessions: Pick<Session, 'id' | 'dateKey' | 'reducedTime' | 'painReported'>[], sleep: Pick<SleepEntry, 'dateKey' | 'sleepHours'>[], shortSleepH = 5): Map<string, string> {
  const m = new Map<string, string>();
  const night = new Map(sleep.filter((s) => s.sleepHours != null).map((s) => [s.dateKey, s.sleepHours!]));
  for (const s of sessions) {
    const h = night.get(s.dateKey);
    if (s.painReported) m.set(s.id, 'dolore segnalato');
    else if (h != null && h < shortSleepH) m.set(s.id, `notte molto breve (${String(h).replace('.', ',')} h)`);
    else if (s.reducedTime) m.set(s.id, 'seduta in modalità "ho meno tempo"');
  }
  return m;
}

/** Giorni a settimana della scheda (giorni distinti con almeno un esercizio). */
export const programDays = (p: Program) => p.days.filter((d) => d.items.length > 0).length;

export interface CoachInput {
  program: Program | null;
  sessions: Session[];          // concluse
  sets: SetEntry[];
  today: string;
  declaredDays: number | null;  // giorni disponibili dichiarati nel profilo
  templates: { id: string; name: string; days: number; reasons: string[] }[]; // già ordinati per compatibilità
  stalls: { exerciseName: string; exerciseId: string }[];
}

export function coachProposals(inp: CoachInput): CoachProposal[] {
  const out: CoachProposal[] = [];
  const p = inp.program;
  if (!p) return out;
  const planned = programDays(p);
  const since = (d: number) => inp.sessions.filter((s) => s.programId === p.id && s.dateKey >= addDays(inp.today, -d) && s.dateKey <= inp.today);

  // 1) I giorni disponibili sono cambiati: proposta di modello subito, anche nella prima settimana.
  if (inp.declaredDays != null && inp.declaredDays !== planned) {
    const cand = inp.templates.filter((t) => t.days === inp.declaredDays).slice(0, 2);
    out.push({
      id: `days_changed_${inp.declaredDays}`, scope: 'model',
      title: `Hai ${inp.declaredDays} giorni a settimana, la scheda ne prevede ${planned}`,
      observation: `Nel profilo hai indicato ${inp.declaredDays} giorni di allenamento; la scheda attiva "${p.name}" è organizzata su ${planned}.`,
      dataUsed: ['giorni dichiarati nel profilo', `struttura della scheda (${planned} giorni)`],
      missing: [],
      note: 'Cambiare modello non cancella nulla: la scheda attuale resta salvata con il suo storico e puoi riattivarla. I carichi restano legati a esercizio e macchina.',
      actions: [
        ...cand.map((t, i) => ({ label: `Passa a "${t.name}"`, action: { kind: 'change_model', templateId: t.id } as CoachAction, primary: i === 0 })),
        { label: 'Mantieni la scheda attuale', action: { kind: 'keep' } }
      ]
    });
  }

  // 2) La scheda non entra nella settimana: due settimane complete con meno della metà delle sedute previste.
  const w0 = weekStart(inp.today);
  const weeks = [addDays(w0, -14), addDays(w0, -7)].map((ws) => inp.sessions.filter((s) => s.programId === p.id && s.dateKey >= ws && s.dateKey < addDays(ws, 7)).length);
  const startedBefore = inp.sessions.some((s) => s.programId === p.id && s.dateKey < addDays(w0, -14)) || (p.createdAt && daysBetween(new Date(p.createdAt).toISOString().slice(0, 10), w0) >= 14);
  if (startedBefore && planned >= 3 && weeks.every((n) => n <= planned / 2) && !(inp.declaredDays != null && inp.declaredDays !== planned)) {
    const fit = Math.max(2, Math.round((weeks[0] + weeks[1]) / 2));
    const cand = inp.templates.filter((t) => t.days === fit).slice(0, 2);
    out.push({
      id: `fit_${fit}`, scope: 'model',
      title: 'La scheda sembra non entrare nella tua settimana',
      observation: `Nelle ultime due settimane complete hai fatto ${weeks[0]} e ${weeks[1]} sedute su ${planned} previste.`,
      dataUsed: [`sedute concluse con questa scheda: ${weeks.join(' e ')}`],
      missing: ['motivo delle sedute saltate (tempo, salute, preferenza): se è un periodo eccezionale, mantieni'],
      note: 'Non significa che la scheda sia inefficace: dice solo che, per ora, non entra nel tempo disponibile.',
      actions: [
        ...cand.map((t, i) => ({ label: `Prova "${t.name}" (${t.days} giorni)`, action: { kind: 'change_model', templateId: t.id } as CoachAction, primary: i === 0 })),
        { label: 'È un periodo eccezionale: mantieni', action: { kind: 'keep' } }
      ]
    });
  }

  // 3) Esercizio saltato abitualmente a fine seduta.
  for (const day of p.days) {
    const occ = inp.sessions.filter((s) => s.programId === p.id && s.dayId === day.id).sort((a, b) => a.startedAt - b.startedAt).slice(-4);
    if (occ.length < 4) continue;
    day.items.forEach((it, idx) => {
      if (it.optional || idx === 0) return;
      const skipped = occ.filter((s) => {
        const mine = inp.sets.filter((x) => x.sessionId === s.id && x.exerciseId === it.exerciseId && x.kind === 'working').length;
        const others = inp.sets.filter((x) => x.sessionId === s.id && x.exerciseId !== it.exerciseId && x.kind === 'working').length;
        return mine === 0 && others > 0; // seduta fatta, quell'esercizio no
      }).length;
      if (skipped < 3) return;
      const atEnd = idx >= day.items.length - 2;
      const target = 1; // subito dopo il primo esercizio, che resta il principale del giorno
      out.push({
        id: `skip_${day.id}_${it.id}`, scope: 'day',
        title: `Esercizio saltato ${skipped} volte su 4`,
        observation: `Nel giorno "${day.name}" l'esercizio in posizione ${idx + 1} non è stato fatto in ${skipped} delle ultime 4 sedute${atEnd ? ', di solito a fine seduta' : ''}.`,
        dataUsed: occ.map((s) => s.dateKey),
        missing: ['perché lo salti: tempo, attrezzatura occupata o preferenza? Uno skip non significa che non ti piace'],
        note: target !== idx ? `Anticiparlo cambia l'ordine: i confronti con le sedute in cui era a fine allenamento non saranno diretti.` : undefined,
        actions: [
          { label: 'È una priorità: anticipalo', action: { kind: 'move_item', programId: p.id, dayId: day.id, itemId: it.id, toIndex: target }, primary: true },
          { label: 'Rendilo facoltativo', action: { kind: 'set_optional', programId: p.id, dayId: day.id, itemId: it.id, optional: true } },
          { label: 'Mantieni com\'è', action: { kind: 'keep' } }
        ]
      });
    });
  }

  // 4) Possibili stalli: una sola modifica alla volta, dopo i controlli.
  for (const st of inp.stalls.slice(0, 3)) {
    out.push({
      id: `stall_${st.exerciseId}`, scope: 'exercise',
      title: `${st.exerciseName}: possibile stallo`,
      observation: 'Più esposizioni confrontabili senza miglioramento della mediana (sedute con notte molto breve, dolore o "ho meno tempo" escluse).',
      dataUsed: ['esposizioni della stessa configurazione (macchina e ROM)'],
      missing: ['verifica dei controlli: confrontabilità, recuperi, sonno, alimentazione, incremento disponibile'],
      note: 'Cambia UNA cosa alla volta e annota la data: tra 2–3 settimane si rivede.',
      actions: [{ label: 'Vedi dati e controlli', action: { kind: 'open', href: '#/progressi/allenamento' }, primary: true }, { label: 'Mantieni', action: { kind: 'keep' } }]
    });
  }

  // 5) Nessun problema rilevato: mantieni, anche se la scheda è vecchia.
  if (!out.length) {
    const recent = since(28).length;
    out.push({
      id: 'keep', scope: 'keep', title: 'Mantieni la scheda',
      observation: `${recent} sedute con questa scheda nelle ultime 4 settimane; nessuna difficoltà ricorrente rilevata.`,
      dataUsed: ['sedute concluse', 'esercizi saltati', 'stalli confrontabili'],
      missing: recent === 0 ? ['nessuna seduta recente: registrane qualcuna per avere dati'] : [],
      note: 'L\'età della scheda non è un motivo per cambiarla: se entra nella tua settimana e i progressi confrontabili continuano, la progressione resta locale (carichi e ripetizioni).',
      actions: []
    });
  }
  return out;
}

/** Applica un'azione a una scheda (pura): restituisce la nuova scheda e una descrizione vecchio → nuovo. */
export function applyToProgram(p: Program, a: CoachAction): { program: Program; change: string } {
  const prog: Program = structuredClone(p);
  if (a.kind === 'move_item') {
    const d = prog.days.find((x) => x.id === a.dayId)!;
    const from = d.items.findIndex((i) => i.id === a.itemId);
    const [it] = d.items.splice(from, 1);
    d.items.splice(a.toIndex, 0, it);
    return { program: { ...prog, revision: (p.revision ?? 1) + 1 }, change: `${d.name}: posizione ${from + 1} → ${a.toIndex + 1}` };
  }
  if (a.kind === 'set_optional') {
    const d = prog.days.find((x) => x.id === a.dayId)!;
    const it = d.items.find((i) => i.id === a.itemId)!;
    it.optional = a.optional;
    return { program: { ...prog, revision: (p.revision ?? 1) + 1 }, change: `${d.name}: esercizio ${a.optional ? 'obbligatorio → facoltativo' : 'facoltativo → obbligatorio'}` };
  }
  return { program: prog, change: '' };
}
