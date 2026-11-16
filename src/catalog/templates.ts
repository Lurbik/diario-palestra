// Template di schede NEUTRI basati sul catalogo. Modificabili, non piani personali validati.
import type { Program } from '../db/types';
import { EXERCISE_CATALOG } from './exercises';
import { estimateDayMinutes } from '../lib/duration';
import type { EquipmentAccess, Experience } from '../db/settings';

export const TEMPLATE_VERSION = 4;

type Row = [exercise: string, sets: number, repMin: number, repMax: number];
/** minutes = valore storico indicativo: la durata mostrata è CALCOLATA (vedi lib/duration). path = durata del percorso. */
interface T { id: string; name: string; days: number; equipment: EquipmentAccess; level: Experience[]; minutes: number; plan: [string, Row[]][]; length?: 'breve' | 'estesa'; path?: string }

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
    ['Casa A', [['goblet_squat', 3, 8, 15], ['panca_piana_man', 3, 8, 12], ['rematore_man', 3, 8, 12], ['alzate_lat_man', 2, 12, 20], ['plank', 2, 20, 45]]],
    ['Casa B', [['rdl_man', 3, 8, 12], ['military_man', 3, 8, 12], ['piegamenti', 2, 6, 15], ['curl_martello', 2, 10, 15], ['dead_bug', 2, 8, 12]]],
    ['Casa C', [['bulgaro', 3, 8, 12], ['panca_incl_man', 3, 8, 12], ['rematore_man', 3, 8, 12], ['alzate_post_man', 2, 12, 20], ['ponte_glutei', 2, 10, 20]]]
  ] },
  { id: 'corpo3', name: 'Full-body 3 giorni (corpo libero)', days: 3, equipment: 'corpo_libero', level: ['principiante', 'intermedio'], minutes: 35, plan: [
    ['Corpo A', [['piegamenti', 3, 6, 15], ['inverted_row', 3, 6, 12], ['ponte_glutei', 3, 10, 20], ['plank', 2, 20, 45]]],
    ['Corpo B', [['dip_panca', 3, 6, 15], ['trazioni', 3, 3, 8], ['dead_bug', 2, 8, 12], ['ponte_glutei', 2, 10, 20]]],
    ['Corpo C', [['piegamenti', 3, 6, 15], ['inverted_row', 3, 6, 12], ['leg_raise', 2, 6, 12], ['plank', 2, 20, 45]]]
  ] },
  // ---- Lotto 2026-11: strutture da 2 a 6 giorni (proposte editoriali completate con serie, range e recuperi).
  // Volume per muscolo volutamente moderato nelle versioni brevi: il rapporto dose-risposta è graduale
  // (Pelland 2025) e una scheda che entra nella settimana vale più di una ottimale che si salta.
  { id: 'full2', name: 'Full body A/B su 2 giorni (palestra)', days: 2, equipment: 'palestra', level: ['principiante', 'intermedio'], minutes: 60, plan: [
    ['Full body A', [['leg_press', 3, 8, 12], ['chest_press', 3, 8, 12], ['lat_larga', 3, 8, 12], ['leg_curl_seduto', 3, 10, 15], ['alzate_lat_cavo', 3, 12, 20]]],
    ['Full body B', [['hack_squat', 3, 6, 10], ['panca_incl_man', 3, 8, 12], ['pulley', 3, 8, 12], ['rdl_man', 3, 8, 12], ['crunch_cavo', 2, 10, 15]]]
  ] },
  { id: 'casa2', name: 'Casa con manubri, 2 giorni', days: 2, equipment: 'casa_manubri', level: ['principiante', 'intermedio', 'esperto'], minutes: 45, plan: [
    ['Casa A', [['goblet_squat', 3, 8, 15], ['piegamenti', 3, 6, 15], ['rematore_man', 3, 8, 12], ['rdl_man', 3, 8, 12], ['dead_bug', 2, 8, 12]]],
    ['Casa B', [['affondi', 3, 8, 12], ['military_man', 3, 8, 12], ['rematore_man', 3, 8, 12], ['ponte_glutei', 3, 10, 20], ['curl_martello', 2, 10, 15]]]
  ] },
  { id: 'macchine3', name: 'Macchine essenziali, 3 sedute brevi', days: 3, equipment: 'palestra', level: ['principiante'], minutes: 35, plan: [
    ['Macchine A', [['leg_press', 3, 8, 12], ['chest_press', 3, 8, 12], ['lat_larga', 3, 8, 12]]],
    ['Macchine B', [['leg_curl_seduto', 3, 10, 15], ['shoulder_press', 3, 8, 12], ['pulley', 3, 8, 12]]],
    ['Macchine C', [['hack_squat', 3, 8, 12], ['chest_press_incl', 3, 8, 12], ['row_macchina', 3, 8, 12]]]
  ] },
  { id: 'ul4breve', name: 'Upper/Lower compatto, 4 giorni', days: 4, equipment: 'palestra', level: ['intermedio', 'esperto'], minutes: 40, plan: [
    ['Upper A', [['chest_press_incl', 3, 6, 10], ['lat_larga', 3, 8, 12], ['alzate_lat_cavo', 3, 12, 20]]],
    ['Lower A', [['hack_squat', 3, 6, 10], ['leg_curl_seduto', 3, 10, 15], ['calf_pressa', 3, 10, 15]]],
    ['Upper B', [['panca_incl_mp', 3, 6, 10], ['tbar', 3, 8, 12], ['reverse_pec', 3, 12, 20]]],
    ['Lower B', [['rdl_bil', 3, 6, 10], ['leg_ext', 3, 10, 15], ['crunch_cavo', 3, 10, 15]]]
  ] },
  { id: 'rot5', name: 'Cinque sedute in rotazione: torso, gambe A, spalle/braccia, gambe B, upper', days: 5, equipment: 'palestra', level: ['intermedio', 'esperto'], minutes: 60, plan: [
    ['Torso', [['chest_press_incl', 3, 6, 10], ['pulldown_unil', 3, 8, 12], ['pec_deck', 2, 10, 15], ['tbar', 3, 8, 12]]],
    ['Gambe A', [['hack_squat', 3, 6, 10], ['leg_curl_seduto', 3, 10, 15], ['leg_ext', 2, 10, 15], ['calf_pressa', 3, 10, 15], ['crunch_allungamento', 2, 8, 15]]],
    ['Spalle e braccia', [['military_mp', 3, 6, 10], ['curl_scott', 2, 8, 12], ['estensione_cavo_testa', 2, 10, 15], ['alzate_lat_panca', 3, 12, 20], ['reverse_pec', 2, 12, 20]]],
    ['Gambe B', [['rdl_bil', 3, 6, 10], ['leg_ext', 2, 10, 15], ['leg_curl_sdraiato', 3, 10, 15], ['calf_pressa', 3, 10, 15], ['crunch_cavo', 2, 10, 15]]],
    ['Upper', [['panca_incl_mp', 3, 6, 10], ['lat_larga', 3, 8, 12], ['curl_cavo_bayes', 2, 10, 15], ['jm_press_mp', 2, 8, 12], ['alzate_lat_man', 3, 12, 20]]]
  ] },
  { id: 'ppl6', name: 'Push/Pull/Legs A/B, 6 sedute brevi', days: 6, equipment: 'palestra', level: ['intermedio', 'esperto'], minutes: 45, plan: [
    ['Push A', [['chest_press_incl', 3, 6, 10], ['shoulder_press', 3, 8, 12], ['pushdown', 3, 10, 15]]],
    ['Pull A', [['lat_larga', 3, 8, 12], ['tbar', 3, 8, 12], ['curl_scott', 3, 8, 12]]],
    ['Legs A', [['hack_squat', 3, 6, 10], ['leg_curl_seduto', 3, 10, 15], ['calf_pressa', 3, 10, 15]]],
    ['Push B', [['chest_press', 3, 8, 12], ['alzate_lat_cavo', 3, 12, 20], ['estensione_cavo_testa', 3, 10, 15]]],
    ['Pull B', [['pulley', 3, 8, 12], ['pulldown_unil', 2, 8, 12], ['reverse_pec', 3, 12, 20], ['curl_martello', 2, 10, 15]]],
    ['Legs B', [['rdl_man', 3, 8, 12], ['leg_press', 3, 8, 12], ['leg_ext', 2, 10, 15], ['crunch_cavo', 2, 10, 15]]]
  ] },
  // ---- Lotto 2026-11-b: opzione breve ed estesa per ogni frequenza (durate calcolate da serie, recuperi, avvicinamenti, transizioni)
  { id: 'full2_breve', name: 'Full body 2 giorni, breve (palestra)', days: 2, equipment: 'palestra', level: ['principiante', 'intermedio', 'esperto'], minutes: 35, length: 'breve', plan: [
    ['Breve A', [['leg_press', 2, 8, 12], ['chest_press', 2, 8, 12], ['lat_larga', 2, 8, 12], ['alzate_lat_cavo', 2, 12, 20]]],
    ['Breve B', [['hack_squat', 2, 6, 10], ['panca_incl_man', 2, 8, 12], ['pulley', 2, 8, 12], ['leg_curl_seduto', 2, 10, 15]]]
  ] },
  { id: 'full2_estesa', name: 'Full body 2 giorni, estesa (palestra)', days: 2, equipment: 'palestra', level: ['intermedio', 'esperto'], minutes: 75, length: 'estesa', plan: [
    ['Estesa A', [['hack_squat', 3, 6, 10], ['chest_press_incl', 3, 6, 10], ['lat_larga', 3, 8, 12], ['rdl_man', 3, 8, 12], ['alzate_lat_cavo', 3, 12, 20], ['curl_man', 2, 10, 15], ['pushdown', 2, 10, 15]]],
    ['Estesa B', [['leg_press', 3, 8, 12], ['panca_piana_man', 3, 6, 10], ['row_macchina', 3, 8, 12], ['leg_curl_seduto', 3, 10, 15], ['reverse_pec', 2, 12, 20], ['calf_pressa', 3, 10, 15], ['crunch_cavo', 2, 10, 15]]]
  ] },
  { id: 'corpo2', name: 'Corpo libero 2 giorni, breve', days: 2, equipment: 'corpo_libero', level: ['principiante', 'intermedio'], minutes: 30, length: 'breve', plan: [
    ['Corpo A', [['piegamenti', 3, 6, 15], ['inverted_row', 3, 6, 12], ['ponte_glutei', 3, 10, 20], ['plank', 2, 20, 45]]],
    ['Corpo B', [['dip_panca', 3, 6, 15], ['trazioni_assistite', 3, 5, 10], ['dead_bug', 2, 8, 12], ['side_plank', 2, 15, 40]]]
  ] },
  { id: 'fb3_estesa', name: 'Full-body 3 giorni, estesa (palestra)', days: 3, equipment: 'palestra', level: ['intermedio', 'esperto'], minutes: 70, length: 'estesa', plan: [
    ['Estesa A', [['hack_squat', 3, 6, 10], ['chest_press', 3, 8, 12], ['lat_larga', 3, 8, 12], ['leg_curl_seduto', 3, 10, 15], ['alzate_lat_cavo', 3, 12, 20], ['curl_cavo_bayes', 2, 10, 15], ['calf_pressa', 3, 10, 15]]],
    ['Estesa B', [['rdl_bil', 3, 6, 10], ['panca_incl_man', 3, 8, 12], ['pulley', 3, 8, 12], ['leg_ext', 3, 10, 15], ['reverse_pec', 2, 12, 20], ['estensione_cavo_testa', 2, 10, 15], ['crunch_cavo', 2, 10, 15]]],
    ['Estesa C', [['leg_press', 3, 8, 12], ['shoulder_press', 3, 8, 12], ['tbar', 3, 8, 12], ['bulgaro', 2, 8, 12], ['calf_pressa', 3, 10, 15], ['crunch_cavo', 2, 10, 15], ['curl_martello', 2, 10, 15]]]
  ] },
  { id: 'ul4_estesa', name: 'Upper/Lower 4 giorni, estesa (palestra)', days: 4, equipment: 'palestra', level: ['intermedio', 'esperto'], minutes: 75, length: 'estesa', plan: [
    ['Upper A', [['chest_press_incl', 3, 6, 10], ['lat_larga', 3, 8, 12], ['military_man', 3, 6, 10], ['row_macchina', 3, 8, 12], ['alzate_lat_cavo', 3, 12, 20], ['curl_man', 2, 10, 15], ['pushdown', 2, 10, 15]]],
    ['Lower A', [['hack_squat', 3, 6, 10], ['rdl_man', 3, 8, 12], ['leg_curl_seduto', 3, 10, 15], ['leg_ext', 2, 10, 15], ['calf_pressa', 3, 10, 15], ['crunch_cavo', 2, 10, 15]]],
    ['Upper B', [['panca_piana_man', 3, 6, 10], ['tbar', 3, 8, 12], ['shoulder_press', 2, 8, 12], ['pulldown_unil', 3, 8, 12], ['reverse_pec', 3, 12, 20], ['curl_inclinata', 2, 10, 15], ['estensione_cavo_testa', 2, 10, 15]]],
    ['Lower B', [['rdl_bil', 3, 6, 10], ['leg_press', 3, 8, 12], ['leg_curl_sdraiato', 3, 10, 15], ['bulgaro', 2, 8, 12], ['calf_seduto', 3, 10, 15], ['leg_raise', 2, 8, 15]]]
  ] },
  { id: 'casa4', name: 'Casa con manubri, 4 giorni', days: 4, equipment: 'casa_manubri', level: ['principiante', 'intermedio', 'esperto'], minutes: 45, plan: [
    ['Upper A', [['panca_piana_man', 3, 8, 12], ['rematore_man', 3, 8, 12], ['military_man', 2, 8, 12], ['alzate_lat_man', 2, 12, 20], ['curl_martello', 2, 10, 15]]],
    ['Lower A', [['goblet_squat', 3, 8, 15], ['rdl_man', 3, 8, 12], ['split_squat', 2, 8, 12], ['ponte_glutei', 2, 10, 20]]],
    ['Upper B', [['panca_incl_man', 3, 8, 12], ['pullover_man', 2, 10, 15], ['rematore_man', 3, 8, 12], ['alzate_post_man', 2, 12, 20], ['curl_inclinata', 2, 10, 15]]],
    ['Lower B', [['bulgaro', 3, 8, 12], ['step_up', 2, 8, 12], ['rdl_man', 2, 8, 12], ['dead_bug', 2, 8, 12], ['side_plank', 2, 15, 40]]]
  ] },
  { id: 'freq5_breve', name: 'Cinque sedute brevi, frequenza distribuita', days: 5, equipment: 'palestra', level: ['intermedio', 'esperto'], minutes: 35, length: 'breve', plan: [
    ['Spinta e gambe', [['chest_press', 2, 8, 12], ['leg_press', 2, 8, 12], ['alzate_lat_cavo', 2, 12, 20]]],
    ['Tirata e posteriori', [['lat_larga', 2, 8, 12], ['leg_curl_seduto', 2, 10, 15], ['curl_man', 2, 10, 15]]],
    ['Spinta e quadricipiti', [['panca_incl_man', 2, 8, 12], ['hack_squat', 2, 6, 10], ['pushdown', 2, 10, 15]]],
    ['Tirata e anca', [['row_macchina', 2, 8, 12], ['rdl_man', 2, 8, 12], ['reverse_pec', 2, 12, 20]]],
    ['Misto', [['shoulder_press', 2, 8, 12], ['pulldown_unil', 2, 8, 12], ['calf_pressa', 2, 10, 15], ['crunch_cavo', 2, 10, 15]]]
  ] },
  { id: 'rot5_estesa', name: 'Cinque sedute in rotazione, estesa', days: 5, equipment: 'palestra', level: ['esperto'], minutes: 70, length: 'estesa', plan: [
    ['Torso', [['chest_press_incl', 3, 6, 10], ['pulldown_unil', 3, 8, 12], ['pec_deck', 3, 10, 15], ['tbar', 3, 8, 12], ['face_pull', 2, 12, 20], ['croci_cavi', 3, 10, 15], ['row_cavo_unil', 2, 8, 12]]],
    ['Gambe A', [['hack_squat', 3, 6, 10], ['leg_curl_seduto', 3, 10, 15], ['leg_ext', 3, 10, 15], ['calf_pressa', 3, 10, 15], ['crunch_allungamento', 3, 8, 15], ['adductor', 2, 10, 15], ['bulgaro', 2, 8, 12]]],
    ['Spalle e braccia', [['military_mp', 3, 6, 10], ['alzate_lat_panca', 3, 12, 20], ['reverse_pec', 3, 12, 20], ['curl_scott', 3, 8, 12], ['estensione_cavo_testa', 3, 10, 15], ['curl_martello', 2, 10, 15], ['pushdown', 2, 10, 15]]],
    ['Gambe B', [['rdl_bil', 3, 6, 10], ['leg_press', 3, 8, 12], ['leg_curl_sdraiato', 3, 10, 15], ['calf_seduto', 3, 10, 15], ['crunch_cavo', 2, 10, 15], ['hip_thrust', 3, 8, 12], ['leg_ext', 2, 10, 15]]],
    ['Upper', [['panca_incl_mp', 3, 6, 10], ['lat_larga', 3, 8, 12], ['row_cavo_unil', 2, 8, 12], ['curl_cavo_bayes', 3, 10, 15], ['jm_press_mp', 3, 8, 12], ['alzate_lat_cavo', 3, 12, 20], ['reverse_pec', 2, 12, 20]]]
  ] },
  { id: 'ppl6_estesa', name: 'Push/Pull/Legs A/B, 6 sedute estese', days: 6, equipment: 'palestra', level: ['esperto'], minutes: 60, length: 'estesa', plan: [
    ['Push A', [['chest_press_incl', 3, 6, 10], ['shoulder_press', 3, 8, 12], ['pec_deck', 2, 10, 15], ['alzate_lat_cavo', 3, 12, 20], ['pushdown', 2, 10, 15], ['estensione_cavo_testa', 2, 10, 15]]],
    ['Pull A', [['lat_larga', 3, 8, 12], ['tbar', 3, 8, 12], ['reverse_pec', 2, 12, 20], ['curl_scott', 3, 8, 12], ['row_cavo_unil', 2, 8, 12], ['curl_martello', 2, 10, 15]]],
    ['Legs A', [['hack_squat', 3, 6, 10], ['leg_curl_seduto', 3, 10, 15], ['leg_ext', 2, 10, 15], ['calf_pressa', 3, 10, 15], ['bulgaro', 2, 8, 12], ['crunch_cavo', 2, 10, 15]]],
    ['Push B', [['panca_piana_man', 3, 6, 10], ['military_man', 2, 8, 12], ['alzate_lat_panca', 3, 12, 20], ['estensione_cavo_testa', 3, 10, 15], ['pec_deck', 2, 10, 15], ['pushdown', 2, 10, 15]]],
    ['Pull B', [['pulley', 3, 8, 12], ['pulldown_unil', 3, 8, 12], ['face_pull', 2, 12, 20], ['curl_martello', 3, 10, 15], ['high_row', 2, 8, 12], ['curl_inclinata', 2, 10, 15]]],
    ['Legs B', [['rdl_bil', 3, 6, 10], ['leg_press', 3, 8, 12], ['leg_curl_sdraiato', 2, 10, 15], ['calf_seduto', 3, 10, 15], ['crunch_cavo', 2, 10, 15], ['hip_thrust', 2, 8, 12]]]
  ] }
];

const WEEKDAYS: Record<number, number[]> = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] };

export function templatesV2(): Program[] {
  return DEF.map((t) => ({
    id: `tpl2_${t.id}`, name: t.name, kind: 'template', isActive: false, createdAt: Date.UTC(2026, 10, 12), origin: 'catalog', catalogVersion: TEMPLATE_VERSION,
    notes: `Template dimostrativo (${t.days} giorni, circa ${TEMPLATE_META.find((m) => m.id === `tpl2_${t.id}`)?.minutesRange.join('–')} min a seduta, stima calcolata). Modificabile, non un piano personale validato: range e serie sono un punto di partenza.`,
    days: t.plan.map(([name, rows], i) => ({
      id: `tpl2_${t.id}_d${i}`, name, weekday: WEEKDAYS[t.days]?.[i] ?? null,
      items: rows.map(([ex, s, a, b], j) => ({
        id: `tpl2_${t.id}_d${i}_${j}`, exerciseId: `cx_${ex}`, sets: s, repMin: a, repMax: b, rirTargets: Array.from({ length: s }, () => ({ min: 1, max: 3 })),
        // recupero di partenza: più lungo per i multiarticolari a ripetizioni basse (Singer 2024: recuperi brevi non aiutano l'ipertrofia)
        restSec: a >= 10 ? 90 : 150, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: j + 1, sameAs: ''
      }))
    }))
  }));
}

export interface TemplateMeta { id: string; name: string; days: number; equipment: EquipmentAccess; level: Experience[]; minutes: number; minutesRange: [number, number]; length: 'breve' | 'estesa' | 'media'; path: string }
const CLS = new Map(EXERCISE_CATALOG.map((e) => [e.id, e.policyClass]));
/** Durata CALCOLATA per giorno (serie, recuperi, avvicinamenti, transizioni, riscaldamento): mai l'etichetta dichiarata. */
export const TEMPLATE_META: TemplateMeta[] = DEF.map(({ id, name, days, equipment, level, plan, length, path }) => {
  const mins = plan.map(([, rows]) => estimateDayMinutes(rows.map(([ex, s, a]) => ({ exerciseId: `cx_${ex}`, sets: s, restSec: a >= 10 ? 90 : 150 })), (x) => CLS.get(x)));
  const max = Math.max(...mins), min = Math.min(...mins);
  return { id: `tpl2_${id}`, name, days, equipment, level, minutes: max, minutesRange: [min, max] as [number, number], length: length ?? (max <= 45 ? 'breve' : max >= 60 ? 'estesa' : 'media'), path: path ?? 'Continua senza scadenza finché progredisci e ti è comoda; revisione facoltativa ogni 8–12 settimane (preferenza di pianificazione, non una data di decadenza).' };
});

/** Ordina i template per compatibilità con le scelte dell'onboarding (vincoli prima del gusto). */
export function rankTemplates(p: { days: number | null; equipment: EquipmentAccess | null; experience: Experience | null; minutes: number | null }) {
  const allowedEq = p.equipment === 'corpo_libero' ? ['corpo_libero'] : p.equipment === 'casa_manubri' ? ['casa_manubri', 'corpo_libero'] : ['palestra', 'casa_manubri', 'corpo_libero'];
  return TEMPLATE_META.filter((t) => allowedEq.includes(t.equipment)).map((t) => {
    const reasons: string[] = [];
    let score = 0;
    if (p.days != null) { const d = Math.abs(t.days - p.days); score -= d * 2; reasons.push(d === 0 ? `${t.days} giorni come richiesto` : `${t.days} giorni (tu: ${p.days})`); }
    if (p.experience && t.level.includes(p.experience)) { score += 1; reasons.push('adatto al tuo livello'); }
    if (p.minutes != null) { if (t.minutes <= p.minutes) { score += 1 + t.minutes / p.minutes; reasons.push(`~${t.minutes} min a seduta`); } else { score -= 1; reasons.push(`~${t.minutes} min: più lungo del tuo tempo`); } }
    if (p.equipment === 'palestra' && t.equipment === 'palestra') score += 1;
    return { ...t, score, reasons };
  }).sort((a, b) => b.score - a.score);
}
