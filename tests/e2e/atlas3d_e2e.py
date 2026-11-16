"""Atlante 3D, primo lotto (spalla e petto): pacchetto scaricabile, selezione da lista e da tocco, andata e ritorno
con una scheda esercizio, vista inversa dall'esercizio, offline, fallback 2D. WebGL in emulazione software (SwiftShader):
le prestazioni misurate qui NON rappresentano un telefono reale."""
import os
import re
import sys
import time
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
  const st = await req(db.transaction('kv').objectStore('kv').get('settings'));
  const t = db.transaction(['kv'], 'readwrite'); t.objectStore('kv').put({ ...st, value: { ...st.value, onboardingDone: true } }); await new Promise((r) => (t.oncomplete = r));
  db.close();
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/oggi"); page.wait_for_load_state("networkidle"); page.wait_for_selector("text=Oggi")
    page.evaluate(SEED); page.reload(); page.wait_for_load_state("networkidle")

    # Muscoli: niente sagoma schematica, atlante in primo piano
    page.goto(BASE + "#/progressi/muscoli"); page.wait_for_selector("[data-testid=open-atlas]")
    check("Progressi → Muscoli: nessuna sagoma schematica, atlante in primo piano", page.locator(".body-svg, svg.body").count() == 0 and page.get_by_test_id("open-atlas").count() == 1)
    page.get_by_test_id("open-atlas").click()

    # Pacchetto non scaricato: dimensione mostrata prima, 2D subito disponibile
    page.wait_for_selector("[data-testid=pack]")
    pack = page.get_by_test_id("pack").inner_text()
    check("Pacchetto 3D: dimensione mostrata prima del download (2,4 MB) e 2D subito usabile", "2,4 MB" in pack and page.get_by_test_id("atlas-map").count() == 1, pack.replace("\n", " | ")[:140])
    t0 = time.time()
    page.get_by_role("button", name=re.compile(r"^Scarica")).click()
    page.wait_for_selector("[data-testid=atlas3d-load]", timeout=90000)
    dl_s = time.time() - t0
    load = page.get_by_test_id("atlas3d-load").inner_text()
    check("Download verificato (SHA-256) e modello caricato", "muscoli selezionabili" in load, f"{load} · download+avvio {dl_s:.1f} s (rete locale, emulazione)")
    page.screenshot(path=f"{OUT}/1-atlante3d-fronte.png", full_page=False)

    # Selezione dalla lista (tastiera/lettore di schermo): porzione acromiale
    page.fill("#atlas3d-q", "laterale")
    page.get_by_test_id("atlas3d-list").get_by_role("button", name=re.compile("Deltoide, porzione laterale")).click()
    page.wait_for_selector("[data-testid=atlas3d-card]")
    check("Lista: porzione laterale (acromiale) del deltoide selezionata, indirizzo aggiornato", "deltoid_lateral" in page.url and "porzione laterale (acromiale)" in page.get_by_test_id("atlas3d-card").inner_text(), page.url)
    page.get_by_role("tab", name="Esercizi compatibili").click()
    exs = page.get_by_test_id("atlas3d-ex").inner_text()
    check("Esercizi compatibili per la porzione laterale (relazioni esplicite)", "Alzate laterali al cavo" in exs and "principale" in exs, exs[:160].replace("\n", " | "))
    page.get_by_test_id("atlas3d-ex").get_by_role("link", name=re.compile("Alzate laterali al cavo")).click()
    page.wait_for_selector("[data-testid=ex-editorial]")
    check("Apre la scheda delle alzate laterali al cavo", "esercizio/cx_alzate_lat_cavo" in page.url)
    page.go_back()
    page.wait_for_selector("[data-testid=atlas3d-card]", timeout=60000)
    check("Tornando indietro: stessa struttura selezionata", "deltoid_lateral" in page.url and "porzione laterale" in page.get_by_test_id("atlas3d-card").inner_text(), page.url)

    # Rotazione di 90° con i pulsanti, poi selezione con un tocco sul modello
    for _ in range(3): page.get_by_role("button", name="Ruota a destra di 30 gradi").click()
    page.get_by_role("button", name="Centra").click(); page.wait_for_timeout(500)
    page.screenshot(path=f"{OUT}/2-atlante3d-ruotato-centrato.png", full_page=False)
    page.get_by_role("button", name="Chiudi").click(); page.wait_for_timeout(300)
    box = page.get_by_test_id("atlas3d-canvas").bounding_box()
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); page.wait_for_timeout(600)
    check("Tocco al centro dopo rotazione di 90° e centratura: selezionata una porzione del deltoide", re.search(r"atlante/deltoid_", page.url) is not None, page.url)
    # Strutture piccole: anteprima tenendo il dito fermo, scelta rapida se il punto è conteso
    page.get_by_role("button", name="Reset").click(); page.wait_for_timeout(300)
    box = page.get_by_test_id("atlas3d-canvas").bounding_box()
    px, py = box["x"] + box["width"] * 0.33, box["y"] + box["height"] * 0.50
    page.mouse.move(px, py); page.mouse.down(); page.wait_for_timeout(450)
    prev = page.locator(".atlas3d-preview")
    prev_txt = prev.inner_text() if prev.count() else ""
    page.mouse.up(); page.wait_for_timeout(300)
    check("Dito fermo: anteprima con il nome della struttura sotto il dito", len(prev_txt) > 3, prev_txt)
    found = False
    for fx, fy in [(0.33, 0.55), (0.32, 0.60), (0.31, 0.62), (0.34, 0.58), (0.30, 0.64), (0.35, 0.53), (0.29, 0.66), (0.67, 0.55), (0.68, 0.60)]:
        page.mouse.click(box["x"] + box["width"] * fx, box["y"] + box["height"] * fy); page.wait_for_timeout(400)
        if page.get_by_test_id("atlas3d-choose").count():
            found = True; break
    n_opts = page.get_by_test_id("atlas3d-choose").get_by_role("button").count() - 0 if found else 0
    check("Tocco tra muscoli piccoli e vicini: compare 'Quale intendevi?' con le candidate (max 4)", found and 2 <= n_opts <= 5, f"{n_opts} pulsanti")
    page.screenshot(path=f"{OUT}/2b-atlante3d-scelta.png", full_page=False)
    if found:
        first_name = page.get_by_test_id("atlas3d-choose").locator(".chips button").first.inner_text()
        page.get_by_test_id("atlas3d-choose").locator(".chips button").first.click(); page.wait_for_timeout(500)
        card = page.get_by_test_id("atlas3d-card").inner_text() if page.get_by_test_id("atlas3d-card").count() else ""
        check("Scelta dalla lista rapida: struttura selezionata e centrata", page.get_by_test_id("atlas3d-choose").count() == 0 and re.search(r"atlante/[a-z_]+", page.url) is not None and len(card) > 0, f"{first_name} → {page.url.split('/')[-1]}")
    page.get_by_role("button", name="Isola").click(); page.wait_for_timeout(300)
    page.screenshot(path=f"{OUT}/3-atlante3d-isolato.png", full_page=False)
    page.get_by_role("button", name="Reset").click()

    # Inverso: dalla panca inclinata
    page.goto(BASE + "#/allenamento/esercizio/cx_panca_incl_man"); page.wait_for_selector("[data-testid=ex-structures]")
    exs = page.get_by_test_id("ex-structures").inner_text()
    check("Scheda panca inclinata: principale, coinvolto e possibile enfasi sul capo clavicolare (evidenza limitata)", "capo clavicolare — possibile enfasi (evidenza limitata)" in exs and "principale" in exs, exs.replace("\n", " | ")[:200])
    check("Scheda esercizio senza sagoma schematica", page.locator("svg.body, .body-svg").count() == 0)
    page.get_by_test_id("ex-open-atlas").click()
    page.wait_for_selector("[data-testid=atlas-ex]"); page.wait_for_selector("[data-testid=atlas3d-load]", timeout=60000)
    ax = page.get_by_test_id("atlas-ex").inner_text()
    check("Atlante dall'esercizio: ruoli con legenda e fonte dello studio", "possibile enfasi" in ax and "Chaves" in ax and "non è una percentuale" in ax, ax.replace("\n", " | ")[:200])
    page.screenshot(path=f"{OUT}/4-atlante3d-panca-inclinata.png", full_page=False)
    page.get_by_role("link", name="Torna alla scheda dell'esercizio").click()
    check("Ritorno alla scheda dell'esercizio", "cx_panca_incl_man" in page.url)

    # Offline: dopo il primo download il 3D si apre senza rete
    page.evaluate("async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; }"); page.wait_for_timeout(1500)
    ctx.set_offline(True)
    page.goto(BASE + "#/progressi/atlante"); page.reload()
    try:
        page.wait_for_selector("[data-testid=atlas3d-load]", timeout=60000); off3d = True
    except Exception:
        off3d = False
    check("Offline dopo il primo download: il 3D si apre dalla cache", off3d)
    # Senza pacchetto: fallback 2D leggibile offline
    page.get_by_role("button", name=re.compile("Rimuovi il pacchetto 3D")).click(); page.wait_for_timeout(500)
    page.reload(); page.wait_for_timeout(1500)
    check("Offline senza pacchetto 3D: atlante 2D con la stessa nomenclatura", page.get_by_test_id("atlas-map").count() == 1 and page.locator("[data-testid=atlas-map] [data-s]").count() >= 20)
    ctx.set_offline(False)

    check("Nessun errore JavaScript nella pagina", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
sys.exit(1 if failed else 0)
