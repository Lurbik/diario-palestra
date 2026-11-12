// Segnali che richiedono valutazione sanitaria. L'app non diagnostica e non prescrive.
import type { PainEpisode } from '../db/types';

export type SafetyLevel = 'urgent' | 'medical' | 'none';

export function painSafety(p: Pick<PainEpisode, 'redFlags' | 'intensity' | 'worsening' | 'limitsActivities'>): { level: SafetyLevel; message: string } {
  if (p.redFlags.perineal || p.redFlags.bladderBowel || p.redFlags.legWeakness) {
    return {
      level: 'urgent',
      message: 'Hai segnalato perdita di sensibilità nella zona perineale/genitale, nuove alterazioni di vescica o intestino, oppure debolezza importante o progressiva alle gambe. Questi segnali richiedono una valutazione medica URGENTE (pronto soccorso o 112/118). Non fare esercizi in attesa.'
    };
  }
  if ((p.intensity != null && p.intensity >= 7) || p.worsening || p.limitsActivities) {
    return { level: 'medical', message: 'Dolore intenso, in rapido peggioramento o che limita le attività: richiede una valutazione sanitaria (medico di base o professionista qualificato).' };
  }
  return { level: 'none', message: '' };
}
