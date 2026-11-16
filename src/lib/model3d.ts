// Pacchetto 3D facoltativo: scaricato solo su richiesta (dimensione mostrata prima), verificato con SHA-256,
// conservato nella Cache Storage del browser per l'uso offline. Annullabile e ripetibile.
import { MODEL3D } from '../catalog/anatomy3d';

const url = () => new URL(MODEL3D.file, document.baseURI).toString();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function isModelReady(): Promise<boolean> {
  if (!('caches' in window)) return false;
  const c = await caches.open(MODEL3D.cache);
  return !!(await c.match(url()));
}

export async function downloadModel(onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(url(), { signal, cache: 'no-store' });
  if (!res.ok || !res.body) throw new Error(`Download non riuscito (${res.status})`);
  const total = Number(res.headers.get('content-length')) || MODEL3D.bytes;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let done = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    parts.push(r.value); done += r.value.length; onProgress(done, total);
  }
  const buf = new Uint8Array(done);
  let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
  const digest = hex(await crypto.subtle.digest('SHA-256', buf));
  if (digest !== MODEL3D.sha256) throw new Error('Il file scaricato non corrisponde a quello atteso (impronta diversa): non viene usato.');
  const c = await caches.open(MODEL3D.cache);
  await c.put(url(), new Response(buf, { headers: { 'content-type': 'model/gltf-binary', 'content-length': String(done) } }));
}

export async function loadModelBuffer(): Promise<ArrayBuffer | null> {
  if (!('caches' in window)) return null;
  const r = await (await caches.open(MODEL3D.cache)).match(url());
  return r ? r.arrayBuffer() : null;
}

export async function removeModel() { if ('caches' in window) await caches.delete(MODEL3D.cache); }

/** WebGL disponibile? (se no: atlante 2D) */
export function webglAvailable(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
