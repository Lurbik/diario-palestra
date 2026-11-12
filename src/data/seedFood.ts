// Alimenti e ricette DIMOSTRATIVI. I valori sono stime generiche marcate come NON verificate:
// vanno sostituiti con l'etichetta del prodotto realmente usato o con le tabelle CREA consultate.
// Nessun formaggio escluso è nascosto nelle ricette. Lo yogurt NON è inserito di default.
import type { Food, Recipe, Nutrients } from '../db/types';

const NOTE = 'Valore generico indicativo inserito come esempio, NON verificato. Sostituiscilo con l\'etichetta del tuo prodotto o con le tabelle CREA.';
const nut = (kcal: number | null, protein: number | null, carbs: number | null, fat: number | null, fiber: number | null): Nutrients => ({ kcal, protein, carbs, fat, fiber });

const F = (id: string, name: string, per100: Nutrients, extra: Partial<Food> = {}): Food => ({
  id, name, brand: '', source: 'estimate', sourceNote: NOTE, sourceDate: null, verified: false, state: 'raw', basis: '100g',
  per100, densityGPerMl: null, gramsPerPiece: null, defaultPortion: null, defaultUnit: 'g', barcode: '', tags: [],
  shelfStable: 'unknown', seed: true, favorite: false, ...extra
});

export const SEED_FOODS: Food[] = [
  F('f_pasta', 'Pasta di semola (secca, cruda)', nut(355, 12.5, 72, 1.5, 3), { defaultPortion: 170, shelfStable: 'yes' }),
  F('f_riso', 'Riso (crudo)', nut(350, 7, 78, 0.6, 1), { defaultPortion: 80, shelfStable: 'yes' }),
  F('f_couscous', 'Couscous (crudo)', nut(360, 12, 72, 1.5, 4), { defaultPortion: 80, shelfStable: 'yes' }),
  F('f_pane', 'Pane comune', nut(275, 8.5, 55, 1.5, 3), { state: 'as_sold', defaultPortion: 100, shelfStable: 'yes', tags: ['glutine'] }),
  F('f_piadina', 'Piadina confezionata', nut(300, 8, 50, 8, 2), { state: 'as_sold', defaultPortion: 100, shelfStable: 'until_opened', tags: ['glutine'] }),
  F('f_uova', 'Uova intere (crude, parte edibile)', nut(140, 12.5, 0.5, 10, 0), { tags: ['uova'] }),
  F('f_pollo_crudo', 'Petto di pollo (crudo)', nut(110, 23, 0, 1.5, 0), { defaultPortion: 150, shelfStable: 'no' }),
  F('f_pollo_cotto', 'Pollo già cotto (confezionato)', nut(165, 31, 0, 3.6, 0), { state: 'cooked', defaultPortion: 100, shelfStable: 'no' }),
  F('f_tonno', 'Tonno al naturale (sgocciolato)', nut(105, 25, 0, 1, 0), { state: 'drained', defaultPortion: 80, shelfStable: 'until_opened', tags: ['pesce'] }),
  F('f_prosciutto', 'Prosciutto cotto', nut(135, 19, 1, 6, 0), { state: 'as_sold', defaultPortion: 50, shelfStable: 'no', tags: ['affettato'] }),
  F('f_macinato', 'Macinato di manzo magro (crudo)', nut(160, 21, 0, 8, 0), { defaultPortion: 150, shelfStable: 'no' }),
  F('f_ceci', 'Ceci in scatola (sgocciolati)', nut(120, 7, 16, 2, 6), { state: 'drained', shelfStable: 'until_opened', tags: ['legumi'] }),
  F('f_lenticchie', 'Lenticchie secche (crude)', nut(330, 23, 50, 1.5, 14), { shelfStable: 'yes', tags: ['legumi'] }),
  F('f_latte_ps', 'Latte parzialmente scremato', nut(46, 3.3, 5, 1.6, 0), { basis: '100ml', state: 'as_sold', defaultUnit: 'ml', defaultPortion: 250, shelfStable: 'no', tags: ['latte'] }),
  F('f_latte_uht', 'Latte UHT intero (brick)', nut(64, 3.2, 4.8, 3.6, 0), { basis: '100ml', state: 'as_sold', defaultUnit: 'ml', defaultPortion: 200, shelfStable: 'until_opened', tags: ['latte'], sourceNote: NOTE + ' Stabile solo finché integro e conservato come da etichetta; dopo l\'apertura va in frigo.' }),
  F('f_mozzarella', 'Mozzarella', nut(250, 18, 1, 19.5, 0), { state: 'as_sold', defaultPortion: 125, shelfStable: 'no', tags: ['latte', 'mozzarella'] }),
  F('f_pomodori', 'Pomodori', nut(18, 0.9, 3.5, 0.2, 1.2), { defaultPortion: 150, shelfStable: 'no' }),
  F('f_verdure', 'Verdure miste surgelate', nut(30, 2, 4, 0.3, 2.5), { defaultPortion: 150, shelfStable: 'no' }),
  F('f_passata', 'Passata di pomodoro', nut(30, 1.5, 5, 0.2, 1.5), { state: 'as_sold', shelfStable: 'until_opened' }),
  F('f_patate', 'Patate (crude)', nut(77, 2, 17, 0.1, 2), { shelfStable: 'no' }),
  F('f_banana', 'Banana', nut(90, 1.1, 21, 0.3, 2), { state: 'as_sold', defaultPortion: 120, shelfStable: 'yes' }),
  F('f_mela', 'Mela', nut(52, 0.3, 13, 0.2, 2), { state: 'as_sold', defaultPortion: 150, shelfStable: 'yes' }),
  F('f_frutta_secca', 'Frutta secca mista', nut(600, 17, 10, 52, 8), { state: 'as_sold', defaultPortion: 30, shelfStable: 'yes', tags: ['frutta_a_guscio'] }),
  F('f_burro_arachidi', 'Burro d\'arachidi', nut(600, 25, 12, 50, 6), { state: 'as_sold', defaultPortion: 20, shelfStable: 'yes', tags: ['arachidi'] }),
  F('f_avena', 'Fiocchi d\'avena', nut(370, 13, 60, 7, 10), { state: 'as_sold', shelfStable: 'yes', tags: ['glutine_possibile'] }),
  F('f_miele', 'Miele', nut(304, 0.3, 82, 0, 0), { state: 'as_sold', shelfStable: 'yes' }),
  F('f_fondente', 'Cioccolato fondente', nut(580, 8, 35, 42, 11), { state: 'as_sold', shelfStable: 'yes' }),
  F('f_proteine_cioc', 'Proteine in polvere al cioccolato', nut(null, null, null, null, null), { state: 'as_sold', shelfStable: 'yes', sourceNote: 'Inserisci i valori dall\'etichetta del tuo prodotto: finché mancano restano "dato mancante".' }),
  F('f_olio', 'Olio extravergine d\'oliva', nut(899, 0, 0, 99.9, 0), { state: 'as_sold', shelfStable: 'yes', sourceNote: NOTE + ' Pesalo in grammi: la conversione ml→g non è assunta.' }),
  F('f_acqua', 'Acqua', nut(0, 0, 0, 0, 0), { state: 'as_sold', shelfStable: 'yes', source: 'database', sourceNote: 'Acqua: nessun apporto energetico.', verified: true }),
  F('f_pesto_classico', 'Pesto classico (può contenere formaggi)', nut(null, null, null, null, null), {
    state: 'as_sold', tags: ['formaggio'], shelfStable: 'until_opened',
    sourceNote: 'Il pesto classico spesso contiene formaggi esclusi. Escluso dai suggerimenti finché non confermi che tolleri il TUO prodotto (togli il tag "formaggio" solo per quello).'
  }),
  F('f_pesto_senza', 'Pesto senza formaggio (verifica etichetta)', nut(null, null, null, null, null), { state: 'as_sold', shelfStable: 'until_opened', sourceNote: 'Controlla in etichetta l\'assenza di formaggi e inserisci i valori nutrizionali.' })
];

const R = (id: string, name: string, servings: number, ingredients: Recipe['ingredients'], extra: Partial<Recipe>): Recipe => ({
  id, name, servings, ingredients, steps: [], equipment: [], activeMin: null, totalMin: null, portable: false, eatCold: false,
  needsColdChain: false, storage: '', storageSource: '', mealSlots: [], notes: 'Ricetta dimostrativa: quantità adattabili, nutrienti calcolati da valori non verificati.', seed: true, favorite: false, ...extra
});

const FSA = 'FSA, guida studenti a igiene e conservazione (vedi Fonti)';
const USDA = 'USDA FSIS, pranzo al sacco e fonti refrigeranti (vedi Fonti)';
const COLD = 'Deperibile: in frigo; da trasportare solo in borsa termica con elementi refrigeranti adeguati. Una borsa da sola non garantisce la sicurezza per 6 ore: contano temperatura, tempo e preparazione.';
const LEFTOVER = 'Raffreddare rapidamente e mettere in frigo; consumare gli avanzi entro i tempi indicati dalla fonte (in genere 2 giorni; il riso cotto prima) oppure congelare in porzioni. Non valutare la sicurezza da odore o aspetto.';

export const SEED_RECIPES: Recipe[] = [
  R('r_pane_uova', 'Pane e uova', 1, [{ foodId: 'f_pane', qty: 80, unit: 'g' }, { foodId: 'f_uova', qty: 110, unit: 'g' }, { foodId: 'f_olio', qty: 5, unit: 'g' }], {
    steps: ['Cuoci le uova in padella (o friggitrice ad aria in stampino).', 'Servi con il pane.'], equipment: ['fornelli'], activeMin: 10, totalMin: 10,
    mealSlots: ['colazione'], notes: 'Colazione salata contenuta. 110 g ≈ 2 uova medie (pesa le tue).'
  }),
  R('r_panino_pollo', 'Panino con pollo già cotto', 1, [{ foodId: 'f_pane', qty: 120, unit: 'g' }, { foodId: 'f_pollo_cotto', qty: 100, unit: 'g' }, { foodId: 'f_pomodori', qty: 60, unit: 'g' }], {
    steps: ['Farcisci il pane con pollo e pomodoro.', 'Avvolgi e metti in borsa termica con elementi refrigeranti.'], activeMin: 5, totalMin: 5,
    portable: true, eatCold: true, needsColdChain: true, storage: COLD, storageSource: USDA, mealSlots: ['spuntino_mattina', 'merenda']
  }),
  R('r_couscous', 'Couscous con ceci e pollo', 4, [{ foodId: 'f_couscous', qty: 320, unit: 'g' }, { foodId: 'f_ceci', qty: 480, unit: 'g' }, { foodId: 'f_pollo_crudo', qty: 480, unit: 'g' }, { foodId: 'f_verdure', qty: 400, unit: 'g' }, { foodId: 'f_olio', qty: 30, unit: 'g' }], {
    steps: ['Cuoci il pollo a cubetti in friggitrice ad aria o padella.', 'Idrata il couscous con acqua bollente.', 'Salta le verdure, unisci tutto con i ceci.', 'Pesa il lotto finale e dividi in 4 porzioni.'],
    equipment: ['fornelli', 'friggitrice ad aria'], activeMin: 20, totalMin: 30, portable: true, eatCold: true, needsColdChain: true,
    storage: LEFTOVER + ' ' + COLD, storageSource: FSA + '; ' + USDA, mealSlots: ['pranzo', 'cena']
  }),
  R('r_pasta_lenticchie', 'Pasta e lenticchie', 4, [{ foodId: 'f_pasta', qty: 320, unit: 'g' }, { foodId: 'f_lenticchie', qty: 160, unit: 'g' }, { foodId: 'f_passata', qty: 300, unit: 'g' }, { foodId: 'f_olio', qty: 30, unit: 'g' }], {
    steps: ['Cuoci le lenticchie con la passata (circa 30 min).', 'Aggiungi la pasta e porta a cottura.', 'Pesa il lotto finale e porziona.'],
    equipment: ['fornelli'], activeMin: 15, totalMin: 45, storage: LEFTOVER, storageSource: FSA, mealSlots: ['pranzo', 'cena']
  }),
  R('r_pasta_tonno', 'Pasta al tonno e pomodoro', 1, [{ foodId: 'f_pasta', qty: 170, unit: 'g' }, { foodId: 'f_tonno', qty: 80, unit: 'g' }, { foodId: 'f_passata', qty: 150, unit: 'g' }, { foodId: 'f_olio', qty: 10, unit: 'g' }], {
    steps: ['Cuoci la pasta (peso a crudo).', 'Scalda passata e tonno, condisci.'], equipment: ['fornelli'], activeMin: 10, totalMin: 15, mealSlots: ['pranzo', 'cena'],
    notes: 'Riflette l\'abitudine dichiarata (150–200 g di pasta a crudo). Varia la fonte proteica nella settimana.'
  }),
  R('r_piadina_pollo', 'Piadina con pollo e verdure', 1, [{ foodId: 'f_piadina', qty: 100, unit: 'g' }, { foodId: 'f_pollo_cotto', qty: 100, unit: 'g' }, { foodId: 'f_verdure', qty: 80, unit: 'g' }], {
    steps: ['Scalda la piadina.', 'Farcisci con pollo e verdure saltate.'], equipment: ['fornelli'], activeMin: 10, totalMin: 10, portable: true, eatCold: true, needsColdChain: true,
    storage: COLD, storageSource: USDA, mealSlots: ['pranzo', 'cena', 'merenda']
  }),
  R('r_mozzarella_pane', 'Mozzarella con pane e pomodori', 1, [{ foodId: 'f_pane', qty: 100, unit: 'g' }, { foodId: 'f_mozzarella', qty: 125, unit: 'g' }, { foodId: 'f_pomodori', qty: 150, unit: 'g' }, { foodId: 'f_olio', qty: 5, unit: 'g' }], {
    steps: ['Taglia mozzarella e pomodori, condisci, servi col pane.'], activeMin: 5, totalMin: 5, eatCold: true, needsColdChain: true, storage: COLD, storageSource: USDA, mealSlots: ['cena', 'pranzo']
  }),
  R('r_riso_pollo', 'Riso con pollo e verdure', 4, [{ foodId: 'f_riso', qty: 320, unit: 'g' }, { foodId: 'f_pollo_crudo', qty: 600, unit: 'g' }, { foodId: 'f_verdure', qty: 600, unit: 'g' }, { foodId: 'f_olio', qty: 30, unit: 'g' }], {
    steps: ['Cuoci il riso.', 'Cuoci il pollo in friggitrice ad aria.', 'Salta le verdure e unisci.', 'Pesa il lotto finale e porziona; raffredda subito.'],
    equipment: ['fornelli', 'friggitrice ad aria'], activeMin: 20, totalMin: 40, storage: LEFTOVER + ' Il riso cotto ha indicazioni più restrittive: verifica la fonte.', storageSource: FSA, mealSlots: ['pranzo', 'cena']
  }),
  R('r_frutta_secca', 'Frutta e frutta secca', 1, [{ foodId: 'f_banana', qty: 120, unit: 'g' }, { foodId: 'f_frutta_secca', qty: 30, unit: 'g' }], {
    steps: ['Porta frutta intera e una porzione di frutta secca.'], activeMin: 1, totalMin: 1, portable: true, eatCold: true, needsColdChain: false,
    storage: 'Frutta intera e frutta secca confezionata non richiedono frigo per una giornata: verifica comunque l\'etichetta.', mealSlots: ['spuntino_mattina', 'merenda']
  }),
  R('r_pane_burro_arachidi', 'Pane e burro d\'arachidi', 1, [{ foodId: 'f_pane', qty: 80, unit: 'g' }, { foodId: 'f_burro_arachidi', qty: 25, unit: 'g' }], {
    steps: ['Spalma e porta via.'], activeMin: 2, totalMin: 2, portable: true, eatCold: true, needsColdChain: false,
    storage: 'Stabile per la giornata secondo etichetta del burro d\'arachidi.', mealSlots: ['merenda', 'spuntino_mattina']
  }),
  R('r_latte_spuntino', 'Latte con spuntino separato', 1, [{ foodId: 'f_latte_uht', qty: 200, unit: 'ml' }, { foodId: 'f_pane', qty: 60, unit: 'g' }, { foodId: 'f_burro_arachidi', qty: 15, unit: 'g' }], {
    steps: ['Brick UHT monoporzione integro: aprilo e bevilo subito.'], activeMin: 2, totalMin: 2, portable: true, eatCold: true, needsColdChain: false,
    storage: 'Latte UHT stabile solo finché integro e come da etichetta; una volta aperto va consumato o refrigerato.', mealSlots: ['spuntino_mattina', 'merenda'],
    notes: 'Solo se gradito. Ricetta dimostrativa.'
  })
];
