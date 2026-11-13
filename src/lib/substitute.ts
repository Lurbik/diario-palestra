// Sostituzioni di esercizi: prima i vincoli, poi l'ordinamento. Nessun punteggio di "efficacia biologica".
import type { EquipmentKind, Exercise } from '../db/types';
import type { EquipmentAccess } from '../db/settings';

export interface ExercisePrefs { disliked: string[]; favorites: string[]; discomfort: string[] }

export const ALLOWED_EQ: Record<EquipmentAccess, EquipmentKind[]> = {
  palestra: ['macchina', 'cavo', 'manubri', 'bilanciere', 'multipower', 'corpo_libero'],
  casa_manubri: ['manubri', 'corpo_libero'],
  corpo_libero: ['corpo_libero']
};

export interface Alternative { exercise: Exercise; reasons: string[] }

export function alternatives(target: Exercise, all: Exercise[], ctx: { access: EquipmentAccess | null; prefs: ExercisePrefs; busyMachineId?: string | null; inSession?: string[]; max?: number }): Alternative[] {
  const allowed = ALLOWED_EQ[ctx.access ?? 'palestra'];
  const out: (Alternative & { score: number })[] = [];
  for (const e of all) {
    if (e.id === target.id || e.archived) continue;
    // Vincoli
    if (e.equipmentKind && !allowed.includes(e.equipmentKind)) continue;
    if (ctx.prefs.disliked.includes(e.id) || ctx.prefs.discomfort.includes(e.id)) continue;
    if (ctx.busyMachineId && e.machineId === ctx.busyMachineId) continue;
    if (ctx.inSession?.includes(e.id)) continue;
    const samePattern = !!target.pattern && e.pattern === target.pattern;
    const shared = e.primaryMuscles.filter((m) => target.primaryMuscles.includes(m));
    if (!samePattern && !shared.length) continue;
    // Ordinamento
    const reasons: string[] = [];
    let score = 0;
    if (samePattern) { score += 3; reasons.push('stessa funzione nella seduta'); }
    if (shared.length) { score += shared.length; reasons.push('stessi muscoli principali'); }
    if (e.equipmentKind && e.equipmentKind !== target.equipmentKind) reasons.push(`attrezzatura diversa (${e.equipment})`);
    if (ctx.prefs.favorites.includes(e.id)) { score += 1; reasons.push('tra i tuoi preferiti'); }
    if ((e.difficulty ?? 2) <= (target.difficulty ?? 2)) score += 0.5;
    if (e.unilateral !== target.unilateral) reasons.push(e.unilateral ? 'unilaterale' : 'bilaterale');
    reasons.push('storico separato: i kg non si confrontano con la variante precedente');
    out.push({ exercise: e, reasons, score });
  }
  return out.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name)).slice(0, ctx.max ?? 3);
}
