"""Atlante anatomico (anteprima spalla, petto, coscia): tocco sulla mappa, schede, lavoro registrato, ricerca, zoom, offline.
Dati SINTETICI; nessun dato personale."""
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


SEED = r"""
async () => {
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await req(indexedDB.open('diario-palestra'));
  const put = async (store, rows) => { const t = db.transaction([store], 'readwrite'); for (const r of rows) t.objectStore(store).put(r); await new Promise((r) => (t.oncomplete = r)); };
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  const d = fmt.format(new Date(Date.now() - 86400000));
  const t = Date.now() - 86400000;
  await put('sessions', [{ id: 'e2e_s', programId: null, dayId: null, title: 'Seduta', dateKey: d, startedAt: t, endedAt: t + 3600000, pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false }]);
  const S = (i, ex) => ({ id: 'e2e_set' + i, sessionId: 'e2e_s', exerciseId: ex, configKey: ex, itemIndex: 0, kind: 'working', order: i, load: 50, loadConvention: 'machine_stack', unilateral: false, romType: 'full', fullReps: 10, validReps: 10, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 2, rirUnknown: false, restBeforeSec: 120, pain: false, painNote: '', techIssue: false, notes: '', savedAt: t + i });
  await put('sets', [S(1, 'cx_chest_press'), S(2, 'cx_chest_press'), S(3, 'cx_chest_press'), S(4, 'cx_leg_ext'), S(5, 'cx_leg_ext')]);
  const st = await req(db.transaction('kv').objectStore('kv').get('settings'));
  await put('kv', [{ ...st, value: { ...st.value, onboardingDone: true, profile: { ...st.value.profile, equipment: 'casa_manubri' } } }]);
  db.close();
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/oggi"); page.wait_for_load_state("networkidle"); page.wait_for_selector("text=Oggi")
    page.evaluate(SEED); page.reload(); page.wait_for_load_state("networkidle")

    page.goto(BASE + "#/progressi/muscoli")
    page.get_by_role("link", name="Atlante anatomico (anteprima: spalla, petto, coscia)").click()
    page.wait_for_selector("[data-testid=atlas-map] svg [data-s]")
    n = page.locator("[data-testid=atlas-map] [data-s]").count()
    check("Atlante caricato con le strutture selezionabili (entrambi i lati)", n >= 20, f"{n} zone")
    page.screenshot(path=f"{OUT}/1-atlante-esplora.png", full_page=True)

    # Tocco sul petto (lato sinistro e destro dell'immagine)
    page.locator("[data-s=pettorale_sternocostale]").nth(1).click(force=True)
    card = page.get_by_test_id("atlas-card")
    check("Tocco sul petto → scheda 'Grande pettorale, capo sternocostale' con cosa fa e fonte OpenStax", "capo sternocostale" in card.inner_text() and "OpenStax" in card.inner_text(), card.inner_text()[:120].replace("\n", " | "))
    sel = page.locator("[data-s=pettorale_sternocostale].atlas-sel").count()
    check("La zona selezionata ha il contorno evidenziato", sel >= 1, f"{sel} elementi")
    card.get_by_role("tab", name="Come allenarlo").click()
    how = page.get_by_test_id("atlas-how").inner_text()
    check("'Come allenarlo' filtrato per l'attrezzatura (casa con manubri): niente chest press, sì esercizi con manubri", "Chest press" not in how and "manubri" in how.lower(), how[:200].replace("\n", " | "))
    card.get_by_role("tab", name="Cosa ho fatto io").click()
    mine = page.get_by_test_id("atlas-mine").inner_text()
    check("'Cosa ho fatto io': 3 serie dirette di petto negli ultimi 7 giorni, con l'esercizio", "3 serie dirette" in mine and "Chest press" in mine, mine[:200].replace("\n", " | "))

    # Il mio lavoro: scala fissa con numeri e legenda
    page.get_by_role("button", name="Il mio lavoro").click(); page.wait_for_timeout(300)
    cls = page.locator("[data-s=pettorale_sternocostale]").first.get_attribute("class")
    check("Il mio lavoro: petto (3 serie) nella fascia 1–5 della scala fissa", "atlas-w1" in cls, cls)
    check("Legenda con numeri e tratteggio per le sole indirette", page.get_by_text("solo serie indirette").count() > 0 and page.get_by_text("12 o più serie dirette").count() > 0)
    page.locator("[data-s=deltoide]").first.click(force=True)
    mine = page.get_by_test_id("atlas-mine").inner_text()
    check("Deltoide senza serie dirette: tre porzioni con i numeri e nessuna deduzione sullo sviluppo", "Deltoidi anteriori" in mine and "non significa che il muscolo sia poco sviluppato" in mine, mine[:220].replace("\n", " | "))
    page.screenshot(path=f"{OUT}/2-atlante-lavoro.png", full_page=True)

    # Ricerca nella lista, muscolo profondo solo testuale
    page.fill("#atlas-q", "vasto")
    items = page.get_by_test_id("atlas-list").inner_text()
    check("Ricerca 'vasto': elenco filtrato con il vasto intermedio segnato come profondo", "Vasto intermedio" in items and "profondo, solo scheda" in items and "Deltoide" not in items, items.replace("\n", " | ")[:200])
    page.get_by_role("button", name="Vasto intermedio").click()
    check("Muscolo profondo: scheda testuale, nessuna zona inventata", "nessuna zona disegnata" in page.get_by_test_id("atlas-card").inner_text())

    # Zoom e vista posteriore
    page.get_by_role("button", name="Zoom spalle e petto").click(); page.wait_for_timeout(200)
    vb = page.locator("[data-testid=atlas-map] svg").get_attribute("viewBox")
    check("Zoom su spalle e petto", vb == "40 52 125 72", vb)
    page.screenshot(path=f"{OUT}/3-atlante-zoom.png", full_page=False)
    page.get_by_role("button", name="Dietro").click(); page.wait_for_timeout(200)
    check("Vista posteriore", page.locator("[data-testid=atlas-map] svg").get_attribute("viewBox").startswith("203"))
    check("Attribuzione e licenza visibili", page.get_by_text("CC BY-SA 4.0").count() > 0)

    # Offline: dopo il primo caricamento, l'atlante si apre senza rete
    page.evaluate("async () => { if ('serviceWorker' in navigator) { await navigator.serviceWorker.ready; } }")
    page.wait_for_timeout(1500)
    ctx.set_offline(True)
    page.goto(BASE + "#/oggi"); page.reload(); page.wait_for_timeout(1500)
    page.goto(BASE + "#/progressi/atlante")
    try:
        page.wait_for_selector("[data-testid=atlas-map] svg [data-s]", timeout=8000); off = True
    except Exception:
        off = False
    check("Offline: l'atlante si apre anche senza rete", off)
    ctx.set_offline(False)

    check("Nessun errore JavaScript nella pagina", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
sys.exit(1 if failed else 0)
