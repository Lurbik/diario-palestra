import { useEffect, useState } from 'react';
import { exportAll, parseBackup, previewImport, applyImport, encryptText, decryptText, isEncrypted, csvSets, csvDiary, csvWeights, csvSleep, downloadText, type BackupFile, type ImportPreview } from '../lib/backup';
import { listSnapshots, type Snapshot } from '../db/migrate';
import { patchSettings } from '../db/bootstrap';
import { Chip, Field, Sheet, useSettings, useToast } from '../ui/kit';
import { requestPersistence, storageInfo } from '../lib/pwa';
import { dateKey } from '../lib/dates';
import { fmtNum } from '../lib/id';
import { APP_VERSION } from './More';

const TABLE_LABEL: Record<string, string> = {
  machines: 'Macchine', exercises: 'Esercizi', programs: 'Schede', sessions: 'Sedute', sets: 'Serie', pain: 'Dolore', foods: 'Alimenti', recipes: 'Ricette',
  stock: 'Dispensa', batches: 'Preparati', stockTx: 'Movimenti', diary: 'Diario', plan: 'Piano', shopping: 'Spesa', weights: 'Pesate', waist: 'Vita',
  sleep: 'Sonno', targets: 'Target', decisions: 'Decisioni', attachments: 'Foto', kv: 'Impostazioni e bozze'
};

export function BackupScreen() {
  const settings = useSettings();
  const toast = useToast();
  const [info, setInfo] = useState<{ persisted: boolean | null; usage: number | null; quota: number | null } | null>(null);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [encSheet, setEncSheet] = useState(false);
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState<{ text: string; needPw: boolean; backup: BackupFile | null; preview: ImportPreview[] | null; err: string | null } | null>(null);
  const [impPw, setImpPw] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [conflict, setConflict] = useState<'keep_local' | 'use_backup'>('keep_local');
  useEffect(() => { storageInfo().then(setInfo); listSnapshots().then(setSnaps).catch(() => {}); }, []);

  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const exportPlain = async () => {
    const b = await exportAll(APP_VERSION);
    downloadText(`diario-backup-${stamp()}.json`, JSON.stringify(b));
    await patchSettings({ lastBackupAt: Date.now() });
    toast({ text: 'Backup scaricato ✓ Conservalo fuori dal telefono (es. PC o cloud personale).' });
  };
  const exportEnc = async () => {
    if (pw !== pw2) { toast({ text: 'Le password non coincidono', kind: 'error' }); return; }
    setBusy(true);
    try {
      const enc = await encryptText(JSON.stringify(await exportAll(APP_VERSION)), pw);
      downloadText(`diario-backup-cifrato-${stamp()}.json`, enc);
      await patchSettings({ lastBackupAt: Date.now() });
      setPw(''); setPw2(''); setEncSheet(false);
      toast({ text: 'Backup cifrato scaricato ✓ La password non è salvata: se la perdi, il file non è recuperabile.' });
    } catch (e) { toast({ text: String(e instanceof Error ? e.message : e), kind: 'error' }); }
    finally { setBusy(false); }
  };
  const onFile = async (f: File) => {
    const text = await f.text();
    if (isEncrypted(text)) { setImp({ text, needPw: true, backup: null, preview: null, err: null }); return; }
    try { const b = parseBackup(text); setImp({ text, needPw: false, backup: b, preview: await previewImport(b), err: null }); }
    catch (e) { setImp({ text, needPw: false, backup: null, preview: null, err: String(e instanceof Error ? e.message : e) }); }
  };
  const decrypt = async () => {
    if (!imp) return;
    setBusy(true);
    try { const plain = await decryptText(imp.text, impPw); const b = parseBackup(plain); setImp({ ...imp, needPw: false, backup: b, preview: await previewImport(b), err: null }); }
    catch (e) { setImp({ ...imp, err: String(e instanceof Error ? e.message : e) }); }
    finally { setBusy(false); setImpPw(''); }
  };
  const apply = async () => {
    if (!imp?.backup) return;
    setBusy(true);
    try {
      // Copia di sicurezza automatica dei dati attuali prima di importare
      downloadText(`diario-prima-di-importare-${stamp()}.json`, JSON.stringify(await exportAll(APP_VERSION)));
      const n = await applyImport(imp.backup, mode, conflict);
      toast({ text: `Importazione completata: ${n} record scritti ✓` });
      setImp(null);
    } catch (e) { toast({ text: `Importazione annullata, nessun dato modificato: ${e instanceof Error ? e.message : e}`, kind: 'error' }); }
    finally { setBusy(false); }
  };
  const csv = async (name: string, fn: () => Promise<string>) => downloadText(`diario-${name}-${dateKey()}.csv`, await fn(), 'text/csv;charset=utf-8');
  const mb = (n: number | null) => (n == null ? '—' : `${fmtNum(n / 1048576, 1)} MB`);

  return (
    <>
      <h1>Backup</h1>
      <div className="card small">
        <p>I dati sono solo su questo dispositivo. Telefono e PC <strong>non si sincronizzano</strong> da soli. {settings.lastBackupAt ? `Ultimo backup: ${new Date(settings.lastBackupAt).toLocaleString('it-IT')}.` : 'Nessun backup ancora.'}</p>
        <p>Archiviazione persistente: <strong>{info?.persisted == null ? 'non supportata' : info.persisted ? 'concessa' : 'non concessa'}</strong> · spazio usato {mb(info?.usage ?? null)}{info?.persisted === false && <> — <button className="btn sm" onClick={async () => { const r = await requestPersistence(); toast({ text: r === 'granted' ? 'Persistenza concessa' : 'Il browser non l\'ha concessa: installare l\'app può aiutare. Fai comunque backup.' }); setInfo(await storageInfo()); }}>Richiedi</button></>}</p>
        <p className="muted">Anche con la persistenza, il browser o l'utente possono cancellare i dati: il backup resta la protezione reale.</p>
      </div>
      <div className="col">
        <button className="btn primary block" onClick={exportPlain}>Scarica backup completo (.json)</button>
        <button className="btn block" onClick={() => setEncSheet(true)}>Scarica backup cifrato con password</button>
      </div>
      <h2>Esporta diari (CSV)</h2>
      <div className="grid2">
        <button className="btn" onClick={() => csv('serie', csvSets)}>Serie</button>
        <button className="btn" onClick={() => csv('alimentazione', csvDiary)}>Alimentazione</button>
        <button className="btn" onClick={() => csv('peso', csvWeights)}>Peso</button>
        <button className="btn" onClick={() => csv('sonno', csvSleep)}>Sonno</button>
      </div>
      <p className="small muted">CSV con separatore ";" e virgola decimale (Excel in italiano).</p>
      <h2>Importa</h2>
      <div className="card">
        <Field label="File di backup (.json, anche cifrato o copia di recupero)"><input type="file" accept=".json,application/json" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} /></Field>
        {imp?.err && <p className="small" role="alert" style={{ color: 'var(--danger)' }}>{imp.err}</p>}
        {imp?.needPw && (
          <div className="col mt">
            <Field label="Password del backup"><input type="password" value={impPw} onChange={(e) => setImpPw(e.target.value)} autoComplete="off" /></Field>
            <button className="btn block" disabled={!impPw || busy} onClick={decrypt}>{busy ? 'Decifratura…' : 'Decifra'}</button>
          </div>
        )}
        {imp?.preview && imp.backup && (
          <div className="mt">
            <p className="small">Backup del {new Date(imp.backup.exportedAt).toLocaleString('it-IT')} (schema {imp.backup.schemaVersion}, app {imp.backup.appVersion}).</p>
            <table className="t small"><thead><tr><th>Dati</th><th>Nuovi</th><th>Identici</th><th>Diversi</th></tr></thead>
              <tbody>{imp.preview.map((p) => <tr key={p.table}><td>{TABLE_LABEL[p.table] ?? p.table}</td><td>{p.added}</td><td>{p.identical}</td><td>{p.conflicts}</td></tr>)}</tbody></table>
            <div className="chips mt"><Chip on={mode === 'merge'} onClick={() => setMode('merge')}>Unisci (nessun duplicato)</Chip><Chip on={mode === 'replace'} onClick={() => setMode('replace')}>Sostituisci tutto</Chip></div>
            {mode === 'merge' && <div className="chips mt"><Chip on={conflict === 'keep_local'} onClick={() => setConflict('keep_local')}>Se diversi: tieni i miei</Chip><Chip on={conflict === 'use_backup'} onClick={() => setConflict('use_backup')}>Se diversi: usa il backup</Chip></div>}
            {mode === 'replace' && <p className="small" style={{ color: 'var(--danger)' }}>Sostituisce tutti i dati attuali con quelli del backup.</p>}
            <p className="small muted">Prima di importare viene scaricata automaticamente una copia dei dati attuali. L'importazione è atomica: se fallisce, nulla cambia.</p>
            <button className="btn primary block" disabled={busy} onClick={apply}>Importa</button>
          </div>
        )}
      </div>
      {snaps.length > 0 && (
        <details className="card flat"><summary>Snapshot automatici pre-aggiornamento ({snaps.length})</summary>
          <ul className="list">{snaps.map((s) => <li key={s.id} className="row between small"><span>{new Date(s.at).toLocaleString('it-IT')} · da schema v{s.fromVersion}</span><button className="btn sm" onClick={() => downloadText(`${s.id}.json`, JSON.stringify(s))}>Scarica</button></li>)}</ul>
          <p className="small muted">Copie create prima di ogni migrazione del database; importabili da qui sopra.</p>
        </details>
      )}
      {encSheet && (
        <Sheet title="Backup cifrato" onClose={() => setEncSheet(false)}>
          <div className="col">
            <p className="small">Cifratura AES-GCM 256 bit con chiave derivata dalla password (PBKDF2-SHA-256, 600.000 iterazioni) tramite Web Crypto. La password non viene salvata da nessuna parte.</p>
            <Field label="Password (almeno 8 caratteri)"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="Ripeti la password"><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
            <button className="btn primary block" disabled={pw.length < 8 || busy} onClick={exportEnc}>{busy ? 'Cifratura…' : 'Cifra e scarica'}</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
