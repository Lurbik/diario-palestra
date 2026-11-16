"""Brief atlante/coach, lotto 1: integratori (tre assi, utente nuovo, diario prese), dolore in seduta, priorità, scheda esercizio.
Dati SINTETICI; nessun dato personale."""
import os
import re
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

SEED_NEW = "async () => {" + IDB + r"""
  const st = (await all('kv')).find((x) => x.key === 'settings');
  await put('kv', [{ ...st, value: { ...st.value, onboardingDone: true } }]);
  db.close();
}
"""

SEED_MEDS = "async () => {" + IDB + r"""
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(new Date());
  const wdJs = new Date(today + 'T12:00:00Z').getUTCDay(); const wd = wdJs === 0 ? 7 : wdJs;
  const day = (n) => fmt.format(new Date(Date.parse(today + 'T12:00:00Z') + n * 86400000));
  const now = Date.now();
  const sessions = [];
  for (let i = 0; i < 10; i++) { const d = day(-2 - i * 2), t = Date.parse(d + 'T10:00:00Z'); sessions.push({ id: 'e2e_s' + i, programId: null, dayId: null, title: 'Seduta', dateKey: d, startedAt: t, endedAt: t + 3600000, pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false }); }
  await put('sessions', sessions);
  await put('weights', Array.from({ length: 20 }, (_, i) => ({ id: 'e2e_w' + i, dateKey: day(-19 + i), time: '07:30', kg: 75 + i * 0.05, morning: true, conditions: '', flags: [], note: '' })));
  const it = { id: 'e2e_i1', exerciseId: 'cx_chest_press', sets: 2, repMin: 8, repMax: 12, rirTargets: [null, null], restSec: 120, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' };
  await put('programs', [{ id: 'e2e_prog', name: 'Scheda E2E', kind: 'custom', origin: 'user', isActive: true, notes: '', createdAt: now, days: [{ id: 'e2e_day', name: 'Petto E2E', weekday: wd, items: [it] }] }]);
  const st = (await all('kv')).find((x) => x.key === 'settings');
  await put('kv', [{ ...st, value: { ...st.value, onboardingDone: true, profile: { ...st.value.profile, health: { meds: true } } } },
    { key: 'supplementLog', value: [{ id: 'creatina', start: day(-6), end: null }], updatedAt: now }]);
  db.close();
}
"""

READ = "async () => {" + IDB + r"""
  const kv = await all('kv'); const sets = await all('sets'); db.close();
  const g = (k) => (kv.find((x) => x.key === k) || {}).value;
  return { doses: g('supplementDoses') || [], focus: g('muscleFocus') || [], sets: sets.map((s) => ({ pain: s.pain, detail: s.painDetail })) };
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/oggi"); page.wait_for_load_state("networkidle"); page.wait_for_selector("text=Oggi")

    # ===== Utente nuovo: niente "non serve"
    page.evaluate(SEED_NEW); page.reload(); page.wait_for_load_state("networkidle")
    page.goto(BASE + "#/altro/integratori"); page.wait_for_selector("[data-testid=supp-creatina]")
    c = page.get_by_test_id("supp-creatina")
    st = c.get_by_test_id("supp-status").inner_text()
    check("Utente nuovo, zero sedute: creatina 'Mi serve un dato' con 'Non so ancora quanto ti alleni'", st == "Mi serve un dato" and "Non so ancora quanto ti alleni" in c.inner_text(), st)
    check("Le informazioni generali sono disponibili subito (riferimento e fonti)", "3–5 g" in c.inner_text() and "ISSN" in c.inner_text())
    page.screenshot(path=f"{OUT}/1-integratori-nuovo.png", full_page=False)

    # ===== Farmaci + creatina già in uso
    page.evaluate(SEED_MEDS); page.reload(); page.wait_for_load_state("networkidle")
    page.goto(BASE + "#/altro/integratori"); page.wait_for_selector("[data-testid=supp-creatina]")
    c = page.get_by_test_id("supp-creatina")
    first = page.locator("details[data-testid^=supp-]").first.get_attribute("data-testid")
    check("Farmaci + creatina in uso: cautela in cima, 'Prima il medico', etichetta 'Lo usi'", c.get_by_test_id("supp-status").inner_text() == "Prima il medico" and c.get_by_test_id("supp-caution").count() == 1 and c.get_by_test_id("supp-inuse").count() == 1, c.get_by_test_id("supp-caution").inner_text()[:120])
    check("Nessun riferimento di dose con la cautela attiva", "Esempio semplice: 3 g" not in c.inner_text() and "non mostra riferimenti di dose" in c.inner_text())
    check("Le cautele vengono prima degli altri integratori", first == "supp-creatina" or page.locator("details[data-testid^=supp-]").first.get_by_test_id("supp-status").inner_text() == "Prima il medico", first)
    # diario prese
    dl = c.get_by_test_id("dose-creatina")
    dl.get_by_label("Quantità (g)").fill("3")
    dl.get_by_role("button", name="Presa", exact=True).click(); page.wait_for_timeout(300)
    dl.get_by_role("button", name="Presa", exact=True).click(); page.wait_for_timeout(300)
    fmt_y = page.evaluate("() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date(Date.now() - 2 * 86400000))")
    dl.locator("input[type=date]").fill(fmt_y)
    dl.get_by_role("button", name="Saltata").click(); page.wait_for_timeout(400)
    d = page.evaluate(READ)
    today_doses = [x for x in d["doses"] if x["status"] == "taken"]
    check("Diario prese: due 'Presa' lo stesso giorno = una voce (3 g); retrodatata 'Saltata'", len(today_doses) == 1 and today_doses[0]["qty"] == 3 and any(x["status"] == "skipped" and x["day"] == fmt_y for x in d["doses"]), str(d["doses"]))
    strip = dl.locator(".dose-strip").inner_text()
    check("Striscia 14 giorni: presa, saltata e non registrata distinte", "●" in strip and "○" in strip and "·" in strip, strip)
    page.screenshot(path=f"{OUT}/2-integratori-cautela.png", full_page=True)

    # ===== Grafico del peso con l'inizio creatina
    page.goto(BASE + "#/progressi/peso"); page.wait_for_timeout(800)
    check("Peso: linea 'inizio creatina' nel grafico e nota sulla regola di prodotto", page.get_by_test_id("chart-marker").count() >= 1 and "regola di prodotto" in page.get_by_test_id("creatine-note").inner_text())

    # ===== Seduta: Fastidio o dolore?
    page.goto(BASE + "#/allenamento"); page.wait_for_load_state("networkidle")
    page.get_by_role("button", name=re.compile("^Inizia ")).first.click()
    page.wait_for_selector("text=Fastidio o dolore?")
    page.get_by_role("button", name="Aumenta").click(); page.wait_for_timeout(150)
    page.get_by_role("button", name="Fastidio o dolore?").click()
    page.get_by_role("group", name="Zona").get_by_role("button", name="Spalla").click()
    page.get_by_role("group", name="Lato").get_by_role("button", name="Destra").click()
    page.get_by_role("button", name="Durante la serie").click()
    sheet_txt = page.locator(".sheet").inner_text()
    check("Avviso d'urgenza per articolazione (niente testo lombare per la spalla)", "trauma" in sheet_txt and "urinare" not in sheet_txt)
    page.get_by_role("button", name="Segna sulla serie e continua").click()
    check("Pulsante accanto a Salva: 'Dolore ✓'", page.get_by_role("button", name=re.compile("Dolore segnato")).count() == 1)
    page.screenshot(path=f"{OUT}/3-seduta-dolore.png", full_page=False)
    page.get_by_role("button", name=re.compile("^Salva serie")).click(); page.wait_for_timeout(600)
    d = page.evaluate(READ)
    check("Serie salvata con pain=true e dettagli (spalla, destra, durante)", any(s["pain"] and s["detail"] and s["detail"]["zone"] == "spalla" and s["detail"]["side"] == "dx" for s in d["sets"]), str(d["sets"]))
    check("Avviso nella seduta: niente carichi più alti su questo movimento oggi", page.get_by_test_id("pain-banner").count() == 1 and "carichi più alti" in page.get_by_test_id("pain-banner").inner_text())
    check("Il modulo della serie successiva NON è segnato con dolore (non si chiede a ogni serie)", page.get_by_role("button", name="Fastidio o dolore?").count() == 1)

    # ===== Priorità dall'atlante, visibile nel profilo
    page.goto(BASE + "#/progressi/atlante"); page.wait_for_selector("[data-testid=atlas-list]")
    page.get_by_test_id("atlas-list").get_by_role("button", name=re.compile("^Grande pettorale, capo sternocostale")).click(timeout=15000)
    page.get_by_test_id("atlas-focus").click(); page.wait_for_timeout(300)
    d = page.evaluate(READ)
    check("Un tocco dall'atlante: petto tra le priorità", d["focus"] == ["petto"], str(d["focus"]))
    page.goto(BASE + "#/altro/impostazioni"); page.wait_for_selector("[data-testid=focus-summary]")
    page.get_by_test_id("focus-summary").get_by_text("Petto").wait_for(state="attached", timeout=5000)
    check("Priorità visibile e revocabile nel profilo", "Petto" in page.get_by_test_id("focus-summary").text_content(), page.get_by_test_id("focus-summary").text_content()[:80])

    # ===== Scheda esercizio: campi editoriali
    page.goto(BASE + "#/allenamento/esercizio/cx_high_row"); page.wait_for_selector("[data-testid=ex-editorial]")
    ed = page.get_by_test_id("ex-editorial").inner_text()
    check("Scheda esercizio: quando sceglierlo, dove metterlo, limiti del confronto, alternative", all(k in ed for k in ["Quando sceglierlo", "Dove metterlo", "non confrontabili", "Alternative se è occupato"]), ed[:160].replace("\n", " | "))
    page.goto(BASE + "#/allenamento/esercizio/cx_panca_piana_bil"); page.wait_for_selector("[data-testid=ex-editorial]")
    check("Esercizio senza scheda editoriale: lo dice invece di inventare", "non ancora compilata" in page.get_by_test_id("ex-editorial").inner_text())

    check("Nessun errore JavaScript nella pagina", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
sys.exit(1 if failed else 0)
