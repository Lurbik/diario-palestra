import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { defaultSettings, type Settings } from '../db/settings';
import { parseNum, fmtNum } from '../lib/id';

// ---------- Icone (SVG inline: disponibili offline) ----------
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Icon = {
  today: () => <svg viewBox="0 0 24 24" {...P} aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  gym: () => <svg viewBox="0 0 24 24" {...P} aria-hidden><path d="M6 7v10M18 7v10M3 9.5v5M21 9.5v5M6 12h12" /></svg>,
  food: () => <svg viewBox="0 0 24 24" {...P} aria-hidden><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v6M3 3v6a4 4 0 0 0 4 4M17 21V3c2.5 1 4 3.5 4 7s-1.5 4-4 4" /></svg>,
  progress: () => <svg viewBox="0 0 24 24" {...P} aria-hidden><path d="M3 20h18M5 16l4-5 4 3 6-8" /></svg>,
  more: () => <svg viewBox="0 0 24 24" {...P} aria-hidden><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>,
  close: () => <svg viewBox="0 0 24 24" {...P} width="22" height="22" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>,
  check: () => <svg viewBox="0 0 24 24" {...P} width="20" height="20" aria-hidden><path d="M5 12l5 5 9-10" /></svg>,
  up: () => <svg viewBox="0 0 24 24" {...P} width="20" height="20" aria-hidden><path d="M6 15l6-6 6 6" /></svg>,
  down: () => <svg viewBox="0 0 24 24" {...P} width="20" height="20" aria-hidden><path d="M6 9l6 6 6-6" /></svg>,
  left: () => <svg viewBox="0 0 24 24" {...P} width="22" height="22" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>,
  right: () => <svg viewBox="0 0 24 24" {...P} width="22" height="22" aria-hidden><path d="M9 6l6 6-6 6" /></svg>,
  pause: () => <svg viewBox="0 0 24 24" {...P} width="22" height="22" aria-hidden><path d="M9 5v14M15 5v14" /></svg>,
  play: () => <svg viewBox="0 0 24 24" {...P} width="22" height="22" aria-hidden><path d="M7 5l12 7-12 7z" /></svg>,
  alert: () => <svg viewBox="0 0 24 24" {...P} width="20" height="20" aria-hidden><path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01" /></svg>,
  plus: () => <svg viewBox="0 0 24 24" {...P} width="20" height="20" aria-hidden><path d="M12 5v14M5 12h14" /></svg>,
  edit: () => <svg viewBox="0 0 24 24" {...P} width="20" height="20" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>,
  trash: () => <svg viewBox="0 0 24 24" {...P} width="20" height="20" aria-hidden><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>,
  lock: () => <svg viewBox="0 0 24 24" {...P} width="18" height="18" aria-hidden><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
};

// ---------- Routing (hash) ----------
export function useRoute(): [string[], (path: string) => void] {
  const get = () => (location.hash.replace(/^#\/?/, '') || 'oggi').split('/');
  const [r, setR] = useState(get);
  useEffect(() => {
    const on = () => { setR(get()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [r, (p) => { location.hash = '#/' + p; }];
}
export const go = (p: string) => { location.hash = '#/' + p; };

// ---------- Impostazioni ----------
export function useSettings(): Settings {
  const row = useLiveQuery(() => db.kv.get('settings'), []);
  return { ...defaultSettings(), ...((row?.value as Partial<Settings>) ?? {}) };
}

/** Orologio per la sola visualizzazione: i valori sono sempre calcolati dai timestamp. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const vis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [intervalMs]);
  return now;
}

// ---------- Toast ----------
interface ToastMsg { id: number; text: string; kind?: 'error' | 'info'; actions?: { label: string; onClick: () => void }[]; ms?: number }
const ToastCtx = createContext<(t: Omit<ToastMsg, 'id'>) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: Omit<ToastMsg, 'id'>) => {
    window.clearTimeout(timer.current);
    const msg = { ...m, id: Date.now() };
    setT(msg);
    timer.current = window.setTimeout(() => setT((cur) => (cur?.id === msg.id ? null : cur)), m.ms ?? (m.kind === 'error' ? 9000 : 6000));
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div className={`toast ${t.kind === 'error' ? 'error' : ''}`} role={t.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
          <div className="grow">{t.text}</div>
          {t.actions?.map((a) => <button key={a.label} className="btn sm" onClick={() => { setT(null); a.onClick(); }}>{a.label}</button>)}
          <button className="btn sm" aria-label="Chiudi" onClick={() => setT(null)}><Icon.close /></button>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Sheet (pannello modale) ----------
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head"><h2>{title}</h2><button className="iconbtn" aria-label="Chiudi" onClick={onClose}><Icon.close /></button></div>
        {children}
      </div>
    </div>
  );
}

// ---------- Input numerici (tastierino, virgola italiana) ----------
export function NumInput({ value, onChange, placeholder, label, hint, decimals = true, id }: {
  value: number | null; onChange: (v: number | null) => void; placeholder?: string; label?: string; hint?: string; decimals?: boolean; id?: string;
}) {
  const [text, setText] = useState(value == null ? '' : fmtRaw(value));
  const last = useRef(value);
  useEffect(() => { if (value !== last.current) { setText(value == null ? '' : fmtRaw(value)); last.current = value; } }, [value]);
  const input = (
    <input id={id} type="text" inputMode={decimals ? 'decimal' : 'numeric'} pattern={decimals ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'} placeholder={placeholder}
      value={text} onChange={(e) => { setText(e.target.value); const v = parseNum(e.target.value); last.current = v; onChange(v); }} />
  );
  if (!label) return input;
  return <label className="field">{label}{hint && <span className="hint">{hint}</span>}{input}</label>;
}
function fmtRaw(n: number) { return String(Math.round(n * 1000) / 1000).replace('.', ','); }

export function Stepper({ label, value, onChange, step = 1, min = 0, decimals = false, extra, startAt }: {
  label: ReactNode; value: number | null; onChange: (v: number | null) => void; step?: number; min?: number; decimals?: boolean; extra?: ReactNode; startAt?: number | null;
}) {
  const bump = (d: number) => {
    if (value == null) { onChange(startAt ?? (d > 0 ? step : min)); return; }
    const v = Math.max(min, Math.round((value + d) * 1000) / 1000);
    onChange(v);
  };
  return (
    <div>
      <div className="stepper-label"><span>{label}</span>{extra}</div>
      <div className="stepper">
        <button type="button" aria-label={`Diminuisci di ${fmtNum(step, 2)}`} onClick={() => bump(-step)}>−</button>
        <NumInput value={value} onChange={onChange} decimals={decimals} placeholder="—" />
        <button type="button" aria-label={`Aumenta di ${fmtNum(step, 2)}`} onClick={() => bump(step)}>+</button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

export function Chip({ on, onClick, children, danger, label }: { on: boolean; onClick: () => void; children: ReactNode; danger?: boolean; label?: string }) {
  return <button type="button" className={`chip ${danger ? 'danger' : ''}`} aria-pressed={on} aria-label={label} onClick={onClick}>{children}</button>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field">{label}{hint && <span className="hint">{hint}</span>}{children}</label>;
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return <label className="check"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{children}</span></label>;
}

export function NotImplemented({ what }: { what: string }) {
  return <p className="small muted">Non ancora implementato in questa versione: {what}.</p>;
}

/** Grafico a linee minimale in SVG, testo leggibile (≥13px), nessuna dipendenza. */
export function LineChart({ series, height = 200, yLabel }: {
  series: { name: string; points: { x: string; y: number }[]; dashed?: boolean; dots?: boolean }[]; height?: number; yLabel?: string;
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return <p className="muted small">Servono almeno due punti per il grafico.</p>;
  const xs = [...new Set(all.map((p) => p.x))].sort();
  const ys = all.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const W = 600, H = height, L = 46, R = 10, T = 12, B = 30;
  const x = (k: string) => L + (xs.indexOf(k) / Math.max(1, xs.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Grafico ${series.map((s) => s.name).join(', ')}`}>
      {ticks.map((t, i) => <g key={i}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" /><text x={4} y={y(t) + 4}>{fmtNum(t, 1)}</text></g>)}
      <text x={L} y={H - 8}>{xs[0].slice(5).split('-').reverse().join('/')}</text>
      <text x={W - R} y={H - 8} textAnchor="end">{xs[xs.length - 1].slice(5).split('-').reverse().join('/')}</text>
      {yLabel && <text x={W - R} y={T + 4} textAnchor="end">{yLabel}</text>}
      {series.map((s, si) => (
        <g key={si}>
          <polyline fill="none" stroke={si === 0 ? 'var(--muted)' : 'var(--accent)'} strokeWidth={si === 0 ? 1.5 : 3} strokeDasharray={s.dashed ? '6 5' : undefined}
            points={s.points.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')} />
          {s.dots && s.points.map((p, i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r={3.5} fill={si === 0 ? 'var(--muted)' : 'var(--accent)'} />)}
        </g>
      ))}
    </svg>
  );
}
