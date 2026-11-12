// Operazioni sulle sedute. Il timer è SEMPRE ricostruito dai timestamp salvati,
// non da un contatore di tick: sopravvive a blocco schermo, chiusura e riapertura.
import { db } from '../db/db';
import type { Exercise, Program, Session, SessionItem, SetEntry, Muscle } from '../db/types';
import { uid } from './id';
import { dateKey } from './dates';
import type { Exposure } from './progression';

export function configKey(ex: Pick<Exercise, 'id' | 'machineId' | 'configVersion' | 'romType' | 'loadConvention'>): string {
  return `${ex.id}|${ex.machineId ?? 'nd'}|v${ex.configVersion}|${ex.romType}|${ex.loadConvention}`;
}

export function sessionTimes(s: Pick<Session, 'startedAt' | 'endedAt' | 'pauses'>, now = Date.now()) {
  const end = s.endedAt ?? now;
  const total = Math.max(0, end - s.startedAt);
  const paused = s.pauses.reduce((a, p) => a + Math.max(0, (p.end ?? end) - p.start), 0);
  return { total, paused, active: Math.max(0, total - paused), isPaused: s.pauses.some((p) => p.end == null) };
}

export function restState(s: Pick<Session, 'rest'>, now = Date.now()) {
  if (!s.rest) return null;
  const elapsed = Math.max(0, now - s.rest.startedAt);
  return { elapsedMs: elapsed, plannedMs: s.rest.plannedSec * 1000, remainingMs: s.rest.plannedSec * 1000 - elapsed, done: elapsed >= s.rest.plannedSec * 1000 };
}

/** Stima della durata di un esercizio: serie × (recupero + ~45 s di esecuzione). Non comprime i recuperi. */
export function estimateItemMin(item: Pick<SessionItem, 'sets' | 'restSec'>, defaultRestSec = 180): number {
  const sets = item.sets ?? 2;
  return (sets * ((item.restSec ?? defaultRestSec) + 45)) / 60 + 2;
}

export async function activeSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first();
}

export async function startSession(opts: { program: Program | null; dayId: string | null; title?: string; reducedTime?: boolean; timeLimitMin?: number | null; skipItemIds?: string[] }): Promise<Session> {
  const existing = await activeSession();
  if (existing) return existing;
  const day = opts.program?.days.find((d) => d.id === opts.dayId) ?? null;
  const items: SessionItem[] = (day?.items ?? []).map((it) => ({
    itemId: it.id, exerciseId: it.exerciseId, sets: it.sets, repMin: it.repMin, repMax: it.repMax,
    rirTargets: it.rirTargets, restSec: it.restSec, skipped: (opts.skipItemIds ?? []).includes(it.id)
  }));
  const now = Date.now();
  const s: Session = {
    id: uid(), programId: opts.program?.id ?? null, dayId: day?.id ?? null, title: opts.title ?? day?.name ?? 'Seduta libera',
    dateKey: dateKey(now), startedAt: now, endedAt: null, pauses: [], status: 'active', items,
    currentIndex: Math.max(0, items.findIndex((i) => !i.skipped)), reducedTime: !!opts.reducedTime, timeLimitMin: opts.timeLimitMin ?? null,
    rest: null, notes: '', painReported: false
  };
  await db.sessions.add(s);
  return s;
}

export type SetDraft = Omit<SetEntry, 'savedAt' | 'order' | 'restBeforeSec' | 'configKey'>;

/**
 * Salva una serie in modo atomico e idempotente: l'id viene generato dalla bozza PRIMA del tocco,
 * quindi un doppio tocco non crea duplicati. Ritorna la serie solo a scrittura completata.
 */
export async function saveSet(draft: SetDraft, ex: Exercise, plannedRestSec: number | null): Promise<{ set: SetEntry; duplicate: boolean }> {
  return db.transaction('rw', db.sets, db.sessions, async () => {
    const already = await db.sets.get(draft.id);
    if (already) return { set: already, duplicate: true };
    const session = await db.sessions.get(draft.sessionId);
    if (!session || session.status !== 'active') throw new Error('La seduta non è attiva');
    const prev = await db.sets.where('sessionId').equals(draft.sessionId).toArray();
    const lastSaved = prev.reduce((m, s) => Math.max(m, s.savedAt), 0);
    const now = Date.now();
    const set: SetEntry = {
      ...draft,
      configKey: configKey(ex),
      order: prev.length + 1,
      restBeforeSec: lastSaved ? Math.round((now - lastSaved) / 1000) : null,
      savedAt: now
    };
    if (set.validReps != null && set.validReps > set.fullReps) throw new Error('Le ripetizioni conformi non possono superare le complete');
    await db.sets.add(set);
    await db.sessions.update(session.id, {
      rest: plannedRestSec ? { startedAt: now, plannedSec: plannedRestSec } : null,
      painReported: session.painReported || set.pain
    });
    return { set, duplicate: false };
  });
}

export async function deleteSet(id: string) { await db.sets.delete(id); }

export async function updateSet(id: string, patch: Partial<SetEntry>) {
  if (patch.validReps != null && patch.fullReps != null && patch.validReps > patch.fullReps) throw new Error('Le ripetizioni conformi non possono superare le complete');
  await db.sets.update(id, patch);
}

export async function togglePause(sessionId: string) {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const now = Date.now();
  const open = s.pauses.find((p) => p.end == null);
  const pauses = open ? s.pauses.map((p) => (p === open ? { ...p, end: now } : p)) : [...s.pauses, { start: now, end: null }];
  await db.sessions.update(sessionId, { pauses });
}

export async function finishSession(sessionId: string, notes?: string) {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const now = Date.now();
  await db.sessions.update(sessionId, {
    status: 'done', endedAt: now, rest: null, notes: notes ?? s.notes,
    pauses: s.pauses.map((p) => (p.end == null ? { ...p, end: now } : p))
  });
}

/** Elimina una seduta e le sue serie (es. avviata per errore). */
export async function discardSession(sessionId: string) {
  await db.transaction('rw', db.sets, db.sessions, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}

/** Esposizioni concluse per una configurazione, dalla più vecchia. */
export async function exposuresFor(configKeyStr: string, excludeSessionId?: string): Promise<Exposure[]> {
  const sets = await db.sets.where('configKey').equals(configKeyStr).toArray();
  const bySession = new Map<string, SetEntry[]>();
  for (const s of sets) if (s.sessionId !== excludeSessionId) bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s]);
  const sessions = (await db.sessions.bulkGet([...bySession.keys()])).filter((s): s is Session => !!s && s.status === 'done');
  return sessions.sort((a, b) => a.startedAt - b.startedAt).map((s) => ({ sessionId: s.id, dateKey: s.dateKey, startedAt: s.startedAt, sets: bySession.get(s.id)!.sort((a, b) => a.order - b.order) }));
}

export async function previousPerformance(configKeyStr: string, excludeSessionId?: string) {
  const ex = await exposuresFor(configKeyStr, excludeSessionId);
  return ex.length ? ex[ex.length - 1] : null;
}

/** Serie allenanti per muscolo: dirette (muscoli principali) e indirette (secondari) separate. */
export function setsPerMuscle(sets: SetEntry[], exercises: Map<string, Exercise>) {
  const direct = new Map<Muscle, number>();
  const indirect = new Map<Muscle, number>();
  for (const s of sets) {
    if (s.kind !== 'working') continue;
    const ex = exercises.get(s.exerciseId);
    if (!ex) continue;
    for (const m of ex.primaryMuscles) direct.set(m, (direct.get(m) ?? 0) + 1);
    for (const m of ex.secondaryMuscles) indirect.set(m, (indirect.get(m) ?? 0) + 1);
  }
  return { direct, indirect };
}

/** Tonnellaggio descrittivo SOLO entro la stessa configurazione/convenzione (mai sommato tra esercizi). */
export function tonnage(sets: SetEntry[]): number | null {
  const ws = sets.filter((s) => s.kind === 'working');
  if (!ws.length || ws.some((s) => s.load == null)) return null;
  if (new Set(ws.map((s) => s.configKey)).size > 1) return null;
  return ws.reduce((a, s) => a + (s.load as number) * s.fullReps, 0);
}

/** Converte il carico per manubrio in totale SOLO su richiesta esplicita. */
export function dumbbellTotal(perDumbbell: number, count: 1 | 2 = 2) { return perDumbbell * count; }

/** Multipower: totale noto solo se il peso barra è noto. */
export function smithTotal(platesPerSide: number, barWeightKg: number | null): number | null {
  return barWeightKg == null ? null : platesPerSide * 2 + barWeightKg;
}
