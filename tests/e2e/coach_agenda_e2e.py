"""Coach, agenda, export calendario e varianti di ricetta: verifica nel browser con dati SINTETICI."""
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
  const now = Date.now();
  const it = (id, ex) => ({ id, exerciseId: ex, sets: 3, repMin: 8, repMax: 12, rirTargets: [null, null, null], restSec: 120, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' });
  // Scheda da 5 giorni; il giorno 1 cade oggi
  const days = Array.from({ length: 5 }, (_, i) => ({ id: 'e2e_d' + i, name: 'Giorno ' + (i + 1), weekday: ((wd - 1 + i) % 7) + 1, items: [it('e2e_i' + i + 'a', 'cx_chest_press'), it('e2e_i' + i + 'b', 'cx_lat_larga'), it('e2e_i' + i + 'c', 'cx_leg_press')] }));
  await put('programs', [{ id: 'e2e_prog5', name: 'Scheda E2E 5 giorni', kind: 'custom', origin: 'user', isActive: true, notes: '', createdAt: now, days }]);
  const st = (await all('kv')).find((x) => x.key === 'settings');
  await put('kv', [{ ...st, value: { ...st.value, onboardingDone: true, sleepTargetH: 8,
    sleepPlan: { ...st.value.sleepPlan, wakeTime: '06:30', latencyMin: 15, routineMin: 30 },
    agenda: { trainingStart: '21:00', trainingByWeekday: {}, commuteMin: 20, awayFrom: null, awayTo: null, prepStart: null, prepMin: null },
    profile: { ...st.value.profile, trainingDaysPerWeek: 2, equipment: 'palestra', experience: 'intermedio', sessionMinutes: 60, goal: 'massa' } } }]);
  db.close();
  return wd;
}
"""

READ = "async () => {" + IDB + r"""
  const progs = await all('programs'); const dec = await all('decisions'); db.close();
  return { active: progs.filter((p) => p.isActive).map((p) => [p.id, p.name]), old: progs.find((p) => p.id === 'e2e_prog5'), decisions: dec.map((d) => [d.scope, d.decision, d.detail]) };
}
"""

SET_AGENDA = "async (start) => {" + IDB + r"""
  const st = (await all('kv')).find((x) => x.key === 'settings');
  await put('kv', [{ ...st, value: { ...st.value, agenda: { ...st.value.agenda, trainingStart: start } } }]);
  db.close();
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome", accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "#/oggi")
    page.wait_for_load_state("networkidle")
    page.wait_for_selector("text=Oggi")
    page.evaluate(SEED)
    page.reload()
    page.wait_for_load_state("networkidle")

    # ================= Agenda in Oggi: allenamento alle 21 + rientro → conflitto con la routine serale (dalle 21:45)
    page.wait_for_selector("#h-tomorrow")
    txt = page.locator("section[aria-labelledby=h-tomorrow]").inner_text()
    check("Oggi: allenamento alle 21:00 + 20 min di rientro segnalato in conflitto con la routine serale", "Allenamento (21:00–" in txt and "routine serale (21:45)" in txt, txt.replace("\n", " | ")[:260])
    check("Oggi: riga 'Domani' con l'allenamento e l'orario dell'agenda", "Domani:" in txt and "alle 21:00" in txt, txt.split("\n")[0:3])
    page.screenshot(path=f"{OUT}/1-oggi-agenda-21.png", full_page=True)
    page.evaluate(SET_AGENDA, "15:30")
    page.reload(); page.wait_for_selector("#h-tomorrow"); page.wait_for_timeout(500)
    txt2 = page.locator("section[aria-labelledby=h-tomorrow]").inner_text()
    check("Allenamento spostato alle 15:30: il conflitto sparisce", "routine serale (" not in txt2, txt2.replace("\n", " | ")[:200])

    # ================= Export calendario: evento che passa la mezzanotte
    page.evaluate(SET_AGENDA, "23:30")
    page.goto(BASE + "#/altro/calendario"); page.wait_for_load_state("networkidle")
    with page.expect_download() as dl:
        page.get_by_role("button", name="Esporta calendario (.ics)").click()
    ics = open(dl.value.path(), encoding="utf-8", newline="").read()
    import re
    ev = re.findall(r"DTSTART;TZID=Europe/Rome:(\d{8})T(\d{6})\r\nDTEND;TZID=Europe/Rome:(\d{8})T(\d{6})", ics)
    ok = ev and all(s_t == "233000" and e_d != s_d for s_d, s_t, e_d, e_t in ev)
    check("Export .ics: allenamento alle 23:30 finisce il giorno dopo (mai 23:59)", ok and "T235900" not in ics, str(ev[:2]))

    # ================= Coach: da 5 a 2 giorni → nuovo modello, poi annulla
    page.goto(BASE + "#/allenamento"); page.wait_for_selector("[data-testid=coach]")
    coach = page.get_by_test_id("coach").inner_text()
    check("Coach: 'Hai 2 giorni a settimana, la scheda ne prevede 5', portata 'Tutta la scheda'", "Hai 2 giorni a settimana, la scheda ne prevede 5" in coach and "Tutta la scheda" in coach, coach.replace("\n", " | ")[:220])
    page.screenshot(path=f"{OUT}/2-coach-proposta.png", full_page=True)
    btn = page.get_by_test_id("coach").get_by_role("button", name=re.compile("^Passa a"))
    label = btn.first.inner_text()
    btn.first.click(); page.wait_for_timeout(800)
    d = page.evaluate(READ)
    check("Accettato: nuova scheda da 2 giorni attiva, la vecchia conservata (non attiva)", len(d["active"]) == 1 and d["active"][0][0] != "e2e_prog5" and d["old"] is not None and not d["old"]["isActive"], f"{label} · attiva={d['active']}")
    check("Diario delle modifiche: vecchia → nuova scheda con motivo", any(x[0] == "program" and "Scheda E2E 5 giorni" in x[2] and "Motivo" in x[2] for x in d["decisions"]), str(d["decisions"])[:200])
    page.goto(BASE + "#/allenamento"); page.wait_for_selector("[data-testid=coach]")
    page.get_by_test_id("coach").locator("summary").click()
    page.get_by_test_id("coach-log").get_by_role("button", name="Annulla").first.click(); page.wait_for_timeout(800)
    d = page.evaluate(READ)
    check("Annulla: torna attiva la scheda precedente, la modifica resta annotata come annullata", d["active"] == [["e2e_prog5", "Scheda E2E 5 giorni"]] and any("ANNULLATA" in x[2] for x in d["decisions"]), str(d["active"]))

    # ================= Macchina occupata una volta: nessuna modifica permanente
    before = page.evaluate(READ)["old"]["days"]
    page.get_by_role("button", name=re.compile("^Inizia ")).first.click()
    page.wait_for_selector("text=Macchina occupata")
    page.get_by_role("button", name="Macchina occupata").click()
    page.get_by_role("button", name="Usa un'alternativa oggi").click()
    page.locator(".sheet .card.flat").first.get_by_role("button", name="Usa questo").click()
    page.wait_for_timeout(600)
    after = page.evaluate(READ)["old"]["days"]
    check("Macchina occupata: alternativa solo per oggi, la scheda non cambia", before == after)
    page.get_by_role("button", name="Termina").click()
    page.get_by_role("button", name=re.compile("Elimina seduta vuota|Termina senza salvare|Elimina")).first.click(timeout=5000)
    page.wait_for_timeout(400)

    # ================= Varianti di ricetta con obiettivo "massa"
    page.goto(BASE + "#/cibo/ricetta/cr_esp_panino_mozz"); page.wait_for_selector("[data-testid=adapt]")
    first = page.get_by_test_id("adapt").locator("[data-testid^=variant-]").first
    vt = first.inner_text()
    check("Ricetta con obiettivo massa: prima variante 'Più energetica', pane 85 → 110 g e kcal in più", "Più energetica" in vt and "85 → 110 g" in vt and "+" in vt, vt.replace("\n", " | ")[:200])
    less = page.get_by_test_id("variant-less_energy").inner_text()
    check("Variante meno energetica: mozzarella non toccata", "Mozzarella" not in less, less.replace("\n", " | ")[:200])
    page.screenshot(path=f"{OUT}/3-varianti.png", full_page=True)
    first.get_by_role("button", name="Usa questa versione").click()
    page.wait_for_selector("h1:has-text('(più energetica)')")
    check("Creata la versione personale (il catalogo resta invariato)", page.locator("h1").inner_text().endswith("(più energetica)"))

    check("Nessun errore JavaScript nella pagina", not errors, "; ".join(errors)[:300])
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} verifiche superate")
sys.exit(1 if failed else 0)
