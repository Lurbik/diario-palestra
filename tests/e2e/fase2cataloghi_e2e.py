"""Secondo audit, fase 2 · verifica nel browser: integratori dai dati, unità secondi, ricette e catalogo nuovi.
Dati SINTETICI scritti in IndexedDB dopo l'avvio; nessun dato personale.
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
  const wdJs = new Date(today + 'T12:00:00Z').getUTCDay(); const wd = wdJs === 0 ? 7 : wdJs;
  const day = (n) => fmt.format(new Date(Date.parse(today + 'T12:00:00Z') + n * 86400000));
  const at = (d, hh) => Date.parse(d + 'T' + hh + ':00+01:00');
  const now = Date.now();
  // 12 sedute concluse negli ultimi 28 giorni, tutte finite alle 21:00 (vicine al sonno: sveglia 07:00, 8 h)
  const sessions = [];
  for (let i = 0; i < 12; i++) { const d = day(-2 - i * 2); sessions.push({ id: 'e2e_s' + i, programId: null, dayId: null, title: 'Seduta', dateKey: d, startedAt: at(d, '19:45'), endedAt: at(d, '21:00'), pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false }); }
  await put('sessions', sessions);
  await put('weights', [{ id: 'e2e_w', dateKey: day(-1), time: '07:30', kg: 80, morning: true, conditions: '', flags: [], note: '' }]);
  // 6 giorni completi con 100 g di proteine note
  const diary = [], kv = [];
  for (let i = 1; i <= 6; i++) { const d = day(-i); diary.push({ id: 'e2e_d' + i, dateKey: d, meal: 'pranzo', kind: 'estimate', label: 'Pasto', foodId: null, batchId: null, recipeId: null, qty: null, unit: 'porzione', nutrients: { kcal: 2400, protein: 100, carbs: 300, fat: 80, fiber: 25 }, estimated: true, txId: null, createdAt: now }); kv.push({ key: 'diaryComplete:' + d, value: true, updatedAt: now }); }
  await put('diary', diary);
  // Scheda con plank (secondi) oggi
  const item = { id: 'i1', exerciseId: 'cx_plank', sets: 2, repMin: 20, repMax: 45, rirTargets: [null, null], restSec: 90, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' };
  await put('programs', [{ id: 'e2e_prog', name: 'Scheda E2E', kind: 'custom', origin: 'user', isActive: true, notes: '', createdAt: now, days: [{ id: 'e2e_day', name: 'Core E2E', weekday: wd, items: [item] }] }]);
  const st = (await all('kv')).find((x) => x.key === 'settings');
  kv.push({ ...st, value: { ...st.value, onboardingDone: true, sleepTargetH: 8, sleepPlan: { ...st.value.sleepPlan, wakeTime: '07:00' } } });
  await put('kv', kv);
  db.close();
  return today;
}
"""

READ = "async () => {" + IDB + r"""
  const kv = await all('kv'); db.close();
  return { log: (kv.find((k) => k.key === 'supplementLog') || {}).value || [], settings: kv.find((k) => k.key === 'settings').value.profile };
}
"""


def status(page, sid):
    card = page.get_by_test_id(f"supp-{sid}")
    return card.get_by_test_id("supp-status").inner_text(), card.get_by_test_id("supp-reasons").inner_text().replace("\n", " | ")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/oggi")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("text=Oggi")
    page.evaluate(SEED)
    page.reload()
    page.wait_for_load_state("networkidle")

    # ================= Integratori
    page.goto(BASE + "#/altro/integratori")
    page.wait_for_selector("[data-testid=supp-creatina]")
    s, r = status(page, "creatina")
    check("Creatina 'Da considerare' con il numero di sedute registrate", s == "Da considerare" and "12 volte" in r, f"{s} · {r[:150]}")
    page.get_by_test_id("supp-caffeina").locator("summary").click()
    s, r = status(page, "caffeina")
    check("Caffeina 'Sconsigliato': le sedute finiscono a meno di 6 ore dal letto", s == "Sconsigliato" and "6 ore" in r, f"{s} · {r[:160]}")
    page.get_by_test_id("supp-proteine_polvere").locator("summary").click()
    s, r = status(page, "proteine_polvere")
    check("Proteine in polvere 'Prima il cibo': 100 g/die su 6 giorni, 28 g sotto il riferimento di 128 g", s == "Prima il cibo" and "28 g sotto" in r, f"{s} · {r[:160]}")
    page.get_by_test_id("supp-bcaa").locator("summary").click()
    check("BCAA 'Sconsigliato'", status(page, "bcaa")[0] == "Sconsigliato")
    page.get_by_test_id("supp-vitamina_d").locator("summary").click()
    check("Vitamina D 'Prima un esame'", status(page, "vitamina_d")[0] == "Prima un esame")
    page.screenshot(path=f"{OUT}/1-integratori.png", full_page=True)
    page.get_by_test_id("supp-creatina").get_by_role("button", name="Lo sto usando da oggi").click()
    page.wait_for_timeout(600)
    d = page.evaluate(READ)
    check("Salvato: creatina segnata con data di inizio (usata per sospendere le modifiche alle calorie)", any(l["id"] == "creatina" and not l.get("end") for l in d["log"]), str(d["log"]))
    check("Stato aggiornato: 'Lo stai usando'", status(page, "creatina")[0] == "Lo stai usando")
    page.get_by_role("button", name="Problemi ai reni").click()
    page.wait_for_timeout(600)
    s, r = status(page, "creatina")
    check("Indicando problemi ai reni: creatina 'Prima il medico'", s == "Prima il medico", f"{s} · {r[:120]}")
    d = page.evaluate(READ)
    check("Domanda di sicurezza salvata solo nel profilo locale", d["settings"].get("health", {}).get("kidney") is True)
    page.get_by_role("button", name="Problemi ai reni").click()
    page.get_by_role("button", name="Vegana").click()
    page.wait_for_timeout(600)
    page.get_by_test_id("supp-b12").locator("summary").click() if page.get_by_test_id("supp-b12").get_attribute("open") is None else None
    check("Alimentazione vegana: vitamina B12 'Da considerare'", status(page, "b12")[0] == "Da considerare")
    page.screenshot(path=f"{OUT}/2-integratori-vegana.png", full_page=True)

    # ================= Unità secondi nella seduta
    page.goto(BASE + "#/allenamento")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Inizia Core E2E").click()
    page.wait_for_selector("h1:has-text('Plank')")
    seg = page.locator(".seg").inner_text()
    check("Plank: si registrano 'Secondi', non ripetizioni né parziali", "Secondi" in seg and "Complete" not in seg and "Parziali" not in seg, seg.replace("\n", " | "))
    page.get_by_role("button", name="Aumenta").click()
    page.wait_for_timeout(300)
    first = page.locator("#cmp-value").input_value()
    page.get_by_role("button", name="Aumenta").click()
    page.wait_for_timeout(300)
    v = page.locator("#cmp-value").input_value()
    check("Il + parte dal minimo del range (20 s) e poi avanza di 5 s", first == "20" and v == "25", f"dopo il primo + {first}, dopo il secondo {v}")
    page.screenshot(path=f"{OUT}/3-plank-secondi.png", full_page=True)

    # ================= Ricetta nuova: fonti e conservazione
    page.goto(BASE + "#/cibo/ricetta/cr_esp_trota")
    page.wait_for_selector("h1:has-text('Trota')")
    ing = page.locator("h2:has-text('Ingredienti') + ul").inner_text()
    amb = page.get_by_test_id("ambient-info").inner_text()
    check("Ricetta nuova: ingredienti con fonte USDA fdcId e stato del peso", "USDA fdcId" in ing and "crudo" in ing.lower(), ing.split("\n")[0])
    check("Ricetta nuova: non trasportabile e fuori frigo non verificato", "Trasportabile: no" in amb and "non verificato" in amb, amb.replace("\n", " | "))

    check("Nessun errore JavaScript nella pagina", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
sys.exit(1 if failed else 0)
