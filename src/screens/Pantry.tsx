import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Food, MealSlot, StockLot } from '../db/types';
import { Field, Icon, NumInput, Sheet, Tabs, useToast } from '../ui/kit';
import { MEAL_LABEL, MEAL_ORDER } from '../db/settings';
import { purchase, eatBatchPortion, undoTx } from '../lib/inventory';
import { shoppingNeeds } from '../lib/recipes';
import { addDays, dateKey, daysBetween, formatDateIt } from '../lib/dates';
import { fmtNum, uid } from '../lib/id';
import { batchPortion } from '../lib/nutrition';
import { NutrientLine } from './Food';

const LOC = { dispensa: 'Dispensa', frigo: 'Frigo', freezer: 'Freezer' } as const;

export function PantryTab() {
  const [tab, setTab] = useState<'scorte' | 'pronti' | 'movimenti'>('scorte');
  return (
    <>
      <Tabs value={tab} onChange={setTab} items={[['scorte', 'Scorte'], ['pronti', 'Preparati'], ['movimenti', 'Movimenti']]} />
      {tab === 'scorte' && <Stock />}
      {tab === 'pronti' && <Prepared />}
      {tab === 'movimenti' && <Moves />}
    </>
  );
}

function expiryBadge(exp: string | null) {
  if (!exp) return null;
  const d = daysBetween(dateKey(), exp);
  if (d < 0) return <span className="badge danger">oltre la data in etichetta</span>;
  if (d <= 2) return <span className="badge warn">scade {d === 0 ? 'oggi' : `tra ${d} g`}</span>;
  return <span className="badge">scad. {formatDateIt(exp)}</span>;
}

function Stock() {
  const toast = useToast();
  const lots = useLiveQuery(() => db.stock.toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), []) ?? [];
  const fMap = new Map(foods.map((f) => [f.id, f]));
  const [add, setAdd] = useState<Food | null | 'pick'>(null);
  const [edit, setEdit] = useState<StockLot | null>(null);
  const [hideEmpty, setHideEmpty] = useState(true);
  const visible = lots.filter((l) => !hideEmpty || l.qty > 0);
  return (
    <>
      <div className="row between"><button className="btn sm" onClick={() => setAdd('pick')}><Icon.plus /> Aggiungi scorta</button>
        <label className="check small"><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} /> Nascondi esauriti</label></div>
      {(['frigo', 'freezer', 'dispensa'] as const).map((loc) => {
        const ls = visible.filter((l) => l.location === loc).sort((a, b) => (a.expiry ?? '9').localeCompare(b.expiry ?? '9'));
        if (!ls.length) return null;
        return (
          <section className="card mt" key={loc}>
            <h3>{LOC[loc]}</h3>
            {ls.map((l) => (
              <div className="setline" key={l.id}>
                <div><div>{fMap.get(l.foodId)?.name ?? l.foodId}</div><div className="small muted num">{fmtNum(l.qty, 1)} {l.unit}{l.openedAt ? ` · aperto ${formatDateIt(l.openedAt)}` : ''} {expiryBadge(l.expiry)}</div></div>
                <button className="iconbtn" aria-label="Modifica scorta" onClick={() => setEdit(l)}><Icon.edit /></button>
              </div>
            ))}
          </section>
        );
      })}
      {!visible.length && <p className="empty">Dispensa vuota. Aggiungi ciò che hai, oppure segna "Comprato" dalla lista della spesa.</p>}
      <p className="small muted">Le date sono quelle in etichetta: l'app non giudica la sicurezza da odore o aspetto.</p>
      {add === 'pick' && <FoodPicker onPick={(f) => setAdd(f)} onClose={() => setAdd(null)} />}
      {add && add !== 'pick' && <PurchaseSheet food={add} onClose={() => setAdd(null)} />}
      {edit && (
        <Sheet title={fMap.get(edit.foodId)?.name ?? 'Scorta'} onClose={() => setEdit(null)}>
          <EditLot lot={edit} onDone={() => { setEdit(null); toast({ text: 'Scorta aggiornata ✓' }); }} />
        </Sheet>
      )}
    </>
  );
}

function EditLot({ lot, onDone }: { lot: StockLot; onDone: () => void }) {
  const [qty, setQty] = useState<number | null>(lot.qty);
  const [exp, setExp] = useState(lot.expiry ?? '');
  const [opened, setOpened] = useState(lot.openedAt ?? '');
  const [loc, setLoc] = useState(lot.location);
  return (
    <div className="col">
      <NumInput label={`Quantità (${lot.unit})`} value={qty} onChange={setQty} />
      <Field label="Scadenza in etichetta"><input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
      <Field label="Aperto il"><input type="date" value={opened} onChange={(e) => setOpened(e.target.value)} /></Field>
      <Field label="Luogo"><select value={loc} onChange={(e) => setLoc(e.target.value as StockLot['location'])}>{Object.entries(LOC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <button className="btn primary block" disabled={qty == null || qty < 0} onClick={async () => {
        await db.transaction('rw', db.stock, db.stockTx, async () => {
          const delta = (qty ?? 0) - lot.qty;
          await db.stock.update(lot.id, { qty: qty ?? 0, expiry: exp || null, openedAt: opened || null, location: loc });
          if (Math.abs(delta) > 1e-9) await db.stockTx.add({ id: uid(), at: Date.now(), kind: 'adjust', label: 'Rettifica manuale scorta', moves: [{ table: 'stock', id: lot.id, field: 'qty', delta }], diaryIds: [], shortfalls: [], undone: false });
        });
        onDone();
      }}>Salva</button>
      <button className="btn danger block" onClick={async () => { await db.stock.delete(lot.id); onDone(); }}><Icon.trash /> Elimina lotto</button>
    </div>
  );
}

export function FoodPicker({ onPick, onClose }: { onPick: (f: Food) => void; onClose: () => void }) {
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), []) ?? [];
  const [q, setQ] = useState('');
  return (
    <Sheet title="Scegli alimento" onClose={onClose}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca…" aria-label="Cerca alimento" />
      <ul className="list mt">{foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).map((f) => <li key={f.id}><button className="listbtn" onClick={() => onPick(f)}>{f.name}<Icon.right /></button></li>)}</ul>
    </Sheet>
  );
}

export function PurchaseSheet({ food, onClose, defaultQty, defaultUnit, onDone }: { food: Food; onClose: () => void; defaultQty?: number; defaultUnit?: 'g' | 'ml' | 'pz'; onDone?: () => void }) {
  const toast = useToast();
  const [qty, setQty] = useState<number | null>(defaultQty ?? food.defaultPortion);
  const [unit, setUnit] = useState<'g' | 'ml' | 'pz'>(defaultUnit ?? food.defaultUnit);
  const [loc, setLoc] = useState<StockLot['location']>(food.shelfStable === 'no' ? 'frigo' : 'dispensa');
  const [exp, setExp] = useState('');
  return (
    <Sheet title={`Comprato: ${food.name}`} onClose={onClose}>
      <div className="col">
        <div className="grid2">
          <NumInput label="Quantità" value={qty} onChange={setQty} />
          <Field label="Unità"><select value={unit} onChange={(e) => setUnit(e.target.value as 'g')}><option value="g">g</option><option value="ml">ml</option><option value="pz">pezzi</option></select></Field>
        </div>
        <Field label="Luogo"><select value={loc} onChange={(e) => setLoc(e.target.value as StockLot['location'])}>{Object.entries(LOC).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Scadenza in etichetta (facoltativa)"><input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></Field>
        <button className="btn primary block" disabled={!qty} onClick={async () => { await purchase({ foodId: food.id, qty: qty!, unit, location: loc, expiry: exp || null }); toast({ text: 'Aggiunto in dispensa ✓' }); onDone?.(); onClose(); }}>Aggiungi alla dispensa</button>
      </div>
    </Sheet>
  );
}

function Prepared() {
  const toast = useToast();
  const batches = useLiveQuery(() => db.batches.orderBy('recipeId').toArray(), []) ?? [];
  const [eat, setEat] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealSlot>('pranzo');
  const [serv, setServ] = useState<number | null>(1);
  const active = batches.filter((b) => b.servingsLeft > 0);
  return (
    <>
      {!active.length && <p className="empty">Nessun piatto preparato disponibile.</p>}
      {active.map((b) => (
        <div className="card" key={b.id}>
          <div className="row between"><strong>{b.name}</strong><span className="badge">{LOC[b.location]}</span></div>
          <p className="small muted">{fmtNum(b.servingsLeft, 1)} di {b.servingsTotal} porzioni · preparato {formatDateIt(b.dateKey)}{b.finalWeightG ? ` · lotto ${fmtNum(b.finalWeightG, 0)} g` : ''}</p>
          <NutrientLine n={batchPortion(b, 1)} /> <span className="small muted">a porzione</span>
          <div className="row wrap mt">
            <button className="btn sm primary" onClick={() => setEat(b.id)}>Mangia porzione</button>
            {b.location !== 'freezer' && <button className="btn sm" onClick={() => db.batches.update(b.id, { location: 'freezer' })}>Sposta in freezer</button>}
            {b.location === 'freezer' && <button className="btn sm" onClick={() => db.batches.update(b.id, { location: 'frigo' })}>Scongela in frigo</button>}
            <button className="btn sm" onClick={async () => {
              await db.transaction('rw', db.batches, db.stockTx, async () => {
                await db.stockTx.add({ id: uid(), at: Date.now(), kind: 'adjust', label: `Scartato: ${b.name}`, moves: [{ table: 'batches', id: b.id, field: 'servingsLeft', delta: -b.servingsLeft }], diaryIds: [], shortfalls: [], undone: false });
                await db.batches.update(b.id, { servingsLeft: 0 });
              });
              toast({ text: 'Porzioni rimanenti scartate (annullabile da Movimenti)' });
            }}>Scarta</button>
          </div>
        </div>
      ))}
      {eat && (
        <Sheet title="Mangia porzione" onClose={() => setEat(null)}>
          <div className="col">
            <Field label="Pasto"><select value={meal} onChange={(e) => setMeal(e.target.value as MealSlot)}>{MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}</select></Field>
            <NumInput label="Porzioni" value={serv} onChange={setServ} />
            <button className="btn primary block" disabled={!serv} onClick={async () => {
              try { await eatBatchPortion({ batchId: eat, servings: serv!, meal }); toast({ text: 'Registrata nel diario ✓' }); setEat(null); }
              catch (e) { toast({ text: String(e instanceof Error ? e.message : e), kind: 'error' }); }
            }}>Registra</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function Moves() {
  const toast = useToast();
  const tx = useLiveQuery(() => db.stockTx.orderBy('at').reverse().limit(40).toArray(), []) ?? [];
  return (
    <ul className="list card flat">
      {!tx.length && <li className="empty">Nessun movimento.</li>}
      {tx.map((t) => (
        <li key={t.id} className="row between">
          <div className="small"><span style={{ textDecoration: t.undone ? 'line-through' : undefined }}>{t.label}</span><br /><span className="muted">{new Date(t.at).toLocaleString('it-IT')}{t.shortfalls.length ? ` · ${t.shortfalls.length} mancanze annotate` : ''}{t.undone ? ' · annullato' : ''}</span></div>
          {!t.undone && <button className="btn sm" onClick={async () => { try { await undoTx(t.id); toast({ text: 'Operazione annullata ✓' }); } catch (e) { toast({ text: String(e instanceof Error ? e.message : e), kind: 'error' }); } }}>Annulla</button>}
        </li>
      ))}
    </ul>
  );
}

export function ShoppingTab() {
  const toast = useToast();
  const today = dateKey();
  const [days, setDays] = useState(7);
  const plan = useLiveQuery(() => db.plan.where('dateKey').between(today, addDays(today, days - 1), true, true).toArray(), [today, days]) ?? [];
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const lots = useLiveQuery(() => db.stock.toArray(), []) ?? [];
  const batches = useLiveQuery(() => db.batches.toArray(), []) ?? [];
  const manual = useLiveQuery(() => db.shopping.orderBy('id').toArray(), []) ?? [];
  const fMap = new Map(foods.map((f) => [f.id, f]));
  const needs = shoppingNeeds({ plan, recipes: new Map(recipes.map((r) => [r.id, r])), foods: fMap, lots, batches });
  const [buy, setBuy] = useState<{ food: Food; qty?: number; unit?: 'g' | 'ml' | 'pz'; manualId?: string } | null>(null);
  const [name, setName] = useState('');
  const [pick, setPick] = useState(false);
  return (
    <>
      <div className="row between">
        <span className="small muted">Dal piano dei prossimi</span>
        <select aria-label="Giorni" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 'auto' }}><option value={3}>3 giorni</option><option value={7}>7 giorni</option><option value={14}>14 giorni</option></select>
      </div>
      <div className="card mt">
        <h3>Dal piano</h3>
        {!plan.length && <p className="small muted">Nessun pasto pianificato: pianifica da Ricette o dal Calendario.</p>}
        {needs.filter((n) => n.toBuy > 0).map((n) => {
          const f = fMap.get(n.foodId);
          return (
            <div className="setline" key={n.foodId + n.unit}>
              <div><div>{f?.name ?? n.foodId}</div><div className="small muted num">servono {fmtNum(n.needed, 0)} {n.unit} · in casa {fmtNum(n.have, 0)} → <strong>da comprare {fmtNum(n.toBuy, 0)} {n.unit}</strong></div></div>
              {f && <button className="btn sm" onClick={() => setBuy({ food: f, qty: Math.ceil(n.toBuy), unit: n.unit as 'g' })}>Comprato</button>}
            </div>
          );
        })}
        {plan.length > 0 && !needs.some((n) => n.toBuy > 0) && <p className="small">Hai già tutto per il piano ✓</p>}
        <p className="small muted">Le porzioni già preparate in frigo/freezer coprono i pasti pianificati della stessa ricetta. "Pianificato" non consuma la dispensa; "Comprato" la aggiorna.</p>
      </div>
      <div className="card">
        <h3>Altro da comprare</h3>
        <div className="row"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aggiungi voce…" aria-label="Nuova voce" />
          <button className="btn sm" disabled={!name.trim()} onClick={async () => { await db.shopping.add({ id: uid(), foodId: null, name: name.trim(), qty: null, unit: '', checked: false, note: '', createdAt: Date.now() }); setName(''); }}>Aggiungi</button></div>
        <button className="btn sm mt" onClick={() => setPick(true)}>+ da alimenti</button>
        {manual.map((m) => (
          <div className="setline" key={m.id}>
            <label className="check grow"><input type="checkbox" checked={m.checked} onChange={(e) => db.shopping.update(m.id, { checked: e.target.checked })} /><span style={{ textDecoration: m.checked ? 'line-through' : undefined }}>{m.name}</span></label>
            {m.foodId && fMap.get(m.foodId) && !m.checked && <button className="btn sm" onClick={() => setBuy({ food: fMap.get(m.foodId!)!, manualId: m.id })}>Comprato</button>}
            <button className="iconbtn" aria-label="Rimuovi" onClick={() => db.shopping.delete(m.id)}><Icon.trash /></button>
          </div>
        ))}
        {manual.some((m) => m.checked) && <button className="btn sm mt" onClick={() => db.shopping.bulkDelete(manual.filter((m) => m.checked).map((m) => m.id))}>Rimuovi spuntati</button>}
      </div>
      {buy && <PurchaseSheet food={buy.food} defaultQty={buy.qty} defaultUnit={buy.unit} onClose={() => setBuy(null)} onDone={() => { if (buy.manualId) db.shopping.update(buy.manualId, { checked: true }); toast({ text: 'Dispensa aggiornata ✓' }); }} />}
      {pick && <FoodPicker onClose={() => setPick(false)} onPick={async (f) => { await db.shopping.add({ id: uid(), foodId: f.id, name: f.name, qty: null, unit: '', checked: false, note: '', createdAt: Date.now() }); setPick(false); }} />}
    </>
  );
}
