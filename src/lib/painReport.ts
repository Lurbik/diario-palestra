// Segnalazione di fastidio o dolore durante una serie: dati riferiti dall'utente, salvati solo sul dispositivo.
// Nessuna diagnosi, nessuna terapia, nessun esercizio "sicuro" per un'articolazione.
// Criteri generali di urgenza da fonti pubbliche (NHS: dolore articolare; mal di schiena), riformulati.

export type PainZone = 'polso' | 'gomito' | 'spalla' | 'schiena' | 'anca' | 'ginocchio' | 'caviglia' | 'altro';
export type PainSide = 'sx' | 'dx' | 'entrambi' | 'centrale' | 'non_so';
export interface PainDetail { zone: PainZone | null; side: PainSide | null; onset: 'durante' | 'dopo' | null; intensity: number | null; note: string }

export const ZONE_LABEL: Record<PainZone, string> = { polso: 'Polso', gomito: 'Gomito', spalla: 'Spalla', schiena: 'Schiena', anca: 'Anca', ginocchio: 'Ginocchio', caviglia: 'Caviglia', altro: 'Altro' };
export const SIDE_LABEL: Record<PainSide, string> = { sx: 'Sinistra', dx: 'Destra', entrambi: 'Entrambi', centrale: 'Centrale', non_so: 'Non so' };

export const emptyPain = (): PainDetail => ({ zone: null, side: null, onset: null, intensity: null, note: '' });

/** Testo breve della segnalazione; i campi ignoti non vengono inventati. */
export function painLabel(d: PainDetail | undefined | null): string {
  if (!d) return 'dettagli non indicati';
  const parts = [d.zone ? ZONE_LABEL[d.zone].toLowerCase() : null, d.side && d.side !== 'non_so' ? SIDE_LABEL[d.side].toLowerCase() : null, d.onset, d.intensity != null ? `${d.intensity}/10` : null].filter(Boolean);
  return parts.length ? parts.join(', ') : 'dettagli non indicati';
}

/** Segnali per cui chiedere assistenza: diversi per articolazioni e schiena (niente avviso lombare sul polso). */
export function urgentSigns(zone: PainZone | null): string {
  if (zone === 'schiena') return 'Chiedi assistenza urgente se compaiono perdita di sensibilità nella zona genitale o tra le gambe, nuove difficoltà a urinare o a trattenere urina e feci, o debolezza importante alle gambe. Un dolore che non migliora o peggiora va fatto valutare.';
  return 'Chiedi assistenza urgente dopo un trauma se non riesci a caricare il peso o a muovere l\'articolazione, se c\'è una deformità evidente, o se l\'articolazione è calda, gonfia e hai febbre. Un dolore che persiste o ritorna va fatto valutare da un professionista.';
}
