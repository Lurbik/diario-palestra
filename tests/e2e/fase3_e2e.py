"""Verifica end-to-end della Fase 3 (webapp-testing / Playwright) sulla build di produzione servita sotto
/diario-palestra/. Profilo browser vuoto; dati SINTETICI scritti in IndexedDB dopo l'avvio (nessun dato personale).

Casi:
  1. preparo otto barrette, ne mangio una e ne restano sette (UI + dati salvati, valori = 1/8 del lotto)
  2. chiedo uno spuntino salato per il lavoro: cosa posso fare con la dispensa, cosa manca, motivi, cambio scelta
  3. cambio hack squat: la nuova macchina non usa i carichi dell'altra (né precompilazione né proposta di aumento)

Uso:  python .claude/skills/webapp-testing/scripts/with_server.py \
        --server "npx vite preview --port 4174 --strictPort --base /diario-palestra/" --port 4174 \
        -- python tests/e2e/fase3_e2e.py
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4174/diario-palestra/"
OUT = os.environ.get("E2E_OUT", "e2e-screens")
os.makedirs(OUT, exist_ok=True)
results = []


def visible(loc, timeout=4000):
    try:
        loc.first.wait_for(timeout=timeout)
        return True
    except Exception:
        return False


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
  const now = Date.now();
  const foods = await all('foods');
  const id = (slug) => foods.find((f) => f.slug === slug).id;
  // Dispensa attiva: ingredienti delle barrette (8 pezzi) + cracker e tonno per uno spuntino salato
  const L = (slug, qty) => ({ id: 'e2e_lot_' + slug, foodId: id(slug), qty, unit: 'g', location: 'dispensa', purchasedAt: null, expiry: null, expiryType: null, openedAt: null, note: '' });
  await put('stock', [L('avena', 500), L('burro_arachidi', 300), L('miele', 200), L('proteine_siero', 200), L('cioccolato_fondente', 100), L('cracker', 100), L('tonno_naturale', 160)]);
  await put('kv', [{ key: 'pantryTracking', value: true, updatedAt: now }]);
  // Due hack squat nella stessa sala, stesso scatto
  const M = (mid, name) => ({ id: mid, name, category: 'Hack squat', brand: '', model: '', seat: '', backrest: '', rollers: '', grip: '', camLever: '', loadPoints: '', minLoadKg: null, increments: [5], barWeightKg: null, pulleyRatio: null, maxedOut: false, photoId: null, notes: '', toConfirm: [], origin: 'user' });
  await put('machines', [M('e2e_hackA', 'Hack E2E sala A'), M('e2e_hackB', 'Hack E2E sala B')]);
  await put('exercises', [{ id: 'e2e_hack', name: 'E2E Hack squat', aliases: [], variant: '', machineId: 'e2e_hackA', equipment: 'Macchina', equipmentKind: 'macchina', primaryMuscles: ['quadricipiti'], secondaryMuscles: [], loadConvention: 'plates_per_side', unilateral: false, romType: 'full', configVersion: 1, configNote: '', techNotes: '', toConfirm: [], policyClass: 'heavy_compound', origin: 'user' }]);
  const item = { id: 'i1', exerciseId: 'e2e_hack', sets: 2, repMin: 8, repMax: 12, rirTargets: [null, null], restSec: 120, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' };
  await put('programs', [{ id: 'e2e_prog', name: 'Scheda E2E', kind: 'custom', origin: 'user', isActive: true, notes: '', createdAt: now, days: [{ id: 'e2e_day', name: 'Gambe E2E', weekday: wd, items: [item] }] }]);
  // Storico SOLO sulla macchina A: 100 kg × 12 in due sedute → sulla A l'app propone un aumento
  const ckA = 'e2e_hack|e2e_hackA|v1|full|plates_per_side';
  const sessions = [], sets = [];
  for (const [k, d] of [[1, -7], [2, -3]]) {
    const sid = 'e2e_s' + k, t = now + d * 86400000;
    sessions.push({ id: sid, programId: 'e2e_prog', dayId: 'e2e_day', title: 'Gambe E2E', dateKey: day(d), startedAt: t, endedAt: t + 3600000, pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false });
    for (let j = 0; j < 2; j++) sets.push({ id: `${sid}_${j}`, sessionId: sid, exerciseId: 'e2e_hack', configKey: ckA, itemIndex: 0, kind: 'working', order: j + 1, load: 100, loadConvention: 'plates_per_side', unilateral: false, romType: 'full', fullReps: 12, validReps: 12, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: 0, assistedReps: 0, failedAttempts: 0, rir: 2, rirUnknown: false, restBeforeSec: j ? 120 : null, pain: false, painNote: '', techIssue: false, notes: '', savedAt: t + j * 60000 });
  }
  await put('sessions', sessions); await put('sets', sets);
  const st = (await all('kv')).find((x) => x.key === 'settings');
  await put('kv', [{ ...st, value: { ...st.value, onboardingDone: true } }]);
  db.close();
  return today;
}
"""

READ = "async () => {" + IDB + r"""
  const out = { batches: await all('batches'), diary: await all('diary'), shopping: await all('shopping'), stock: await all('stock'), ex: (await all('exercises')).find((e) => e.id === 'e2e_hack'), kv: (await all('kv')).filter((k) => k.key.startsWith('acceptedLoad:')) };
  db.close();
  return out;
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
    page.evaluate(SEED)
    page.reload()
    page.wait_for_load_state("networkidle")

    # ================= Caso 1 · barrette 8 → 7
    page.goto(BASE + "#/cibo/ricetta/cr_lotto_barrette")
    page.wait_for_selector("h1:has-text('barrette')")
    amb = page.get_by_test_id("ambient-info").inner_text()
    check("Barrette: 'Trasportabile: sì' separato da 'Fuori frigo: no, richiede frigo…' con fonte", "Trasportabile: sì" in amb and "Fuori frigo: no" in amb and "Fonte:" in amb, amb.replace("\n", " | "))
    check("Barrette: valori 'A pezzo (8 pezzi)'", page.get_by_text("A pezzo (8 pezzi)").count() > 0)
    ing = page.locator("h2:has-text('Ingredienti') + ul").inner_text()
    check("Ingredienti con stato del peso e fonte dei valori (USDA fdcId)", "peso crudo" in ing.lower() or "peso come venduto" in ing.lower(), ing.split("\n")[0])
    check("Fonte USDA fdcId indicata per ingrediente", "USDA fdcId" in ing, ing.split("\n")[0])
    page.get_by_role("button", name="Ho preparato…").click()
    page.get_by_role("button", name="Conferma preparazione").click()
    page.wait_for_timeout(600)
    d = page.evaluate(READ)
    b = [x for x in d["batches"] if x["recipeId"] == "cr_lotto_barrette"]
    check("Salvato: lotto di 8 pezzi", len(b) == 1 and b[0]["servingsTotal"] == 8 and b[0]["servingsLeft"] == 8 and b[0].get("unitLabel") == "pezzi", str([(x["servingsTotal"], x["servingsLeft"], x.get("unitLabel")) for x in b]))
    avena = next(x for x in d["stock"] if x["id"] == "e2e_lot_avena")["qty"]
    check("Dispensa scaricata una volta: avena 500 → 300 g", avena == 300, f"avena={avena}")
    page.goto(BASE + "#/cibo/dispensa")
    page.get_by_role("tab", name="Preparati").click()
    card = page.locator(".card", has_text="barrette")
    check("Preparati: '8 di 8 pezzi'", visible(card.get_by_text("8 di 8 pezzi")), card.inner_text()[:120].replace("\n", " | "))
    card.get_by_role("button", name="Mangia un pezzo").click()
    page.get_by_role("button", name="Registra").click()
    page.wait_for_timeout(600)
    check("Preparati: dopo averne mangiata una compare '7 di 8 pezzi'", visible(card.get_by_text("7 di 8 pezzi")), card.inner_text()[:120].replace("\n", " | "))
    page.screenshot(path=f"{OUT}/1-barrette-7-di-8.png", full_page=True)
    d = page.evaluate(READ)
    b = [x for x in d["batches"] if x["recipeId"] == "cr_lotto_barrette"][0]
    e = [x for x in d["diary"] if x.get("batchId") == b["id"]]
    kcal_ok = len(e) == 1 and abs(e[0]["nutrients"]["kcal"] - b["totals"]["kcal"] / 8) < 0.01
    check("Salvato: restano 7; diario con 1 barretta = 1/8 delle kcal del lotto", b["servingsLeft"] == 7 and kcal_ok, f"rimaste={b['servingsLeft']} kcal voce={e[0]['nutrients']['kcal'] if e else None} lotto={b['totals']['kcal']}")
    avena2 = next(x for x in d["stock"] if x["id"] == "e2e_lot_avena")["qty"]
    check("Mangiare una barretta non scarica di nuovo la dispensa", avena2 == 300, f"avena={avena2}")

    # ================= Caso 2 · spuntino salato per il lavoro
    page.goto(BASE + "#/cibo/ricette")
    page.get_by_role("button", name="Spuntino salato da portare al lavoro").click()
    panel = page.get_by_test_id("work-snack")
    first = panel.get_by_test_id("snack-name").inner_text()
    status = panel.get_by_test_id("snack-status").inner_text()
    reasons = panel.get_by_test_id("snack-reasons").inner_text()
    check("Prima proposta: preparabile con la dispensa (cracker e tonno)", first == "Cracker e tonno in scatoletta" and status == "Puoi prepararlo ora", f"{first} · {status}")
    check("Motivo visibile: dispensa + fuori frigo secondo la fonte", "puoi prepararlo adesso" in reasons and "fuori frigo secondo la fonte" in reasons, reasons.replace("\n", " | "))
    cold = panel.get_by_test_id("snack-needs-cold").inner_text() if panel.get_by_test_id("snack-needs-cold").count() else ""
    check("Senza frigo/borsa dichiarati: le ricette da tenere al freddo sono elencate a parte, non proposte", "richiedono il freddo" in cold, cold[:140])
    page.screenshot(path=f"{OUT}/2-spuntino-pronto.png", full_page=True)
    panel.get_by_role("button", name="Cambia proposta").click()
    page.wait_for_timeout(200)
    second = panel.get_by_test_id("snack-name").inner_text()
    status2 = panel.get_by_test_id("snack-status").inner_text()
    missing = panel.get_by_test_id("snack-missing").inner_text() if panel.get_by_test_id("snack-missing").count() else ""
    reasons2 = panel.get_by_test_id("snack-reasons").inner_text()
    check("Cambia proposta: un'altra ricetta, con cosa manca in grammi e il motivo", second != first and status2.startswith("Mancano") and " g" in missing and "manca:" in reasons2, f"{second} · {status2} · {missing.replace(chr(10), ', ')}")
    page.screenshot(path=f"{OUT}/3-spuntino-mancante.png", full_page=True)
    panel.get_by_role("button", name="Aggiungi il mancante alla spesa").click()
    page.wait_for_timeout(400)
    d = page.evaluate(READ)
    note = [x for x in d["shopping"] if x["note"] == f"per: {second}"]
    check("Salvato: il mancante è nella lista della spesa, con quantità", len(note) >= 1 and all(x["qty"] and x["qty"] > 0 for x in note), str([(x["name"], x["qty"], x["unit"]) for x in note]))
    n_before = panel.locator("text=/\\(\\d+ di \\d+\\)/").inner_text()
    panel.get_by_role("button", name="uso la borsa termica").click()
    page.wait_for_timeout(400)
    n_after = panel.locator("text=/\\(\\d+ di \\d+\\)/").inner_text()
    check("Dichiarando la borsa termica entrano anche gli spuntini da tenere al freddo", int(n_after.split("di ")[1].rstrip(")")) > int(n_before.split("di ")[1].rstrip(")")), f"{n_before} → {n_after}")

    # ================= Caso 3 · cambio hack squat
    page.goto(BASE + "#/progressi/allenamento")
    page.wait_for_selector("text=E2E Hack squat")
    check("Macchina A (storico 100 kg × 12): proposta di aumento 'Applica 105 kg'", page.get_by_role("button", name="Applica 105 kg").count() == 1)
    page.goto(BASE + "#/allenamento")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Inizia Gambe E2E").click()
    page.wait_for_selector("h1:has-text('E2E Hack squat')")
    page.wait_for_timeout(700)
    page.get_by_role("button", name="Carico", exact=True).click()
    page.wait_for_timeout(150)
    load_a = page.locator("#cmp-value").input_value()
    check("Sulla macchina A il carico è precompilato dall'ultima seduta (100)", load_a == "100", f"campo='{load_a}'")
    page.locator(".machine-btn").click()
    page.locator(".listbtn", has_text="Hack E2E sala B").click()
    page.wait_for_timeout(800)
    mb = page.locator(".machine-btn").inner_text()
    check("Macchina mostrata: sala B", "sala B" in mb, mb.replace("\n", " | "))
    page.get_by_role("button", name="Carico", exact=True).click()
    page.wait_for_timeout(150)
    load_b = page.locator("#cmp-value").input_value()
    check("Dopo il cambio: carico NON precompilato con i 100 kg dell'altra macchina", load_b in ("", "0") and load_b != "100", f"campo='{load_b}'")
    page.screenshot(path=f"{OUT}/4-hack-macchina-B.png", full_page=True)
    d = page.evaluate(READ)
    check("Salvato: l'esercizio usa la macchina B", d["ex"]["machineId"] == "e2e_hackB")
    page.get_by_role("button", name="Termina").click()
    page.get_by_role("button", name="Elimina seduta vuota").click(timeout=5000)
    page.wait_for_timeout(300)
    page.goto(BASE + "#/progressi/allenamento")
    page.wait_for_timeout(800)
    check("Progressi: nessuna proposta di aumento per la macchina B basata sulla A", page.get_by_role("button", name="Applica 105 kg").count() == 0)
    page.screenshot(path=f"{OUT}/5-progressi-dopo-cambio.png", full_page=True)
    # Torno alla A dalla pagina esercizio: lo storico della A ritorna
    page.goto(BASE + "#/allenamento/esercizio/e2e_hack")
    page.wait_for_timeout(500)
    if page.locator(".machine-btn").count():
        page.locator(".machine-btn").click()
        try:
            page.locator(".listbtn", has_text="Hack E2E sala A").filter(has_text="2 sedute").wait_for(timeout=4000)
        except Exception:
            pass
        sheet_txt = page.locator(".listbtn", has_text="Hack E2E sala A").inner_text()
        check("Selettore macchina: la A mostra il suo storico (2 sedute, 100 kg)", "2 sedute" in sheet_txt and "100" in sheet_txt, sheet_txt.replace("\n", " | "))
        page.locator(".listbtn", has_text="Hack E2E sala A").click()
        page.wait_for_timeout(500)
        page.goto(BASE + "#/progressi/allenamento")
        page.wait_for_timeout(800)
        check("Tornando alla A, ritorna la sua proposta 'Applica 105 kg'", page.get_by_role("button", name="Applica 105 kg").count() == 1)
    else:
        check("Pagina esercizio con selettore macchina", False, page.url)

    check("Nessun errore JavaScript nella pagina", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
sys.exit(1 if failed else 0)
