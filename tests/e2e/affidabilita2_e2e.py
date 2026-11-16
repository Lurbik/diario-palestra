"""Secondo audit, fase 1 · verifica nel browser (webapp-testing / Playwright) sulla build servita sotto /diario-palestra/.
Profilo vuoto, dati SINTETICI scritti in IndexedDB dopo l'avvio.

  Spesa:      lotto che scade prima del pasto · pasto confermato che occupa le scorte · barretta senza lotto pronto
  Fuori casa: stessa risposta in Settimana e Spuntino; il frigo a destinazione non copre il tragitto;
              con la borsa termica la ricetta entra in entrambe le schermate.
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


IDB = r"""
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await req(indexedDB.open('diario-palestra'));
  const all = async (store) => req(db.transaction(store).objectStore(store).getAll());
  const put = async (store, rows) => { const t = db.transaction([store], 'readwrite'); for (const r of rows) t.objectStore(store).put(r); await new Promise((r) => (t.oncomplete = r)); };
"""

SEED = "async () => {" + IDB + r"""
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(new Date());
  const day = (n) => fmt.format(new Date(Date.parse(today + 'T12:00:00Z') + n * 86400000));
  const now = Date.now();
  const foods = await all('foods');
  const F = (slug) => foods.find((f) => f.slug === slug);
  // Solo due ricette di catalogo restano attive: ceci croccanti (fuori frigo NON verificato) e barrette (lotto da 8)
  const recs = await all('recipes');
  await put('recipes', recs.map((r) => ({ ...r, archived: !['cr_sn_ceci_croccanti', 'cr_lotto_barrette'].includes(r.id) })));
  const R = (id, name, slots, slug, g) => ({ id, name, ingredients: [{ foodId: F(slug).id, qty: g, unit: 'g' }], servings: 1, steps: [], equipment: [], activeMin: 10, totalMin: 15, portable: false, eatCold: false, needsColdChain: false, storage: '', storageSource: '', mealSlots: slots, notes: '', seed: false, favorite: false, origin: 'user', portionSteps: [1] });
  await put('recipes', [R('e2e_riso', 'E2E Riso', ['pranzo'], 'riso_bianco', 100), R('e2e_ceci_pranzo', 'E2E Ceci pranzo', ['pranzo'], 'ceci_secchi', 100), R('e2e_ceci_cena', 'E2E Ceci cena', ['cena'], 'ceci_secchi', 100)]);
  // Dispensa: 100 g di riso che scadono domani (da consumarsi entro), 100 g di ceci secchi
  const L = (slug, qty, expiry, expiryType) => ({ id: 'e2e_lot_' + slug, foodId: F(slug).id, qty, unit: 'g', location: 'dispensa', purchasedAt: null, expiry, expiryType, openedAt: null, note: '' });
  await put('stock', [L('riso_bianco', 100, day(1), 'use_by'), L('ceci_secchi', 100, null, null)]);
  // Piano: riso dopodomani (bloccato); domani pranzo confermato + cena proposta sugli stessi ceci; domani una barretta
  const P = (id, d, slot, recipeId, extra) => ({ id, dateKey: d, slot, recipeId, foodId: null, servings: 1, locked: false, done: false, status: 'proposed', ...extra });
  await put('plan', [
    P('e2e_p1', day(2), 'pranzo', 'e2e_riso', { locked: true, status: 'confirmed' }),
    P('e2e_p2', day(1), 'pranzo', 'e2e_ceci_pranzo', { locked: true, status: 'confirmed' }),
    P('e2e_p3', day(1), 'cena', 'e2e_ceci_cena', {}),
    P('e2e_p4', day(1), 'merenda', 'cr_lotto_barrette', { locked: true, status: 'confirmed' })
  ]);
  // Settimana di lavoro/università; fuori casa: frigo a destinazione sì, borsa termica non indicata
  const kv = [{ key: 'pantryTracking', value: true, updatedAt: now }];
  for (let i = -7; i < 14; i++) kv.push({ key: 'dayType:' + day(i), value: 'universita', updatedAt: now });
  const st = (await all('kv')).find((x) => x.key === 'settings');
  kv.push({ ...st, value: { ...st.value, onboardingDone: true, profile: { ...st.value.profile, fridgeAway: 'si', coolerBag: null } } });
  await put('kv', kv);
  db.close();
  return { names: { riso: F('riso_bianco').name, ceci: F('ceci_secchi').name, avena: F('avena').name }, today };
}
"""

READ_PLAN = "async () => {" + IDB + r"""
  const rows = await all('plan'); const stock = await all('stock');
  db.close();
  return { plan: rows.map((p) => [p.dateKey, p.slot, p.recipeId, p.status]), stock: stock.map((l) => [l.id, l.qty]) };
}
"""


def shop_line(page, name):
    loc = page.locator(".setline", has_text=name)
    return loc.first.inner_text().replace("\n", " · ") if loc.count() else ""


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/oggi")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("text=Oggi")
    seed = page.evaluate(SEED)
    names = seed["names"]
    page.reload()
    page.wait_for_load_state("networkidle")
    stock_before = page.evaluate(READ_PLAN)["stock"]

    # ================= Spesa: casi 2, 3, 4
    page.goto(BASE + "#/cibo/spesa")
    page.wait_for_selector("text=Dal piano")
    page.wait_for_timeout(800)
    riso = shop_line(page, names["riso"])
    ceci = shop_line(page, names["ceci"])
    avena = shop_line(page, names["avena"])
    check("Caso 2 · riso: i 100 g in casa scadono domani, il pasto è dopodomani → da comprare 100 g", "da comprare 100 g" in riso, riso)
    check("Caso 3 · ceci: pranzo confermato + cena proposta → servono 200, in casa 100, da comprare 100 g", "servono 200 g" in ceci and "in casa 100" in ceci and "da comprare 100 g" in ceci, ceci)
    check("Caso 4 · una barretta senza lotto pronto: si prepara il lotto intero → avena da comprare 200 g (non 25)", "da comprare 200 g" in avena, avena)
    page.screenshot(path=f"{OUT}/1-spesa.png", full_page=True)

    # ================= Caso 1: fuori casa, Spuntino
    page.goto(BASE + "#/cibo/ricette")
    page.get_by_role("button", name="Spuntino salato da portare al lavoro").click()
    panel = page.get_by_test_id("work-snack")
    page.wait_for_timeout(300)
    empty = panel.get_by_text("Nessuno spuntino compatibile").count() > 0
    cold = panel.get_by_test_id("snack-needs-cold").inner_text() if panel.get_by_test_id("snack-needs-cold").count() else ""
    check("Spuntino, frigo a destinazione ma senza borsa termica: ceci croccanti (non verificati) NON proposti", empty and "Ceci croccanti" in cold, cold[:160])
    check("Spuntino spiega che il frigo a destinazione non copre il viaggio", "non copre il viaggio" in cold)
    page.screenshot(path=f"{OUT}/2-spuntino-senza-borsa.png", full_page=True)

    # ================= Caso 1: fuori casa, Settimana (stessa risposta)
    page.goto(BASE + "#/altro/calendario")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Genera / rigenera non bloccati").click()
    page.wait_for_timeout(2500)
    data = page.evaluate(READ_PLAN)
    sm = [x for x in data["plan"] if x[1] == "spuntino_mattina"]
    check("Settimana, stesso scenario: nessuno spuntino di metà mattina fuori casa con i ceci croccanti", not sm, str(sm[:3]))
    check("Settimana spiega perché lo slot resta vuoto (conservazione non verificata)", page.get_by_text("conservazione fuori frigo non verificata").count() > 0)
    kept = [x for x in data["plan"] if x[3] == "confirmed"]
    check("Settimana: i pasti confermati restano intatti", len(kept) == 3, str(kept))
    check("Generare il piano non consuma la dispensa reale", data["stock"] == stock_before, str(data["stock"]))
    page.screenshot(path=f"{OUT}/3-settimana-senza-borsa.png", full_page=False)

    # ================= Con la borsa termica: la ricetta entra in entrambe
    page.goto(BASE + "#/cibo/ricette")
    page.get_by_role("button", name="Spuntino salato da portare al lavoro").click()
    panel = page.get_by_test_id("work-snack")
    panel.get_by_role("button", name="uso la borsa termica").click()
    page.wait_for_timeout(500)
    nm = panel.get_by_test_id("snack-name").inner_text() if panel.get_by_test_id("snack-name").count() else ""
    rs = panel.get_by_test_id("snack-reasons").inner_text() if panel.get_by_test_id("snack-reasons").count() else ""
    check("Con la borsa termica lo Spuntino propone i ceci croccanti, con il motivo", "Ceci croccanti" in nm and "borsa termica" in rs, f"{nm} · {rs.replace(chr(10), ' | ')}")
    page.screenshot(path=f"{OUT}/4-spuntino-con-borsa.png", full_page=True)
    page.goto(BASE + "#/altro/calendario")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Genera / rigenera non bloccati").click()
    page.wait_for_timeout(2500)
    sm = [x for x in page.evaluate(READ_PLAN)["plan"] if x[1] == "spuntino_mattina"]
    check("Con la borsa termica anche la Settimana ammette fuori casa le ricette da tenere al freddo (ceci croccanti, barrette)", any(x[2] == "cr_sn_ceci_croccanti" for x in sm) and all(x[2] in ("cr_sn_ceci_croccanti", "cr_lotto_barrette") for x in sm), str(sm[:4]))

    check("Nessun errore JavaScript nella pagina", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
sys.exit(1 if failed else 0)
