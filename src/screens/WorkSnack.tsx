// Pannello "Spuntino salato da portare": cosa puoi preparare con la dispensa, cosa manca, perché, e scelta modificabile.
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import type { Recipe } from '../db/types';
import { Chip, go, useSettings, useToast } from '../ui/kit';
import { patchSettings } from '../db/bootstrap';
import { rulesFrom, type RecipeFeedback } from '../lib/recipes';
import { snackForWork } from '../lib/snack';
import { dateKey } from '../lib/dates';
import { fmtNum, uid } from '../lib/id';
import { recipeTotals, strictTotals } from '../lib/nutrition';
import { NutrientLine } from './Food';

/** Trasportabile e "fuori frigo" sono due cose diverse: le mostro separate, con la fonte. */
export function AmbientInfo({ r }: { r: Recipe }) {
  const amb = r.ambient ?? (r.needsColdChain ? 'requires_cold' : 'not_verified');
  return (
    <div className="card flat small" data-testid="ambient-info">
      <div><strong>Trasportabile:</strong> {r.portable ? 'sì (si porta in un contenitore)' : 'no'}</div>
      <div><strong>Fuori frigo:</strong> {amb === 'ok' ? 'adatto senza refrigerazione secondo la fonte, a confezione integra' : amb === 'requires_cold' ? 'no, richiede frigo o borsa termica con ghiaccio' : 'non verificato: trattalo come da tenere al freddo'}</div>
      {r.ambientSource && <div className="muted">Fonte: {r.ambientSource}</div>}
    </div>
  );
}

export function WorkSnack() {
  const toast = useToast();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [salty, setSalty] = useState(true);
  const recipes = useLiveQuery(() => db.recipes.toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const lots = useLiveQuery(() => db.stock.toArray(), []) ?? [];
  const tracked = useLiveQuery(() => db.kv.get('pantryTracking'), [])?.value === true;
  const fb = (useLiveQuery(() => db.kv.get('recipeFeedback'), [])?.value as Record<string, RecipeFeedback>) ?? {};
  if (!open) return <button className="btn block" style={{ marginBottom: 12 }} onClick={() => setOpen(true)}>Spuntino {salty ? 'salato' : ''} da portare al lavoro</button>;
  const fMap = new Map(foods.map((f) => [f.id, f]));
  const res = snackForWork({ recipes, foods: fMap, lots, rules: rulesFrom(settings), today: dateKey(), coolerBag: settings.profile.coolerBag, fridgeAway: settings.profile.fridgeAway, pantryTracked: tracked, salty, feedback: fb });
  const o = res.options.length ? res.options[idx % res.options.length] : null;
  const name = (id: string) => fMap.get(id)?.name ?? id;
  const addMissing = async () => {
    if (!o) return;
    const now = Date.now();
    await db.shopping.bulkAdd(o.missing.map((m, k) => ({ id: uid(), foodId: m.foodId, name: name(m.foodId), qty: Math.ceil(m.qty), unit: (m.unit as 'g' | 'ml' | 'pz'), checked: false, note: `per: ${o.recipe.name}`, createdAt: now + k })));
    toast({ text: `${o.missing.length} ingredienti aggiunti alla spesa ✓` });
  };
  return (
    <section className="card" data-testid="work-snack">
      <div className="row between"><strong>Spuntino da portare al lavoro</strong><button className="btn sm ghost" onClick={() => setOpen(false)}>Chiudi</button></div>
      <div className="chips">
        <Chip on={salty} onClick={() => { setSalty(true); setIdx(0); }}>Salato</Chip>
        <Chip on={!salty} onClick={() => { setSalty(false); setIdx(0); }}>Qualsiasi</Chip>
      </div>
      {!o && <p className="empty">Nessuno spuntino compatibile con le tue regole e la conservazione disponibile.</p>}
      {o && (
        <div data-testid="snack-option">
          <p className="mt0"><a href={`#/cibo/ricetta/${o.recipe.id}`}><strong data-testid="snack-name">{o.recipe.name}</strong></a> <span className="small muted">({idx % res.options.length + 1} di {res.options.length})</span></p>
          <div className="chips">
            {o.canMakeNow === true && <span className="badge ok" data-testid="snack-status">Puoi prepararlo ora</span>}
            {o.canMakeNow === false && <span className="badge warn" data-testid="snack-status">Mancano {o.missing.length} ingredienti</span>}
            {o.canMakeNow == null && <span className="badge" data-testid="snack-status">Dispensa non verificata</span>}
            <span className="badge">{o.ambient === 'ok' ? 'Fuori frigo: ok' : 'Da tenere al freddo'}</span>
            <span className="badge">{o.recipe.activeMin ?? '?'} min</span>
          </div>
          <NutrientLine n={strictTotals(recipeTotals(o.recipe, fMap, 1 / o.recipe.servings).sum)} /> <span className="small muted">a porzione</span>
          <p className="small mb0"><strong>Perché te lo propongo</strong></p>
          <ul className="small" data-testid="snack-reasons">{o.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
          {o.missing.length > 0 && (
            <>
              <ul className="small" data-testid="snack-missing">{o.missing.map((m) => <li key={m.foodId}>{name(m.foodId)}: {fmtNum(Math.ceil(m.qty), 0)} {m.unit}</li>)}</ul>
              <button className="btn sm" onClick={addMissing}>Aggiungi il mancante alla spesa</button>
            </>
          )}
          <div className="row wrap mt">
            {res.options.length > 1 && <button className="btn sm" onClick={() => setIdx(idx + 1)}>Cambia proposta</button>}
            <button className="btn sm primary" onClick={() => go(`cibo/ricetta/${o.recipe.id}`)}>Apri ricetta</button>
            <button className="btn sm ghost" onClick={async () => { await kvSet('recipeFeedback', { ...fb, [o.recipe.id]: { ...fb[o.recipe.id], never: true } }); setIdx(0); toast({ text: 'Non te la riproporrò (puoi riattivarla dalla ricetta)' }); }}>Non propormelo più</button>
          </div>
          {res.options.length > 1 && (
            <details className="mt">
              <summary className="small">Tutte le alternative ({res.options.length})</summary>
              <ul className="small">{res.options.map((x, k) => <li key={x.recipe.id}><button className="linklike" onClick={() => setIdx(k)}>{x.recipe.name}</button> — {x.canMakeNow === true ? 'pronta con la dispensa' : x.canMakeNow === false ? `mancano ${x.missing.length}` : 'non verificata'}</li>)}</ul>
            </details>
          )}
        </div>
      )}
      {res.needsCold.length > 0 && (
        <div className="small muted mt" data-testid="snack-needs-cold">
          {res.needsCold.length} altre richiedono il freddo ({res.needsCold.slice(0, 3).map((r) => r.name).join(', ')}{res.needsCold.length > 3 ? '…' : ''}).{' '}
          {settings.profile.coolerBag == null && settings.profile.fridgeAway == null
            ? <>Dimmi se fuori casa hai un frigo o la borsa termica: <button className="linklike" onClick={() => patchSettings({ profile: { ...settings.profile, coolerBag: 'si' } })}>uso la borsa termica</button> · <button className="linklike" onClick={() => go('altro/impostazioni')}>altre impostazioni</button></>
            : <>Le hai escluse perché hai indicato niente frigo e niente borsa termica.</>}
        </div>
      )}
      {res.excludedCount > 0 && <p className="small muted">{res.excludedCount} escluse per le tue esclusioni o allergie.</p>}
      {!tracked && <p className="small muted">La dispensa non è attiva: non posso dirti cosa manca. Attivala da Dispensa.</p>}
    </section>
  );
}
