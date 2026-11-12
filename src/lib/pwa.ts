// Stato PWA: verifica reale della cache, richiesta di persistenza, protezione degli aggiornamenti.

/** Moduli con input non salvato: l'aggiornamento non può essere attivato mentre esistono. */
const unsaved = new Set<string>();
const listeners = new Set<() => void>();
export function setUnsaved(key: string, dirty: boolean) {
  const had = unsaved.has(key);
  if (dirty) unsaved.add(key); else unsaved.delete(key);
  if (had !== dirty) listeners.forEach((l) => l());
}
export function hasUnsaved() { return unsaved.size > 0; }
export function onUnsavedChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/**
 * "Pronta offline" solo se: c'è un service worker attivo che controlla la pagina e
 * TUTTE le risorse caricate da questa pagina (script, CSS, index.html) sono nella cache precache.
 */
export async function verifyOfflineReady(): Promise<{ ready: boolean; detail: string }> {
  if (!('serviceWorker' in navigator)) return { ready: false, detail: 'Service worker non supportato da questo browser.' };
  if (!navigator.serviceWorker.controller) return { ready: false, detail: 'Service worker non ancora attivo su questa pagina (ricarica una volta).' };
  if (!('caches' in window)) return { ready: false, detail: 'Cache API non disponibile.' };
  const keys = await caches.keys();
  const pre = keys.filter((k) => k.includes('precache'));
  if (!pre.length) return { ready: false, detail: 'Cache essenziale non trovata.' };
  const urls = [
    ...Array.from(document.querySelectorAll<HTMLScriptElement>('script[src]')).map((s) => s.src),
    ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map((l) => l.href),
    new URL('index.html', location.href).href
  ];
  for (const u of urls) {
    let hit = false;
    for (const k of pre) {
      const c = await caches.open(k);
      if (await c.match(u, { ignoreSearch: true })) { hit = true; break; }
    }
    if (!hit) return { ready: false, detail: `Risorsa non ancora in cache: ${u.split('/').pop()}` };
  }
  return { ready: true, detail: `Cache essenziale verificata (${urls.length} risorse principali).` };
}

export async function requestPersistence(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!navigator.storage?.persist) return 'unsupported';
  if (await navigator.storage.persisted()) return 'granted';
  return (await navigator.storage.persist()) ? 'granted' : 'denied';
}

export async function storageInfo() {
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  return { persisted, usage: est?.usage ?? null, quota: est?.quota ?? null };
}

export const isNative = () => typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform === 'function'
  && (window as unknown as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor.isNativePlatform();

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
