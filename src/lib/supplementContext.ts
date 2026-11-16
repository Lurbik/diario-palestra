// Costruisce il contesto per i consigli sugli integratori leggendo SOLO dati locali del dispositivo.
// Valori ignoti restano null (mai zero); le soglie di sufficienza sono dichiarate nei messaggi.
import { db } from '../db/db';
import type { Settings } from '../db/settings';
import type { DiaryEntry, Food, Session, SleepEntry } from '../db/types';
import { addDays, dateKey, timeHM } from './dates';
import type { SupplementContext } from './supplements';

const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

/** Ora abituale di andare a letto (minuti dalla mezzanotte): dal piano del sonno, altrimenti mediana del diario del sonno. */
export function usualBedtimeMin(settings: Pick<Settings, 'sleepPlan' | 'sleepTargetH'>, sleep: SleepEntry[]): number | null {
  if (settings.sleepPlan.wakeTime) return ((toMin(settings.sleepPlan.wakeTime) - settings.sleepTargetH * 60 - settings.sleepPlan.latencyMin) % 1440 + 1440) % 1440;
  const beds = sleep.map((s) => s.bedTime).filter((b): b is string => !!b).map((b) => { const m = toMin(b); return m < 12 * 60 ? m + 1440 : m; }).sort((a, b) => a - b);
  if (beds.length < 5) return null;
  return beds[Math.floor(beds.length / 2)] % 1440;
}

/** Quota di sedute che finiscono a meno di 6 ore dal letto. */
export function lateSessionShare(sessions: Pick<Session, 'endedAt'>[], bedMin: number | null): number | null {
  const ended = sessions.filter((s) => s.endedAt);
  if (bedMin == null || ended.length < 3) return null;
  const late = ended.filter((s) => { const end = toMin(timeHM(s.endedAt!)); const gap = (bedMin - end + 1440) % 1440; return gap < 6 * 60; }).length;
  return late / ended.length;
}

/** Proteine medie dei soli giorni completi in cui tutte le voci hanno le proteine note. */
export function proteinFromDiary(diary: Pick<DiaryEntry, 'dateKey' | 'nutrients'>[], completeDays: string[]) {
  const byDay = new Map<string, (number | null)[]>();
  for (const d of diary) byDay.set(d.dateKey, [...(byDay.get(d.dateKey) ?? []), d.nutrients.protein]);
  const vals: number[] = [];
  for (const day of completeDays) {
    const v = byDay.get(day);
    if (!v?.length || v.some((x) => x == null)) continue;
    vals.push((v as number[]).reduce((a, b) => a + b, 0));
  }
  return { avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, days: vals.length };
}

/** Porzioni di pesce a settimana (voci con almeno un alimento etichettato "pesce"); null con diario scarno. */
export function fishPerWeek(diary: Pick<DiaryEntry, 'dateKey' | 'foodId' | 'recipeId'>[], foods: Map<string, Food>, recipeIngredients: Map<string, string[]>, loggedDays: number): number | null {
  if (loggedDays < 14) return null;
  const isFish = (id: string | null | undefined) => !!id && !!foods.get(id)?.tags.includes('pesce');
  const n = diary.filter((d) => isFish(d.foodId) || (d.recipeId ? (recipeIngredients.get(d.recipeId) ?? []).some(isFish) : false)).length;
  return n / (loggedDays / 7);
}

export async function buildSupplementContext(settings: Settings): Promise<SupplementContext> {
  const today = dateKey();
  const from = addDays(today, -27);
  const [weights, diary, completeRows, sessions, sleep, foods, recipes, logRow] = await Promise.all([
    db.weights.orderBy('dateKey').toArray(), db.diary.where('dateKey').between(from, today, true, true).toArray(),
    db.kv.where('key').startsWith('diaryComplete:').toArray(), db.sessions.where('dateKey').between(from, today, true, true).filter((s) => s.status === 'done').toArray(),
    db.sleep.where('dateKey').between(from, today, true, true).toArray(), db.foods.toArray(), db.recipes.toArray(), db.kv.get('supplementLog')
  ]);
  const complete = completeRows.filter((r) => r.value === true).map((r) => r.key.slice('diaryComplete:'.length)).filter((d) => d >= from && d <= today);
  const prot = proteinFromDiary(diary, complete);
  const loggedDays = new Set(diary.map((d) => d.dateKey)).size;
  const fMap = new Map(foods.map((f) => [f.id, f]));
  const ing = new Map(recipes.map((r) => [r.id, r.ingredients.map((i) => i.foodId)]));
  const p = settings.profile;
  const log = ((logRow?.value as { id: string; start: string; end?: string | null }[]) ?? []).filter((l) => !l.end);
  return {
    goal: p.goal, diet: p.diet ?? null, health: p.health ?? {},
    weightKg: weights.length ? weights[weights.length - 1].kg : null,
    proteinAvgG: prot.avg, proteinDays: prot.days,
    sessions28: sessions.length,
    lateSessionShare: lateSessionShare(sessions, usualBedtimeMin(settings, sleep)),
    fishPerWeek: fishPerWeek(diary, fMap, ing, loggedDays),
    noDairy: settings.excludedTags.includes('latte') || p.allergies.some((a) => /latt|siero|whey/i.test(a)),
    using: log.map((l) => l.id),
    declaredDays: p.trainingDaysPerWeek
  };
}
