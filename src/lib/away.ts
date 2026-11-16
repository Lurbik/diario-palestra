// UN SOLO criterio per i pasti fuori casa, usato da Oggi, Settimana, filtri ricette, Spuntino e porzioni pronte.
// Domande distinte, mai fuse:
// - "posso portarlo?"             → ricetta trasportabile (r.portable)
// - "si tiene fuori frigo?"       → r.ambient: 'ok' solo con una fonte; 'not_verified' ≠ 'requires_cold'
// - "ho freddo nel tragitto?"     → borsa termica dichiarata dall'utente
// - "ho un frigo a destinazione?" → informazione utile, ma NON rende sicuro il tragitto né trasportabile un piatto
import type { Recipe } from '../db/types';
import type { DayType } from '../db/settings';

export type Ambient = 'ok' | 'requires_cold' | 'not_verified';

export const ambientOf = (r: Pick<Recipe, 'ambient' | 'needsColdChain'>): Ambient =>
  r.ambient === 'ok' && !r.needsColdChain ? 'ok' : r.ambient === 'requires_cold' || r.needsColdChain ? 'requires_cold' : 'not_verified';

export interface AwayContext {
  /** borsa termica (con ghiaccio) nel tragitto */
  coolerBag: 'si' | 'no' | null;
  /** frigo a destinazione */
  fridgeAway: 'si' | 'no' | null;
}

export const awayContextFrom = (p: { coolerBag: 'si' | 'no' | null; fridgeAway: 'si' | 'no' | null }): AwayContext => ({ coolerBag: p.coolerBag, fridgeAway: p.fridgeAway });

/** Il freddo è garantito per il trasporto solo con la borsa termica: un frigo al lavoro non copre il tragitto. */
export const coldAvailable = (c: AwayContext) => c.coolerBag === 'si';

/** Quali pasti si consumano fuori casa: stessa regola per Oggi e per la Settimana. */
export const isAwaySlot = (dayType: DayType, slot: string) => dayType === 'universita' && (slot === 'spuntino_mattina' || slot === 'pranzo');

export type AwayCheck = { ok: true; reason: string } | { ok: false; code: 'not_portable' | 'requires_cold' | 'not_verified'; reason: string };

/** Idoneità di una ricetta per un pasto fuori casa. */
export function awayCheck(r: Pick<Recipe, 'portable' | 'ambient' | 'needsColdChain'>, c: AwayContext): AwayCheck {
  if (!r.portable) return { ok: false, code: 'not_portable', reason: 'non trasportabile' };
  const a = ambientOf(r);
  if (a === 'ok') return { ok: true, reason: 'si tiene fuori frigo secondo la fonte (confezioni integre)' };
  if (coldAvailable(c)) return { ok: true, reason: `va tenuto al freddo: usi la borsa termica${c.fridgeAway === 'si' ? ' e a destinazione hai un frigo' : ''}` };
  if (a === 'requires_cold') return { ok: false, code: 'requires_cold', reason: c.fridgeAway === 'si' ? 'richiede freddo anche nel tragitto: serve la borsa termica' : 'richiede freddo: serve la borsa termica' };
  return { ok: false, code: 'not_verified', reason: 'conservazione fuori frigo non verificata: trattata come da tenere al freddo' };
}
