import { useState } from 'react';
import { db } from '../db/db';
import type { Food, FoodSource, FoodState, Nutrients } from '../db/types';
import { Check, Field, NumInput, Sheet, useToast } from '../ui/kit';
import { atwaterGap, NUTRIENT_KEYS, NUTRIENT_LABEL, NUTRIENT_UNIT } from '../lib/nutrition';
import { uid, fmtNum } from '../lib/id';
import { dateKey } from '../lib/dates';

export const STATE_LABEL: Record<FoodState, string> = { raw: 'crudo', cooked: 'cotto', drained: 'sgocciolato', as_sold: 'come venduto' };
export const SOURCE_LABEL: Record<FoodSource, string> = { label: 'Etichetta prodotto', database: 'Database verificabile', estimate: 'Stima' };
export const COMMON_TAGS = ['formaggio', 'latte', 'mozzarella', 'glutine', 'uova', 'pesce', 'affettato', 'arachidi', 'frutta_a_guscio', 'legumi', 'soia'];

export function newFood(): Food {
  return {
    id: uid(), name: '', brand: '', source: 'label', sourceNote: '', sourceDate: dateKey(), verified: false, state: 'raw', basis: '100g',
    per100: { kcal: null, protein: null, carbs: null, fat: null, fiber: null }, densityGPerMl: null, gramsPerPiece: null, defaultPortion: null,
    defaultUnit: 'g', barcode: '', tags: [], shelfStable: 'unknown', seed: false, favorite: false
  };
}

export function FoodEditorSheet({ food, onClose, onSaved }: { food: Food; onClose: () => void; onSaved?: (f: Food) => void }) {
  const toast = useToast();
  const [f, setF] = useState<Food>(structuredClone(food));
  const [off, setOff] = useState<{ loading: boolean; result: string | null; data: Partial<Food> | null }>({ loading: false, result: null, data: null });
  const up = (p: Partial<Food>) => setF({ ...f, ...p });
  const upN = (k: keyof Nutrients, v: number | null) => setF({ ...f, per100: { ...f.per100, [k]: v } });
  const gap = atwaterGap(f.per100);
  const lookupOFF = async () => {
    if (!f.barcode.trim()) return;
    if (!navigator.onLine) { setOff({ loading: false, result: 'Sei offline: inserisci i valori a mano dall\'etichetta.', data: null }); return; }
    setOff({ loading: true, result: null, data: null });
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(f.barcode.trim())}.json?fields=product_name,brands,nutriments`);
      const j = await r.json();
      if (j.status !== 1) { setOff({ loading: false, result: 'Prodotto non trovato su Open Food Facts.', data: null }); return; }
      const n = j.product.nutriments ?? {};
      const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
      const data: Partial<Food> = {
        name: f.name || j.product.product_name || '', brand: j.product.brands ?? '', source: 'database',
        sourceNote: `Open Food Facts (licenza ODbL), codice ${f.barcode.trim()}, importato il ${dateKey()}. Dati da verificare con l'etichetta.`,
        per100: { kcal: num(n['energy-kcal_100g']), protein: num(n.proteins_100g), carbs: num(n.carbohydrates_100g), fat: num(n.fat_100g), fiber: num(n.fiber_100g) },
        state: 'as_sold', verified: false
      };
      setOff({ loading: false, result: 'Trovato: controlla i valori qui sotto prima di applicarli.', data });
    } catch {
      setOff({ loading: false, result: 'Ricerca non riuscita (rete o servizio non disponibile).', data: null });
    }
  };
  const save = async () => {
    if (!f.name.trim()) { toast({ text: 'Inserisci un nome', kind: 'error' }); return; }
    await db.foods.put(f);
    toast({ text: 'Alimento salvato ✓' });
    onSaved?.(f);
    onClose();
  };
  return (
    <Sheet title={food.name ? 'Modifica alimento' : 'Nuovo alimento'} onClose={onClose}>
      <div className="col">
        <Field label="Nome"><input value={f.name} onChange={(e) => up({ name: e.target.value })} /></Field>
        <Field label="Marca"><input value={f.brand} onChange={(e) => up({ brand: e.target.value })} /></Field>
        <Field label="Codice a barre" hint="Digitalo dalla confezione. Scansione con fotocamera non implementata in questa versione.">
          <div className="row"><input inputMode="numeric" value={f.barcode} onChange={(e) => up({ barcode: e.target.value.replace(/\D/g, '') })} /><button className="btn sm" type="button" disabled={!f.barcode || off.loading} onClick={lookupOFF}>{off.loading ? '…' : 'Cerca online'}</button></div>
        </Field>
        {off.result && <div className="card flat small">{off.result}{off.data && (
          <>
            <p>{off.data.name} {off.data.brand ? `· ${off.data.brand}` : ''}<br />{NUTRIENT_KEYS.map((k) => `${NUTRIENT_LABEL[k]} ${off.data!.per100![k] == null ? 'mancante' : fmtNum(off.data!.per100![k], 1)}`).join(' · ')}</p>
            <button className="btn sm" onClick={() => { setF({ ...f, ...off.data! }); setOff({ ...off, data: null, result: 'Valori applicati: verifica e salva.' }); }}>Applica</button>
          </>
        )}</div>}
        <div className="grid2">
          <Field label="Fonte"><select value={f.source} onChange={(e) => up({ source: e.target.value as FoodSource })}>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Stato"><select value={f.state} onChange={(e) => up({ state: e.target.value as FoodState })}>{Object.entries(STATE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
        <Field label="Note sulla fonte"><input value={f.sourceNote} onChange={(e) => up({ sourceNote: e.target.value })} /></Field>
        <div className="grid2">
          <Field label="Data della fonte"><input type="date" value={f.sourceDate ?? ''} onChange={(e) => up({ sourceDate: e.target.value || null })} /></Field>
          <Field label="Valori riferiti a"><select value={f.basis} onChange={(e) => up({ basis: e.target.value as Food['basis'] })}><option value="100g">100 g</option><option value="100ml">100 ml</option></select></Field>
        </div>
        <div className="grid2">
          {NUTRIENT_KEYS.map((k) => <NumInput key={k} label={`${NUTRIENT_LABEL[k]} (${NUTRIENT_UNIT[k]})`} value={f.per100[k]} onChange={(v) => upN(k, v)} placeholder="mancante" />)}
        </div>
        <p className="small muted">Campo vuoto = dato mancante (mai zero).{gap != null && Math.abs(gap) > 0.12 ? ` Nota: 4P+4C+9F differisce del ${fmtNum(gap * 100, 0)}% dalle kcal indicate — normale con fibra, polioli e arrotondamenti; controlla solo eventuali errori di battitura.` : ''}</p>
        <div className="grid2">
          <NumInput label="Densità g/ml" hint="Solo se nota (mai assunta 1)" value={f.densityGPerMl} onChange={(v) => up({ densityGPerMl: v })} />
          <NumInput label="Grammi per pezzo" hint="Solo se pesato/noto" value={f.gramsPerPiece} onChange={(v) => up({ gramsPerPiece: v })} />
        </div>
        <div className="grid2">
          <NumInput label="Porzione abituale" value={f.defaultPortion} onChange={(v) => up({ defaultPortion: v })} />
          <Field label="Unità"><select value={f.defaultUnit} onChange={(e) => up({ defaultUnit: e.target.value as Food['defaultUnit'] })}><option value="g">g</option><option value="ml">ml</option><option value="pz">pezzi</option></select></Field>
        </div>
        <Field label="Conservazione fuori frigo">
          <select value={f.shelfStable} onChange={(e) => up({ shelfStable: e.target.value as Food['shelfStable'] })}>
            <option value="unknown">Non indicato</option><option value="yes">Stabile secondo etichetta</option><option value="until_opened">Stabile solo finché chiuso</option><option value="no">Richiede frigo</option>
          </select>
        </Field>
        <fieldset className="card flat"><legend className="small"><strong>Etichette (esclusioni e allergeni)</strong></legend>
          <div className="chips">{COMMON_TAGS.map((t) => <button type="button" key={t} className="chip" aria-pressed={f.tags.includes(t)} onClick={() => up({ tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] })}>{t}</button>)}</div>
        </fieldset>
        <Check checked={f.verified} onChange={(v) => up({ verified: v })}>Valori verificati con l'etichetta o la tabella</Check>
        <Check checked={f.favorite} onChange={(v) => up({ favorite: v })}>Preferito</Check>
        <button className="btn primary block" onClick={save}>Salva alimento</button>
      </div>
    </Sheet>
  );
}
