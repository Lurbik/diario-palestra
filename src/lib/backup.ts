// Backup completo versionato, importazione con anteprima e gestione duplicati,
// esportazione cifrata (PBKDF2-SHA256 + AES-GCM tramite Web Crypto). La password non viene salvata.
import { db, SCHEMA_VERSION } from '../db/db';
import type { Attachment } from '../db/types';

export const BACKUP_FORMAT = 'diario-backup';
export const BACKUP_FORMAT_VERSION = 1;
export const ENC_FORMAT = 'diario-backup-cifrato';
const PBKDF2_ITERATIONS = 600_000;

export const TABLE_NAMES = [
  'machines', 'exercises', 'programs', 'sessions', 'sets', 'pain', 'foods', 'recipes', 'stock', 'batches', 'stockTx',
  'diary', 'plan', 'shopping', 'weights', 'waist', 'sleep', 'targets', 'decisions', 'attachments', 'kv'
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const keyOf = (t: TableName) => (t === 'kv' ? 'key' : 'id');

export async function exportAll(appVersion = '0'): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  await db.transaction('r', TABLE_NAMES.map((t) => db.table(t)), async () => {
    for (const t of TABLE_NAMES) {
      const rows = await db.table(t).toArray();
      if (t === 'attachments') {
        tables[t] = await Promise.all((rows as Attachment[]).map(async (a) => ({
          id: a.id, mime: a.mime, createdAt: a.createdAt, b64: bytesToB64(new Uint8Array(await a.blob.arrayBuffer()))
        })));
      } else tables[t] = rows;
    }
  });
  return { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, schemaVersion: SCHEMA_VERSION, appVersion, exportedAt: new Date().toISOString(), tables };
}

export function parseBackup(text: string): BackupFile {
  let obj: unknown;
  try { obj = JSON.parse(text); } catch { throw new Error('Il file non è un JSON valido.'); }
  let b = obj as BackupFile;
  if (b?.format === (ENC_FORMAT as string)) throw new Error('Questo backup è cifrato: inserisci la password.');
  // Copia grezza / snapshot pre-migrazione dalla schermata di recupero
  const rawData = (obj as { data?: unknown; fromVersion?: number })?.fromVersion != null ? (obj as { data: unknown }).data : obj;
  if (!b?.format && rawData && typeof rawData === 'object' && Object.keys(rawData).some((k) => (TABLE_NAMES as readonly string[]).includes(k))) {
    const tables: BackupFile['tables'] = {};
    for (const t of TABLE_NAMES) {
      const rows = (rawData as Record<string, unknown[]>)[t];
      if (Array.isArray(rows)) tables[t] = t === 'attachments' ? [] : rows; // i Blob grezzi non sono serializzabili in JSON
    }
    b = { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, schemaVersion: 1, appVersion: 'recupero', exportedAt: new Date().toISOString(), tables };
  }
  if (b?.format !== BACKUP_FORMAT || typeof b.tables !== 'object') throw new Error('Il file non è un backup di questa app.');
  if (b.schemaVersion > SCHEMA_VERSION) throw new Error(`Backup creato da una versione più recente (schema ${b.schemaVersion}). Aggiorna l'app prima di importarlo.`);
  return b;
}

export interface ImportPreview { table: TableName; incoming: number; added: number; identical: number; conflicts: number }

function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b))) : val));
}

function restoreRow(t: TableName, row: Record<string, unknown>) {
  if (t !== 'attachments') return row;
  const bytes = b64ToBytes(String(row.b64));
  return { id: row.id, mime: row.mime, createdAt: row.createdAt, blob: new Blob([bytes], { type: String(row.mime) }) };
}

async function comparable(t: TableName, row: unknown): Promise<string> {
  if (t === 'attachments') {
    const a = row as Attachment;
    return stable({ id: a.id, mime: a.mime, createdAt: a.createdAt, b64: bytesToB64(new Uint8Array(await a.blob.arrayBuffer())) });
  }
  return stable(row);
}

export async function previewImport(b: BackupFile): Promise<ImportPreview[]> {
  const out: ImportPreview[] = [];
  for (const t of TABLE_NAMES) {
    const rows = (b.tables[t] ?? []) as Record<string, unknown>[];
    let added = 0, identical = 0, conflicts = 0;
    for (const r of rows) {
      const k = r[keyOf(t)] as string;
      const local = await db.table(t).get(k);
      if (!local) added++;
      else if ((await comparable(t, local)) === stable(r)) identical++;
      else conflicts++;
    }
    if (rows.length) out.push({ table: t, incoming: rows.length, added, identical, conflicts });
  }
  return out;
}

/**
 * Importa in un'unica transazione: o tutto o niente.
 * - merge: aggiunge i nuovi, ignora gli identici (nessun duplicato), conflitti secondo `onConflict`.
 * - replace: sostituisce completamente i dati locali con quelli del backup.
 */
export async function applyImport(b: BackupFile, mode: 'merge' | 'replace', onConflict: 'keep_local' | 'use_backup' = 'keep_local') {
  let written = 0;
  await db.transaction('rw', TABLE_NAMES.map((t) => db.table(t)), async () => {
    for (const t of TABLE_NAMES) {
      const rows = ((b.tables[t] ?? []) as Record<string, unknown>[]).map((r) => restoreRow(t, r));
      const table = db.table(t);
      if (mode === 'replace') {
        await table.clear();
        await table.bulkPut(rows);
        written += rows.length;
        continue;
      }
      for (const r of rows) {
        const k = r[keyOf(t)] as string;
        const local = await table.get(k);
        if (!local || onConflict === 'use_backup') {
          if (!local || (await comparable(t, local)) !== (await comparable(t, r))) { await table.put(r); written++; }
        }
      }
    }
  });
  return written;
}

// ---------- Cifratura ----------
async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(plain: string, password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  if (password.length < 8) throw new Error('Usa una password di almeno 8 caratteri.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
  return JSON.stringify({
    format: ENC_FORMAT, version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: bytesToB64(salt) },
    cipher: { name: 'AES-GCM', iv: bytesToB64(iv) },
    data: bytesToB64(ct)
  });
}

export function isEncrypted(text: string): boolean {
  try { return JSON.parse(text)?.format === ENC_FORMAT; } catch { return false; }
}

export async function decryptText(text: string, password: string): Promise<string> {
  const o = JSON.parse(text);
  if (o?.format !== ENC_FORMAT) throw new Error('File non cifrato con questo formato.');
  const key = await deriveKey(password, b64ToBytes(o.kdf.salt), o.kdf.iterations);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(o.cipher.iv) }, key, b64ToBytes(o.data));
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error('Password errata oppure file danneggiato: impossibile decifrare.');
  }
}

// ---------- CSV (separatore ";" e virgola decimale, compatibile con Excel in italiano) ----------
export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    if (v == null) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : typeof v === 'boolean' ? (v ? 'sì' : 'no') : v;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

export async function csvSets(): Promise<string> {
  const [sets, sessions, exercises] = await Promise.all([db.sets.toArray(), db.sessions.toArray(), db.exercises.toArray()]);
  const sMap = new Map(sessions.map((s) => [s.id, s]));
  const eMap = new Map(exercises.map((e) => [e.id, e]));
  const rows: (string | number | boolean | null)[][] = [[
    'data', 'seduta', 'ordine', 'esercizio', 'configurazione', 'tipo', 'carico_kg', 'convenzione', 'unilaterale_per_lato',
    'rip_complete', 'di_cui_valide', 'rip_altro_lato', 'parziali_pianificate', 'parziali_extra', 'assistite', 'tentativi_falliti',
    'rir', 'rir_non_so', 'recupero_prima_s', 'dolore', 'nota_dolore', 'problema_tecnico', 'note', 'salvata_alle'
  ]];
  for (const s of sets.sort((a, b) => a.savedAt - b.savedAt)) {
    const se = sMap.get(s.sessionId);
    rows.push([se?.dateKey ?? '', se?.title ?? '', s.order, eMap.get(s.exerciseId)?.name ?? s.exerciseId, s.configKey, s.kind === 'warmup' ? 'riscaldamento' : 'allenante',
      s.load, s.loadConvention, s.unilateral, s.fullReps, s.validReps, s.fullRepsOtherSide, s.plannedPartials, s.extraPartials, s.assistedReps, s.failedAttempts,
      s.rir, s.rirUnknown, s.restBeforeSec, s.pain, s.painNote, s.techIssue, s.notes, new Date(s.savedAt).toISOString()]);
  }
  return toCsv(rows);
}

export async function csvDiary(): Promise<string> {
  const d = await db.diary.toArray();
  const rows: (string | number | boolean | null)[][] = [['data', 'pasto', 'voce', 'tipo', 'quantita', 'unita', 'kcal', 'proteine_g', 'carboidrati_g', 'grassi_g', 'fibra_g', 'stimato']];
  for (const e of d.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.createdAt - b.createdAt)) {
    const n = e.nutrients;
    const r = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);
    rows.push([e.dateKey, e.meal, e.label, e.kind, e.qty, e.unit, r(n.kcal), r(n.protein), r(n.carbs), r(n.fat), r(n.fiber), e.estimated]);
  }
  return toCsv(rows);
}

export async function csvWeights(): Promise<string> {
  const w = await db.weights.orderBy('dateKey').toArray();
  return toCsv([['data', 'ora', 'kg', 'mattino', 'condizioni', 'annotazioni', 'note'], ...w.map((x) => [x.dateKey, x.time, x.kg, x.morning, x.conditions, x.flags.join(', '), x.note])]);
}

export async function csvSleep(): Promise<string> {
  const s = await db.sleep.orderBy('dateKey').toArray();
  return toCsv([['data_risveglio', 'a_letto', 'risveglio', 'sonno_stimato_h', 'qualita_1_5', 'sonnellino_min', 'note'], ...s.map((x) => [x.dateKey, x.bedTime, x.wakeTime, x.sleepHours, x.quality, x.napMin, x.note])]);
}

export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
