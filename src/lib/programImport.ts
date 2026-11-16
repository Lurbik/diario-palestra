// Importazione ed esportazione di SCHEDE (non di tutto il diario).
// - Accetta un file parziale nel formato del backup (solo exercises/programs/machines) o un oggetto { exercises, programs }.
// - Importazione ADDITIVA, atomica e idempotente: le voci identiche si saltano, i conflitti tengono le tue (default),
//   le schede importate non diventano attive da sole e non generano sedute; gli altri dati del file vengono ignorati.
// - Gli esercizi richiesti da una scheda devono esistere (catalogo, diario o file): altrimenti sono segnalati.
// - L'esportazione contiene solo schede ed esercizi/macchine personali che servono: nessun dato sanitario, peso o storico.
import { db } from '../db/db';
import type { Exercise, Machine, Program } from '../db/types';

export interface ProgramFile { exercises: Exercise[]; programs: Program[]; machines: Machine[]; ignored: string[] }
export interface ProgramImportPreview {
  programs: { id: string; name: string; status: 'nuova' | 'identica' | 'conflitto'; days: number }[];
  exercises: { added: number; identical: number; conflicts: number };
  machines: { added: number; identical: number; conflicts: number };
  missing: { programId: string; exerciseId: string }[];
  ignored: string[];
}

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
const KEEP = ['exercises', 'programs', 'machines'];

export function parseProgramFile(text: string): ProgramFile {
  let o: Record<string, unknown>;
  try { o = JSON.parse(text); } catch { throw new Error('Il file non è un JSON valido.'); }
  if ((o as { format?: string }).format?.includes('cifrat') || (o as { ciphertext?: string }).ciphertext) throw new Error('File cifrato: per le schede usa un file non cifrato.');
  const t = (o.tables && typeof o.tables === 'object' ? o.tables : o) as Record<string, unknown>;
  const arr = <T,>(k: string) => (Array.isArray(t[k]) ? (t[k] as T[]) : []);
  const ignored = Object.keys(t).filter((k) => !KEEP.includes(k) && Array.isArray(t[k]) && (t[k] as unknown[]).length > 0);
  const programs = arr<Program>('programs');
  if (!programs.length) throw new Error('Nel file non ci sono schede.');
  return { exercises: arr<Exercise>('exercises'), programs, machines: arr<Machine>('machines'), ignored };
}

async function cmp<T extends { id: string }>(table: { get(id: string): Promise<T | undefined> }, rows: T[]) {
  let added = 0, identical = 0, conflicts = 0;
  for (const r of rows) { const l = await table.get(r.id); if (!l) added++; else if (stable(l) === stable(r)) identical++; else conflicts++; }
  return { added, identical, conflicts };
}

// Stessa preparazione per anteprima e importazione: così un file reimportato tale e quale risulta «identico».
const prepMachine = (m: Machine): Machine => ({ ...m, origin: m.origin ?? 'private_import' });
const prepExercise = (e: Exercise): Exercise => ({ ...e, origin: e.origin === 'catalog' ? 'catalog' : 'private_import' });
const prepProgram = (p: Program): Program => ({ ...p, isActive: false, kind: p.kind === 'template' ? 'template' : 'custom', origin: p.origin === 'catalog' ? 'catalog' : 'private_import' });

export async function previewProgramImport(f: ProgramFile): Promise<ProgramImportPreview> {
  const known = new Set([...(await db.exercises.toCollection().primaryKeys()) as string[], ...f.exercises.map((e) => e.id)]);
  const programs = [];
  for (const p of f.programs) {
    const l = await db.programs.get(p.id);
    const norm = (x: Program) => stable({ ...x, isActive: false });
    programs.push({ id: p.id, name: p.name, days: p.days.length, status: (!l ? 'nuova' : norm(l) === norm(prepProgram(p)) ? 'identica' : 'conflitto') as 'nuova' | 'identica' | 'conflitto' });
  }
  const missing = f.programs.flatMap((p) => p.days.flatMap((d) => d.items.filter((i) => !known.has(i.exerciseId)).map((i) => ({ programId: p.id, exerciseId: i.exerciseId }))));
  return { programs, exercises: await cmp(db.exercises, f.exercises.map(prepExercise)), machines: await cmp(db.machines, f.machines.map(prepMachine)), missing, ignored: f.ignored };
}

/** Importa in un'unica transazione. Conflitti: "tieni i miei" (default) oppure "usa il file". Mai attiva, mai sedute. */
export async function applyProgramImport(f: ProgramFile, onConflict: 'keep_local' | 'use_file' = 'keep_local'): Promise<{ programs: number; exercises: number; machines: number; skipped: number }> {
  const pv = await previewProgramImport(f);
  if (pv.missing.length) throw new Error(`Mancano ${pv.missing.length} esercizi richiesti dalle schede: importazione annullata, nessuna modifica.`);
  const res = { programs: 0, exercises: 0, machines: 0, skipped: 0 };
  await db.transaction('rw', db.exercises, db.programs, db.machines, async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const put = async <T extends { id: string }>(table: any, rows: T[], key: 'programs' | 'exercises' | 'machines', prep: (r: T) => T) => {
      for (const r0 of rows) {
        const r = prep(r0);
        const l = await table.get(r.id);
        if (l && (stable(key === 'programs' ? { ...(l as unknown as Program), isActive: false } : l) === stable(r) || onConflict === 'keep_local')) { res.skipped++; continue; }
        await table.put(r); res[key]++;
      }
    };
    await put(db.machines, f.machines, 'machines', prepMachine);
    await put(db.exercises, f.exercises, 'exercises', prepExercise);
    await put(db.programs, f.programs, 'programs', prepProgram);
  });
  return res;
}

/** File con le sole schede scelte e gli esercizi/macchine personali che usano. */
export async function exportPrograms(ids: string[]): Promise<string> {
  const programs = (await db.programs.bulkGet(ids)).filter((p): p is Program => !!p).map((p) => ({ ...p, isActive: false }));
  const exIds = new Set(programs.flatMap((p) => p.days.flatMap((d) => d.items.map((i) => i.exerciseId))));
  const exercises = (await db.exercises.bulkGet([...exIds])).filter((e): e is Exercise => !!e && e.origin !== 'catalog');
  const mIds = new Set(exercises.map((e) => e.machineId).filter((x): x is string => !!x));
  const machines = (await db.machines.bulkGet([...mIds])).filter((m): m is Machine => !!m);
  return JSON.stringify({ format: 'diario-schede', version: 1, exportedAt: new Date().toISOString(), tables: { programs, exercises, machines } }, null, 1);
}
