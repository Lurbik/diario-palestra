// Utilizzabilità dei lotti in dispensa.
// - "Da consumarsi entro" (use_by) superato → NON utilizzabile, mai proposto.
// - "Preferibilmente entro" (best_before) superato, o tipo di scadenza ignoto e data passata →
//   "da valutare": non proposto automaticamente, resta visibile per una decisione esplicita.
// - Quantità ≤ 0 → esaurito.
import type { StockLot } from '../db/types';
import { addDays } from './dates';

export type LotStatus = 'usable' | 'review' | 'unsafe' | 'empty';

export function lotStatus(l: Pick<StockLot, 'qty' | 'expiry' | 'expiryType'>, today: string): LotStatus {
  if (!(l.qty > 1e-9)) return 'empty';
  if (!l.expiry || l.expiry >= today) return 'usable';
  if (l.expiryType === 'use_by') return 'unsafe';
  return 'review';
}

export function usableLots(lots: StockLot[], today: string) { return lots.filter((l) => lotStatus(l, today) === 'usable'); }

/** Lotti utilizzabili in scadenza entro `days` giorni (date passate escluse). */
export function expiringSoon(lots: StockLot[], today: string, days = 3) {
  const limit = addDays(today, days);
  return usableLots(lots, today).filter((l) => l.expiry && l.expiry >= today && l.expiry <= limit);
}

/** Ordine FEFO: prima le scadenze più vicine, poi i lotti senza data. */
export function fefo(a: StockLot, b: StockLot) { return (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999'); }
