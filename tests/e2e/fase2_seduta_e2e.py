"""Verifica end-to-end della schermata Seduta · proposta B (confronto) sulla build servita sotto /diario-palestra/.
Profilo vuoto, dati SINTETICI. Uso:
  python .claude/skills/webapp-testing/scripts/with_server.py \
    --server "npx vite preview --port 4174 --strictPort --base /diario-palestra/" --port 4174 -- python tests/e2e/fase2_seduta_e2e.py
"""
import os
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4174/diario-palestra/"
OUT = os.environ.get("E2E_OUT", "e2e-screens")
os.makedirs(OUT, exist_ok=True)
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("OK   " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""))


SEED = r"""
async () => {
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await req(indexedDB.open('diario-palestra'));
  const put = async (store, rows) => { const t = db.transaction([store], 'readwrite'); for (const r of rows) t.objectStore(store).put(r); await new Promise((r) => (t.oncomplete = r)); };
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(new Date());
  const wdJs = new Date(today + 'T12:00:00Z').getUTCDay(); const wd = wdJs === 0 ? 7 : wdJs;
  const now = Date.now(), t = now - 3 * 86400000;
  await put('machines', [{ id: 'm_lat', name: 'Lat machine sala pesi', category: 'Test', brand: '', model: '', seat: '', backrest: '', rollers: '', grip: '', camLever: '', loadPoints: '', minLoadKg: null, increments: [2.5], barWeightKg: null, pulleyRatio: null, maxedOut: false, photoId: null, notes: '', toConfirm: [], origin: 'user' }]);
  await put('exercises', [{ id: 'e_lat', name: 'Lat machine presa larga', aliases: [], variant: '', machineId: 'm_lat', equipment: 'Macchina', primaryMuscles: ['dorsali'], secondaryMuscles: ['bicipiti'], loadConvention: 'machine_stack', unilateral: false, romType: 'full', configVersion: 1, configNote: '', techNotes: '', toConfirm: [], policyClass: 'compound', origin: 'user' }]);
  await put('programs', [{ id: 'p', name: 'Scheda prova', kind: 'custom', origin: 'user', isActive: true, notes: '', createdAt: now, days: [{ id: 'd', name: 'Upper A', weekday: wd, items: [{ id: 'i', exerciseId: 'e_lat', sets: 2, repMin: 6, repMax: 8, rirTargets: [{ min: 1, max: 2 }, { min: 1, max: 2 }], restSec: 150, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' }] }] }]);
  const ck = 'e_lat|m_lat|v1|full|machine_stack';
  await put('sessions', [{ id: 'prev', programId: 'p', dayId: 'd', title: 'Upper A', dateKey: fmt.format(new Date(t)), startedAt: t, endedAt: t + 3600000, pauses: [], status: 'done', items: [], currentIndex: 0, reducedTime: false, timeLimitMin: null, rest: null, notes: '', painReported: false }]);
  const S = (id, o, reps, part, rir) => ({ id, sessionId: 'prev', exerciseId: 'e_lat', configKey: ck, itemIndex: 0, kind: 'working', order: o, load: 55, loadConvention: 'machine_stack', unilateral: false, romType: 'full', fullReps: reps, validReps: reps, fullRepsOtherSide: null, plannedPartials: 0, extraPartials: part, assistedReps: 0, failedAttempts: 0, rir, rirUnknown: false, restBeforeSec: o > 1 ? 150 : null, pain: false, painNote: '', techIssue: false, notes: '', savedAt: t + o * 60000 });
  await put('sets', [S('p1', 1, 7, 2, 1), S('p2', 2, 6, 3, 0)]);
  const st = await req(db.transaction('kv').objectStore('kv').get('settings'));
  await put('kv', [{ ...st, value: { ...st.value, onboardingDone: true } }]);
  db.close();
}
"""

READ_SETS = r"""
async () => {
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await req(indexedDB.open('diario-palestra'));
  const rows = await req(db.transaction('sets').objectStore('sets').getAll());
  db.close();
  return rows.filter((s) => s.sessionId !== 'prev').sort((a, b) => a.order - b.order).map((s) => ({ load: s.load, full: s.fullReps, valid: s.validReps, part: s.extraPartials, rir: s.rir, kind: s.kind }));
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome", has_touch=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/oggi"); page.wait_for_load_state("networkidle"); page.wait_for_selector("text=Oggi")
    page.evaluate(SEED); page.reload(); page.wait_for_load_state("networkidle")

    page.goto(BASE + "#/allenamento"); page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Inizia Upper A").click()
    page.wait_for_selector("table.cmp"); page.wait_for_timeout(700)
    head = page.locator("table.cmp thead").inner_text()
    row1 = page.locator("table.cmp tbody tr").nth(0).inner_text()
    check("Tabella: colonna con la data dell'ultima volta e colonna Oggi", "oggi" in head.lower() and any(m in head.lower() for m in ("nov", "dic", "ott")), head.replace("\n", " | "))
    check("Ultima volta, serie 1: 55 kg × 7, +2 parziali, RIR 1", "55 kg × 7" in row1 and "+2 parziali" in row1 and "RIR 1" in row1, row1.replace("\n", " | "))
    check("Carico precompilato 55 con indicazione; ripetizioni vuote", "55 kg × —" in row1 and page.get_by_text("carico precompilato").count() > 0)
    page.screenshot(path=f"{OUT}/B1-inizio-390.png", full_page=True)

    # ---- 6 complete + 3 parziali, RIR 1: conteggio tocchi
    taps = 0
    def tap(loc):
        global taps
        loc.click(); taps += 1
    tap(page.get_by_role("button", name="Aumenta"))                 # complete: parte dal minimo del range (6)
    tap(page.get_by_role("button", name="Parziali", exact=True))
    for _ in range(3): tap(page.get_by_role("button", name="Aumenta"))
    tap(page.get_by_role("button", name="RIR", exact=True))
    tap(page.get_by_role("button", name="RIR 1", exact=True))
    delta = page.locator("p.delta").inner_text()
    check("Differenza calcolata prima di salvare", "-1 complete" in delta and "parziali non contano" in delta, delta)
    tap(page.get_by_role("button", name="Salva serie 1"))
    page.wait_for_timeout(700)
    sets = page.evaluate(READ_SETS)
    check("Tocchi per 6 complete + 3 parziali + RIR 1 + salva", taps == 8, f"{taps} tocchi")
    check("Salvato: 55 kg, 6 complete (6 conformi), 3 parziali extra, RIR 1", sets == [{"load": 55, "full": 6, "valid": 6, "part": 3, "rir": 1, "kind": "working"}], str(sets))
    row1 = page.locator("table.cmp tbody tr").nth(0).inner_text()
    check("Colonna Oggi, serie 1: 55 kg × 6, +3 parziali, RIR 1", "55 kg × 6" in row1 and "+3 parziali · RIR 1" in row1, row1.replace("\n", " | "))
    check("Recupero avviato e visibile", page.locator(".timer").count() == 1)
    check("Pulsante passa a 'Salva serie 2'; ripetizioni non copiate", page.get_by_role("button", name="Salva serie 2").count() == 1 and page.locator("#cmp-value").input_value() == "")
    page.screenshot(path=f"{OUT}/B2-dopo-salva-390.png", full_page=True)

    # ---- Correzione dalla tabella
    page.get_by_role("button", name="Correggi serie 1").click()
    sheet = page.locator(".sheet")
    sheet.locator(".stepper").nth(1).get_by_role("button", name="Aumenta di 1").click()
    sheet.get_by_role("button", name="Salva modifica").click()
    page.wait_for_timeout(700)
    sets = page.evaluate(READ_SETS)
    check("Correzione salvata (7 complete), nessun duplicato", len(sets) == 1 and sets[0]["full"] == 7 and sets[0]["part"] == 3, str(sets))
    check("Tabella aggiornata dopo la correzione", "55 kg × 7" in page.locator("table.cmp tbody tr").nth(0).inner_text())

    # ---- Doppio tocco su Salva: una sola serie
    page.get_by_role("button", name="Aumenta").click()
    page.get_by_role("button", name="Salva serie 2").dblclick()
    page.wait_for_timeout(900)
    sets = page.evaluate(READ_SETS)
    check("Doppio tocco: una sola serie 2 salvata", len(sets) == 2, str(sets))

    # ---- Ripresa: bozza non salvata conservata dopo ricarica
    inp = page.locator("#cmp-value")
    inp.click(); inp.fill("9")
    page.wait_for_timeout(500)
    page.reload(); page.wait_for_load_state("networkidle"); page.wait_for_selector("table.cmp"); page.wait_for_timeout(800)
    resumed = page.locator("#cmp-value").input_value()
    rows_after = page.locator("table.cmp tbody tr").count()
    check("Dopo la ricarica: seduta ripresa, valore non salvato conservato (9)", resumed == "9", f"valore='{resumed}'")
    check("Dopo la ricarica: le due serie salvate restano in tabella", page.locator("table.cmp tbody tr").nth(1).inner_text().find("55 kg ×") >= 0, f"righe={rows_after}")

    # ---- Tastiera virtuale (SIMULATA): finestra ridotta come con tastiera aperta
    check("Campo valore con tastiera numerica (inputmode numeric/decimal)", page.locator("#cmp-value").get_attribute("inputmode") in ("numeric", "decimal"))
    page.set_viewport_size({"width": 390, "height": 500})
    page.locator("#cmp-value").focus(); page.locator("#cmp-value").scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    vis = page.evaluate("""() => { const vh = innerHeight; const r1 = document.querySelector('#cmp-value').getBoundingClientRect(); const r2 = [...document.querySelectorAll('.bar-bottom button')][0].getBoundingClientRect(); return { input: r1.top >= 0 && r1.bottom <= vh, save: r2.top >= 0 && r2.bottom <= vh, overlap: !(r1.bottom <= r2.top || r1.top >= r2.bottom) }; }""")
    check("Con altezza ridotta (tastiera simulata): campo e 'Salva' visibili e non sovrapposti", vis["input"] and vis["save"] and not vis["overlap"], str(vis))
    page.screenshot(path=f"{OUT}/B3-tastiera-simulata-390x500.png")

    # ---- Desktop 1280
    page.set_viewport_size({"width": 1280, "height": 800})
    page.wait_for_timeout(300)
    page.screenshot(path=f"{OUT}/B4-desktop-1280.png")
    over = page.evaluate("() => document.documentElement.scrollWidth > innerWidth")
    check("1280 px: nessuno scorrimento orizzontale", not over)
    page.set_viewport_size({"width": 390, "height": 844})
    over = page.evaluate("() => document.documentElement.scrollWidth > innerWidth")
    small = page.evaluate("""() => [...document.querySelectorAll('main button, .bar-bottom button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); }).map(b => (b.getAttribute('aria-label') || b.textContent.trim()) + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height))""")
    check("390 px: nessuno scorrimento orizzontale", not over)
    check("390 px: comandi della seduta almeno 44×44 px", not small, str(small))
    check("Nessun errore JavaScript", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
sys.exit(1 if failed else 0)
