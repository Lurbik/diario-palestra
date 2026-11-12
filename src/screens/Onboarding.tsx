import { useState } from 'react';
import { db } from '../db/db';
import { patchSettings } from '../db/bootstrap';
import { PREFILL_ENABLED, PERSONAL_PAIN, type Answer, type Settings } from '../db/settings';
import { Chip, Field, NumInput, Sheet, useToast } from '../ui/kit';
import { uid } from '../lib/id';
import { dateKey } from '../lib/dates';

/**
 * Onboarding breve e NON bloccante. I dati del documento sono precompilati;
 * entrano nel diario reale (peso, episodio di dolore) solo dopo conferma esplicita.
 */
export function OnboardingSheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(settings.prefillConfirmed ? 2 : 1);
  const p = settings.profile;
  const [addWeight, setAddWeight] = useState(true);
  const [addPain, setAddPain] = useState(true);
  const [yogurt, setYogurt] = useState<Answer>(p.yogurt);
  const [pesto, setPesto] = useState<Answer>(p.pestoOwnTolerated);
  const [bag, setBag] = useState<Answer>(p.coolerBag);
  const [allergies, setAllergies] = useState(p.allergies.join(', '));
  const [steps, setSteps] = useState<number | null>(p.stepsMeasured);
  const [android, setAndroid] = useState(p.androidModel);
  const [protein, setProtein] = useState<number | null>(settings.proteinTargetG);

  const confirmPrefill = async () => {
    if (addWeight && p.declaredWeightKg != null && p.declaredWeightDate) {
      const exists = await db.weights.where('dateKey').equals(p.declaredWeightDate).count();
      if (!exists) await db.weights.add({ id: uid(), dateKey: p.declaredWeightDate, time: '', kg: p.declaredWeightKg, morning: null, conditions: 'non standardizzate', flags: [], note: p.declaredWeightNote });
    }
    if (PREFILL_ENABLED && PERSONAL_PAIN && addPain && !(await db.pain.where('status').equals('active').count())) {
      await db.pain.add({
        id: uid(), area: PERSONAL_PAIN.area, selfDescription: PERSONAL_PAIN.selfDescription, startDate: null,
        symptoms: PERSONAL_PAIN.symptoms, intensity: null, limitsActivities: null, worsening: null,
        redFlags: { perineal: false, bladderBowel: false, legWeakness: false }, professionalNotes: '', status: 'active', resume: null, createdAt: Date.now(), log: []
      });
    }
    await patchSettings({ prefillConfirmed: true, observationStart: settings.observationStart ?? dateKey() });
    toast({ text: 'Dati confermati e inseriti ✓' });
    setStep(2);
  };

  const saveAnswers = async () => {
    const excluded = new Set(settings.excludedTags);
    await patchSettings({
      onboardingDone: true,
      proteinTargetG: protein,
      excludedTags: [...excluded],
      profile: { ...p, yogurt, pestoOwnTolerated: pesto, coolerBag: bag, allergies: allergies.split(',').map((s) => s.trim()).filter(Boolean), stepsMeasured: steps, androidModel: android }
    });
    if (yogurt === 'si' && !(await db.foods.where('name').startsWithIgnoreCase('yogurt').count())) {
      await db.foods.add({
        id: uid(), name: 'Yogurt (inserisci i valori dall\'etichetta)', brand: '', source: 'label', sourceNote: 'Aggiunto perché hai indicato di volerlo. Valori da etichetta.', sourceDate: null, verified: false,
        state: 'as_sold', basis: '100g', per100: { kcal: null, protein: null, carbs: null, fat: null, fiber: null }, densityGPerMl: null, gramsPerPiece: null, defaultPortion: 125,
        defaultUnit: 'g', barcode: '', tags: ['latte'], shelfStable: 'no', seed: false, favorite: false
      });
    }
    toast({ text: 'Preferenze salvate ✓' });
    onClose();
  };

  const Ans = ({ v, set }: { v: Answer; set: (a: Answer) => void }) => (
    <div className="chips"><Chip on={v === 'si'} onClick={() => set('si')}>Sì</Chip><Chip on={v === 'no'} onClick={() => set('no')}>No</Chip><Chip on={v === null} onClick={() => set(null)}>Dopo</Chip></div>
  );

  return (
    <Sheet title={step === 1 ? 'Conferma i dati iniziali' : 'Poche domande'} onClose={onClose}>
      {step === 1 ? (
        <div className="col">
          <p className="small muted">Dati che mi hai comunicato. Puoi usare il diario anche senza confermarli.</p>
          <dl className="kv small">
            <dt>Profilo</dt><dd>{p.name}, {p.age} anni, {p.heightCm} cm</dd>
            <dt>Peso</dt><dd>{p.declaredWeightKg} kg — {p.declaredWeightNote}</dd>
            <dt>Routine</dt><dd>{p.trainingDaysPerWeek} allenamenti/settimana, {p.workHours}; {p.study}; sonno {p.sleepAvgDeclared}</dd>
            <dt>Obiettivo</dt><dd>{p.goal}</dd>
            <dt>Gradisce</dt><dd>{p.likes.join('; ')}</dd>
            <dt>Esclusioni</dt><dd>{p.dislikes.join('; ')}</dd>
            {PERSONAL_PAIN && <><dt>Situazione</dt><dd>{PERSONAL_PAIN.summary}</dd></>}
          </dl>
          {p.declaredWeightKg != null && <label className="check"><input type="checkbox" checked={addWeight} onChange={(e) => setAddWeight(e.target.checked)} /><span>Inserisci la pesata di {p.declaredWeightKg} kg del {p.declaredWeightDate} nel diario del peso (marcata come non standardizzata)</span></label>}
          {PERSONAL_PAIN && <label className="check"><input type="checkbox" checked={addPain} onChange={(e) => setAddPain(e.target.checked)} /><span>Attiva la modalità pausa per dolore — {PERSONAL_PAIN.area} (senza data d'esordio, causa o tempi di guarigione inventati)</span></label>}
          <p className="small muted">Nessun target calorico viene importato automaticamente. La scheda resta un modello, senza sedute o record.</p>
          <button className="btn primary block" onClick={confirmPrefill}>Conferma e inserisci</button>
          <button className="btn block" onClick={onClose}>Più tardi</button>
        </div>
      ) : (
        <div className="col">
          <p className="small muted">Solo ciò che manca. Puoi saltare tutto e rispondere dopo da Altro → Impostazioni.</p>
          <div><strong>Vuoi lo yogurt tra gli alimenti?</strong><Ans v={yogurt} set={setYogurt} /></div>
          <div><strong>Il pesto che usi abitualmente ti va bene?</strong><p className="small muted">Il pesto classico contiene spesso formaggi: resta escluso dai suggerimenti finché non lo confermi per il tuo prodotto.</p><Ans v={pesto} set={setPesto} /></div>
          <div><strong>Hai già una borsa termica con elementi refrigeranti?</strong><Ans v={bag} set={setBag} /></div>
          <Field label="Allergie (distinte dalle preferenze)" hint="Separate da virgola; vuoto = nessuna dichiarata"><input value={allergies} onChange={(e) => setAllergies(e.target.value)} /></Field>
          <NumInput label="Passi giornalieri misurati (se disponibili)" value={steps} onChange={setSteps} decimals={false} />
          <Field label="Modello/versione Android" hint="Solo per eventuali compatibilità tecniche"><input value={android} onChange={(e) => setAndroid(e.target.value)} /></Field>
          <NumInput label="Target proteico (g/die), se vuoi impostarlo" hint={p.declaredWeightKg ? `Riferimento informativo a ${p.declaredWeightKg} kg: 1,6–2,2 g/kg ≈ ${Math.round(p.declaredWeightKg * 1.6)}–${Math.round(p.declaredWeightKg * 2.2)} g. Il target lo scegli tu.` : "Riferimento informativo: 1,6–2,2 g per kg di peso corporeo. Il target lo scegli tu."} value={protein} onChange={setProtein} decimals={false} />
          <p className="small muted">Andamento del peso, incrementi delle macchine e quantità degli alimenti si raccolgono usando l'app: nessuna stima viene inventata.</p>
          <button className="btn primary block" onClick={saveAnswers}>Salva</button>
        </div>
      )}
    </Sheet>
  );
}
