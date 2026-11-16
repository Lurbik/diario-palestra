// Coach allenamento: proposte con motivo, dati usati, portata; ogni modifica è annullabile e annotata.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, kvGet, kvSet } from '../db/db';
import type { Program } from '../db/types';
import { useSettings, useToast } from '../ui/kit';
import { coachProposals, applyToProgram, sessionContext, SCOPE_LABEL, type CoachAction, type CoachProposal } from '../lib/coach';
import { rankTemplates } from '../catalog/templates';
import { activateTemplate } from './Onboarding';
import { configKey, exposuresFor } from '../lib/workout';
import { detectStall } from '../lib/stall';
import { addDays, dateKey, formatDateIt } from '../lib/dates';
import { uid } from '../lib/id';

export function CoachCard({ program }: { program: Program }) {
  const settings = useSettings();
  const toast = useToast();
  const today = dateKey();
  const sessions = useLiveQuery(() => db.sessions.where('dateKey').above(addDays(today, -70)).filter((s) => s.status === 'done').toArray(), [today]) ?? [];
  const dismissed = useLiveQuery(() => db.kv.where('key').startsWith('coachKeep:').toArray(), []) ?? [];
  const log = useLiveQuery(() => db.decisions.filter((d) => d.scope === 'program').reverse().sortBy('at'), []) ?? [];
  const [props, setProps] = useState<CoachProposal[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const ids = sessions.map((s) => s.id);
      const sets = ids.length ? await db.sets.where('sessionId').anyOf(ids).toArray() : [];
      const ctx = sessionContext(await db.sessions.toArray(), await db.sleep.toArray());
      const exIds = [...new Set(program.days.flatMap((d) => d.items.map((i) => i.exerciseId)))];
      const stalls: { exerciseName: string; exerciseId: string }[] = [];
      for (const id of exIds) {
        const ex = await db.exercises.get(id);
        if (!ex) continue;
        if (detectStall(await exposuresFor(configKey(ex)), { context: ctx }).status === 'possible_stall') stalls.push({ exerciseName: ex.name, exerciseId: ex.id });
      }
      const p = settings.profile;
      const templates = rankTemplates({ days: p.trainingDaysPerWeek, equipment: p.equipment, experience: p.experience, minutes: p.sessionMinutes });
      const res = coachProposals({ program, sessions, sets, today, declaredDays: p.trainingDaysPerWeek, templates, stalls });
      if (alive) setProps(res);
    })();
    return () => { alive = false; };
  }, [program, sessions.length, settings, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const hidden = new Set(dismissed.filter((d) => (d.value as string) >= today).map((d) => d.key.slice('coachKeep:'.length)));
  const visible = (props ?? []).filter((x) => !hidden.has(x.id));

  const act = async (pr: CoachProposal, a: CoachAction) => {
    if (a.kind === 'open') { location.hash = a.href; return; }
    const decId = uid();
    if (a.kind === 'keep') {
      await kvSet(`coachKeep:${pr.id}`, addDays(today, 28));
      await db.decisions.add({ id: decId, at: Date.now(), scope: 'program', refId: program.id, ruleId: pr.id, decision: 'kept', detail: `${pr.title} → mantieni. Motivo: ${pr.observation}`, reviewAfter: addDays(today, 28) });
      toast({ text: 'Mantenuta: la proposta torna tra 4 settimane solo se i dati la confermano' });
      return;
    }
    if (a.kind === 'change_model') {
      const created = await activateTemplate(a.templateId);
      if (!created) return;
      await kvSet(`coachUndo:${decId}`, { kind: 'model', previous: program.id, created: created.id });
      await db.decisions.add({ id: decId, at: Date.now(), scope: 'program', refId: created.id, ruleId: pr.id, decision: 'accepted', detail: `Scheda: "${program.name}" → "${created.name}". Motivo: ${pr.observation}`, reviewAfter: addDays(today, 21) });
      toast({ text: `Attivata "${created.name}". La scheda precedente resta salvata.`, actions: [{ label: 'Annulla', onClick: () => undo(decId) }] });
      return;
    }
    const { program: next, change } = applyToProgram(program, a);
    await kvSet(`coachUndo:${decId}`, { kind: 'edit', previous: program });
    await db.programs.put(next);
    await db.decisions.add({ id: decId, at: Date.now(), scope: 'program', refId: program.id, ruleId: pr.id, decision: 'accepted', detail: `${change} (versione ${program.revision ?? 1} → ${next.revision}). Motivo: ${pr.observation}`, reviewAfter: addDays(today, 21) });
    toast({ text: 'Modifica applicata dalla prossima seduta', actions: [{ label: 'Annulla', onClick: () => undo(decId) }] });
  };
  const undo = async (decId: string) => {
    const u = await kvGet<{ kind: 'edit'; previous: Program } | { kind: 'model'; previous: string; created: string } | null>(`coachUndo:${decId}`, null);
    if (!u) return;
    await db.transaction('rw', db.programs, db.decisions, db.kv, async () => {
      if (u.kind === 'edit') await db.programs.put(u.previous);
      else { await db.programs.update(u.created, { isActive: false, archived: true }); await db.programs.update(u.previous, { isActive: true }); }
      await db.decisions.update(decId, { decision: 'modified', detail: ((await db.decisions.get(decId))?.detail ?? '') + ' — ANNULLATA' });
      await db.kv.delete(`coachUndo:${decId}`);
    });
    toast({ text: 'Modifica annullata: scheda ripristinata' });
  };

  if (!props) return null;
  return (
    <section className="card" data-testid="coach">
      <h3 className="mt0">Coach</h3>
      {visible.map((pr) => (
        <div key={pr.id} className="coach-item" data-testid={`coach-${pr.id}`}>
          <div className="row between"><strong>{pr.title}</strong><span className="badge">{SCOPE_LABEL[pr.scope]}</span></div>
          <p className="small">{pr.observation}</p>
          <p className="small muted mb0">Dati usati: {pr.dataUsed.join(', ')}.{pr.missing.length ? ` Manca: ${pr.missing.join('; ')}.` : ''}</p>
          {pr.note && <p className="small muted">{pr.note}</p>}
          <div className="row wrap mt">{pr.actions.map((x) => <button key={x.label} className={`btn sm${x.primary ? ' primary' : ''}`} onClick={() => act(pr, x.action)}>{x.label}</button>)}</div>
        </div>
      ))}
      {!visible.length && <p className="small muted">Nessuna proposta aperta: le hai già valutate. Tornano solo se i dati le confermano.</p>}
      {log.length > 0 && (
        <details className="mt">
          <summary className="small">Diario delle modifiche ({log.length})</summary>
          <ul className="small" data-testid="coach-log">{log.slice(0, 12).map((d) => (
            <li key={d.id}>{formatDateIt(dateKey(d.at))}: {d.detail}{d.decision === 'accepted' && <> <UndoButton id={d.id} onUndo={undo} /></>}</li>
          ))}</ul>
        </details>
      )}
    </section>
  );
}

function UndoButton({ id, onUndo }: { id: string; onUndo: (id: string) => void }) {
  const has = useLiveQuery(() => db.kv.get(`coachUndo:${id}`), [id]);
  return has ? <button className="linklike" onClick={() => onUndo(id)}>Annulla</button> : null;
}
