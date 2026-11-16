// Consigli sugli integratori a partire dai DATI registrati. Deterministico e spiegabile, offline.
// Gerarchia: sicurezza → cibo prima → esami prima → integratore da considerare. Mai "prendi X".
// Ogni esito dice quali dati ha usato e cosa manca; nessun dato inventato (valori ignoti restano ignoti).
import { SUPPLEMENTS, type SupplementInfo } from '../catalog/supplements';

/**
 * Tre assi distinti, mai sovrascritti l'uno dall'altro:
 *   status/pertinenza (informazione) · inUse (fatto riferito dall'utente) · caution (prioritaria).
 * "Lo uso già" non è un consenso a consigli di dose e non nasconde una cautela.
 */
export type SupplementStatus = 'consider' | 'need_info' | 'food_first' | 'test_first' | 'not_needed' | 'not_recommended' | 'ask_doctor';

export interface HealthFlags {
  pregnant?: boolean; kidney?: boolean; heart?: boolean; meds?: boolean; under18?: boolean;
  /** atleta sottoposto a controlli antidoping */
  tested?: boolean;
}

export interface SupplementContext {
  goal: 'massa' | 'mantenimento' | 'dimagrimento' | 'solo_diario' | null;
  diet: 'onnivora' | 'vegetariana' | 'vegana' | null;
  health: HealthFlags;
  /** ultimo peso registrato (kg), null se assente */
  weightKg: number | null;
  /** media proteine (g) nei giorni COMPLETI con proteine note; null se nessuno */
  proteinAvgG: number | null;
  proteinDays: number;
  /** sedute concluse negli ultimi 28 giorni */
  sessions28: number;
  /** quota delle sedute (ultimi 28 giorni) che FINISCONO a meno di 6 ore dall'ora abituale di andare a letto */
  lateSessionShare: number | null;
  /** porzioni di pesce a settimana dal diario (ultimi 28 giorni); null se il diario è troppo scarno */
  fishPerWeek: number | null;
  /** il latte è escluso o allergene */
  noDairy: boolean;
  /** integratori segnati come "lo sto usando" */
  using: string[];
  /** giorni di allenamento dichiarati nel profilo (null = non indicato, che non vale "zero") */
  declaredDays?: number | null;
}

export interface SupplementAdvice {
  info: SupplementInfo; status: SupplementStatus; title: string; reasons: string[]; missing: string[];
  /** l'utente ha segnato che lo usa (fatto riferito) */
  inUse: boolean;
  /** cautela prioritaria da mostrare per prima, anche se lo usa già; null se nessuna segnalata */
  caution: string | null;
}

const fmt = (n: number, d = 0) => n.toFixed(d).replace('.', ',');
const anyRisk = (h: HealthFlags) => !!(h.pregnant || h.kidney || h.heart || h.meds || h.under18);

export function supplementAdvice(c: SupplementContext): SupplementAdvice[] {
  const out: SupplementAdvice[] = [];
  const kg = c.weightKg;
  for (const info of SUPPLEMENTS) {
    const reasons: string[] = [];
    const missing: string[] = [];
    let status: SupplementStatus;
    let title: string;
    switch (info.id) {
      case 'creatina': {
        if (c.health.kidney || c.health.pregnant || c.health.under18) { status = 'ask_doctor'; title = 'Parlane prima con il medico'; reasons.push('Hai indicato una condizione per cui la creatina va valutata dal medico.'); break; }
        const water = 'Nelle prime 3–4 settimane il peso può salire per acqua: con la data di inizio segnata, l\'app sospende le proposte sulle calorie in quel periodo (regola di prodotto, non un dato scientifico).';
        if (c.sessions28 >= 6) { status = 'consider'; title = 'Da considerare'; reasons.push(`Ti sei allenato ${c.sessions28} volte negli ultimi 28 giorni: per chi si allena con i pesi è l'integratore con le prove più solide.`); reasons.push(water); }
        else if (c.sessions28 === 0 && !c.declaredDays) { status = 'need_info'; title = 'Non so ancora quanto ti alleni: vuoi indicarlo?'; reasons.push('Non ci sono sedute registrate e nel profilo non hai indicato quanti giorni ti alleni. Le informazioni generali sono qui sotto già da ora.'); missing.push('giorni di allenamento a settimana (profilo) o alcune sedute registrate'); }
        else if ((c.declaredDays ?? 0) >= 2) { status = 'consider'; title = 'Da considerare'; reasons.push(`Hai indicato ${c.declaredDays} giorni di allenamento a settimana${c.sessions28 ? ` (${c.sessions28} sedute registrate negli ultimi 28 giorni)` : ''}: per chi si allena con i pesi è l'integratore con le prove più solide.`); reasons.push(water); }
        else { status = 'not_needed'; title = 'Per ora poco rilevante'; reasons.push(`${c.sessions28} sedute registrate negli ultimi 28 giorni: il beneficio dipende dall'allenamento costante.`); }
        if (c.health.meds) reasons.push('Assumi farmaci: chiedi conferma a medico o farmacista.');
        break;
      }
      case 'caffeina': {
        if (c.health.heart || c.health.pregnant || c.health.under18) { status = 'ask_doctor'; title = 'Parlane prima con il medico'; reasons.push('Hai indicato una condizione per cui la caffeina come integratore va valutata dal medico.'); break; }
        if (c.lateSessionShare != null && c.lateSessionShare >= 0.5) {
          status = 'not_recommended'; title = 'Sconsigliata per le tue sedute';
          reasons.push(`${fmt(c.lateSessionShare * 100)}% delle tue sedute finisce a meno di 6 ore da quando vai a letto: la caffeina presa prima può ridurre il sonno anche senza che te ne accorga.`);
          reasons.push('Il sonno conta per recupero e progressi più di un piccolo aumento di prestazione.');
        } else {
          status = 'consider'; title = 'Facoltativa';
          reasons.push(kg ? `Con il tuo ultimo peso (${fmt(kg, 1)} kg) gli studi usano da circa ${Math.round(kg * 2)} mg (2 mg/kg) in su. EFSA considera sicuri per adulti sani fino a 200 mg alla volta e 400 mg al giorno da tutte le fonti, caffè compreso: l'app non propone dosi oltre questi limiti.` : 'Registra il peso per vedere il riferimento in mg.');
          if (c.lateSessionShare == null) missing.push('orario abituale di sonno o sedute concluse, per valutare l\'impatto sul sonno');
        }
        if (!kg) missing.push('peso corporeo');
        break;
      }
      case 'proteine_polvere': {
        if (c.health.kidney) { status = 'ask_doctor'; title = 'Parlane prima con il medico'; reasons.push('Con una malattia renale la quota proteica va decisa con il medico.'); break; }
        if (!kg) { status = 'food_first'; title = 'Prima il cibo'; missing.push('peso corporeo'); reasons.push('Senza peso non posso confrontare le proteine con il riferimento.'); break; }
        if (c.proteinAvgG == null || c.proteinDays < 5) { status = 'food_first'; title = 'Prima il cibo'; missing.push(`almeno 5 giorni completi con le proteine note (ora ${c.proteinDays})`); reasons.push('Non ho abbastanza giorni completi per dire se ti mancano proteine.'); break; }
        const ref = 1.6 * kg;
        if (c.proteinAvgG >= ref) { status = 'not_needed'; title = 'Non serve'; reasons.push(`Media ${fmt(c.proteinAvgG)} g/die su ${c.proteinDays} giorni completi: già sopra il riferimento di circa ${fmt(ref)} g (1,6 g/kg).`); break; }
        const gap = ref - c.proteinAvgG;
        status = 'food_first'; title = 'Prima il cibo, la polvere se è più comoda';
        reasons.push(`Media ${fmt(c.proteinAvgG)} g/die su ${c.proteinDays} giorni completi: circa ${fmt(gap)} g sotto il riferimento di ${fmt(ref)} g (1,6 g/kg).`);
        reasons.push(c.noDairy || c.diet === 'vegana' ? 'Se usi una polvere, scegli proteine vegetali (escludi il siero del latte).' : 'Una dose da 20–40 g in un pasto che ne ha poche colma gran parte della differenza.');
        break;
      }
      case 'vitamina_d': {
        status = 'test_first'; title = 'Solo dopo un esame';
        reasons.push('Senza una carenza misurata non ci sono prove che aumenti forza o potenza. Se passi poco tempo all\'aperto, soprattutto d\'inverno, chiedi al medico l\'esame 25-OH vitamina D.');
        break;
      }
      case 'omega3': {
        if (c.fishPerWeek == null) { status = 'food_first'; title = 'Prima il cibo'; missing.push('almeno 2 settimane di diario per stimare quanto pesce mangi'); reasons.push('Mangiare pesce (soprattutto azzurro) è la prima scelta.'); }
        else if (c.fishPerWeek >= 2) { status = 'not_needed'; title = 'Non serve'; reasons.push(`Circa ${fmt(c.fishPerWeek, 1)} porzioni di pesce a settimana nel diario.`); }
        else { status = 'food_first'; title = 'Prima il cibo'; reasons.push(`Circa ${fmt(c.fishPerWeek, 1)} porzioni di pesce a settimana nel diario: prova ad aggiungerne una o due (sgombro, sardine, salmone, trota).`); reasons.push('Come integratore l\'effetto sulla forza è piccolo e incerto; nessun effetto affidabile sulla massa.'); }
        if (c.health.meds) { status = 'ask_doctor'; title = 'Parlane prima con il medico'; reasons.push('Con alcuni farmaci (es. anticoagulanti) va valutato dal medico.'); }
        break;
      }
      case 'b12': {
        if (c.diet === 'vegana') { status = 'consider'; title = 'Necessaria una fonte affidabile'; reasons.push('Alimentazione vegana: serve B12 da alimenti fortificati o da un integratore. Dose e forma con medico o farmacista.'); }
        else if (c.diet === 'vegetariana') { status = 'test_first'; title = 'Da verificare'; reasons.push('Alimentazione vegetariana: assicurati di avere fonti di B12 (uova, latticini, alimenti fortificati); un esame può confermarlo.'); }
        else if (c.diet === 'onnivora') { status = 'not_needed'; title = 'Di norma non serve'; reasons.push('Con un\'alimentazione che include alimenti animali la B12 arriva dal cibo.'); }
        else { status = 'not_needed'; title = 'Indica il tipo di alimentazione'; missing.push('tipo di alimentazione (onnivora, vegetariana, vegana)'); reasons.push('Rilevante soprattutto per chi è vegano.'); }
        break;
      }
      case 'ferro': {
        status = 'test_first'; title = 'Solo con esami e indicazione del medico';
        reasons.push('Integrare ferro senza una carenza diagnosticata non migliora la prestazione e può fare danni.');
        if (c.diet === 'vegana' || c.diet === 'vegetariana') reasons.push('Con un\'alimentazione vegetariana o vegana un controllo periodico può essere utile: chiedilo al medico.');
        break;
      }
      case 'beta_alanina': {
        status = 'not_needed'; title = 'Poco utile per il tuo allenamento';
        reasons.push('I benefici riguardano sforzi continui di 1–4 minuti; le serie con i pesi durano meno. Effetto piccolo o assente.');
        break;
      }
      case 'bcaa': {
        status = 'not_recommended'; title = 'Sconsigliati';
        reasons.push(c.proteinAvgG != null && kg && c.proteinAvgG >= 1.6 * kg ? 'Le tue proteine sono già sufficienti: i BCAA non aggiungono nulla.' : 'Se ti mancano proteine, una fonte proteica completa (cibo o polvere) è più efficace dei soli BCAA.');
        break;
      }
      default: {
        status = 'not_recommended'; title = 'Sconsigliati';
        reasons.push('Nessuna prova solida di benefici in persone sane; rischio di sostanze non dichiarate.');
      }
    }
    const inUse = c.using.includes(info.id);
    if (c.health.tested && status !== 'not_recommended') reasons.push('Sei sottoposto a controlli antidoping: usa solo prodotti con certificazione di lotto (es. Informed Sport). Una parte degli integratori analizzati contiene sostanze non dichiarate.');
    // Cautela: hai indicato condizioni o farmaci. Vale anche (soprattutto) se lo usi già.
    let caution: string | null = status === 'ask_doctor' ? reasons[0] ?? 'Parlane con medico o farmacista.' : null;
    if (anyRisk(c.health) && (status === 'consider' || status === 'need_info' || inUse)) {
      caution = inUse ? 'Lo usi già e hai indicato condizioni o farmaci: parlane con medico o farmacista. L\'app non propone dosi personalizzate.' : 'Hai indicato condizioni o farmaci: prima di iniziare chiedi a medico o farmacista.';
      status = 'ask_doctor'; title = 'Parlane prima con il medico';
    }
    if (inUse) reasons.unshift('Hai segnato che lo stai usando: è un dato che hai riferito, non un consiglio dell\'app.');
    out.push({ info, status, title, reasons, missing, inUse, caution });
  }
  // Le cautele vengono sempre prima; l'uso dichiarato non cambia la posizione.
  const order: SupplementStatus[] = ['ask_doctor', 'consider', 'need_info', 'food_first', 'test_first', 'not_needed', 'not_recommended'];
  return out.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
}

/**
 * Periodi in cui il peso è poco interpretabile per le calorie (es. creatina: acqua nelle prime settimane).
 * Restituisce gli intervalli [from, until] da passare a proposeCalories.
 */
export function weightConfounders(log: { id: string; start: string }[], addDays: (d: string, n: number) => string) {
  return log.filter((l) => l.id === 'creatina').map((l) => ({ label: 'inizio creatina (acqua nei muscoli)', from: l.start, until: addDays(l.start, 28) }));
}
