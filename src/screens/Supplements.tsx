// Integratori: consigli spiegati a partire dai dati del diario. Non è un consiglio medico.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import { Chip, useSettings, useToast } from '../ui/kit';
import { patchSettings } from '../db/bootstrap';
import { supplementAdvice, type SupplementAdvice, type SupplementStatus } from '../lib/supplements';
import { buildSupplementContext } from '../lib/supplementContext';
import { SUPPLEMENT_GENERAL_SOURCES } from '../catalog/supplements';
import { addDays, dateKey, formatDateIt } from '../lib/dates';
import { NumInput } from '../ui/kit';
import { upsertDose, type Dose } from '../lib/supplementLog';

const STATUS: Record<SupplementStatus, { label: string; cls: string }> = {
  consider: { label: 'Da considerare', cls: 'ok' }, need_info: { label: 'Mi serve un dato', cls: '' }, ask_doctor: { label: 'Prima il medico', cls: 'warn' },
  food_first: { label: 'Prima il cibo', cls: '' }, test_first: { label: 'Prima un esame', cls: '' }, not_needed: { label: 'Non serve ora', cls: '' }, not_recommended: { label: 'Sconsigliato', cls: 'warn' }
};
const GRADE: Record<string, string> = { forte: 'prove forti', moderata: 'prove moderate', debole: 'prove deboli', insufficiente: 'prove insufficienti' };
type LogItem = { id: string; start: string; end?: string | null };

export function SupplementsScreen() {
  const settings = useSettings();
  const toast = useToast();
  const logRow = useLiveQuery(() => db.kv.get('supplementLog'), []);
  const log = (logRow?.value as LogItem[] | undefined) ?? [];
  const [advice, setAdvice] = useState<SupplementAdvice[] | null>(null);
  const dosesRow = useLiveQuery(() => db.kv.get('supplementDoses'), []);
  const doses = (dosesRow?.value as Dose[] | undefined) ?? [];
  useEffect(() => { let alive = true; buildSupplementContext(settings).then((c) => { if (alive) setAdvice(supplementAdvice(c)); }); return () => { alive = false; }; }, [settings, logRow]);
  const p = settings.profile;
  const h = p.health ?? {};
  const setHealth = (k: keyof NonNullable<typeof p.health>) => patchSettings({ profile: { ...p, health: { ...h, [k]: !h[k] } } });
  const active = (id: string) => log.find((l) => l.id === id && !l.end);
  const toggleUse = async (id: string) => {
    const a = active(id);
    // interrompere chiude il periodo; riprendere apre un periodo nuovo (lo storico dei periodi resta)
    const next = a ? log.map((l) => (l === a ? { ...l, end: dateKey() } : l)) : [...log, { id, start: dateKey(), end: null }];
    await kvSet('supplementLog', next);
    toast({ text: a ? 'Segnato come interrotto (le prese passate restano)' : id === 'creatina' ? 'Segnato da oggi. Regola di prodotto: per 4 settimane niente proposte sulle calorie basate sul peso' : 'Segnato da oggi' });
  };
  return (
    <>
      <h1>Integratori</h1>
      <div className="banner info small">Informazioni generali basate su posizioni ufficiali e meta-analisi, applicate ai dati che registri. Non sostituiscono medico o farmacista; le risposte individuali variano.</div>
      <section className="card">
        <strong className="small">Alimentazione</strong>
        <div className="chips">
          {(['onnivora', 'vegetariana', 'vegana'] as const).map((d) => <Chip key={d} on={p.diet === d} onClick={() => patchSettings({ profile: { ...p, diet: p.diet === d ? null : d } })}>{d[0].toUpperCase() + d.slice(1)}</Chip>)}
        </div>
        <strong className="small">Domande di sicurezza (restano sul dispositivo)</strong>
        <div className="chips">
          <Chip on={!!h.kidney} onClick={() => setHealth('kidney')}>Problemi ai reni</Chip>
          <Chip on={!!h.heart} onClick={() => setHealth('heart')}>Cuore o pressione</Chip>
          <Chip on={!!h.meds} onClick={() => setHealth('meds')}>Prendo farmaci</Chip>
          <Chip on={!!h.pregnant} onClick={() => setHealth('pregnant')}>Gravidanza o allattamento</Chip>
          <Chip on={!!h.under18} onClick={() => setHealth('under18')}>Ho meno di 18 anni</Chip>
          <Chip on={!!h.tested} onClick={() => setHealth('tested')}>Controlli antidoping</Chip>
        </div>
      </section>
      {!advice && <p className="muted">Calcolo…</p>}
      {advice?.map((a) => (
        <details key={a.info.id} className="card" data-testid={`supp-${a.info.id}`} open={a.status === 'consider' || a.inUse || a.status === 'ask_doctor' || a.status === 'need_info'}>
          <summary><strong>{a.info.name}</strong> <span className={`badge ${STATUS[a.status].cls}`} data-testid="supp-status">{STATUS[a.status].label}</span>{a.inUse && <span className="badge ok" data-testid="supp-inuse"> Lo usi</span>} <span className="small muted">· {GRADE[a.info.evidence]}</span></summary>
          {a.caution && <div className="banner warn small" data-testid="supp-caution">{a.caution}</div>}
          <p className="small"><strong>{a.title}.</strong> {a.info.purpose}</p>
          <p className="small mb0"><strong>Perché, con i tuoi dati</strong></p>
          <ul className="small" data-testid="supp-reasons">{a.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          {a.missing.length > 0 && <p className="small muted">Per un consiglio più preciso servono: {a.missing.join('; ')}.</p>}
          <p className="small"><strong>Cosa dicono le prove:</strong> {a.info.evidenceNote}</p>
          {a.info.dose && !a.caution && a.status !== 'not_recommended' && <p className="small"><strong>Riferimento generale per adulti sani:</strong> {a.info.dose}{a.info.id === 'creatina' ? ' Esempio semplice: 3 g al giorno, anche nei giorni di riposo. Conta i grammi di monoidrato, non i misurini: la capacità di un misurino non è nota se l\'etichetta non la indica. Segui l\'etichetta e le indicazioni personali ricevute.' : ''}</p>}
          {a.info.dose && a.caution && <p className="small muted">Con le condizioni che hai indicato l'app non mostra riferimenti di dose: parlane con medico o farmacista.</p>}
          {a.info.cautions.length > 0 && <><p className="small mb0"><strong>Parlane prima con medico o farmacista se:</strong></p><ul className="small">{a.info.cautions.map((c) => <li key={c}>{c}</li>)}</ul></>}
          {a.info.sideEffects.length > 0 && <p className="small muted">Effetti indesiderati possibili: {a.info.sideEffects.join(' ')}</p>}
          <p className="small muted">Fonti: {a.info.sources.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></span>)}</p>
          {a.status !== 'not_recommended' && (
            <button className="btn sm" onClick={() => toggleUse(a.info.id)}>{active(a.info.id) ? `Lo uso dal ${formatDateIt(active(a.info.id)!.start)} · interrompi` : log.some((l) => l.id === a.info.id) ? 'Riprendo da oggi' : 'Lo sto usando da oggi'}</button>
          )}
          {(a.inUse || doses.some((d) => d.supp === a.info.id)) && <DoseLog supp={a.info.id} doses={doses.filter((d) => d.supp === a.info.id)} unit={a.info.id === 'creatina' || a.info.id === 'proteine_polvere' ? 'g' : a.info.id === 'caffeina' ? 'mg' : ''} />}
        </details>
      ))}
      <p className="small muted">Regole generali: prima alimentazione, sonno e allenamento costante; un integratore alla volta, provato in allenamento; prodotti con certificazione di lotto se fai sport con controlli. Fonti generali: {SUPPLEMENT_GENERAL_SOURCES.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></span>)}</p>
    </>
  );
}

/** Diario delle prese: data reale (anche passata), quantità, presa/saltata. Un giorno senza voce resta "non registrato". */
function DoseLog({ supp, doses, unit }: { supp: string; doses: Dose[]; unit: string }) {
  const toast = useToast();
  const [day, setDay] = useState(dateKey());
  const last = [...doses].filter((d) => d.status === 'taken' && d.qty != null).sort((a, b) => b.day.localeCompare(a.day))[0];
  const [qty, setQty] = useState<number | null>(last?.qty ?? null);
  const save = async (status: Dose['status']) => {
    await upsertDose({ supp, day, status, qty: status === 'taken' ? qty : null, unit });
    toast({ text: status === 'taken' ? `Presa segnata per il ${formatDateIt(day)}` : `Segnata come saltata il ${formatDateIt(day)}` });
  };
  const today = dateKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i));
  return (
    <div className="mt" data-testid={`dose-${supp}`}>
      <strong className="small">Diario delle prese</strong>
      <div className="grid2">
        <label className="small">Giorno<input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value || today)} /></label>
        {unit ? <NumInput label={`Quantità (${unit})`} value={qty} onChange={setQty} /> : <span />}
      </div>
      <div className="row wrap mt">
        <button className="btn sm primary" onClick={() => save('taken')}>Presa</button>
        <button className="btn sm" onClick={() => save('skipped')}>Saltata</button>
      </div>
      <p className="small muted mb0">Una presa saltata non va recuperata con una dose doppia: l'app non aumenta nulla da sola. Salvare due volte lo stesso giorno aggiorna la voce, non la duplica.</p>
      <div className="dose-strip" aria-label="Ultimi 14 giorni">
        {days.map((d) => { const x = doses.find((y) => y.day === d); return <span key={d} title={`${formatDateIt(d)}: ${x ? (x.status === 'taken' ? `presa${x.qty != null ? ' ' + x.qty + ' ' + x.unit : ''}` : 'saltata') : 'non registrata'}`} className={`dose ${x?.status ?? 'none'}`}>{x?.status === 'taken' ? '●' : x?.status === 'skipped' ? '○' : '·'}</span>; })}
      </div>
      <p className="small muted">● presa · ○ saltata · · non registrata (non vale "saltata")</p>
    </div>
  );
}
