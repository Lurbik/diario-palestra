import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import type { DiaryEntry, Food, MealSlot, Nutrients } from '../db/types';
import { Check, Chip, Field, Icon, NumInput, Sheet, Tabs, go, useSettings, useToast } from '../ui/kit';
import { MEAL_LABEL, MEAL_ORDER } from '../db/settings';
import { addDays, dateKey, formatDateIt } from '../lib/dates';
import { NUTRIENT_KEYS, NUTRIENT_LABEL, nutrientsFor, sumNutrients, batchPortion, recipeTotals, strictTotals, scaleNutrients } from '../lib/nutrition';
import { copyMeal, deleteDiaryEntry, eatBatchPortion, eatRecipeDirect, logEstimate, logFood, ShortfallError } from '../lib/inventory';
import { fmtNum } from '../lib/id';
import { FoodEditorSheet, STATE_LABEL, newFood } from './FoodEditor';
import { RecipesTab, RecipeDetail, BarsCalculator } from './Recipes';
import { PantryTab, ShoppingTab } from './Pantry';
import { isFoodAllowed } from '../lib/recipes';

type Sub = 'diario' | 'ricette' | 'dispensa' | 'spesa';

export function FoodScreen({ route }: { route: string[] }) {
  const sub = (route[1] as Sub) || 'diario';
  if (sub === ('ricetta' as Sub) && route[2]) return <RecipeDetail id={route[2]} />;
  if (sub === ('barrette' as Sub)) return <BarsCalculator />;
  return (
    <main className="main">
      <h1>Cibo</h1>
      <Tabs value={sub} onChange={(v) => go(`cibo/${v}`)} items={[['diario', 'Diario'], ['ricette', 'Ricette'], ['dispensa', 'Dispensa'], ['spesa', 'Spesa']]} />
      {sub === 'diario' && <DiaryTab openSlot={(route[2] as MealSlot) || null} />}
      {sub === 'ricette' && <RecipesTab />}
      {sub === 'dispensa' && <PantryTab />}
      {sub === 'spesa' && <ShoppingTab />}
    </main>
  );
}

export function NutrientLine({ n, incomplete }: { n: Nutrients; incomplete?: Partial<Record<keyof Nutrients, boolean>> }) {
  return (
    <span className="small muted num">
      {n.kcal == null ? 'kcal mancanti' : `${fmtNum(n.kcal, 0)} kcal${incomplete?.kcal ? '+?' : ''}`} · {n.protein == null ? 'proteine mancanti' : `P ${fmtNum(n.protein, 1)} g${incomplete?.protein ? '+?' : ''}`}
    </span>
  );
}

function DiaryTab({ openSlot }: { openSlot: MealSlot | null }) {
  const [day, setDay] = useState(dateKey());
  const [adding, setAdding] = useState<MealSlot | null>(openSlot);
  useEffect(() => { if (openSlot) setAdding(openSlot); }, [openSlot]);
  const settings = useSettings();
  const toast = useToast();
  const entries = useLiveQuery(() => db.diary.where('dateKey').equals(day).sortBy('createdAt'), [day]) ?? [];
  const plan = useLiveQuery(() => db.plan.where('dateKey').equals(day).toArray(), [day]) ?? [];
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const complete = useLiveQuery(() => db.kv.get(`diaryComplete:${day}`), [day]);
  const target = useLiveQuery(() => db.targets.orderBy('effectiveFrom').filter((t) => t.effectiveFrom <= day).last(), [day]);
  const total = sumNutrients(entries.map((e) => e.nutrients));
  const proteinTarget = settings.proteinTargetG ?? target?.proteinG ?? null;
  const rName = new Map(recipes.map((r) => [r.id, r.name]));

  return (
    <>
      <div className="row between">
        <button className="iconbtn" aria-label="Giorno precedente" onClick={() => setDay(addDays(day, -1))}><Icon.left /></button>
        <button className="btn ghost" onClick={() => setDay(dateKey())}><strong>{day === dateKey() ? 'Oggi' : formatDateIt(day, true)}</strong></button>
        <button className="iconbtn" aria-label="Giorno successivo" onClick={() => setDay(addDays(day, 1))}><Icon.right /></button>
      </div>
      <div className="card mt">
        <div className="grid2">
          <div><div className="small muted">Energia consumata</div><div className="big num">{fmtNum(total.values.kcal ?? 0, 0)}</div><div className="small muted">{target?.kcal ? `target ${target.kcal} kcal` : 'nessun target'}{total.incomplete.kcal ? ' · voci con dati mancanti' : ''}</div></div>
          <div><div className="small muted">Proteine</div><div className="big num">{fmtNum(total.values.protein ?? 0, 0)} g</div><div className="small muted">{proteinTarget ? `target ${proteinTarget} g` : 'nessun target'}{total.incomplete.protein ? ' · dati mancanti' : ''}</div></div>
        </div>
        <p className="small muted">C {fmtNum(total.values.carbs, 0)} g · G {fmtNum(total.values.fat, 0)} g · Fibra {fmtNum(total.values.fiber, 0)} g{total.incomplete.fiber ? ' (parziale)' : ''}</p>
        <Check checked={!!complete?.value} onChange={(v) => kvSet(`diaryComplete:${day}`, v)}>Ho registrato tutto quello che ho mangiato oggi</Check>
        <p className="small muted">Serve solo a capire se i dati bastano per calibrare: nessun giudizio sui pasti saltati.</p>
      </div>
      {MEAL_ORDER.map((slot) => {
        const list = entries.filter((e) => e.meal === slot);
        const planned = plan.filter((p) => p.slot === slot && !p.done);
        return (
          <section className="card" key={slot}>
            <div className="row between">
              <h3 className="mb0">{MEAL_LABEL[slot]}</h3>
              <span className="row">
                <button className="btn sm ghost" onClick={async () => { const n = await copyMeal(addDays(day, -1), slot, day); toast({ text: n ? `Copiate ${n} voci da ieri` : 'Nessuna voce ieri per questo pasto' }); }}>Copia da ieri</button>
                <button className="iconbtn" aria-label={`Aggiungi a ${MEAL_LABEL[slot]}`} onClick={() => setAdding(slot)}><Icon.plus /></button>
              </span>
            </div>
            {list.map((e) => <EntryRow key={e.id} e={e} />)}
            {planned.map((p) => (
              <div className="setline" key={p.id}>
                <span className="small"><span className="badge">Pianificato</span> {p.recipeId ? rName.get(p.recipeId) : p.foodId} × {p.servings} — non conteggiato</span>
              </div>
            ))}
            {!list.length && !planned.length && <p className="small muted">Niente registrato.</p>}
          </section>
        );
      })}
      {adding && <AddSheet slot={adding} day={day} onClose={() => { setAdding(null); if (openSlot) go('cibo/diario'); }} />}
    </>
  );
}

function EntryRow({ e }: { e: DiaryEntry }) {
  const toast = useToast();
  return (
    <div className="setline">
      <div>
        <div>{e.label}{e.estimated && <span className="badge warn"> stima</span>}</div>
        <span className="small muted">{e.qty != null ? `${fmtNum(e.qty, 1)} ${e.unit === 'porzione' ? 'porz.' : e.unit}` : ''} </span><NutrientLine n={e.nutrients} />
      </div>
      <button className="iconbtn" aria-label={`Elimina ${e.label}`} onClick={async () => {
        try { await deleteDiaryEntry(e.id); toast({ text: e.txId ? 'Voce eliminata, dispensa ripristinata' : 'Voce eliminata' }); }
        catch (err) { toast({ text: String(err instanceof Error ? err.message : err), kind: 'error' }); }
      }}><Icon.trash /></button>
    </div>
  );
}

function AddSheet({ slot, day, onClose }: { slot: MealSlot; day: string; onClose: () => void }) {
  const [tab, setTab] = useState<'food' | 'batch' | 'recipe' | 'estimate'>('food');
  return (
    <Sheet title={`Aggiungi a ${MEAL_LABEL[slot]}`} onClose={onClose}>
      <Tabs value={tab} onChange={setTab} items={[['food', 'Alimento'], ['batch', 'Pronto'], ['recipe', 'Ricetta'], ['estimate', 'Stima']]} />
      {tab === 'food' && <AddFood slot={slot} day={day} onDone={onClose} />}
      {tab === 'batch' && <AddBatch slot={slot} day={day} onDone={onClose} />}
      {tab === 'recipe' && <AddRecipe slot={slot} day={day} onDone={onClose} />}
      {tab === 'estimate' && <AddEstimate slot={slot} day={day} onDone={onClose} />}
    </Sheet>
  );
}

function AddFood({ slot, day, onDone }: { slot: MealSlot; day: string; onDone: () => void }) {
  const settings = useSettings();
  const toast = useToast();
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), []) ?? [];
  const stock = useLiveQuery(() => db.stock.toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Food | null>(null);
  const [qty, setQty] = useState<number | null>(null);
  const [unit, setUnit] = useState<'g' | 'ml' | 'pz'>('g');
  const [deduct, setDeduct] = useState(false);
  const [editor, setEditor] = useState<Food | null>(null);
  const [shortfall, setShortfall] = useState<string | null>(null);
  const rules = { excludedTags: settings.excludedTags, allergies: settings.profile.allergies };
  const list = useMemo(() => foods.filter((f) => (f.name + ' ' + f.brand + ' ' + f.barcode).toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.favorite) - Number(a.favorite)), [foods, q]);
  const pick = (f: Food) => { setSel(f); setQty(f.defaultPortion); setUnit(f.defaultUnit); setDeduct(stock.some((l) => l.foodId === f.id && l.qty > 0)); };
  const n = sel && qty != null ? nutrientsFor(sel, qty, unit) : null;
  const submit = async (allow = false) => {
    if (!sel || qty == null || qty <= 0) return;
    try {
      await logFood({ food: sel, qty, unit, meal: slot, dateKey: day, deductStock: deduct, allowShortfall: allow });
      toast({ text: `${sel.name} registrato ✓` });
      onDone();
    } catch (e) {
      if (e instanceof ShortfallError) setShortfall(e.message); else toast({ text: String(e), kind: 'error' });
    }
  };
  if (!sel) return (
    <>
      <input type="search" placeholder="Cerca alimento, marca o codice…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cerca alimento" autoFocus />
      <ul className="list mt">
        {list.slice(0, 60).map((f) => (
          <li key={f.id}><button className="listbtn" onClick={() => pick(f)}>
            <span>{f.favorite ? '★ ' : ''}{f.name}<br /><span className="small muted">{STATE_LABEL[f.state]} · {f.source === 'estimate' ? 'stima non verificata' : f.verified ? 'verificato' : 'da verificare'}{!isFoodAllowed(f, rules) ? ' · escluso dalle tue preferenze' : ''}</span></span>
            <Icon.right /></button></li>
        ))}
      </ul>
      <button className="btn block" onClick={() => setEditor({ ...newFood(), name: q })}><Icon.plus /> Nuovo alimento</button>
      {editor && <FoodEditorSheet food={editor} onClose={() => setEditor(null)} onSaved={pick} />}
    </>
  );
  return (
    <div className="col">
      <div className="row between"><strong>{sel.name}</strong><button className="btn sm ghost" onClick={() => setSel(null)}>Cambia</button></div>
      {!isFoodAllowed(sel, rules) && <div className="banner warn small">Questo alimento rientra nelle tue esclusioni. Puoi registrarlo se l'hai mangiato, ma non verrà proposto.</div>}
      <p className="small muted">Stato: {STATE_LABEL[sel.state]} (valori per 100 {sel.basis === '100g' ? 'g' : 'ml'}). {sel.sourceNote}</p>
      <div className="grid2">
        <NumInput label="Quantità" value={qty} onChange={setQty} />
        <Field label="Unità"><select value={unit} onChange={(e) => setUnit(e.target.value as 'g' | 'ml' | 'pz')}><option value="g">g</option><option value="ml">ml</option><option value="pz">pezzi</option></select></Field>
      </div>
      {n && <p><NutrientLine n={n} /></p>}
      {n && NUTRIENT_KEYS.some((k) => n[k] == null) && <p className="small muted">Alcuni valori risultano mancanti (es. unità senza peso per pezzo o densità nota): non vengono contati come zero.</p>}
      <Check checked={deduct} onChange={setDeduct}>Scarica dalla dispensa</Check>
      {shortfall && <div className="card warn small">{shortfall}<div className="row mt"><button className="btn sm" onClick={() => submit(true)}>Registra comunque (scarica il disponibile)</button></div></div>}
      <button className="btn primary block" disabled={qty == null || qty <= 0} onClick={() => submit(false)}>Registra come mangiato</button>
      <button className="btn block" onClick={() => setEditor(sel)}><Icon.edit /> Modifica alimento</button>
      {editor && <FoodEditorSheet food={editor} onClose={() => setEditor(null)} onSaved={pick} />}
    </div>
  );
}

function AddBatch({ slot, day, onDone }: { slot: MealSlot; day: string; onDone: () => void }) {
  const toast = useToast();
  const batches = useLiveQuery(() => db.batches.filter((b) => b.servingsLeft > 0).toArray(), []) ?? [];
  const [servings, setServings] = useState<number | null>(1);
  if (!batches.length) return <p className="empty">Nessuna porzione pronta. Le crei da Ricette → "Ho preparato".</p>;
  return (
    <div className="col">
      <NumInput label="Porzioni" hint="Anche frazioni, es. 0,5" value={servings} onChange={setServings} />
      <ul className="list">
        {batches.map((b) => (
          <li key={b.id} className="row between">
            <div><strong>{b.name}</strong><br /><span className="small muted">{fmtNum(b.servingsLeft, 1)} di {b.servingsTotal} porzioni · {b.location} · preparato {formatDateIt(b.dateKey)}</span><br /><NutrientLine n={batchPortion(b, 1)} /> <span className="small muted">a porzione</span></div>
            <button className="btn sm primary" disabled={!servings} onClick={async () => {
              try { await eatBatchPortion({ batchId: b.id, servings: servings!, meal: slot, dateKey: day }); toast({ text: 'Porzione registrata ✓' }); onDone(); }
              catch (e) { toast({ text: String(e instanceof Error ? e.message : e), kind: 'error' }); }
            }}>Mangiata</button>
          </li>
        ))}
      </ul>
      <p className="small muted">Mangiare una porzione pronta non scarica di nuovo gli ingredienti.</p>
    </div>
  );
}

function AddRecipe({ slot, day, onDone }: { slot: MealSlot; day: string; onDone: () => void }) {
  const toast = useToast();
  const settings = useSettings();
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const fMap = new Map(foods.map((f) => [f.id, f]));
  const [servings, setServings] = useState<number | null>(1);
  const [deduct, setDeduct] = useState(true);
  const [shortfall, setShortfall] = useState<{ id: string; msg: string } | null>(null);
  const eat = async (id: string, allow = false) => {
    try { await eatRecipeDirect({ recipeId: id, servings: servings!, meal: slot, dateKey: day, deductStock: deduct, allowShortfall: allow }); toast({ text: 'Pasto registrato ✓' }); onDone(); }
    catch (e) { if (e instanceof ShortfallError) setShortfall({ id, msg: e.message }); else toast({ text: String(e), kind: 'error' }); }
  };
  return (
    <div className="col">
      <p className="small muted">Pasto assemblato al momento: consuma direttamente gli ingredienti. Per i piatti preparati in più porzioni usa "Pronto".</p>
      <NumInput label="Porzioni" value={servings} onChange={setServings} />
      <Check checked={deduct} onChange={setDeduct}>Scarica gli ingredienti dalla dispensa</Check>
      {shortfall && <div className="card warn small">{shortfall.msg}<div className="mt"><button className="btn sm" onClick={() => eat(shortfall.id, true)}>Registra comunque</button></div></div>}
      <ul className="list">
        {recipes.filter((r) => !r.ingredients.some((i) => fMap.get(i.foodId)?.tags.some((t) => settings.excludedTags.includes(t)))).map((r) => {
          const n = strictTotals(recipeTotals(r, fMap, (servings ?? 1) / r.servings).sum);
          return (
            <li key={r.id} className="row between">
              <div><strong>{r.name}</strong><br /><NutrientLine n={n} /></div>
              <button className="btn sm" disabled={!servings} onClick={() => eat(r.id)}>Mangiato</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AddEstimate({ slot, day, onDone }: { slot: MealSlot; day: string; onDone: () => void }) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [n, setN] = useState<Nutrients>({ kcal: null, protein: null, carbs: null, fat: null, fiber: null });
  return (
    <div className="col">
      <p className="small muted">Per pasti fuori casa: inserisci una stima esplicita. Verrà marcata come stima; i campi vuoti restano "mancanti".</p>
      <Field label="Cosa hai mangiato"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="es. panino al bar" /></Field>
      <div className="grid2">{NUTRIENT_KEYS.map((k) => <NumInput key={k} label={NUTRIENT_LABEL[k]} value={n[k]} onChange={(v) => setN({ ...n, [k]: v })} placeholder="mancante" />)}</div>
      <button className="btn primary block" disabled={!label} onClick={async () => { await logEstimate({ label, nutrients: n, meal: slot, dateKey: day }); toast({ text: 'Stima registrata ✓' }); onDone(); }}>Registra stima</button>
    </div>
  );
}

export function scaleN(n: Nutrients, f: number) { return scaleNutrients(n, f); }
export { Chip };
