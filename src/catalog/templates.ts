// Template di schede NEUTRI basati sul catalogo. Modificabili, non piani personali validati.
import type { Program } from '../db/types';
import type { EquipmentAccess, Experience } from '../db/settings';

export const TEMPLATE_VERSION = 2;

type Row = [exercise: string, sets: number, repMin: number, repMax: number];
interface T { id: string; name: string; days: number; equipment: EquipmentAccess; level: Experience[]; minutes: number; plan: [string, Row[]][] }

const DEF: T[] = [
  { id: 'fb3', name: 'Full-body 3 giorni (palestra)', days: 3, equipment: 'palestra', level: ['principiante', 'intermedio'], minutes: 60, plan: [
    ['Full-body A', [['leg_press', 3, 8, 12], ['chest_press', 3, 8, 12], ['lat_larga', 3, 8, 12], ['leg_curl_seduto', 2, 10, 15], ['alzate_lat_man', 2, 12, 20]]],
    ['Full-body B', [['rdl_man', 3, 8, 12], ['panca_incl_man', 3, 8, 12], ['pulley', 3, 8, 12], ['leg_ext', 2, 10, 15], ['curl_man', 2, 10, 15]]],
    ['Full-body C', [['goblet_squat', 3, 8, 12], ['shoulder_press', 3, 8, 12], ['row_macchina', 3, 8, 12], ['calf_piedi', 2, 10, 15], ['pushdown', 2, 10, 15]]]
  ] },
  { id: 'ul4', name: 'Upper/Lower 4 giorni (palestra)', days: 4, equipment: 'palestra', level: ['intermedio', 'esperto'], minutes: 70, plan: [
    ['Upper A', [['chest_press_incl', 3, 6, 10], ['lat_larga', 3, 8, 12], ['military_man', 2, 6, 10], ['pulley', 2, 8, 12], ['alzate_lat_cavo', 2, 12, 20], ['curl_man', 2, 10, 15]]],
    ['Lower A', [['hack_squat', 3, 6, 10], ['leg_curl_seduto', 3, 10, 15], ['leg_ext', 2, 10, 15], ['calf_pressa', 3, 10, 15], ['crunch_cavo', 2, 10, 15]]],
    ['Upper B', [['panca_piana_man', 3, 6, 10], ['tbar', 3, 8, 12], ['pec_deck', 2, 10, 15], ['pulldown_unil', 2, 8, 12], ['reverse_pec', 2, 12, 20], ['pushdown', 2, 10, 15]]],
    ['Lower B', [['rdl_bil', 3, 6, 10], ['leg_press', 3, 8, 12], ['leg_curl_sdraiato', 2, 10, 15], ['calf_seduto', 3, 10, 15], ['leg_raise', 2, 8, 15]]]
  ] },
  { id: 'ulppl5', name: 'Upper/Lower + Push/Pull/Legs 5 giorni (palestra)', days: 5, equipment: 'palestra', level: ['intermedio', 'esperto'], minutes: 70, plan: [
    ['Upper', [['chest_press_incl', 3, 6, 10], ['lat_larga', 3, 8, 12], ['military_man', 2, 6, 10], ['pulley', 2, 8, 12], ['alzate_lat_man', 2, 12, 20]]],
    ['Lower', [['hack_squat', 3, 6, 10], ['rdl_bil', 2, 6, 10], ['leg_ext', 2, 10, 15], ['calf_pressa', 3, 10, 15]]],
    ['Push', [['panca_piana_man', 3, 6, 10], ['pec_deck', 2, 10, 15], ['lateral_machine', 3, 12, 20], ['pushdown', 2, 10, 15], ['estensione_cavo_testa', 2, 10, 15]]],
    ['Pull', [['pulldown_unil', 3, 8, 12], ['tbar', 3, 8, 12], ['face_pull', 2, 12, 20], ['curl_cavo_bayes', 2, 10, 15], ['curl_martello', 2, 10, 15]]],
    ['Legs', [['leg_press', 3, 8, 12], ['leg_curl_seduto', 3, 10, 15], ['bulgaro', 2, 8, 12], ['crunch_cavo', 2, 10, 15]]]
  ] },
  { id: 'casa3', name: 'Full-body 3 giorni (manubri a casa)', days: 3, equipment: 'casa_manubri', level: ['principiante', 'intermedio', 'esperto'], minutes: 45, plan: [
    ['Casa A', [['goblet_squat', 3, 8, 15], ['panca_piana_man', 3, 8, 12], ['rematore_man', 3, 8, 12], ['alzate_lat_man', 2, 12, 20], ['plank', 2, 1, 1]]],
    ['Casa B', [['rdl_man', 3, 8, 12], ['military_man', 3, 8, 12], ['piegamenti', 2, 6, 15], ['curl_martello', 2, 10, 15], ['dead_bug', 2, 8, 12]]],
    ['Casa C', [['bulgaro', 3, 8, 12], ['panca_incl_man', 3, 8, 12], ['rematore_man', 3, 8, 12], ['alzate_post_man', 2, 12, 20], ['ponte_glutei', 2, 10, 20]]]
  ] },
  { id: 'corpo3', name: 'Full-body 3 giorni (corpo libero)', days: 3, equipment: 'corpo_libero', level: ['principiante', 'intermedio'], minutes: 35, plan: [
    ['Corpo A', [['piegamenti', 3, 6, 15], ['inverted_row', 3, 6, 12], ['ponte_glutei', 3, 10, 20], ['plank', 2, 1, 1]]],
    ['Corpo B', [['dip_panca', 3, 6, 15], ['trazioni', 3, 3, 8], ['dead_bug', 2, 8, 12], ['ponte_glutei', 2, 10, 20]]],
    ['Corpo C', [['piegamenti', 3, 6, 15], ['inverted_row', 3, 6, 12], ['leg_raise', 2, 6, 12], ['plank', 2, 1, 1]]]
  ] }
];

const WEEKDAYS: Record<number, number[]> = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] };

export function templatesV2(): Program[] {
  return DEF.map((t) => ({
    id: `tpl2_${t.id}`, name: t.name, kind: 'template', isActive: false, createdAt: Date.UTC(2026, 10, 12), origin: 'catalog', catalogVersion: TEMPLATE_VERSION,
    notes: `Template dimostrativo (${t.days} giorni, circa ${t.minutes} min). Modificabile, non un piano personale validato: range e serie sono un punto di partenza.`,
    days: t.plan.map(([name, rows], i) => ({
      id: `tpl2_${t.id}_d${i}`, name, weekday: WEEKDAYS[t.days]?.[i] ?? null,
      items: rows.map(([ex, s, a, b], j) => ({
        id: `tpl2_${t.id}_d${i}_${j}`, exerciseId: `cx_${ex}`, sets: s, repMin: a, repMax: b, rirTargets: Array.from({ length: s }, () => ({ min: 1, max: 3 })),
        restSec: 150, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: j + 1, sameAs: ''
      }))
    }))
  }));
}

export interface TemplateMeta { id: string; name: string; days: number; equipment: EquipmentAccess; level: Experience[]; minutes: number }
export const TEMPLATE_META: TemplateMeta[] = DEF.map(({ id, name, days, equipment, level, minutes }) => ({ id: `tpl2_${id}`, name, days, equipment, level, minutes }));

/** Ordina i template per compatibilità con le scelte dell'onboarding (vincoli prima del gusto). */
export function rankTemplates(p: { days: number | null; equipment: EquipmentAccess | null; experience: Experience | null; minutes: number | null }) {
  const allowedEq = p.equipment === 'corpo_libero' ? ['corpo_libero'] : p.equipment === 'casa_manubri' ? ['casa_manubri', 'corpo_libero'] : ['palestra', 'casa_manubri', 'corpo_libero'];
  return TEMPLATE_META.filter((t) => allowedEq.includes(t.equipment)).map((t) => {
    const reasons: string[] = [];
    let score = 0;
    if (p.days != null) { const d = Math.abs(t.days - p.days); score -= d * 2; reasons.push(d === 0 ? `${t.days} giorni come richiesto` : `${t.days} giorni (tu: ${p.days})`); }
    if (p.experience && t.level.includes(p.experience)) { score += 1; reasons.push('adatto al tuo livello'); }
    if (p.minutes != null) { if (t.minutes <= p.minutes) { score += 1; reasons.push(`~${t.minutes} min a seduta`); } else { score -= 1; reasons.push(`~${t.minutes} min: più lungo del tuo tempo`); } }
    if (p.equipment === 'palestra' && t.equipment === 'palestra') score += 1;
    return { ...t, score, reasons };
  }).sort((a, b) => b.score - a.score);
}
