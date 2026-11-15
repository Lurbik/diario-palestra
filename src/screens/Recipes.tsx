import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { MealSlot, Recipe } from '../db/types';
import { Check, Chip, Field, Icon, NumInput, Sheet, go, useSettings, useToast } from '../ui/kit';
import { MEAL_LABEL, MEAL_ORDER } from '../db/settings';
import { recipeTotals, strictTotals, barTotals, NUTRIENT_KEYS, NUTRIENT_LABEL, NUTRIENT_UNIT } from '../lib/nutrition';
import { suggestRecipes, exclusionReason, rulesFrom, type RecipeFilter, type RecipeFeedback } from '../lib/recipes';
import { CategoryIcon } from '../ui/visuals';
import type { Food } from '../db/types';
import { kvSet } from '../db/db';
import { prepareBatch, eatRecipeDirect, ShortfallError } from '../lib/inventory';
import { addDays, dateKey } from '../lib/dates';
import { fmtNum, uid } from '../lib/id';
import { NutrientLine } from './Food';
import { STATE_LABEL } from './FoodEditor';
import { WorkSnack, AmbientInfo } from './WorkSnack';

const DEFAULT_FILTER: RecipeFilter = { availability: 'any', maxMissing: 2, maxActiveMin: null, portable: false, eatCold: false, noColdChain: false, expiringFirst: false };

export function RecipesTab() {
  const settings = useSettings();
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const lots = useLiveQuery(() => db.stock.toArray(), []) ?? [];
  const today = dateKey();
  const recent = useLiveQuery(() => db.diary.where('dateKey').between(addDays(today, -2), today, true, true).toArray(), [today]) ?? [];
  const [f, setF] = useState<RecipeFilter>(DEFAULT_FILTER);
  const tracked = useLiveQuery(() => db.kv.get('pantryTracking'), [])?.value === true;
  const fbRow = useLiveQuery(() => db.kv.get('recipeFeedback'), []);
  const [editor, setEditor] = useState<Recipe | null>(null);
  const fMap = new Map(foods.map((x) => [x.id, x]));
  const list = suggestRecipes({ recipes, foods: fMap, lots, filter: f, pantryTracked: tracked, feedback: (fbRow?.value as Record<string, RecipeFeedback>) ?? {}, rules: rulesFrom(settings), recentDiary: recent, today });
  const shown = list.filter((s) => !s.excluded);
  const hidden = list.filter((s) => s.excluded);
  const up = (p: Partial<RecipeFilter>) => setF({ ...f, ...p });
  return (
    <>
      <WorkSnack />
      <details className="card flat">
        <summary>Filtri {JSON.stringify(f) !== JSON.stringify(DEFAULT_FILTER) ? <span className="badge accent">attivi</span> : null}</summary>
        <div className="col">
          <div className="chips">
            <Chip on={f.availability === 'any'} onClick={() => up({ availability: 'any' })}>Tutte</Chip>
            <Chip on={f.availability === 'only_available'} onClick={() => up({ availability: 'only_available' })}>Solo ingredienti presenti</Chip>
            <Chip on={f.availability === 'max_missing'} onClick={() => up({ availability: 'max_missing' })}>Max 1–2 mancanti</Chip>
          </div>
          <div className="chips" aria-label="Tempo attivo massimo">
            {[null, 5, 10, 15, 30].map((m) => <Chip key={String(m)} on={f.maxActiveMin === m} onClick={() => up({ maxActiveMin: m })}>{m == null ? 'Ogni tempo' : `≤ ${m} min attivi`}</Chip>)}
          </div>
          <div className="chips">
            <Chip on={f.portable} onClick={() => up({ portable: !f.portable })}>Trasportabile</Chip>
            <Chip on={f.eatCold} onClick={() => up({ eatCold: !f.eatCold })}>Si mangia fredda</Chip>
            <Chip on={f.noColdChain} onClick={() => up({ noColdChain: !f.noColdChain })}>Senza frigo</Chip>
            <Chip on={f.expiringFirst} onClick={() => up({ expiringFirst: !f.expiringFirst })}>Usa ingredienti in scadenza</Chip>
          </div>
        </div>
      </details>
      <div className="row wrap mb0" style={{ marginBottom: 12 }}>
        <a className="btn sm" href="#/cibo/barrette">Calcolatore barrette</a>
        <button className="btn sm" onClick={() => setEditor({ id: uid(), name: 'Nuova ricetta', ingredients: [], servings: 1, steps: [], equipment: [], activeMin: null, totalMin: null, portable: false, eatCold: false, needsColdChain: false, storage: '', storageSource: '', mealSlots: [], notes: '', seed: false, favorite: false })}><Icon.plus /> Nuova ricetta</button>
      </div>
      {shown.map(({ recipe: r, missing, expiringUsed, repetitive }) => {
        const n = strictTotals(recipeTotals(r, fMap, 1 / r.servings).sum);
        return (
          <a className="card" key={r.id} href={`#/cibo/ricetta/${r.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div className="row"><span className="thumb"><CategoryIcon cat={r.category} /></span><div className="grow"><strong>{r.favorite ? '★ ' : ''}{r.name}</strong>{r.origin === 'legacy_seed' && <span className="badge"> versione precedente</span>}<br /><span className="small muted">{r.difficulty ?? ''}{r.eating?.oneHand ? ' · si mangia con una mano' : ''}</span></div></div>
            <div className="small muted">{r.activeMin != null ? `${r.activeMin} min attivi` : 'tempo n.d.'}{r.totalMin != null ? ` · ${r.totalMin} totali` : ''} · {r.servings} {r.unitLabel === 'pezzi' ? 'pezzi' : 'porz.'}{r.portable ? ' · trasportabile' : ''}{r.ambient === 'ok' ? ' · fuori frigo: ok' : r.ambient === 'requires_cold' || r.needsColdChain ? ' · richiede freddo' : ''}</div>
            <NutrientLine n={n} /> <span className="small muted">a porzione</span>
            <div className="chips mt">
              {missing.length > 0 && <span className="badge">{missing.length} ingredienti mancanti</span>}
              {expiringUsed > 0 && <span className="badge warn">usa {expiringUsed} in scadenza</span>}
              {repetitive && <span className="badge">stessa fonte proteica di recente</span>}
            </div>
          </a>
        );
      })}
      {!shown.length && <p className="empty">Nessuna ricetta con questi filtri.</p>}
      {hidden.length > 0 && <details><summary>{hidden.length} ricette nascoste per esclusioni/allergeni</summary><ul className="small">{hidden.map((h) => <li key={h.recipe.id}>{h.recipe.name}: {h.excluded}</li>)}</ul></details>}
      {editor && <RecipeEditorSheet recipe={editor} onClose={() => setEditor(null)} />}
    </>
  );
}

export function RecipeDetail({ id }: { id: string }) {
  const toast = useToast();
  const settings = useSettings();
  const r = useLiveQuery(() => db.recipes.get(id), [id]);
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const fMap = new Map(foods.map((x) => [x.id, x]));
  const [sheet, setSheet] = useState<null | 'prepare' | 'eat' | 'plan' | 'edit' | 'delete'>(null);
  if (!r) return <main className="main"><p className="muted">Caricamento…</p></main>;
  const tot = recipeTotals(r, fMap);
  const per = strictTotals(recipeTotals(r, fMap, 1 / r.servings).sum);
  const excl = exclusionReason(r, fMap, rulesFrom(settings));
  return (
    <main className="main">
      <a href="#/cibo/ricette" className="small">‹ Ricette</a>
      <h1>{r.name}</h1>
      <RecipeFeedbackRow id={r.id} />
      <PortionVariants r={r} foods={fMap} />
      {(r.seed || r.origin === 'legacy_seed') && <div className="banner info small">Ricetta dimostrativa: quantità adattabili, valori nutrizionali basati su stime non verificate finché non le sostituisci con le etichette.</div>}
      {excl && <div className="banner warn small">Esclusa dai suggerimenti: {excl}</div>}
      <div className="card">
        <div className="grid2">
          <div><div className="small muted">{r.unitLabel === 'pezzi' ? `A pezzo (${r.servings} pezzi)` : `A porzione (${r.servings} porz.)`}</div><NutrientLine n={per} /></div>
          <div><div className="small muted">Tempo</div><div className="small">{r.activeMin ?? '?'} min attivi · {r.totalMin ?? '?'} totali</div></div>
        </div>
        <p className="small muted">{NUTRIENT_KEYS.map((k) => `${NUTRIENT_LABEL[k]} lotto: ${tot.sum.values[k] == null ? 'mancante' : fmtNum(tot.sum.values[k], 0) + (tot.sum.incomplete[k] ? '+?' : '') + ' ' + NUTRIENT_UNIT[k]}`).join(' · ')}</p>
        <p className="small muted">Peso crudo ingredienti: {tot.rawWeightG != null ? `${fmtNum(tot.rawWeightG, 0)} g` : 'non calcolabile'}. Dopo la cottura si usa il peso finale misurato del lotto.</p>
      </div>
      <h2>Ingredienti</h2>
      <ul className="list card flat">
        {r.ingredients.map((i, k) => { const f = fMap.get(i.foodId); return <li key={k} className="row between small"><span>{f?.name ?? i.foodId}{f ? <span className="muted"> · peso {STATE_LABEL[f.state].toLowerCase()} · valori: {f.source === 'label' ? 'etichetta' : f.source === 'database' ? (f.sourceNote.match(/fdcId \d+/) ? 'USDA ' + f.sourceNote.match(/fdcId \d+/)![0] : 'banca dati') : 'stima'}</span> : null}</span><span className="num">{fmtNum(i.qty, 1)} {i.unit}</span></li>; })}
      </ul>
      {r.steps.length > 0 && <><h2>Passaggi</h2><ol>{r.steps.map((s, k) => <li key={k}>{s}</li>)}</ol></>}
      <p className="small">{r.equipment.length ? `Attrezzatura: ${r.equipment.join(', ')}. ` : ''}{r.eatCold ? 'Si può mangiare fredda. ' : ''}</p>
      <AmbientInfo r={r} />
      {r.storage && <div className="card flat small"><strong>Conservazione</strong><p>{r.storage}</p>{r.storageSource && <p className="muted">Fonte: {r.storageSource}. Se manca una regola verificata per un alimento, l'app non garantisce una scadenza.</p>}</div>}
      {r.notes && <p className="small muted">{r.notes}</p>}
      <div className="col mt">
        <button className="btn primary block" onClick={() => setSheet('prepare')}>Ho preparato…</button>
        <button className="btn block" onClick={() => setSheet('eat')}>Mangiata ora (assemblata al momento)</button>
        <button className="btn block" onClick={() => setSheet('plan')}>Pianifica</button>
        <div className="grid2">
          <button className="btn" onClick={() => setSheet('edit')}><Icon.edit /> Modifica</button>
          <button className="btn" onClick={async () => { const c = { ...structuredClone(r), id: uid(), name: r.name + ' (copia)', seed: false }; await db.recipes.add(c); go(`cibo/ricetta/${c.id}`); }}>Duplica</button>
        </div>
        <button className="btn danger block" onClick={() => setSheet('delete')}><Icon.trash /> Elimina</button>
      </div>
      {sheet === 'prepare' && <PrepareSheet recipe={r} onClose={() => setSheet(null)} />}
      {sheet === 'eat' && <EatNowSheet recipe={r} onClose={() => setSheet(null)} />}
      {sheet === 'plan' && <PlanSheet recipe={r} onClose={() => setSheet(null)} />}
      {sheet === 'edit' && <RecipeEditorSheet recipe={r} onClose={() => setSheet(null)} />}
      {sheet === 'delete' && (
        <Sheet title="Eliminare la ricetta?" onClose={() => setSheet(null)}>
          <p>I pasti già registrati restano nel diario.</p>
          <div className="grid2"><button className="btn" onClick={() => setSheet(null)}>Annulla</button><button className="btn danger" onClick={async () => { await db.recipes.delete(r.id); toast({ text: 'Ricetta eliminata' }); go('cibo/ricette'); }}>Elimina</button></div>
        </Sheet>
      )}
    </main>
  );
}

function PrepareSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const toast = useToast();
  const [servings, setServings] = useState<number | null>(recipe.servings);
  const [weight, setWeight] = useState<number | null>(null);
  const [loc, setLoc] = useState<'frigo' | 'freezer' | 'dispensa'>('frigo');
  const [short, setShort] = useState<string | null>(null);
  const go2 = async (allow: boolean) => {
    try {
      const { tx } = await prepareBatch({ recipeId: recipe.id, servingsMade: servings!, finalWeightG: weight, location: loc, allowShortfall: allow });
      toast({ text: `Preparate ${servings} porzioni ✓`, actions: [{ label: 'Annulla', onClick: async () => { const { undoTx } = await import('../lib/inventory'); await undoTx(tx.id); toast({ text: 'Preparazione annullata, dispensa ripristinata' }); } }] });
      onClose();
    } catch (e) { if (e instanceof ShortfallError) setShort(e.message); else toast({ text: String(e instanceof Error ? e.message : e), kind: 'error' }); }
  };
  return (
    <Sheet title={`Ho preparato: ${recipe.name}`} onClose={onClose}>
      <div className="col">
        <NumInput label="Porzioni ottenute" hint={`La ricetta è scritta per ${recipe.servings}: le quantità vengono scalate`} value={servings} onChange={setServings} />
        <NumInput label="Peso finale del lotto (g), facoltativo" hint="Pesalo dopo la cottura: serve per porzionare a peso" value={weight} onChange={setWeight} />
        <Field label="Dove lo conservi"><select value={loc} onChange={(e) => setLoc(e.target.value as typeof loc)}><option value="frigo">Frigo</option><option value="freezer">Freezer</option><option value="dispensa">Dispensa</option></select></Field>
        <p className="small muted">Gli ingredienti crudi vengono scaricati una sola volta dalla dispensa; le porzioni diventano disponibili in "Pronto".</p>
        {short && <div className="card warn small">{short}<p>Puoi registrare comunque: verrà scaricato solo ciò che risulta in dispensa e la mancanza resterà annotata.</p><button className="btn sm" onClick={() => go2(true)}>Registra comunque</button></div>}
        <button className="btn primary block" disabled={!servings} onClick={() => go2(false)}>Conferma preparazione</button>
      </div>
    </Sheet>
  );
}

function EatNowSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const toast = useToast();
  const [meal, setMeal] = useState<MealSlot>('pranzo');
  const [servings, setServings] = useState<number | null>(1);
  const [deduct, setDeduct] = useState(true);
  const [short, setShort] = useState<string | null>(null);
  const submit = async (allow: boolean) => {
    try { await eatRecipeDirect({ recipeId: recipe.id, servings: servings!, meal, deductStock: deduct, allowShortfall: allow }); toast({ text: 'Registrato nel diario ✓' }); onClose(); }
    catch (e) { if (e instanceof ShortfallError) setShort(e.message); else toast({ text: String(e), kind: 'error' }); }
  };
  return (
    <Sheet title="Mangiata ora" onClose={onClose}>
      <div className="col">
        <Field label="Pasto"><select value={meal} onChange={(e) => setMeal(e.target.value as MealSlot)}>{MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}</select></Field>
        <NumInput label="Porzioni" value={servings} onChange={setServings} />
        <Check checked={deduct} onChange={setDeduct}>Scarica gli ingredienti dalla dispensa</Check>
        {short && <div className="card warn small">{short}<div className="mt"><button className="btn sm" onClick={() => submit(true)}>Registra comunque</button></div></div>}
        <button className="btn primary block" disabled={!servings} onClick={() => submit(false)}>Registra</button>
      </div>
    </Sheet>
  );
}

function PlanSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState(dateKey());
  const [meal, setMeal] = useState<MealSlot>(recipe.mealSlots[0] ?? 'pranzo');
  const [servings, setServings] = useState<number | null>(1);
  return (
    <Sheet title="Pianifica" onClose={onClose}>
      <div className="col">
        <Field label="Giorno"><input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field>
        <Field label="Pasto"><select value={meal} onChange={(e) => setMeal(e.target.value as MealSlot)}>{MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}</select></Field>
        <NumInput label="Porzioni" value={servings} onChange={setServings} />
        <p className="small muted">Pianificare non scarica la dispensa e non entra nel diario: serve per la lista della spesa.</p>
        <button className="btn primary block" disabled={!servings} onClick={async () => { await db.plan.add({ id: uid(), dateKey: d, slot: meal, recipeId: recipe.id, foodId: null, servings: servings!, locked: true, done: false }); toast({ text: 'Pianificato ✓' }); onClose(); }}>Aggiungi al piano</button>
      </div>
    </Sheet>
  );
}

export function RecipeEditorSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const toast = useToast();
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), []) ?? [];
  const [r, setR] = useState<Recipe>(structuredClone(recipe));
  const up = (p: Partial<Recipe>) => setR({ ...r, ...p });
  return (
    <Sheet title="Modifica ricetta" onClose={onClose}>
      <div className="col">
        <Field label="Nome"><input value={r.name} onChange={(e) => up({ name: e.target.value })} /></Field>
        <div className="grid3">
          <NumInput label="Porzioni" value={r.servings} onChange={(v) => up({ servings: v && v > 0 ? v : 1 })} />
          <NumInput label="Min attivi" value={r.activeMin} onChange={(v) => up({ activeMin: v })} decimals={false} />
          <NumInput label="Min totali" value={r.totalMin} onChange={(v) => up({ totalMin: v })} decimals={false} />
        </div>
        <strong className="small">Ingredienti (peso a crudo, salvo stato indicato)</strong>
        {r.ingredients.map((i, k) => (
          <div key={k} className="card flat">
            <select aria-label="Alimento" value={i.foodId} onChange={(e) => up({ ingredients: r.ingredients.map((x, j) => (j === k ? { ...x, foodId: e.target.value } : x)) })}>
              {foods.map((f) => <option key={f.id} value={f.id}>{f.name} ({STATE_LABEL[f.state]})</option>)}
            </select>
            <div className="row mt">
              <NumInput value={i.qty} onChange={(v) => up({ ingredients: r.ingredients.map((x, j) => (j === k ? { ...x, qty: v ?? 0 } : x)) })} />
              <select aria-label="Unità" value={i.unit} onChange={(e) => up({ ingredients: r.ingredients.map((x, j) => (j === k ? { ...x, unit: e.target.value as 'g' } : x)) })}><option value="g">g</option><option value="ml">ml</option><option value="pz">pz</option></select>
              <button className="iconbtn" aria-label="Rimuovi ingrediente" onClick={() => up({ ingredients: r.ingredients.filter((_, j) => j !== k) })}><Icon.trash /></button>
            </div>
          </div>
        ))}
        <button className="btn sm" onClick={() => up({ ingredients: [...r.ingredients, { foodId: foods[0]?.id ?? '', qty: 100, unit: 'g' }] })}><Icon.plus /> Ingrediente</button>
        <Field label="Passaggi (uno per riga)"><textarea value={r.steps.join('\n')} onChange={(e) => up({ steps: e.target.value.split('\n').filter((s) => s.trim()) })} /></Field>
        <Field label="Attrezzatura (separata da virgola)"><input value={r.equipment.join(', ')} onChange={(e) => up({ equipment: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></Field>
        <div className="chips">{MEAL_ORDER.map((m) => <Chip key={m} on={r.mealSlots.includes(m)} onClick={() => up({ mealSlots: r.mealSlots.includes(m) ? r.mealSlots.filter((x) => x !== m) : [...r.mealSlots, m] })}>{MEAL_LABEL[m]}</Chip>)}</div>
        <Check checked={r.portable} onChange={(v) => up({ portable: v })}>Trasportabile</Check>
        <Check checked={r.eatCold} onChange={(v) => up({ eatCold: v })}>Si mangia fredda</Check>
        <Check checked={r.needsColdChain} onChange={(v) => up({ needsColdChain: v })}>Richiede catena del freddo</Check>
        <Check checked={r.favorite} onChange={(v) => up({ favorite: v })}>Preferita</Check>
        <Field label="Conservazione"><textarea value={r.storage} onChange={(e) => up({ storage: e.target.value })} /></Field>
        <Field label="Fonte delle indicazioni di conservazione"><input value={r.storageSource} onChange={(e) => up({ storageSource: e.target.value })} /></Field>
        <Field label="Note"><textarea value={r.notes} onChange={(e) => up({ notes: e.target.value })} /></Field>
        <button className="btn primary block" onClick={async () => { await db.recipes.put({ ...r, origin: r.origin ?? 'user', userModified: r.origin === 'catalog' ? true : r.userModified }); toast({ text: 'Ricetta salvata ✓' }); onClose(); go(`cibo/ricetta/${r.id}`); }}>Salva</button>
      </div>
    </Sheet>
  );
}

const BAR_ID = 'r_barrette_utente';
const BAR_SLUGS: [string, string][] = [['avena', 'Avena'], ['miele', 'Miele'], ['burro_arachidi', 'Burro d’arachidi'], ['cioccolato_fondente', 'Cioccolato fondente'], ['proteine_siero', 'Proteine in polvere'], ['acqua', 'Acqua']];

export function BarsCalculator() {
  const toast = useToast();
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const existing = useLiveQuery(() => db.recipes.get(BAR_ID), []);
  const fMap = new Map(foods.map((f) => [f.id, f]));
  const [q, setQ] = useState<Record<string, number | null>>({});
  const [weight, setWeight] = useState<number | null>(null);
  const [pieces, setPieces] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  if (existing && !loaded) {
    setQ(Object.fromEntries(existing.ingredients.map((i) => [i.foodId, i.qty])));
    setPieces(existing.servings);
    setLoaded(true);
  }
  const BAR_FOODS: [string, string][] = BAR_SLUGS.map(([slug, label]) => [foods.find((x) => x.slug === slug)?.id ?? `missing:${slug}`, label]);
  const ingredients = BAR_FOODS.filter(([id]) => (q[id] ?? 0) > 0).map(([id]) => ({ foodId: id, qty: q[id]!, unit: 'g' as const }));
  const tot = recipeTotals({ ingredients }, fMap);
  const b = barTotals(tot.sum.values, weight, pieces);
  const save = async () => {
    const rec: Recipe = {
      id: BAR_ID, name: 'Barrette casalinghe', ingredients, servings: pieces ?? 1, steps: ['Mescola gli ingredienti, compatta in teglia, raffredda e taglia.'], equipment: [],
      activeMin: null, totalMin: null, portable: true, eatCold: true, needsColdChain: true,
      storage: 'Barretta casalinga umida (contiene acqua): non è un prodotto industriale stabile a temperatura ambiente. Conservala in frigo o in freezer; l\'app non stabilisce una durata certa.',
      storageSource: 'Principi generali FSA/USDA (vedi Fonti)', ambient: 'requires_cold', ambientSource: 'USDA FSIS, Shelf-Stable Food Safety (vedi Fonti)', unitLabel: 'pezzi', category: 'multiporzione', tags: ['dolce'], mealSlots: ['spuntino_mattina', 'merenda'], notes: 'Le tue quantità reali. Proteine: inserisci i valori dall\'etichetta, altrimenti risultano mancanti.', seed: false, favorite: true
    };
    await db.recipes.put(rec);
    toast({ text: 'Barrette salvate come ricetta ✓' });
    return rec;
  };
  return (
    <main className="main">
      <a href="#/cibo/ricette" className="small">‹ Ricette</a>
      <h1>Barrette casalinghe</h1>
      <p className="small muted">Inserisci le quantità reali (g). Nessuna quantità è precompilata: valori calcolati per lotto, per 100 g e per pezzo.</p>
      <div className="card"><div className="grid2">
        {BAR_FOODS.map(([id, label]) => <NumInput key={id} label={`${label} (g)`} value={q[id] ?? null} onChange={(v) => setQ({ ...q, [id]: v })} />)}
      </div></div>
      <div className="card"><div className="grid2">
        <NumInput label="Peso finale lotto (g)" value={weight} onChange={setWeight} />
        <NumInput label="Numero di pezzi" value={pieces} onChange={setPieces} decimals={false} />
      </div></div>
      <div className="card">
        <table className="t">
          <thead><tr><th></th><th>Lotto</th><th>100 g</th><th>Pezzo{b.pieceWeightG ? ` (${fmtNum(b.pieceWeightG, 0)} g)` : ''}</th></tr></thead>
          <tbody>{NUTRIENT_KEYS.map((k) => (
            <tr key={k}><td>{NUTRIENT_LABEL[k]}</td>
              {[b.perBatch[k], b.per100g[k], b.perPiece[k]].map((v, i) => <td key={i} className="num">{v == null ? '—' : fmtNum(v, k === 'kcal' ? 0 : 1)}{tot.sum.incomplete[k] && v != null ? '+?' : ''}</td>)}
            </tr>
          ))}</tbody>
        </table>
        {tot.sum.incomplete.kcal && <p className="small muted">"+?" = almeno un ingrediente senza valori (es. proteine senza etichetta): il totale è parziale, non completo.</p>}
        <p className="small muted">Barretta umida fatta in casa: non trattarla come prodotto industriale stabile; conservala al freddo. Nessuna durata certa viene indicata.</p>
      </div>
      <div className="col">
        <button className="btn primary block" disabled={!ingredients.length || !pieces} onClick={save}>Salva come ricetta</button>
        <button className="btn block" disabled={!ingredients.length || !pieces} onClick={async () => {
          await save();
          try { await prepareBatch({ recipeId: BAR_ID, servingsMade: pieces!, finalWeightG: weight, location: 'frigo' }); toast({ text: `Lotto di ${pieces} barrette registrato ✓` }); }
          catch (e) { toast({ text: String(e instanceof Error ? e.message : e) + ' — aggiungi gli ingredienti in dispensa o prepara dalla scheda ricetta con "Registra comunque".', kind: 'error' }); }
        }}>Ho preparato questo lotto</button>
      </div>
    </main>
  );
}

const FB: [keyof RecipeFeedback, string][] = [['liked', 'Mi piace'], ['toTry', 'Da provare'], ['tooBig', 'Troppo abbondante'], ['tooDry', 'Troppo secca'], ['tooSlow', 'Troppo lenta'], ['never', 'Non propormela']];
function RecipeFeedbackRow({ id }: { id: string }) {
  const row = useLiveQuery(() => db.kv.get('recipeFeedback'), []);
  const all = (row?.value as Record<string, RecipeFeedback> | undefined) ?? {};
  const mine = all[id] ?? {};
  return (
    <div className="chips" aria-label="Il tuo feedback">
      {FB.map(([k, l]) => <Chip key={k} on={!!mine[k]} onClick={() => kvSet('recipeFeedback', { ...all, [id]: { ...mine, [k]: !mine[k] } })}>{l}</Chip>)}
    </div>
  );
}

/** Varianti di porzione realmente ricalcolate (passi ammessi dalla ricetta), non etichette "da massa/dimagranti". */
function PortionVariants({ r, foods }: { r: Recipe; foods: Map<string, Food> }) {
  const steps = r.portionSteps?.length ? r.portionSteps : [1];
  if (steps.length < 2) return null;
  return (
    <div className="card flat small">
      <strong>Porzioni possibili</strong>
      <ul className="list">{steps.map((k) => { const t = strictTotals(recipeTotals(r, foods, k / r.servings).sum); return <li key={k} className="row between"><span>{k === 1 ? 'Standard' : k < 1 ? 'Più leggera' : 'Più energetica'} ×{fmtNum(k, 2)}</span><span className="num">{t.kcal == null ? 'kcal mancanti' : `${fmtNum(t.kcal, 0)} kcal · ${fmtNum(t.protein, 0)} g prot.`}</span></li>; })}</ul>
    </div>
  );
}
