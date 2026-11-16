// Integratori: consigli spiegati a partire dai dati del diario. Non è un consiglio medico.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvSet } from '../db/db';
import { Chip, useSettings, useToast } from '../ui/kit';
import { patchSettings } from '../db/bootstrap';
import { supplementAdvice, type SupplementAdvice, type SupplementStatus } from '../lib/supplements';
import { buildSupplementContext } from '../lib/supplementContext';
import { SUPPLEMENT_GENERAL_SOURCES } from '../catalog/supplements';
import { dateKey, formatDateIt } from '../lib/dates';

const STATUS: Record<SupplementStatus, { label: string; cls: string }> = {
  in_use: { label: 'Lo stai usando', cls: 'ok' }, consider: { label: 'Da considerare', cls: 'ok' }, ask_doctor: { label: 'Prima il medico', cls: 'warn' },
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
  useEffect(() => { let alive = true; buildSupplementContext(settings).then((c) => { if (alive) setAdvice(supplementAdvice(c)); }); return () => { alive = false; }; }, [settings, logRow]);
  const p = settings.profile;
  const h = p.health ?? {};
  const setHealth = (k: keyof NonNullable<typeof p.health>) => patchSettings({ profile: { ...p, health: { ...h, [k]: !h[k] } } });
  const active = (id: string) => log.find((l) => l.id === id && !l.end);
  const toggleUse = async (id: string) => {
    const a = active(id);
    const next = a ? log.map((l) => (l === a ? { ...l, end: dateKey() } : l)) : [...log, { id, start: dateKey(), end: null }];
    await kvSet('supplementLog', next);
    toast({ text: a ? 'Segnato come sospeso' : id === 'creatina' ? 'Segnato da oggi: per 4 settimane le calorie non verranno ritoccate in base al peso' : 'Segnato da oggi' });
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
        <details key={a.info.id} className="card" data-testid={`supp-${a.info.id}`} open={a.status === 'consider' || a.status === 'in_use' || a.status === 'ask_doctor'}>
          <summary><strong>{a.info.name}</strong> <span className={`badge ${STATUS[a.status].cls}`} data-testid="supp-status">{STATUS[a.status].label}</span> <span className="small muted">· {GRADE[a.info.evidence]}</span></summary>
          <p className="small"><strong>{a.title}.</strong> {a.info.purpose}</p>
          <p className="small mb0"><strong>Perché, con i tuoi dati</strong></p>
          <ul className="small" data-testid="supp-reasons">{a.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          {a.missing.length > 0 && <p className="small muted">Per un consiglio più preciso servono: {a.missing.join('; ')}.</p>}
          <p className="small"><strong>Cosa dicono le prove:</strong> {a.info.evidenceNote}</p>
          {a.info.dose && a.status !== 'ask_doctor' && a.status !== 'not_recommended' && <p className="small"><strong>Riferimento generale per adulti sani:</strong> {a.info.dose}</p>}
          {a.info.cautions.length > 0 && <><p className="small mb0"><strong>Parlane prima con medico o farmacista se:</strong></p><ul className="small">{a.info.cautions.map((c) => <li key={c}>{c}</li>)}</ul></>}
          {a.info.sideEffects.length > 0 && <p className="small muted">Effetti indesiderati possibili: {a.info.sideEffects.join(' ')}</p>}
          <p className="small muted">Fonti: {a.info.sources.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></span>)}</p>
          {a.status !== 'not_recommended' && (
            <button className="btn sm" onClick={() => toggleUse(a.info.id)}>{active(a.info.id) ? `Lo uso dal ${formatDateIt(active(a.info.id)!.start)} · segna sospeso` : 'Lo sto usando da oggi'}</button>
          )}
        </details>
      ))}
      <p className="small muted">Regole generali: prima alimentazione, sonno e allenamento costante; un integratore alla volta, provato in allenamento; prodotti con certificazione di lotto se fai sport con controlli. Fonti generali: {SUPPLEMENT_GENERAL_SOURCES.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></span>)}</p>
    </>
  );
}
