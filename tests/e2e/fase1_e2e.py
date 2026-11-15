"""Verifica end-to-end della Fase 1 (webapp-testing / Playwright) sulla build di produzione servita sotto
/diario-palestra/ come su GitHub Pages. Profilo browser vuoto ad ogni esecuzione; dati di prova SINTETICI
scritti in IndexedDB dopo l'avvio dell'app (nessun dato personale).

Uso:  python .claude/skills/webapp-testing/scripts/with_server.py \
        --server "npx vite preview --port 4174 --strictPort --base /diario-palestra/" --port 4174 \
        -- python tests/e2e/fase1_e2e.py
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4174/diario-palestra/"
OUT = os.environ.get("E2E_OUT", "e2e-screens")
os.makedirs(OUT, exist_ok=True)
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("OK   " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""))


def read_load_and_source(page):
    """Proposta B: il carico si legge selezionando il campo 'Carico'; l'origine è nel title dell'etichetta."""
    page.get_by_role("button", name="Carico", exact=True).click()
    page.wait_for_timeout(150)
    value = page.locator("#cmp-value").input_value()
    badge = page.locator(".badge.accent").first.get_attribute("title") if page.locator(".badge.accent").count() else ""
    page.get_by_role("button", name="Complete", exact=True).click()
    return value, badge or ""

SEED = r"""
async () => {
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await req(indexedDB.open('diario-palestra'));
  const tx = (stores) => db.transaction(stores, 'readwrite');
  const put = async (store, rows) => { const t = tx([store]); for (const r of rows) t.objectStore(store).put(r); await new Promise((r) => (t.oncomplete = r)); };
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(new Date());
  const wdJs = new Date(today + 'T12:00:00Z').getUTCDay(); const wd = wdJs === 0 ? 7 : wdJs;
  const day = (n) => fmt.format(new Date(Date.parse(today + 'T12:00:00Z') + n * 86400000));
  const now = Date.now();
  // Due macchine sintetiche con incrementi diversi
  const M = (id, name, inc) => ({ id, name, category: 'Test', brand: '', model: '', seat: '', backrest: '', rollers: '', grip: '', camLever: '', loadPoints: '', minLoadKg: null, increments: [inc], barWeightKg: null, pulleyRatio: null, maxedOut: false, photoId: null, notes: '', toConfirm: [], origin: 'user' });
  const E = (id, name, machineId) => ({ id, name, aliases: [], variant: '', machineId, equipment: 'Macchina', primaryMuscles: ['petto'], secondaryMuscles: [], loadConvention: 'machine_stack', unilateral: false, romType: 'full', configVersion: 1, configNote: '', techNotes: '', toConfirm: [], policyClass: 'compound', origin: 'user' });
  await put('machines', [M('e2e_m5', 'Macchina scatto 5', 5), M('e2e_m25', 'Macchina scatto 2,5', 2.5)]);
  await put('exercises', [E('e2e_hold', 'E2E Spinta consolidamento', 'e2e_m5'), E('e2e_up', 'E2E Spinta aumento', 'e2e_m25')]);
  const item = (id, ex) => ({ id, exerciseId: ex, sets: 2, repMin: 6, repMax: 8, rirTargets: [null, null], restSec: 120, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' });
  await put('programs', [{ id: 'e2e_prog', name: 'Scheda E2E', kind: 'custom', origin: 'user', isActive: true, notes: '', createdAt: now, days: [{ id: 'e2e_day', name: 'Giorno E2E', weekday: wd, items: [item('i1', 'e2e_hold'), item('i2', 'e2e_up')] }] }]);
  // Storico: due sedute concluse (−14 e −7 giorni). Consolidamento a 20 kg (scatto 5 = 25%), aumento a 30 kg (scatto 2,5 = 8%).
  const sessions = [], sets = [];
  for (const [k, d] of [[1, -14], [2, -7]]) {
    const sid = 'e2e_s' + k, t = now + d * 86400000;
    sessions.push({ id: sid, programId: 'e2e_prog', dayId: 'e2e_day', title: 'Giorno E2E', dateKey: day(d), startedAt: t, endedAt: t + 3600000, pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false });
    let o = 0;
    for (const [ex, m, load] of [['e2e_hold', 'e2e_m5', 20], ['e2e_up', 'e2e_m25', 30]]) for (let j = 0; j < 2; j++) sets.push({ id: `${sid}_${ex}_${j}`, sessionId: sid, exerciseId: ex, configKey: `${ex}|${m}|v1|full|machine_stack`, itemIndex: ex === 'e2e_hold' ? 0 : 1, kind: 'working', order: ++o, load, loadConvention: 'machine_stack', unilateral: false, romType: 'full', fullReps: 8, validReps: 8, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 2, rirUnknown: false, restBeforeSec: j ? 120 : null, pain: false, painNote: '', techIssue: false, notes: '', savedAt: t + o * 60000 });
  }
  await put('sessions', sessions); await put('sets', sets);
  // Valore "25 kg" salvato dalla versione con il bug, da annullare con "Mantieni"
  await put('kv', [{ key: 'acceptedLoad:e2e_hold|e2e_m5|v1|full|machine_stack', value: { load: 25, at: now }, updatedAt: now }]);
  // Pasti: archivia le ricette del catalogo e lascia una sola ricetta valida solo a pranzo
  const recs = await req(db.transaction('recipes').objectStore('recipes').getAll());
  await put('recipes', recs.map((r) => ({ ...r, archived: true })));
  const foods = await req(db.transaction('foods').objectStore('foods').getAll());
  const f = foods.find((x) => x.slug === 'riso_bianco');
  await put('recipes', [{ id: 'e2e_solo_pranzo', name: 'E2E Riso solo pranzo', ingredients: [{ foodId: f.id, qty: 80, unit: 'g' }], servings: 1, steps: [], equipment: [], activeMin: 10, totalMin: 15, portable: false, eatCold: false, needsColdChain: false, storage: '', storageSource: '', mealSlots: ['pranzo'], notes: '', seed: false, favorite: false, origin: 'user', portionSteps: [1] }]);
  // Calorie: 14 giorni di pesate, target impostato, giorni "completi" ma con una voce senza kcal
  const weights = [], diary = [], kvs = [];
  for (let i = 0; i < 14; i++) {
    const d = day(-13 + i);
    weights.push({ id: 'e2e_w' + i, dateKey: d, time: '07:30', kg: 70, morning: true, conditions: '', flags: [], note: '' });
    diary.push({ id: 'e2e_d' + i, dateKey: d, meal: 'pranzo', kind: 'estimate', label: 'Pasto senza kcal', foodId: null, batchId: null, recipeId: null, qty: null, unit: 'porzione', nutrients: { kcal: null, protein: 30, carbs: null, fat: null, fiber: null }, estimated: true, txId: null, createdAt: now });
    diary.push({ id: 'e2e_e' + i, dateKey: d, meal: 'cena', kind: 'estimate', label: 'Pasto noto', foodId: null, batchId: null, recipeId: null, qty: null, unit: 'porzione', nutrients: { kcal: 900, protein: 40, carbs: null, fat: null, fiber: null }, estimated: true, txId: null, createdAt: now });
    kvs.push({ key: 'diaryComplete:' + d, value: true, updatedAt: now });
  }
  await put('weights', weights); await put('diary', diary); await put('kv', kvs);
  await put('targets', [{ id: 'e2e_t', createdAt: now - 30 * 86400000, effectiveFrom: day(-30), kcal: 2500, proteinG: null, mode: 'manual', reason: 'E2E' }]);
  const st = await req(db.transaction('kv').objectStore('kv').get('settings'));
  await put('kv', [{ ...st, value: { ...st.value, onboardingDone: true } }]);
  db.close();
  return today;
}
"""

READ_PLAN = r"""
async () => {
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await req(indexedDB.open('diario-palestra'));
  const rows = await req(db.transaction('plan').objectStore('plan').getAll());
  const kv = await req(db.transaction('kv').objectStore('kv').getAll());
  db.close();
  return { plan: rows.map((p) => [p.dateKey, p.slot, p.recipeId]), accepted: kv.filter((k) => k.key.startsWith('acceptedLoad:')).map((k) => [k.key.split('|')[0], k.value.load]) };
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/oggi")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("text=Oggi")
    today = page.evaluate(SEED)
    page.reload()
    page.wait_for_load_state("networkidle")

    # ---- 2. Carichi: suggerimento mostrato
    page.goto(BASE + "#/progressi/allenamento")
    page.wait_for_selector("text=E2E Spinta consolidamento")
    card_hold = page.locator(".card", has_text="E2E Spinta consolidamento")
    card_up = page.locator(".card", has_text="E2E Spinta aumento")
    check("Consolidamento mostrato come 'Mantieni 20 kg: lo scatto successivo è di 5 kg'", card_hold.get_by_text("Mantieni 20 kg: lo scatto successivo è di 5 kg").count() > 0)
    check("Consolidamento: nessun pulsante 'Applica'", card_hold.get_by_role("button", name="Applica").count() == 0)
    check("Aumento: pulsante 'Applica 32,5 kg'", card_up.get_by_role("button", name="Applica 32,5 kg").count() == 1)
    page.screenshot(path=f"{OUT}/1-progressi-decisioni.png", full_page=True)
    card_hold.get_by_role("button", name="Mantieni 20 kg").click()
    page.wait_for_timeout(500)
    card_up.get_by_role("button", name="Applica 32,5 kg").click()
    page.wait_for_timeout(500)
    saved = page.evaluate(READ_PLAN)["accepted"]
    check("Salvato: nessun carico accettato per l'esercizio mantenuto (il 25 del bug è rimosso)", not any(k.endswith("e2e_hold") for k, _ in saved), str(saved))
    check("Salvato: 32,5 kg accettati per l'esercizio in aumento", ["acceptedLoad:e2e_up", 32.5] in [list(x) for x in saved], str(saved))

    # ---- Riapertura dell'app e seduta successiva: carico visibile nel campo
    page.close()
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/allenamento")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Inizia Giorno E2E").click()
    page.wait_for_selector("text=E2E Spinta consolidamento")
    page.wait_for_timeout(700)
    load1, badge1 = read_load_and_source(page)
    page.screenshot(path=f"{OUT}/2-seduta-mantieni-20.png", full_page=True)
    check("Seduta successiva: 'Mantieni 20 kg' → nel campo carico compare 20", load1 == "20", f"campo='{load1}' etichetta='{badge1}'")
    page.get_by_role("button", name="Esercizio successivo").click()
    page.wait_for_selector("h1:has-text('E2E Spinta aumento')")
    page.wait_for_timeout(700)
    load2, badge2 = read_load_and_source(page)
    page.screenshot(path=f"{OUT}/3-seduta-applica-32-5.png", full_page=True)
    check("Seduta successiva: 'Applica 32,5 kg' → nel campo carico compare 32,5 (da confermare)", load2 == "32,5" and "proposta accettata" in badge2, f"campo='{load2}' etichetta='{badge2}'")
    reps = page.locator("#cmp-value").input_value()
    check("Ripetizioni non precompilate (mai copiate dalla seduta precedente)", reps == "", f"ripetizioni='{reps}'")
    # Termina la seduta vuota senza salvare serie
    page.get_by_role("button", name="Termina").click()
    try:
        page.get_by_role("button", name="Elimina seduta vuota").click(timeout=5000)
    except Exception:
        page.screenshot(path=f"{OUT}/debug-termina.png", full_page=True)
        raise

    # ---- 1. Pasti: Calendario → genera → voce al posto giusto
    page.wait_for_url("**#/allenamento")
    page.wait_for_timeout(300)
    page.goto(BASE + "#/altro/calendario")
    page.wait_for_load_state("networkidle")
    try:
        page.get_by_role("button", name="Genera / rigenera non bloccati").click(timeout=8000)
    except Exception:
        page.screenshot(path=f"{OUT}/debug-calendario.png", full_page=True)
        print("URL:", page.url)
        raise
    page.wait_for_timeout(2500)
    data = page.evaluate(READ_PLAN)["plan"]
    todays = [x for x in data if x[0] == today]
    check("Piano salvato oggi: solo pranzo con la ricetta valida, nessuna voce a colazione", todays == [[today, "pranzo", "e2e_solo_pranzo"]], str(todays))
    day_card = page.locator("section.card").filter(has_text="Colazione").filter(has_text="E2E Riso solo pranzo").first
    txt = day_card.inner_text()
    lines = [l.strip() for l in txt.split("\n") if l.strip()]
    pranzo_ok = any("Pranzo" in l for l in lines) and lines[lines.index(next(l for l in lines if "Pranzo" in l)) + 1] == "E2E Riso solo pranzo"
    colaz_empty = lines[lines.index(next(l for l in lines if "Colazione" in l)) + 1] == "—"
    check("Calendario visibile: Colazione '—', Pranzo 'E2E Riso solo pranzo'", pranzo_ok and colaz_empty)
    check("Messaggio che spiega lo slot vuoto", page.get_by_text("colazione: nessuna ricetta ammissibile").count() > 0)
    page.screenshot(path=f"{OUT}/4-calendario-pasti.png", full_page=False)

    # ---- 4. Calorie
    page.goto(BASE + "#/progressi/peso")
    page.wait_for_selector("text=Proposta calorie")
    check("Calorie: nessuna modifica proposta, con motivo (valori energetici mancanti, non zero)", (page.get_by_text("Consumo non calcolabile: nessuna modifica").count() + page.get_by_text("Dati insufficienti: nessuna modifica").count()) > 0 and page.get_by_text("un valore mancante non vale zero").count() > 0)
    page.get_by_text("Qualità dei dati").click()
    check("Calorie: giorni con valori mancanti esclusi e dichiarati", page.get_by_text("14 esclusi per valori mancanti").count() > 0)
    check("Calorie: nessun pulsante 'Accetta' o '+100 kcal'", page.get_by_role("button", name="Accetta").count() == 0 and page.get_by_text("+100 kcal").count() == 0)
    page.screenshot(path=f"{OUT}/5-calorie.png", full_page=True)

    check("Nessun errore JavaScript nella pagina", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
sys.exit(1 if failed else 0)
