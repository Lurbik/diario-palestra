// Estrae un sottoinsieme di alimenti generici da USDA FoodData Central — SR Legacy (2021-10-28),
// dati di pubblico dominio (CC0 1.0). Uso: scaricare lo zip JSON in tools/usda/ e lanciare
//   node scripts/build-food-catalog.mjs
// L'output (src/catalog/foods.json) è riproducibile: stesso input → stesso file.
// Ogni voce conserva fdcId e descrizione originale. Valori mancanti nella fonte restano null.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DIR = 'tools/usda';
const file = readdirSync(DIR).find((f) => f.endsWith('.json'));
if (!file) throw new Error('Scarica prima FoodData_Central_sr_legacy_food_json_2021-10-28.zip in tools/usda e decomprimilo');
const raw = readFileSync(`${DIR}/${file}`);
const sha = createHash('sha256').update(raw).digest('hex');
const foods = JSON.parse(raw).SRLegacyFoods;
const byDesc = new Map(foods.map((f) => [f.description.toLowerCase(), f]));

// [slug, nome italiano, sinonimi, descrizione USDA esatta, stato, categoria, tag allergeni/esclusioni, porzione pezzo (modifier USDA)]
const L = [
  // Cereali, pane, pasta
  ['pasta_secca', 'Pasta di semola (secca, cruda)', ['pasta', 'spaghetti', 'penne', 'maccheroni'], 'Pasta, dry, enriched', 'raw', 'cereali', ['glutine']],
  ['pasta_cotta', 'Pasta di semola (cotta, senza sale)', ['pasta cotta'], 'Pasta, cooked, enriched, without added salt', 'cooked', 'cereali', ['glutine']],
  ['pasta_integrale', 'Pasta integrale (secca, cruda)', ['pasta integrale'], 'Pasta, whole-wheat, dry (Includes foods for USDA\'s Food Distribution Program)', 'raw', 'cereali', ['glutine']],
  ['riso_bianco', 'Riso bianco a grana lunga (crudo)', ['riso', 'riso basmati'], 'Rice, white, long-grain, regular, raw, enriched', 'raw', 'cereali', []],
  ['riso_bianco_cotto', 'Riso bianco a grana lunga (cotto)', ['riso cotto'], 'Rice, white, long-grain, regular, enriched, cooked', 'cooked', 'cereali', []],
  ['riso_integrale', 'Riso integrale (crudo)', ['riso integrale'], 'Rice, brown, long-grain, raw (Includes foods for USDA\'s Food Distribution Program)', 'raw', 'cereali', []],
  ['couscous', 'Couscous (secco)', ['cous cous'], 'Couscous, dry', 'raw', 'cereali', ['glutine']],
  ['avena', 'Fiocchi d\'avena', ['avena', 'fiocchi di avena'], 'Cereals, oats, regular and quick, not fortified, dry', 'as_sold', 'cereali', ['glutine_possibile']],
  ['pane_bianco', 'Pane bianco', ['pane', 'pane in cassetta'], 'Bread, white, commercially prepared (includes soft bread crumbs)', 'as_sold', 'cereali', ['glutine']],
  ['pane_integrale', 'Pane integrale', ['pane integrale'], 'Bread, whole-wheat, commercially prepared', 'as_sold', 'cereali', ['glutine']],
  ['tortilla', 'Tortilla/piadina di frumento', ['piadina', 'wrap', 'tortilla'], 'Tortillas, ready-to-bake or -fry, flour, refrigerated', 'as_sold', 'cereali', ['glutine']],
  ['bagel', 'Bagel', ['bagel'], 'Bagels, plain, enriched, with calcium propionate (includes onion, poppy, sesame)', 'as_sold', 'cereali', ['glutine']],
  ['gallette_riso', 'Gallette di riso', ['gallette'], 'Snacks, rice cakes, brown rice, plain, unsalted', 'as_sold', 'cereali', []],
  ['cracker', 'Cracker salati', ['crackers'], 'Crackers, saltines (includes oyster, soda, soup)', 'as_sold', 'cereali', ['glutine']],
  ['farina_00', 'Farina di frumento', ['farina'], 'Wheat flour, white, all-purpose, enriched, bleached', 'raw', 'cereali', ['glutine']],
  ['corn_flakes', 'Fiocchi di mais', ['corn flakes', 'cereali colazione'], 'Cereals ready-to-eat, RALSTON Corn Flakes', 'as_sold', 'cereali', []],
  ['quinoa', 'Quinoa (cruda)', ['quinoa'], 'Quinoa, uncooked', 'raw', 'cereali', []],
  ['patate', 'Patate (crude, con buccia)', ['patata'], 'Potatoes, flesh and skin, raw', 'raw', 'tuberi', []],
  ['patate_dolci', 'Patate dolci (crude)', ['patata americana', 'batata'], 'Sweet potato, raw, unprepared (Includes foods for USDA\'s Food Distribution Program)', 'raw', 'tuberi', []],
  // Carne, pesce, uova
  ['petto_pollo', 'Petto di pollo (crudo)', ['pollo', 'petto di pollo'], 'Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw', 'raw', 'carne', []],
  ['petto_pollo_cotto', 'Petto di pollo (arrosto/cotto)', ['pollo cotto'], 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', 'cooked', 'carne', []],
  ['coscia_pollo', 'Sovracoscia di pollo senza pelle (cruda)', ['coscia di pollo'], 'Chicken, broilers or fryers, dark meat, thigh, meat only, raw', 'raw', 'carne', []],
  ['tacchino_petto', 'Petto di tacchino (crudo)', ['tacchino', 'fesa di tacchino'], 'Turkey, whole, breast, meat only, raw', 'raw', 'carne', []],
  ['macinato_90', 'Macinato di manzo 90% magro (crudo)', ['carne macinata', 'macinato magro'], 'Beef, ground, 90% lean meat / 10% fat, raw', 'raw', 'carne', []],
  ['macinato_80', 'Macinato di manzo 80% magro (crudo)', ['macinato'], 'Beef, ground, 80% lean meat / 20% fat, raw', 'raw', 'carne', []],
  ['lonza_maiale', 'Lonza di maiale (cruda)', ['maiale', 'lonza'], 'Pork, fresh, loin, center loin (chops), boneless, separable lean only, raw', 'raw', 'carne', []],
  ['prosciutto_cotto', 'Prosciutto cotto (affettato)', ['prosciutto cotto'], 'Ham, sliced, regular (approximately 11% fat)', 'as_sold', 'carne', ['affettato']],
  ['bresaola_manzo_essiccato', 'Manzo essiccato (tipo bresaola)', ['bresaola'], 'Beef, cured, dried', 'as_sold', 'carne', ['affettato']],
  ['salmone', 'Salmone atlantico d\'allevamento (crudo)', ['salmone'], 'Fish, salmon, Atlantic, farmed, raw', 'raw', 'pesce', ['pesce']],
  ['tonno_naturale', 'Tonno al naturale (sgocciolato)', ['tonno in scatola', 'tonno'], 'Fish, tuna, light, canned in water, without salt, drained solids', 'drained', 'pesce', ['pesce']],
  ['tonno_olio', 'Tonno sott\'olio (sgocciolato)', ['tonno all\'olio'], 'Fish, tuna, light, canned in oil, drained solids', 'drained', 'pesce', ['pesce']],
  ['merluzzo', 'Merluzzo (crudo)', ['merluzzo', 'filetti di merluzzo'], 'Fish, cod, Atlantic, raw', 'raw', 'pesce', ['pesce']],
  ['gamberi', 'Gamberi (crudi)', ['gamberetti'], 'Crustaceans, shrimp, mixed species, raw (may contain additives to retain moisture)', 'raw', 'pesce', ['crostacei']],
  ['sardine', 'Sardine sott\'olio (sgocciolate)', ['sardine'], 'Fish, sardine, Atlantic, canned in oil, drained solids with bone', 'drained', 'pesce', ['pesce']],
  ['uova', 'Uova intere (crude)', ['uovo', 'uova'], 'Egg, whole, raw, fresh', 'raw', 'uova', ['uova'], 'large'],
  ['albume', 'Albume d\'uovo (crudo)', ['albumi', 'chiara d\'uovo'], 'Egg, white, raw, fresh', 'raw', 'uova', ['uova']],
  ['uova_sode', 'Uova sode', ['uovo sodo'], 'Egg, whole, cooked, hard-boiled', 'cooked', 'uova', ['uova'], 'large'],
  // Latte e derivati (formaggi presenti ma etichettati: l'utente li esclude se vuole)
  ['latte_intero', 'Latte intero', ['latte'], 'Milk, whole, 3.25% milkfat, with added vitamin D', 'as_sold', 'latticini', ['latte']],
  ['latte_ps', 'Latte parzialmente scremato (2%)', ['latte parzialmente scremato'], 'Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D', 'as_sold', 'latticini', ['latte']],
  ['latte_scremato', 'Latte scremato', ['latte magro'], 'Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)', 'as_sold', 'latticini', ['latte']],
  ['yogurt_greco_magro', 'Yogurt greco bianco magro', ['yogurt greco'], 'Yogurt, Greek, plain, nonfat (Includes foods for USDA\'s Food Distribution Program)', 'as_sold', 'latticini', ['latte']],
  ['yogurt_bianco_intero', 'Yogurt bianco intero', ['yogurt'], 'Yogurt, plain, whole milk', 'as_sold', 'latticini', ['latte']],
  ['mozzarella', 'Mozzarella (latte intero)', ['mozzarella'], 'Cheese, mozzarella, whole milk', 'as_sold', 'latticini', ['latte', 'mozzarella', 'formaggio']],
  ['ricotta', 'Ricotta (latte intero)', ['ricotta'], 'Cheese, ricotta, whole milk', 'as_sold', 'latticini', ['latte', 'formaggio']],
  ['parmigiano', 'Parmigiano grattugiato', ['grana', 'parmigiano'], 'Cheese, parmesan, grated', 'as_sold', 'latticini', ['latte', 'formaggio']],
  ['fiocchi_latte', 'Fiocchi di latte', ['cottage cheese', 'fiocchi di latte'], 'Cheese, cottage, lowfat, 2% milkfat', 'as_sold', 'latticini', ['latte', 'formaggio']],
  ['burro', 'Burro', ['burro'], 'Butter, without salt', 'as_sold', 'grassi', ['latte']],
  ['proteine_siero', 'Proteine del siero del latte (polvere, generico)', ['whey', 'proteine in polvere'], 'Beverages, Whey protein powder isolate', 'as_sold', 'integratori', ['latte']],
  // Legumi e alternative
  ['ceci_scatola', 'Ceci in scatola (sgocciolati)', ['ceci'], 'Chickpeas (garbanzo beans, bengal gram), mature seeds, canned, drained solids', 'drained', 'legumi', ['legumi']],
  ['ceci_secchi', 'Ceci secchi (crudi)', ['ceci secchi'], 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', 'raw', 'legumi', ['legumi']],
  ['lenticchie_secche', 'Lenticchie secche (crude)', ['lenticchie'], 'Lentils, raw', 'raw', 'legumi', ['legumi']],
  ['lenticchie_cotte', 'Lenticchie (cotte, senza sale)', ['lenticchie cotte'], 'Lentils, mature seeds, cooked, boiled, without salt', 'cooked', 'legumi', ['legumi']],
  ['fagioli_scatola', 'Fagioli cannellini/bianchi in scatola', ['fagioli', 'cannellini'], 'Beans, white, mature seeds, canned', 'as_sold', 'legumi', ['legumi']],
  ['fagioli_neri_scatola', 'Fagioli neri in scatola (sgocciolati)', ['fagioli neri'], 'Beans, black, mature seeds, canned, low sodium', 'as_sold', 'legumi', ['legumi']],
  ['piselli_surgelati', 'Piselli surgelati', ['piselli'], 'Peas, green, frozen, unprepared (Includes foods for USDA\'s Food Distribution Program)', 'raw', 'legumi', ['legumi']],
  ['tofu', 'Tofu compatto', ['tofu'], 'Tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)', 'as_sold', 'legumi', ['soia']],
  ['edamame', 'Edamame surgelati', ['edamame', 'fagioli di soia'], 'Edamame, frozen, unprepared', 'raw', 'legumi', ['soia']],
  ['hummus', 'Hummus', ['hummus'], 'Hummus, commercial', 'as_sold', 'legumi', ['legumi', 'sesamo']],
  // Frutta secca, semi, grassi
  ['burro_arachidi', 'Burro d\'arachidi (cremoso)', ['burro di arachidi', 'peanut butter'], 'Peanut butter, smooth style, without salt', 'as_sold', 'frutta_secca', ['arachidi']],
  ['arachidi', 'Arachidi tostate', ['noccioline'], 'Peanuts, all types, dry-roasted, without salt', 'as_sold', 'frutta_secca', ['arachidi']],
  ['mandorle', 'Mandorle', ['mandorle'], 'Nuts, almonds', 'as_sold', 'frutta_secca', ['frutta_a_guscio']],
  ['noci', 'Noci', ['noci'], 'Nuts, walnuts, english', 'as_sold', 'frutta_secca', ['frutta_a_guscio']],
  ['nocciole', 'Nocciole', ['nocciole'], 'Nuts, hazelnuts or filberts', 'as_sold', 'frutta_secca', ['frutta_a_guscio']],
  ['anacardi', 'Anacardi tostati', ['anacardi'], 'Nuts, cashew nuts, dry roasted, without salt added', 'as_sold', 'frutta_secca', ['frutta_a_guscio']],
  ['semi_girasole', 'Semi di girasole', ['semi di girasole'], 'Seeds, sunflower seed kernels, dried', 'as_sold', 'frutta_secca', []],
  ['semi_chia', 'Semi di chia', ['chia'], 'Seeds, chia seeds, dried', 'as_sold', 'frutta_secca', []],
  ['olio_oliva', 'Olio d\'oliva', ['olio extravergine', 'olio'], 'Oil, olive, salad or cooking', 'as_sold', 'grassi', []],
  ['olio_semi', 'Olio di semi di girasole', ['olio di semi'], 'Oil, sunflower, linoleic, (approx. 65%)', 'as_sold', 'grassi', []],
  ['avocado', 'Avocado', ['avocado'], 'Avocados, raw, all commercial varieties', 'raw', 'frutta', []],
  ['cioccolato_fondente', 'Cioccolato fondente 70–85%', ['fondente', 'cioccolato'], 'Chocolate, dark, 70-85% cacao solids', 'as_sold', 'dolci', ['latte_possibile']],
  ['miele', 'Miele', ['miele'], 'Honey', 'as_sold', 'dolci', []],
  ['marmellata', 'Marmellata/confettura', ['confettura', 'marmellata'], 'Jams and preserves', 'as_sold', 'dolci', []],
  ['zucchero', 'Zucchero', ['zucchero'], 'Sugars, granulated', 'as_sold', 'dolci', []],
  // Frutta
  ['banana', 'Banana', ['banane'], 'Bananas, raw', 'raw', 'frutta', [], 'medium (7" to 7-7/8" long)'],
  ['mela', 'Mela (con buccia)', ['mele'], 'Apples, raw, with skin (Includes foods for USDA\'s Food Distribution Program)', 'raw', 'frutta', [], 'medium (3" dia)'],
  ['arancia', 'Arancia', ['arance'], 'Oranges, raw, all commercial varieties', 'raw', 'frutta', []],
  ['pera', 'Pera', ['pere'], 'Pears, raw', 'raw', 'frutta', []],
  ['kiwi', 'Kiwi', ['kiwi'], 'Kiwifruit, green, raw', 'raw', 'frutta', []],
  ['fragole', 'Fragole', ['fragole'], 'Strawberries, raw', 'raw', 'frutta', []],
  ['mirtilli', 'Mirtilli', ['mirtilli'], 'Blueberries, raw', 'raw', 'frutta', []],
  ['uva', 'Uva', ['uva'], 'Grapes, red or green (European type, such as Thompson seedless), raw', 'raw', 'frutta', []],
  ['datteri', 'Datteri secchi', ['datteri'], 'Dates, medjool', 'as_sold', 'frutta', []],
  ['uvetta', 'Uvetta', ['uva passa'], 'Raisins, dark, seedless (Includes foods for USDA\'s Food Distribution Program)', 'as_sold', 'frutta', []],
  ['albicocche_secche', 'Albicocche secche', ['albicocche disidratate'], 'Apricots, dried, sulfured, uncooked', 'as_sold', 'frutta', []],
  ['succo_arancia', 'Succo d\'arancia', ['spremuta', 'succo di arancia'], 'Orange juice, raw (Includes foods for USDA\'s Food Distribution Program)', 'as_sold', 'frutta', []],
  // Verdure
  ['pomodori', 'Pomodori', ['pomodoro'], 'Tomatoes, red, ripe, raw, year round average', 'raw', 'verdura', []],
  ['passata_pomodoro', 'Passata di pomodoro', ['passata', 'salsa di pomodoro'], 'Tomato products, canned, puree, without salt added', 'as_sold', 'verdura', []],
  ['pelati', 'Pomodori pelati in scatola', ['pelati'], 'Tomatoes, red, ripe, canned, packed in tomato juice', 'as_sold', 'verdura', []],
  ['zucchine', 'Zucchine', ['zucchina'], 'Squash, summer, zucchini, includes skin, raw', 'raw', 'verdura', []],
  ['broccoli', 'Broccoli', ['broccolo'], 'Broccoli, raw', 'raw', 'verdura', []],
  ['spinaci', 'Spinaci', ['spinacio'], 'Spinach, raw', 'raw', 'verdura', []],
  ['spinaci_surgelati', 'Spinaci surgelati', ['spinaci surgelati'], 'Spinach, frozen, chopped or leaf, unprepared (Includes foods for USDA\'s Food Distribution Program)', 'raw', 'verdura', []],
  ['carote', 'Carote', ['carota'], 'Carrots, raw', 'raw', 'verdura', []],
  ['peperoni', 'Peperoni rossi', ['peperone'], 'Peppers, sweet, red, raw', 'raw', 'verdura', []],
  ['cipolla', 'Cipolla', ['cipolle'], 'Onions, raw', 'raw', 'verdura', []],
  ['lattuga', 'Lattuga', ['insalata'], 'Lettuce, green leaf, raw', 'raw', 'verdura', []],
  ['cetrioli', 'Cetrioli', ['cetriolo'], 'Cucumber, with peel, raw', 'raw', 'verdura', []],
  ['melanzane', 'Melanzane', ['melanzana'], 'Eggplant, raw', 'raw', 'verdura', []],
  ['funghi', 'Funghi champignon', ['funghi'], 'Mushrooms, white, raw', 'raw', 'verdura', []],
  ['verdure_miste_surgelate', 'Verdure miste surgelate', ['minestrone surgelato', 'verdure surgelate'], 'Vegetables, mixed, frozen, unprepared', 'raw', 'verdura', []],
  ['mais_scatola', 'Mais dolce in scatola (sgocciolato)', ['mais'], 'Corn, sweet, yellow, canned, whole kernel, drained solids', 'drained', 'verdura', []],
  ['fagiolini', 'Fagiolini', ['fagiolini'], 'Beans, snap, green, raw', 'raw', 'verdura', []],
  ['cavolfiore', 'Cavolfiore', ['cavolfiore'], 'Cauliflower, raw', 'raw', 'verdura', []],
  ['rucola', 'Rucola', ['rucola'], 'Arugula, raw', 'raw', 'verdura', []],
  // Altro
  ['pesto_generico', 'Pesto al basilico (generico, può contenere formaggio)', ['pesto'], 'Sauce, pesto, ready-to-serve, refrigerated', 'as_sold', 'condimenti', ['formaggio', 'frutta_a_guscio_possibile']],
  ['maionese', 'Maionese', ['maionese'], 'Salad dressing, mayonnaise, regular', 'as_sold', 'condimenti', ['uova']],
  ['ketchup', 'Ketchup', ['ketchup'], 'Catsup', 'as_sold', 'condimenti', []],
  ['salsa_soia', 'Salsa di soia', ['salsa di soia'], 'Soy sauce made from soy and wheat (shoyu)', 'as_sold', 'condimenti', ['soia', 'glutine']],
  ['acqua', 'Acqua', ['acqua'], 'Beverages, water, tap, drinking', 'as_sold', 'bevande', []],
  ['bevanda_soia', 'Bevanda di soia', ['latte di soia'], 'Soymilk, original and vanilla, with added calcium, vitamins A and D', 'as_sold', 'bevande', ['soia']],
  ['cacao_amaro', 'Cacao amaro in polvere', ['cacao'], 'Cocoa, dry powder, unsweetened', 'as_sold', 'dolci', []],
  ['biscotti_secchi', 'Biscotti secchi', ['biscotti'], 'Cookies, butter, commercially prepared, enriched', 'as_sold', 'dolci', ['glutine', 'latte', 'uova']],
  // Lotto 2026-11 (proposte editoriali verificate sul dataset: descrizione USDA esatta, valori riletti dalla fonte)
  ['lamponi', 'Lamponi', ['lamponi'], 'Raspberries, raw', 'raw', 'frutta', []],
  ['asparagi', 'Asparagi', ['asparago'], 'Asparagus, raw', 'raw', 'verdura', []],
  ['crusca_avena', 'Crusca d’avena', ['crusca di avena'], 'Oat bran, raw', 'raw', 'cereali', ['glutine_possibile']],
  ['ananas', 'Ananas', ['ananas'], 'Pineapple, raw, all varieties', 'raw', 'frutta', []],
  ['barbabietola', 'Barbabietola rossa (cruda)', ['rapa rossa', 'barbabietola'], 'Beets, raw', 'raw', 'verdura', []],
  ['porri', 'Porri', ['porro'], 'Leeks, (bulb and lower leaf-portion), raw', 'raw', 'verdura', []],
  ['finocchi', 'Finocchi', ['finocchio'], 'Fennel, bulb, raw', 'raw', 'verdura', []],
  ['miglio', 'Miglio (secco, crudo)', ['miglio'], 'Millet, raw', 'raw', 'cereali', []],
  ['pesca', 'Pesca gialla', ['pesche'], 'Peaches, yellow, raw', 'raw', 'frutta', []],
  ['prugne', 'Prugne fresche', ['susine', 'prugne'], 'Plums, raw', 'raw', 'frutta', []],
  ['cavolo_rosso', 'Cavolo rosso', ['cavolo cappuccio rosso'], 'Cabbage, red, raw', 'raw', 'verdura', []],
  ['pistacchi', 'Pistacchi tostati non salati', ['pistacchi'], 'Nuts, pistachio nuts, dry roasted, without salt added', 'as_sold', 'frutta_secca', ['frutta_a_guscio']],
  ['orzo_perlato', 'Orzo perlato (secco, crudo)', ['orzo'], 'Barley, pearled, raw', 'raw', 'cereali', ['glutine']],
  ['semi_zucca', 'Semi di zucca sgusciati', ['semi di zucca'], 'Seeds, pumpkin and squash seed kernels, dried', 'as_sold', 'frutta_secca', []],
  ['grano_saraceno', 'Grano saraceno tostato (secco)', ['grano saraceno', 'kasha'], 'Buckwheat groats, roasted, dry', 'raw', 'cereali', []],
  ['bulgur', 'Bulgur (secco)', ['bulgur'], 'Bulgur, dry', 'raw', 'cereali', ['glutine']],
  ['albicocche', 'Albicocche fresche', ['albicocca'], 'Apricots, raw', 'raw', 'frutta', []],
  ['trota', 'Trota iridea d’allevamento (cruda)', ['trota'], 'Fish, trout, rainbow, farmed, raw', 'raw', 'pesce', ['pesce']],
  ['farina_ceci', 'Farina di ceci', ['farina di ceci'], 'Chickpea flour (besan)', 'raw', 'legumi', ['legumi']],
  ['sgombro', 'Sgombro atlantico (crudo)', ['sgombro'], 'Fish, mackerel, Atlantic, raw', 'raw', 'pesce', ['pesce']]
];

// Prodotti trasformati: possono contenere allergeni/tracce diversi dal generico → informazione 'sconosciuta'.
// Alimenti semplici (frutta, verdura, carne, pesce, uova, legumi, frutta secca, cereali in chicco): tag per composizione.
const PROCESSED = new Set(['pane_bianco', 'pane_integrale', 'tortilla', 'bagel', 'gallette_riso', 'cracker', 'corn_flakes', 'prosciutto_cotto', 'bresaola_manzo_essiccato', 'tonno_olio', 'sardine', 'proteine_siero', 'hummus', 'burro_arachidi', 'cioccolato_fondente', 'marmellata', 'pesto_generico', 'maionese', 'ketchup', 'salsa_soia', 'bevanda_soia', 'biscotti_secchi', 'passata_pomodoro', 'pelati', 'mais_scatola', 'ceci_scatola', 'fagioli_scatola', 'fagioli_neri_scatola', 'tofu', 'yogurt_greco_magro', 'yogurt_bianco_intero', 'mozzarella', 'ricotta', 'parmigiano', 'fiocchi_latte', 'datteri', 'uvetta', 'albicocche_secche', 'anacardi', 'arachidi', 'verdure_miste_surgelate', 'pistacchi', 'semi_zucca', 'farina_ceci', 'crusca_avena']);

const N = { '208': 'kcal', '203': 'protein', '205': 'carbs', '204': 'fat', '291': 'fiber' };
const out = [];
const missing = [];
for (const [slug, name, syn, desc, state, category, tags, pieceMod] of L) {
  const f = byDesc.get(desc.toLowerCase());
  if (!f) { missing.push(desc); continue; }
  const per100 = { kcal: null, protein: null, carbs: null, fat: null, fiber: null };
  for (const n of f.foodNutrients) {
    const k = N[n.nutrient?.number];
    if (k && typeof n.amount === 'number') per100[k] = Math.round(n.amount * 100) / 100;
  }
  let gramsPerPiece = null;
  if (pieceMod) {
    const p = (f.foodPortions ?? []).find((x) => (x.modifier ?? '').toLowerCase() === pieceMod.toLowerCase());
    if (p) gramsPerPiece = p.gramWeight;
  }
  out.push({
    id: `usda_${f.fdcId}`, slug, name, synonyms: syn, originalName: f.description, sourceId: String(f.fdcId),
    source: 'database', license: 'Pubblico dominio (CC0 1.0) — USDA FoodData Central, SR Legacy 2021-10-28',
    sourceNote: `USDA FoodData Central SR Legacy, fdcId ${f.fdcId} ("${f.description}"). Valori generici: per un prodotto specifico usa l'etichetta.`,
    sourceDate: '2021-10-28', verified: true, state, basis: '100g', per100, gramsPerPiece, category,
    tags, allergenInfo: PROCESSED.has(slug) ? 'unknown' : 'declared'
  });
}
if (missing.length) { console.error('NON TROVATI:\n' + missing.join('\n')); }
const meta = { catalog: 'foods', version: 4, generatedFrom: file, sourceSha256: sha, count: out.length, license: 'USDA FoodData Central: CC0 1.0 (pubblico dominio)' };
writeFileSync('src/catalog/foods.json', JSON.stringify({ meta, items: out }, null, 1));
console.log(`Scritti ${out.length} alimenti; mancanti ${missing.length}`);
