// Trend del peso e regole di adattamento calorico. Soglie di QUALITÀ DEL DATO configurabili,
// non validazione scientifica. Nessun adattamento da singole pesate; niente 7700 kcal/kg.
import type { WeightEntry } from '../db/types';
import { addDays, daysBetween } from './dates';

export interface CalorieRules {
  minDays: number;               // finestra minima (14)
  minWeighInsPerWeek: number;    // 3
  minCompleteDiaryDays: number;  // 10 su 14
  rateMinPct: number;            // crescita settimanale desiderata minima (% peso)
  rateMaxPct: number;            // massima
  stepKcal: number;              // ritocco proposto (100–150)
  minDaysBetweenChanges: number; // 14
  adherenceMin: number;          // consumo medio / target per considerare "seguito" (0.95)
}
export const DEFAULT_CAL_RULES: CalorieRules = {
  minDays: 14, minWeighInsPerWeek: 3, minCompleteDiaryDays: 10, rateMinPct: 0.1, rateMaxPct: 0.25,
  stepKcal: 100, minDaysBetweenChanges: 14, adherenceMin: 0.95
};

/** Media giornaliera (più pesate nello stesso giorno → media). */
export function dailyWeights(ws: WeightEntry[]): { dateKey: string; kg: number }[] {
  const m = new Map<string, number[]>();
  for (const w of ws) m.set(w.dateKey, [...(m.get(w.dateKey) ?? []), w.kg]);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dateKey, v]) => ({ dateKey, kg: v.reduce((a, b) => a + b, 0) / v.length }));
}

/** Media mobile su `days` giorni di calendario (usa le pesate disponibili nella finestra). */
export function movingAverage(daily: { dateKey: string; kg: number }[], days = 7) {
  return daily.map((d) => {
    const from = addDays(d.dateKey, -(days - 1));
    const win = daily.filter((x) => x.dateKey >= from && x.dateKey <= d.dateKey);
    return { dateKey: d.dateKey, avg: win.reduce((a, b) => a + b.kg, 0) / win.length, n: win.length };
  });
}

/** Regressione lineare kg~giorni: pendenza ed errore standard. */
export function slope(daily: { dateKey: string; kg: number }[]) {
  if (daily.length < 3) return null;
  const x0 = daily[0].dateKey;
  const xs = daily.map((d) => daysBetween(x0, d.dateKey));
  const ys = daily.map((d) => d.kg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  const a = my - b * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (a + b * xs[i])) ** 2;
  const se = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : Infinity;
  return { kgPerDay: b, seKgPerDay: se, meanKg: my };
}

export interface DataQuality { ok: boolean; reasons: string[]; spanDays: number; weighInsByWeek: number[]; completeDays: number }

export function dataQuality(weights: WeightEntry[], completeDiaryDays: string[], today: string, rules = DEFAULT_CAL_RULES): DataQuality {
  const from = addDays(today, -(rules.minDays - 1));
  const inWin = dailyWeights(weights.filter((w) => w.dateKey >= from && w.dateKey <= today));
  const w1 = inWin.filter((d) => d.dateKey < addDays(from, 7)).length;
  const w2 = inWin.filter((d) => d.dateKey >= addDays(from, 7)).length;
  const all = dailyWeights(weights);
  const spanDays = all.length ? daysBetween(all[0].dateKey, today) + 1 : 0;
  const complete = completeDiaryDays.filter((d) => d >= from && d <= today).length;
  const reasons: string[] = [];
  if (spanDays < rules.minDays) reasons.push(`Storico del peso di ${spanDays} giorni: ne servono almeno ${rules.minDays}.`);
  if (w1 < rules.minWeighInsPerWeek || w2 < rules.minWeighInsPerWeek) reasons.push(`Pesate per settimana: ${w1} e ${w2} (servono almeno ${rules.minWeighInsPerWeek} in ciascuna).`);
  if (complete < rules.minCompleteDiaryDays) reasons.push(`Giorni completi con tutti i valori energetici noti: ${complete}/${rules.minDays} (servono almeno ${rules.minCompleteDiaryDays}; un valore mancante non vale zero).`);
  return { ok: reasons.length === 0, reasons, spanDays, weighInsByWeek: [w1, w2], completeDays: complete };
}

export type CalorieDecision = 'insufficient_data' | 'too_soon' | 'postpone' | 'hold_uncertain' | 'hold' | 'increase' | 'decrease' | 'improve_practicality' | 'no_target';

export interface CalorieProposal { kind: CalorieDecision; title: string; reasons: string[]; deltaKcal: number | null; ratePctPerWeek: number | null }

export function proposeCalories(args: {
  weights: WeightEntry[];
  completeDiaryDays: string[];
  avgIntakeKcal: number | null; // media dei giorni completi
  targetKcal: number | null;
  lastTargetChange: string | null;
  today: string;
  rules?: CalorieRules;
  goal?: 'massa' | 'mantenimento' | 'dimagrimento' | 'solo_diario';
  /** Periodi in cui il peso è poco interpretabile (es. inizio creatina): nessuna modifica se si sovrappongono alla finestra. */
  confounders?: { label: string; from: string; until: string }[];
}): CalorieProposal {
  const rules = args.rules ?? DEFAULT_CAL_RULES;
  if (args.goal === 'solo_diario') return { kind: 'no_target', title: 'Solo diario: nessuna proposta', reasons: ['Hai scelto di usare il diario senza obiettivo: l\'app registra e mostra i dati, ma non propone modifiche alle calorie.'], deltaKcal: null, ratePctPerWeek: null };
  const q = dataQuality(args.weights, args.completeDiaryDays, args.today, rules);
  if (args.lastTargetChange && daysBetween(args.lastTargetChange, args.today) < rules.minDaysBetweenChanges) {
    return { kind: 'too_soon', title: 'Target modificato di recente', reasons: [`L'ultimo cambio risale a ${daysBetween(args.lastTargetChange, args.today)} giorni fa: le modifiche sono al massimo una ogni ${rules.minDaysBetweenChanges} giorni.`], deltaKcal: null, ratePctPerWeek: null };
  }
  if (!q.ok) return { kind: 'insufficient_data', title: 'Dati insufficienti: nessuna modifica', reasons: q.reasons, deltaKcal: null, ratePctPerWeek: null };
  const from = addDays(args.today, -(rules.minDays - 1));
  const recentFlags = args.weights.filter((w) => w.dateKey >= from && w.flags.length);
  const daily = dailyWeights(args.weights.filter((w) => w.dateKey >= from));
  const s = slope(daily);
  if (!s) return { kind: 'insufficient_data', title: 'Dati insufficienti', reasons: ['Pesate troppo poche per stimare un andamento.'], deltaKcal: null, ratePctPerWeek: null };
  const rate = (s.kgPerDay * 7 / s.meanKg) * 100;
  const seRate = (s.seKgPerDay * 7 / s.meanKg) * 100;
  const rateTxt = `Andamento stimato: ${rate.toFixed(2).replace('.', ',')}% del peso a settimana (±${(2 * seRate).toFixed(2).replace('.', ',')}).`;
  const conf = (args.confounders ?? []).filter((c) => c.from <= args.today && c.until >= from);
  if (conf.length) {
    return { kind: 'postpone', title: 'Peso meno interpretabile: nessuna modifica per ora', reasons: [rateTxt, ...conf.map((c) => `${c.label}: dal ${c.from} al ${c.until} il peso può variare per motivi che non sono grasso né muscolo. Le calorie restano come sono.`)], deltaKcal: null, ratePctPerWeek: rate };
  }
  if (recentFlags.length) {
    return { kind: 'postpone', title: 'Peso meno interpretabile: valuta di rinviare', reasons: [rateTxt, `Annotazioni recenti (${[...new Set(recentFlags.flatMap((w) => w.flags))].join(', ')}) possono alterare il peso (acqua, glicogeno, contenuto intestinale).`], deltaKcal: null, ratePctPerWeek: rate };
  }
  if (args.targetKcal == null) {
    const stable = Math.abs(rate) < rules.rateMinPct && Math.abs(rate) + 2 * seRate < rules.rateMaxPct;
    return {
      kind: 'no_target', title: 'Nessun target calorico impostato',
      reasons: [rateTxt, stable && args.avgIntakeKcal != null
        ? `Peso abbastanza stabile e diario sufficientemente completo: il consumo medio registrato (${Math.round(args.avgIntakeKcal)} kcal) è una stima approssimativa del mantenimento.`
        : 'Il mantenimento non è stimabile con sicurezza: il peso non è stabile o il diario non basta.'],
      deltaKcal: null, ratePctPerWeek: rate
    };
  }
  // Una proposta attribuita al diario richiede un consumo calcolabile: senza, si mostrano i dati e si attende.
  if (args.avgIntakeKcal == null) {
    return { kind: 'insufficient_data', title: 'Consumo non calcolabile: nessuna modifica', reasons: [rateTxt, 'Mancano giorni dichiarati completi con tutti i valori energetici noti. Un valore mancante non è zero: completa le voci o le etichette e riprova.'], deltaKcal: null, ratePctPerWeek: rate };
  }
  const [minR, maxR] = goalRange(args.goal ?? 'massa', rules);
  const uncertain = (rate < minR && rate + 2 * seRate >= minR) || (rate > maxR && rate - 2 * seRate <= maxR);
  const range = `${String(minR).replace('.', ',')}…${String(maxR).replace('.', ',')}%/settimana`;
  if (uncertain) return { kind: 'hold_uncertain', title: 'Segnale incerto: mantieni', reasons: [rateTxt, 'La variazione è confrontabile con le oscillazioni: continua a raccogliere dati per 3–4 settimane.'], deltaKcal: null, ratePctPerWeek: rate };
  if (rate < minR) {
    // Il peso scende (o sale) meno del ritmo scelto verso l'alto: proposta di piccolo aumento
    if (args.avgIntakeKcal != null && args.avgIntakeKcal < args.targetKcal * rules.adherenceMin) {
      return { kind: 'improve_practicality', title: 'Prima rendi il piano più praticabile', reasons: [rateTxt, `Consumo medio ${Math.round(args.avgIntakeKcal)} kcal sotto il target di ${args.targetKcal}: invece di alzarlo, prova pasti più pratici o porzioni distribuite meglio.`], deltaKcal: null, ratePctPerWeek: rate };
    }
    return { kind: 'increase', title: `Proposta: +${rules.stepKcal} kcal/die`, reasons: [rateTxt, `Andamento sotto il ritmo scelto (${range}) seguendo il target: piccolo aumento da rivalutare tra almeno 2 settimane.`], deltaKcal: rules.stepKcal, ratePctPerWeek: rate };
  }
  if (rate > maxR) {
    if (args.avgIntakeKcal != null && args.avgIntakeKcal > args.targetKcal * (2 - rules.adherenceMin)) {
      return { kind: 'improve_practicality', title: 'Prima avvicinati al target attuale', reasons: [rateTxt, `Consumo medio ${Math.round(args.avgIntakeKcal)} kcal sopra il target di ${args.targetKcal}: abbassarlo non servirebbe; valuta pasti più sazianti o porzioni più semplici da gestire.`], deltaKcal: null, ratePctPerWeek: rate };
    }
    return { kind: 'decrease', title: `Proposta: −${rules.stepKcal} kcal/die`, reasons: [rateTxt, `Andamento sopra il ritmo scelto (${range}) in modo persistente: piccola riduzione e rivaluta il contesto. Nessuna compensazione drastica.`], deltaKcal: -rules.stepKcal, ratePctPerWeek: rate };
  }
  return { kind: 'hold', title: 'Nel ritmo scelto: mantieni', reasons: [rateTxt], deltaKcal: null, ratePctPerWeek: rate };
}

/**
 * Ritmi prudenti predefiniti per obiettivo (% del peso a settimana). Scelte operative modificabili,
 * non soglie ottimali dimostrate. Massa usa i valori configurabili nelle impostazioni.
 */
export function goalRange(goal: 'massa' | 'mantenimento' | 'dimagrimento' | 'solo_diario', rules: CalorieRules): [number, number] {
  if (goal === 'mantenimento') return [-0.1, 0.1];
  if (goal === 'dimagrimento') return [-0.75, -0.25];
  return [rules.rateMinPct, rules.rateMaxPct];
}

export interface IntakeStats {
  /** Media kcal dei soli giorni dichiarati completi con TUTTE le voci note. null se nessuno. */
  avgKcal: number | null;
  usableDays: string[];
  /** Giorni dichiarati completi ma con almeno una voce senza kcal (valore sconosciuto, non zero). */
  unknownDays: string[];
  /** Giorni dichiarati completi senza alcuna voce: esclusi, non contati come 0 kcal. */
  emptyDays: string[];
}

/** Introito medio: registrazione incompleta, valore sconosciuto e zero restano distinti. */
export function intakeStats(diary: { dateKey: string; nutrients: { kcal: number | null } }[], completeDays: string[], from: string, to: string): IntakeStats {
  const usableDays: string[] = [], unknownDays: string[] = [], emptyDays: string[] = [];
  let sum = 0;
  for (const d of [...new Set(completeDays)].filter((x) => x >= from && x <= to).sort()) {
    const es = diary.filter((e) => e.dateKey === d);
    if (!es.length) { emptyDays.push(d); continue; }
    if (es.some((e) => e.nutrients.kcal == null)) { unknownDays.push(d); continue; }
    usableDays.push(d);
    sum += es.reduce((a, e) => a + (e.nutrients.kcal as number), 0);
  }
  return { avgKcal: usableDays.length ? sum / usableDays.length : null, usableDays, unknownDays, emptyDays };
}

/** Riferimento proteico informativo 1,6–2,2 g/kg (non prescrizione). */
export function proteinReference(kg: number) { return { low: Math.round(kg * 1.6), high: Math.round(kg * 2.2) }; }

/**
 * Stima iniziale con formula documentata (Mifflin-St Jeor) × fattore attività scelto dall'utente.
 * Ampia incertezza: serve solo come punto di partenza da calibrare.
 */
export function mifflinStJeor(args: { kg: number; cm: number; age: number; sex: 'M' | 'F'; activity: number }) {
  const bmr = 10 * args.kg + 6.25 * args.cm - 5 * args.age + (args.sex === 'M' ? 5 : -161);
  const tdee = bmr * args.activity;
  return { bmr, tdee, low: tdee * 0.85, high: tdee * 1.15 };
}
