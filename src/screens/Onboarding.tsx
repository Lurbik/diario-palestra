import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { patchSettings } from '../db/bootstrap';
import { GOAL_LABEL, type Answer, type EquipmentAccess, type Experience, type Goal, type Settings } from '../db/settings';
import type { Program } from '../db/types';
import { Chip, Field, Sheet, go, useToast } from '../ui/kit';
import { rankTemplates } from '../catalog/templates';
import { uid } from '../lib/id';
import { dateKey, WEEKDAYS } from '../lib/dates';

/** Copia un template in una scheda personale attiva (il template resta intatto). */
export async function activateTemplate(templateId: string): Promise<Program | null> {
  const t = await db.programs.get(templateId);
  if (!t) return null;
  const p: Program = {
    ...structuredClone(t), id: uid(), name: t.name, kind: 'custom', origin: 'user', catalogVersion: undefined, isActive: true, createdAt: Date.now(),
    notes: `Creata dal template "${t.name}". ${t.notes}`
  };
  p.days = p.days.map((d) => ({ ...d, id: uid(), items: d.items.map((i) => ({ ...i, id: uid() })) }));
  await db.transaction('rw', db.programs, async () => {
    for (const x of await db.programs.filter((x) => x.isActive).toArray()) await db.programs.update(x.id, { isActive: false });
    await db.programs.add(p);
  });
  return p;
}

const EXCLUSIONS: [string, string][] = [['formaggio', 'Formaggi'], ['latte', 'Latte e derivati'], ['glutine', 'Glutine'], ['uova', 'Uova'], ['pesce', 'Pesce'], ['crostacei', 'Crostacei'], ['arachidi', 'Arachidi'], ['frutta_a_guscio', 'Frutta a guscio'], ['soia', 'Soia'], ['legumi', 'Legumi']];

export function OnboardingSheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const toast = useToast();
  const p = settings.profile;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<Goal | null>(p.goal);
  const [exp, setExp] = useState<Experience | null>(p.experience);
  const [days, setDays] = useState<number | null>(p.trainingDaysPerWeek);
  const [minutes, setMinutes] = useState<number | null>(p.sessionMinutes);
  const [eq, setEq] = useState<EquipmentAccess | null>(p.equipment);
  const [allergies, setAllergies] = useState(p.allergies.join(', '));
  const [excl, setExcl] = useState<string[]>(settings.excludedTags);
  const [fridge, setFridge] = useState<Answer>(p.fridgeAway);
  const [bag, setBag] = useState<Answer>(p.coolerBag);
  const [cook, setCook] = useState<number | null>(p.defaultCookMin);
  const [preview, setPreview] = useState<string | null>(null);
  const tpl = useLiveQuery(async () => (preview ? db.programs.get(preview) : undefined), [preview]);
  const exNames = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e.name])), []) ?? new Map<string, string>();
  const ranked = rankTemplates({ days, equipment: eq, experience: exp, minutes });

  const save = async () => {
    await patchSettings({
      onboardingDone: true, excludedTags: excl, dailyTimeLimitMin: minutes ?? settings.dailyTimeLimitMin, observationStart: settings.observationStart ?? dateKey(),
      profile: { ...p, goal, experience: exp, trainingDaysPerWeek: days, sessionMinutes: minutes, equipment: eq, allergies: allergies.split(',').map((s) => s.trim()).filter(Boolean), fridgeAway: fridge, coolerBag: bag, defaultCookMin: cook }
    });
  };
  const Ans = ({ v, set }: { v: Answer; set: (a: Answer) => void }) => (
    <div className="chips"><Chip on={v === 'si'} onClick={() => set('si')}>Sì</Chip><Chip on={v === 'no'} onClick={() => set('no')}>No</Chip><Chip on={v === null} onClick={() => set(null)}>Non so</Chip></div>
  );

  return (
    <Sheet title={['Il tuo obiettivo', 'Cibo e vincoli', 'Scegli una scheda'][step - 1]} onClose={onClose}>
      <p className="small muted">Passo {step} di 3 · Puoi saltare: l'app funziona anche senza.</p>
      {step === 1 && (
        <div className="col">
          <div><strong>Obiettivo</strong><div className="chips">{(Object.keys(GOAL_LABEL) as Goal[]).map((g) => <Chip key={g} on={goal === g} onClick={() => setGoal(g)}>{GOAL_LABEL[g]}</Chip>)}</div></div>
          <div><strong>Esperienza con i pesi</strong><div className="chips">{(['principiante', 'intermedio', 'esperto'] as Experience[]).map((e) => <Chip key={e} on={exp === e} onClick={() => setExp(e)}>{e[0].toUpperCase() + e.slice(1)}</Chip>)}</div></div>
          <div><strong>Giorni a settimana</strong><div className="chips">{[2, 3, 4, 5, 6].map((d) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{d}</Chip>)}</div></div>
          <div><strong>Tempo per seduta</strong><div className="chips">{[30, 45, 60, 75, 90].map((m) => <Chip key={m} on={minutes === m} onClick={() => setMinutes(m)}>{m} min</Chip>)}</div></div>
          <div><strong>Dove ti alleni</strong><div className="chips">
            <Chip on={eq === 'palestra'} onClick={() => setEq('palestra')}>Palestra</Chip>
            <Chip on={eq === 'casa_manubri'} onClick={() => setEq('casa_manubri')}>Casa con manubri</Chip>
            <Chip on={eq === 'corpo_libero'} onClick={() => setEq('corpo_libero')}>Corpo libero</Chip>
          </div></div>
          <button className="btn primary block" onClick={() => setStep(2)}>Avanti</button>
        </div>
      )}
      {step === 2 && (
        <div className="col">
          <Field label="Allergie" hint="Separate da virgola. Distinte dalle preferenze: una ricetta senza informazioni sugli allergeni non viene proposta come sicura."><input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="nessuna" /></Field>
          <div><strong>Non propormi</strong><p className="small muted">Preferenze/esclusioni (non diagnosi)</p>
            <div className="chips">{EXCLUSIONS.map(([t, l]) => <Chip key={t} on={excl.includes(t)} onClick={() => setExcl(excl.includes(t) ? excl.filter((x) => x !== t) : [...excl, t])}>{l}</Chip>)}</div></div>
          <div><strong>Hai un frigo quando sei fuori casa (lavoro/studio)?</strong><Ans v={fridge} set={setFridge} /></div>
          <div><strong>Hai una borsa termica con elementi refrigeranti?</strong><Ans v={bag} set={setBag} /></div>
          <div><strong>Quanto tempo attivo in cucina di solito?</strong><p className="small muted">Lo chiedo una volta; nei giorni diversi c'è "oggi ho poco tempo".</p>
            <div className="chips">{[5, 15, 30].map((m) => <Chip key={m} on={cook === m} onClick={() => setCook(m)}>{m} min</Chip>)}</div></div>
          <div className="action-row"><button className="btn" onClick={() => setStep(1)}>Indietro</button><button className="btn primary" onClick={async () => { await save(); setStep(3); }}>Avanti</button></div>
        </div>
      )}
      {step === 3 && (
        <div className="col">
          <p className="small">Proposte compatibili con le tue scelte. Vedi l'anteprima prima di attivare: puoi modificarla quando vuoi.</p>
          {ranked.map((t) => (
            <div className={`card flat ${preview === t.id ? 'accent' : ''}`} key={t.id}>
              <strong>{t.name}</strong>
              <p className="seg-why">{t.reasons.join(' · ') || 'compatibile con l\'attrezzatura'}</p>
              <button className="btn sm" onClick={() => setPreview(preview === t.id ? null : t.id)}>{preview === t.id ? 'Chiudi anteprima' : 'Anteprima'}</button>
              {preview === t.id && tpl && (
                <div className="mt small">
                  {tpl.days.map((d) => <p key={d.id}><strong>{d.weekday ? WEEKDAYS[d.weekday] : ''} · {d.name}:</strong> {d.items.map((i) => `${exNames.get(i.exerciseId) ?? i.exerciseId} ${i.sets}×${i.repMin}–${i.repMax}`).join(', ')}</p>)}
                  <button className="btn primary block" onClick={async () => { await activateTemplate(t.id); toast({ text: 'Scheda attivata ✓ Puoi modificarla da Allenamento → Schede.' }); onClose(); go('allenamento'); }}>Attiva questa scheda</button>
                </div>
              )}
            </div>
          ))}
          <p className="small muted">Hai già una scheda tua salvata in un file? Importala da Altro → Backup (anteprima prima di confermare).</p>
          <button className="btn block" onClick={() => { toast({ text: 'Preferenze salvate. Puoi scegliere una scheda più tardi.' }); onClose(); }}>Più tardi</button>
        </div>
      )}
    </Sheet>
  );
}
