// Dal suggerimento mostrato al carico effettivamente salvato e poi precompilato in seduta.
// - "Applica X kg": scrive X SOLO se la proposta è un vero aumento numerico.
// - "Mantieni": cancella un eventuale carico accettato in precedenza → in seduta si riparte dal carico usato.
// - "Modifica": scrive solo un numero scelto esplicitamente dall'utente.
// - "Rivedi" / "Raccogli dati" / consolidamento: nessuna scrittura di carichi.
// - Nessuna modifica alla scheda: si agisce solo sulla precompilazione della configurazione (configKey).
import type { Suggestion } from './progression';

export interface AcceptedLoad { load: number; at: number; previousLoad: number | null; ruleId: string }

export type LoadWrite = { action: 'set'; value: AcceptedLoad } | { action: 'clear' } | { action: 'none' };

export function loadWriteFor(sug: Pick<Suggestion, 'kind' | 'proposedLoad' | 'ruleId' | 'currentLoad'>, decision: 'accepted' | 'kept' | 'modified', at: number, chosenLoad?: number | null): LoadWrite {
  if (decision === 'kept') return sug.kind === 'increase' || sug.kind === 'consolidate' ? { action: 'clear' } : { action: 'none' };
  if (decision === 'accepted') {
    if (sug.kind === 'increase' && sug.proposedLoad != null) return { action: 'set', value: { load: sug.proposedLoad, at, previousLoad: sug.currentLoad ?? null, ruleId: sug.ruleId } };
    return { action: 'none' };
  }
  if (decision === 'modified' && chosenLoad != null && chosenLoad > 0) return { action: 'set', value: { load: chosenLoad, at, previousLoad: sug.currentLoad ?? null, ruleId: 'manual' } };
  return { action: 'none' };
}

/**
 * Carico precompilato all'apertura di un esercizio (sempre da confermare con "Salva serie").
 * Ordine: serie già fatta oggi → carico accettato più recente dell'ultima seduta → carico dell'ultima seduta.
 */
export function prefillLoad(args: {
  lastHereLoad: number | null;
  previous: { startedAt: number; dateLabel: string; firstWorkingLoad: number | null } | null;
  accepted: AcceptedLoad | { load: number; at: number } | null;
}): { load: number | null; from: string | null } {
  if (args.lastHereLoad != null) return { load: args.lastHereLoad, from: 'serie precedente di oggi' };
  if (args.accepted && (!args.previous || args.accepted.at > args.previous.startedAt)) return { load: args.accepted.load, from: 'proposta accettata, da confermare' };
  if (args.previous?.firstWorkingLoad != null) return { load: args.previous.firstWorkingLoad, from: `seduta del ${args.previous.dateLabel}` };
  return { load: null, from: null };
}
