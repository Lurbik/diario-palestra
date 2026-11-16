"""Collaudo del brief «schede, RIR, ricerca» a 390×844, dati SINTETICI.
Flussi: 1 ricerca «RDL» + 3 esercizi nell'editor senza perdere il giorno · 2 import additivo due volte ·
3 scheda 5 giorni, 2 serie, RIR reale ≠ target, parziali, dolore → nessun invito ad aumentare ·
4 scheda esercizio → figura → romboide → esercizio → stessa bozza · 5 correzione di una serie storica ·
6 consigliate 2×35 e 5×75 · 7 offline a schermo stretto senza e con pacchetto 3D.
Uso: E2E_OUT=<cartella> python tests/e2e/collaudo_brief_e2e.py (dietro with_server.py)."""
import json
import os
import re
import sys
import tempfile
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4174/diario-palestra/"
OUT = os.environ.get("E2E_OUT", "e2e-screens")
os.makedirs(OUT, exist_ok=True)
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("OK   " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""), flush=True)


SEED = r"""
async (prof) => {
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await req(indexedDB.open('diario-palestra'));
  const put = async (store, rows) => { const t = db.transaction([store], 'readwrite'); for (const r of rows) t.objectStore(store).put(r); await new Promise((r) => (t.oncomplete = r)); };
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(new Date());
  const wdJs = new Date(today + 'T12:00:00Z').getUTCDay(); const wd = wdJs === 0 ? 7 : wdJs;
  const it = (id, ex, a, b, rir) => ({ id, exerciseId: ex, sets: 2, repMin: a, repMax: b, rirTargets: [rir, rir], rirManual: true, restSec: 150, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' });
  const day = (n, w, items) => ({ id: 'd' + n, name: 'Giorno ' + n, weekday: w, items });
  const other = (k) => ((wd + k - 1) % 7) + 1;
  await put('programs', [{ id: 'e2e_p', name: 'Cinque giorni prova', kind: 'custom', origin: 'user', isActive: true, notes: '', createdAt: Date.now(), days: [
    day(1, wd, [it('a', 'cx_lat_larga', 8, 12, { min: 2, max: 3 }), it('b', 'cx_chest_press', 8, 12, { min: 2, max: 3 })]),
    day(2, other(1), [it('c', 'cx_leg_press', 8, 12, { min: 2, max: 3 })]),
    day(3, other(2), [it('d', 'cx_shoulder_press', 8, 12, { min: 2, max: 3 })]),
    day(4, other(3), [it('e', 'cx_leg_curl_seduto', 10, 15, { min: 1, max: 2 })]),
    day(5, other(4), [it('f', 'cx_curl_man', 10, 15, { min: 1, max: 2 })])
  ] }]);
  // seduta passata sintetica per la correzione
  const t = Date.now() - 3 * 86400000;
  await put('sessions', [{ id: 'old', programId: 'e2e_p', dayId: 'd1', title: 'Giorno 1', dateKey: fmt.format(new Date(t)), startedAt: t, endedAt: t + 3600000, pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false }]);
  await put('sets', [{ id: 'old1', sessionId: 'old', exerciseId: 'cx_lat_larga', configKey: 'cx_lat_larga', itemIndex: 0, kind: 'working', order: 1, load: 40, loadConvention: 'machine_stack', unilateral: false, romType: 'full', fullReps: 10, validReps: 10, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 2, rirUnknown: false, restBeforeSec: null, pain: false, painNote: '', techIssue: false, notes: '', savedAt: t + 60000 }]);
  const st = await req(db.transaction('kv').objectStore('kv').get('settings'));
  await put('kv', [{ ...st, value: { ...st.value, onboardingDone: true, profile: { ...st.value.profile, equipment: 'palestra', experience: 'intermedio', ...prof } } }]);
  db.close();
}
"""

READ = r"""
async () => {
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await req(indexedDB.open('diario-palestra'));
  const all = async (s) => req(db.transaction(s).objectStore(s).getAll());
  const out = { programs: await all('programs'), sets: await all('sets'), sessions: await all('sessions') };
  db.close(); return out;
}
"""

FILE = {"format": "diario-backup", "tables": {
    "programs": [{"id": "imp_x", "name": "Scheda importata", "kind": "custom", "isActive": True, "notes": "", "createdAt": 1,
                  "days": [{"id": "imp_d", "name": "Torso", "weekday": None, "items": [{"id": "i1", "exerciseId": "cx_rdl_man", "sets": 2, "repMin": 6, "repMax": 8, "rirTargets": [None, None], "restSec": 180, "declaredLoad": "", "declaredNotes": "", "toConfirm": [], "priority": None, "sameAs": ""}]}]}],
    "sessions": [{"id": "x"}], "weights": [{"id": "w"}]}}

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome", has_touch=True)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(BASE + "#/oggi"); pg.wait_for_load_state("networkidle"); pg.wait_for_selector("text=Oggi")
    pg.evaluate(SEED, {"trainingDaysPerWeek": 5, "sessionMinutes": 75}); pg.reload(); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(400)

    # ===== 1. Editor: «RDL» + altri esercizi, il giorno resta
    pg.goto(BASE + "#/allenamento/scheda/e2e_p"); pg.wait_for_timeout(700)
    pg.get_by_role("button", name="Aggiungi esercizi").first.click()
    picker = pg.get_by_role("dialog")
    q = picker.get_by_role("searchbox")
    check("Selettore senza preselezione", picker.get_by_role("button", name=re.compile("^Aggiungi [0-9]")).count() == 0)
    q.fill("RDL"); pg.wait_for_timeout(250)
    first = picker.get_by_test_id("picker-results").get_by_role("button").first.inner_text()
    check("«RDL» trova lo stacco rumeno per primo", "Stacco rumeno" in first, first.split("\n")[0])
    picker.get_by_test_id("picker-results").get_by_role("button").first.click()
    for term in ["face pull", "hip thrust", "romboidi"]:
        q.fill(term); pg.wait_for_timeout(250)
        picker.get_by_test_id("picker-results").get_by_role("button").first.click()
    pg.screenshot(path=f"{OUT}/collaudo-1-selettore.png")
    picker.get_by_role("button", name="Aggiungi 4").click(); pg.wait_for_timeout(400)
    pg.get_by_role("button", name="Salva scheda").click(); pg.wait_for_timeout(500)
    d1 = next(d for d in next(x for x in pg.evaluate(READ)["programs"] if x["id"] == "e2e_p")["days"] if d["id"] == "d1")
    ids = [i["exerciseId"] for i in d1["items"]]
    check("Giorno 1: i 2 esercizi originali restano e se ne aggiungono 4 (RDL incluso)", ids[:2] == ["cx_lat_larga", "cx_chest_press"] and len(ids) == 6 and any(x in ids for x in ("cx_rdl_man", "cx_rdl_bil")), str(ids))
    check("Nuove voci con RIR suggerito (non prescritto)", all(i.get("rirManual") is False for i in d1["items"][2:]))

    # ===== 2. Import additivo due volte
    f = os.path.join(tempfile.mkdtemp(), "scheda.json")
    with open(f, "w", encoding="utf-8") as fh:
        json.dump(FILE, fh)
    n0 = len(pg.evaluate(READ)["programs"])
    for k in range(2):
        pg.goto(BASE + "#/allenamento/schede"); pg.wait_for_timeout(600)
        pg.get_by_test_id("import-input").set_input_files(f); pg.wait_for_selector("[data-testid=import-preview]")
        prev = pg.get_by_test_id("import-preview").inner_text()
        if k == 1:
            check("Seconda importazione: anteprima «già presente, identica»", "già presente" in prev, prev.replace("\n", " | ")[-160:])
            pg.screenshot(path=f"{OUT}/collaudo-2-import-bis.png")
        pg.locator(".sheet").get_by_role("button", name="Importa", exact=True).click(); pg.wait_for_timeout(500)
        pg.locator(".sheet").get_by_role("button", name="Più tardi").click(); pg.wait_for_timeout(200)
    st = pg.evaluate(READ)
    check("Dopo due importazioni: una sola scheda in più, nessuna seduta creata, attiva invariata",
          len(st["programs"]) == n0 + 1 and len(st["sessions"]) == 1 and [x["id"] for x in st["programs"] if x["isActive"]] == ["e2e_p"])

    # ===== 3. Seduta: target per serie, RIR reale ≠ target, parziali, dolore
    pg.goto(BASE + "#/allenamento"); pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name=re.compile("^Inizia ")).first.click(); pg.wait_for_selector("[data-testid=set-target]")
    tgt = pg.get_by_test_id("set-target").inner_text()
    check("Frase prima della serie: esercizio, serie 1 di 2, RIR prescritto", "serie 1 di 2" in tgt and "RIR 2–3" in tgt and "prescritto" in tgt, tgt.replace("\n", " | ")[:160])
    pg.screenshot(path=f"{OUT}/collaudo-3-target.png")
    pg.get_by_role("button", name="Aumenta").first.click()
    pg.get_by_role("button", name="Parziali", exact=True).click()
    for _ in range(2): pg.get_by_role("button", name="Aumenta").first.click()
    pg.get_by_role("button", name="RIR", exact=True).click(); pg.get_by_role("button", name="RIR 0", exact=True).click()
    pg.get_by_role("button", name="Fastidio o dolore?").click()
    pg.get_by_role("group", name="Zona").get_by_role("button", name="Spalla").click()
    pg.get_by_role("group", name="Lato").get_by_role("button", name="Destra").click()
    pg.get_by_role("button", name="Durante la serie").click()
    pg.get_by_role("button", name="Segna sulla serie e continua").click()
    pg.get_by_role("button", name=re.compile("^Salva serie 1")).click(); pg.wait_for_timeout(700)
    sets = [s for s in pg.evaluate(READ)["sets"] if s["sessionId"] != "old"]
    check("Serie salvata: RIR reale 0 (target 2–3), parziali a parte, dolore", any(s["rir"] == 0 and s["extraPartials"] == 2 and s["pain"] for s in sets), str([(s["rir"], s["extraPartials"], s["pain"]) for s in sets]))
    tgt2 = pg.get_by_test_id("set-target").inner_text()
    body = pg.locator("main").inner_text()
    check("Dopo il dolore: serie 2 di 2, nessun invito ad aumentare", "serie 2 di 2" in tgt2 and re.search(r"aumenta(re)? il carico|prova ad aumentare", body, re.I) is None and pg.get_by_test_id("pain-banner").count() == 1, tgt2.replace("\n", " | ")[:200])
    pg.screenshot(path=f"{OUT}/collaudo-3-dopo-dolore.png")
    pg.goto(BASE + "#/allenamento"); pg.wait_for_timeout(400)

    # ===== 5. Correzione di una serie storica
    pg.goto(BASE + "#/allenamento/storico/old"); pg.wait_for_timeout(600)
    pg.get_by_role("button", name="Correggi questa serie registrata").first.click(); pg.wait_for_timeout(300)
    sheet = pg.locator(".sheet")
    sheet.get_by_role("button", name=re.compile("^Riscald")).click()
    sheet.get_by_role("button", name="Salva", exact=True).click(); pg.wait_for_timeout(500)
    old = next(s for s in pg.evaluate(READ)["sets"] if s["id"] == "old1")
    check("Correzione: la serie storica diventa riscaldamento", old["kind"] == "warmup")

    # ===== 6. Consigliate: 5×75 e 2×35
    pg.goto(BASE + "#/allenamento/schede"); pg.wait_for_timeout(500)
    pg.get_by_role("tab", name="Consigliate").click(); pg.wait_for_timeout(300)
    rec = pg.locator("main").inner_text()
    check("5 giorni × 75 min, intermedio: prima proposta a 5 giorni (l'estesa è per esperti)", "Cinque sedute in rotazione: torso" in rec)
    pg.evaluate(SEED, {"trainingDaysPerWeek": 5, "sessionMinutes": 75, "experience": "esperto"}); pg.reload(); pg.wait_for_timeout(600)
    pg.get_by_role("tab", name="Consigliate").click(); pg.wait_for_timeout(300)
    rec = pg.locator("main").inner_text()
    check("5 giorni × 75 min, esperto: tra le proposte la scheda estesa a 5 sedute", "Cinque sedute in rotazione, estesa" in rec)
    pg.screenshot(path=f"{OUT}/collaudo-6-consigliate-5x75.png")
    pg.evaluate(SEED, {"trainingDaysPerWeek": 2, "sessionMinutes": 35}); pg.reload(); pg.wait_for_timeout(600)
    pg.get_by_role("tab", name="Consigliate").click(); pg.wait_for_timeout(300)
    rec = pg.locator("main").inner_text()
    check("2 giorni × 35 min: la prima proposta è breve a 2 giorni", "Full body 2 giorni, breve" in rec, rec[:200].replace("\n", " | "))
    pg.screenshot(path=f"{OUT}/collaudo-6-consigliate-2x35.png")

    # ===== 7a. Offline senza pacchetto 3D
    pg.goto(BASE + "#/oggi"); pg.wait_for_timeout(400)
    pg.evaluate("navigator.serviceWorker.ready.then(() => true)"); pg.reload(); pg.wait_for_timeout(800)
    ctx.set_offline(True)
    pg.goto(BASE + "#/allenamento/esercizio/cx_rematore_appoggio"); pg.reload(); pg.wait_for_timeout(1000)
    check("Offline, senza pacchetto: scheda esercizio con figura 2D", pg.get_by_test_id("ex-figure-2d").count() == 1)
    pg.screenshot(path=f"{OUT}/collaudo-7-offline-2d.png")
    pg.goto(BASE + "#/allenamento/scheda/e2e_p"); pg.wait_for_timeout(600)
    pg.get_by_role("button", name="Aggiungi esercizi").first.click(); pg.get_by_role("dialog").get_by_role("searchbox").fill("rdl"); pg.wait_for_timeout(250)
    check("Offline: il selettore cerca", "Stacco rumeno" in pg.get_by_test_id("picker-results").inner_text())
    pg.get_by_role("dialog").get_by_role("button", name="Chiudi").click()
    ctx.set_offline(False)

    # ===== 4 + 7b. Con pacchetto 3D: scheda esercizio → figura → romboide → esercizio → stessa bozza; poi offline
    pg.goto(BASE + "#/progressi/atlante"); pg.wait_for_timeout(800)
    if pg.get_by_role("button", name=re.compile(r"^Scarica")).count():
        pg.get_by_role("button", name=re.compile(r"^Scarica")).click()
    pg.wait_for_selector("[data-testid=atlas3d-load]", timeout=90000)
    pg.goto(BASE + "#/allenamento/esercizio/cx_rematore_appoggio"); pg.wait_for_timeout(500)
    try:
        pg.wait_for_selector("[data-testid=ex-poster]", timeout=60000)
        check("Scheda esercizio: poster generato dal modello", True)
    except Exception as e:
        check("Scheda esercizio: poster generato dal modello", False, str(e)[:120])
    pg.screenshot(path=f"{OUT}/collaudo-4-poster.png")
    before = next(x for x in pg.evaluate(READ)["programs"] if x["id"] == "e2e_p")
    pg.get_by_test_id("ex-structures").get_by_role("button", name="Romboide maggiore").click()
    pg.wait_for_selector("[data-testid=atlas3d-card]", timeout=60000); pg.wait_for_timeout(500)
    card = pg.get_by_test_id("atlas3d-card").inner_text()
    check("Atlante: scheda del romboide con esercizi con focus", "Romboide maggiore" in card and "Esercizi con focus" in card)
    pg.screenshot(path=f"{OUT}/collaudo-4-romboide.png")
    pg.get_by_test_id("atlas-add-day").first.click(); pg.wait_for_selector("[data-testid=add-to-day]")
    pg.get_by_test_id("add-to-day").get_by_role("button").nth(1).click(); pg.wait_for_timeout(500)
    after = next(x for x in pg.evaluate(READ)["programs"] if x["id"] == "e2e_p")
    same = all([i["id"] for i in a["items"]] == [i["id"] for i in bb["items"]][: len(a["items"])] for a, bb in zip(before["days"], after["days"]))
    grew = sum(len(d["items"]) for d in after["days"]) == sum(len(d["items"]) for d in before["days"]) + 1
    check("Aggiunto al giorno scelto della stessa bozza, nulla perso", same and grew and after["id"] == before["id"])
    pg.goto(BASE + "#/oggi"); pg.wait_for_timeout(300)
    ctx.set_offline(True)
    pg.goto(BASE + "#/progressi/atlante/rhomboid_major"); pg.reload(); pg.wait_for_timeout(500)
    try:
        pg.wait_for_selector("[data-testid=atlas3d-load]", timeout=90000)
        check("Offline con pacchetto: atlante 3D si apre", True)
    except Exception as e:
        check("Offline con pacchetto: atlante 3D si apre", False, str(e)[:120])
    pg.screenshot(path=f"{OUT}/collaudo-7-offline-3d.png")
    ctx.set_offline(False)

    check("Nessun errore JavaScript", not errors, "; ".join(errors[:3]))
    b.close()

bad = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(bad)}/{len(results)} OK")
sys.exit(1 if bad else 0)
