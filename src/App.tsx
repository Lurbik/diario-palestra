import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { Icon, ToastProvider, useRoute, useSettings } from './ui/kit';
import { TodayScreen } from './screens/Today';
import { WorkoutScreen } from './screens/Workout';
import { FoodScreen } from './screens/Food';
import { ProgressScreen } from './screens/Progress';
import { MoreScreen } from './screens/More';
import { hasUnsaved, onUnsavedChange, verifyOfflineReady } from './lib/pwa';

const NAV: [string, string, () => React.JSX.Element][] = [
  ['oggi', 'Oggi', Icon.today], ['allenamento', 'Allenamento', Icon.gym], ['cibo', 'Cibo', Icon.food], ['progressi', 'Progressi', Icon.progress], ['altro', 'Altro', Icon.more]
];

export function App() {
  const settings = useSettings();
  const [route] = useRoute();
  const activeSession = useLiveQuery(() => db.sessions.where('status').equals('active').first(), []);
  const [unsaved, setUnsavedState] = useState(hasUnsaved());
  useEffect(() => onUnsavedChange(() => setUnsavedState(hasUnsaved())), []);

  // Tema
  useEffect(() => {
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.documentElement.dataset.contrast = settings.highContrast ? 'high' : 'normal';
      document.documentElement.dataset.motion = settings.reduceMotion ? 'reduce' : 'normal';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#15171b' : '#f4f5f7');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme, settings.highContrast, settings.reduceMotion]);

  // Service worker: aggiornamento a richiesta, mai automatico.
  const { needRefresh: [needRefresh], offlineReady: [offlineReadyEvt], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Controllo periodico di nuove versioni solo se online (non ricarica nulla da solo).
      if (reg) setInterval(() => { if (navigator.onLine) reg.update().catch(() => {}); }, 60 * 60 * 1000);
    }
  });
  const [offline, setOffline] = useState<{ ready: boolean; detail: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () => verifyOfflineReady().then((r) => alive && setOffline(r)).catch(() => {});
    check();
    navigator.serviceWorker?.addEventListener('controllerchange', check);
    const t = setTimeout(check, 4000);
    return () => { alive = false; clearTimeout(t); navigator.serviceWorker?.removeEventListener('controllerchange', check); };
  }, [offlineReadyEvt]);
  (window as unknown as { __offlineStatus?: unknown }).__offlineStatus = offline;

  const blockUpdate = !!activeSession || unsaved;
  const section = route[0];

  return (
    <ToastProvider>
      <div className="app">
        {needRefresh && (
          <div className="banner info" style={{ margin: '10px 16px 0' }} role="status">
            <div className="grow small">
              <strong>Nuova versione disponibile</strong> — {blockUpdate ? 'aggiorna dopo la seduta o dopo aver salvato.' : 'i tuoi dati restano sul dispositivo.'}
            </div>
            <button className="btn sm" disabled={blockUpdate} onClick={() => { if (!hasUnsaved()) updateServiceWorker(true); }}>Aggiorna</button>
          </div>
        )}
        {section === 'oggi' && <TodayScreen offline={offline} />}
        {section === 'allenamento' && <WorkoutScreen route={route} />}
        {section === 'cibo' && <FoodScreen route={route} />}
        {section === 'progressi' && <ProgressScreen route={route} />}
        {section === 'altro' && <MoreScreen route={route} offline={offline} />}
        <nav className="nav" aria-label="Sezioni principali">
          {NAV.map(([k, label, I]) => (
            <button key={k} className="navbtn" aria-current={section === k ? 'page' : undefined} onClick={() => { location.hash = '#/' + (k === 'allenamento' && activeSession ? 'allenamento/seduta' : k); }}>
              <I /><span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}
