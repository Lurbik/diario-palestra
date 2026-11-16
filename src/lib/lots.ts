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

/**
 * Dispensa VIRTUALE per pianificare senza toccare quella reale.
 * Ogni lotto resta distinto con la sua scadenza: una quantità è disponibile in un giorno solo se il lotto
 * è utilizzabile IN QUEL GIORNO (data effettiva di preparazione), non oggi. Le riserve scalano in ordine FEFO
 * fra i lotti utilizzabili a quella data.
 */
export class VirtualPantry {
  private rem: { key: string; qty: number; expiry: string | null; expiryType: StockLot['expiryType'] }[];
  constructor(lots: StockLot[]) {
    this.rem = lots.filter((l) => l.qty > 1e-9).sort(fefo).map((l) => ({ key: `${l.foodId}|${l.unit}`, qty: l.qty, expiry: l.expiry, expiryType: l.expiryType }));
  }
  clone(): VirtualPantry { const v = Object.create(VirtualPantry.prototype) as VirtualPantry; v.rem = this.rem.map((x) => ({ ...x })); return v; }
  private usableOn(x: { qty: number; expiry: string | null; expiryType: StockLot['expiryType'] }, day: string) { return lotStatus(x, day) === 'usable'; }
  /** Quantità utilizzabile per chiave alimento|unità nel giorno indicato. */
  available(day: string): Map<string, number> {
    const m = new Map<string, number>();
    for (const x of this.rem) if (this.usableOn(x, day)) m.set(x.key, (m.get(x.key) ?? 0) + x.qty);
    return m;
  }
  /** Riserva le quantità nel giorno indicato; ritorna il mancante per chiave. */
  reserve(needs: Map<string, number>, day: string): Map<string, number> {
    const missing = new Map<string, number>();
    for (const [k, q] of needs) {
      let left = q;
      for (const x of this.rem) {
        if (left <= 1e-9) break;
        if (x.key !== k || !this.usableOn(x, day)) continue;
        const take = Math.min(x.qty, left);
        x.qty -= take; left -= take;
      }
      if (left > 1e-9) missing.set(k, left);
    }
    return missing;
  }
}
