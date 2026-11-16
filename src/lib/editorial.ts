// Scheda editoriale di un esercizio: curata se esiste, altrimenti un'indicazione GENERALE ricavata da gesto,
// classe e attrezzatura, marcata come tale (mai presentata come specifica della variante).
import type { Exercise } from '../db/types';

export interface Editorial { whenToChoose: string; whenToMove: string; comparisonLimits: string; alternatives: string[]; general: boolean }

const CONV_LIMIT: Partial<Record<Exercise['loadConvention'], string>> = {
  machine_stack: 'Ogni macchina ha leve e pacco pesi propri: confronta i kg solo sulla stessa macchina e con le stesse regolazioni.',
  plates_per_side: 'Si contano i dischi per lato su quella macchina: macchine diverse non sono confrontabili.',
  plates_total: 'Dischi totali su quella macchina: macchine diverse non sono confrontabili.',
  cable_stack: 'Il rapporto delle carrucole cambia tra stazioni: confronta solo sullo stesso cavo e alla stessa altezza.',
  per_dumbbell: 'Si registra il peso di un manubrio; inclinazione, appoggio e presa fanno parte della configurazione.',
  barbell_total: 'Peso totale del bilanciere con i dischi; una presa o un ROM diverso avvia un nuovo confronto.',
  bodyweight_added: 'Si registra la zavorra aggiunta; con il peso corporeo che cambia il confronto è approssimativo.',
  assisted: 'Più assistenza = più facile: confronta solo con lo stesso tipo di assistenza.'
};

export function editorialFor(ex: Exercise, catalog: Exercise[]): Editorial {
  if (ex.whenToChoose && ex.whenToMove && ex.comparisonLimits) {
    return { whenToChoose: ex.whenToChoose, whenToMove: ex.whenToMove, comparisonLimits: ex.comparisonLimits, alternatives: ex.alternatives ?? [], general: false };
  }
  const cls = ex.policyClass;
  const whenToChoose = cls === 'heavy_compound' ? 'Multiarticolare impegnativo: utile come esercizio principale del giorno per il gesto che allena.'
    : cls === 'compound' ? 'Multiarticolare guidato o con manubri: buon esercizio principale o secondario per il gesto che allena.'
    : cls === 'isolation' ? 'Esercizio di isolamento: utile per dare lavoro diretto a un muscolo dopo i multiarticolari.'
    : 'Lavoro per polpacci o addome: si aggiunge di solito a fine seduta.';
  const whenToMove = cls === 'heavy_compound' || cls === 'compound' ? 'Di solito all\'inizio della seduta; anticiparlo ha senso se vuoi migliorare la prestazione proprio in questo esercizio.' : 'Di solito dopo i multiarticolari; puoi anticiparlo se è una tua priorità (il confronto con le sedute in cui era a fine allenamento non sarà diretto).';
  const comparisonLimits = (CONV_LIMIT[ex.loadConvention] ?? 'Confronta solo con la stessa configurazione.') + (ex.unilateral ? ' Ripetizioni per lato.' : '');
  const alternatives = catalog.filter((e) => e.id !== ex.id && !e.archived && e.pattern && e.pattern === ex.pattern && e.primaryMuscles.some((m) => ex.primaryMuscles.includes(m))).slice(0, 3).map((e) => e.id);
  // i campi scritti per la variante prevalgono; quelli mancanti sono generali (e la scheda lo dichiara)
  return { whenToChoose: ex.whenToChoose || whenToChoose, whenToMove: ex.whenToMove || whenToMove, comparisonLimits: ex.comparisonLimits || comparisonLimits, alternatives: ex.alternatives?.length ? ex.alternatives : alternatives, general: true };
}
