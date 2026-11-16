"""Schermate di confronto prima/dopo, stesso formato telefono (390×844), dati SINTETICI.
Uso: E2E_OUT=<cartella> SHOTS_TAG=prima|dopo python tests/e2e/shots_compare.py (dietro with_server.py)."""
import os
import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4174/diario-palestra/"
OUT = os.environ.get("E2E_OUT", "e2e-screens")
TAG = os.environ.get("SHOTS_TAG", "prima")
os.makedirs(OUT, exist_ok=True)

SEED = r"""
async () => {
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const db = await req(indexedDB.open('diario-palestra'));
  const all = async (s) => req(db.transaction(s).objectStore(s).getAll());
  const put = async (store, rows) => { const t = db.transaction([store], 'readwrite'); for (const r of rows) t.objectStore(store).put(r); await new Promise((r) => (t.oncomplete = r)); };
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(new Date());
  const wdJs = new Date(today + 'T12:00:00Z').getUTCDay(); const wd = wdJs === 0 ? 7 : wdJs;
  const it = (id, ex, sets, a, b) => ({ id, exerciseId: ex, sets, repMin: a, repMax: b, rirTargets: Array.from({ length: sets }, () => ({ min: 1, max: 3 })), restSec: 150, declaredLoad: '', declaredNotes: '', toConfirm: [], priority: null, sameAs: '' });
  await put('programs', [{ id: 'e2e_p', name: 'Scheda prova', kind: 'custom', origin: 'user', isActive: true, notes: '', createdAt: Date.now(), days: [{ id: 'e2e_d', name: 'Schiena e spalle', weekday: wd, items: [it('a', 'cx_rdl_man', 2, 6, 8), it('b', 'cx_lat_larga', 2, 8, 12), it('c', 'cx_chest_press', 2, 8, 12), it('d', 'cx_alzate_lat_cavo', 2, 12, 20), it('e', 'cx_curl_man', 2, 10, 15)] }] }]);
  const st = (await all('kv')).find((x) => x.key === 'settings');
  await put('kv', [{ ...st, value: { ...st.value, onboardingDone: true, profile: { ...st.value.profile, equipment: 'palestra', experience: 'intermedio' } } }]);
  db.close();
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, locale="it-IT", timezone_id="Europe/Rome")
    pg = ctx.new_page()
    pg.goto(BASE + "#/oggi"); pg.wait_for_load_state("networkidle"); pg.wait_for_selector("text=Oggi")
    pg.evaluate(SEED); pg.reload(); pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
    pg.screenshot(path=f"{OUT}/{TAG}-1-oggi.png")
    # Editor: aggiungere un esercizio
    pg.goto(BASE + "#/allenamento/scheda/e2e_p"); pg.wait_for_timeout(700)
    btn = pg.get_by_role("button", name=re.compile(r"^(\+ )?Esercizio$|Aggiungi esercizi")).first
    btn.click(); pg.wait_for_timeout(500)
    pg.screenshot(path=f"{OUT}/{TAG}-2-editor-aggiungi.png")
    # Seduta: prima della prima serie
    pg.goto(BASE + "#/allenamento"); pg.wait_for_load_state("networkidle")
    pg.get_by_role("button", name=re.compile("^Inizia ")).first.click(); pg.wait_for_timeout(900)
    pg.screenshot(path=f"{OUT}/{TAG}-3-seduta-prima-serie.png")
    # Scheda esercizio
    pg.goto(BASE + "#/allenamento/esercizio/cx_alzate_lat_cavo"); pg.wait_for_timeout(1200)
    pg.screenshot(path=f"{OUT}/{TAG}-4-scheda-esercizio.png")
    # Atlante: schiena (romboidi) nel 3D
    pg.goto(BASE + "#/progressi/atlante"); pg.wait_for_timeout(800)
    if pg.get_by_role("button", name=re.compile(r"^Scarica")).count():
        pg.get_by_role("button", name=re.compile(r"^Scarica")).click()
    try:
        pg.wait_for_selector("[data-testid=atlas3d-load]", timeout=60000)
        pg.get_by_role("button", name="Retro").click()
        pg.fill("#atlas3d-q", "romb"); pg.wait_for_timeout(300)
        pg.get_by_test_id("atlas3d-list").get_by_role("button").first.click(); pg.wait_for_timeout(800)
    except Exception as e:
        print("atlante:", e)
    pg.screenshot(path=f"{OUT}/{TAG}-5-atlante-schiena.png")
    # Schede
    pg.goto(BASE + "#/allenamento/schede"); pg.wait_for_timeout(700)
    pg.screenshot(path=f"{OUT}/{TAG}-6-schede.png")
    b.close()
print("ok", TAG)
