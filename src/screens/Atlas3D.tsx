// Visualizzatore 3D (three.js) caricato in un modulo separato: mai sul percorso di "Salva serie".
// - Una sola istanza WebGL; rendering solo quando cambia qualcosa (nessuna rotazione continua).
// - Comandi a pulsante per ruotare senza trascinare; tocco = selezione, trascinamento = rotazione.
// - Colore + contorno per la selezione; colori del lavoro su scala fissa con legenda nella schermata.
import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { decidePick, sampleOffsets, type Sample } from '../lib/pick3d';

export type Paint = 'principale' | 'secondario' | 'possibile_enfasi' | 'w0' | 'w1' | 'w2' | 'w3' | 'cand';
export interface MeshInfo { key: string; side: string; label: string; group: string; layer: string; sourceName: string }
export interface Atlas3DHandle { view(v: 'front' | 'back' | 'left' | 'right'): void; rotate(deg: number): void; zoom(f: number): void; center(): void; reset(): void }

const COLORS: Record<Paint | 'base' | 'bone' | 'conn' | 'sel', number> = {
  base: 0xc8826f, bone: 0xebe5d8, conn: 0xd9cdbd, sel: 0x2563eb,
  principale: 0x9c3416, secondario: 0xe39a6d, possibile_enfasi: 0x7c3aed,
  w0: 0xd8d2c8, w1: 0xf3c9a3, w2: 0xe07a4f, w3: 0x9c3416, cand: 0xfbbf24
};
const PREVIEW = 0x93c5fd;

export const Atlas3D = forwardRef<Atlas3DHandle, {
  buffer: ArrayBuffer; selected: string | null; onSelect: (m: MeshInfo | null) => void;
  paint?: Map<string, Paint>; isolate?: boolean; reduceMotion?: boolean; onReady?: (keys: MeshInfo[], ms: number) => void;
  /** tocco conteso tra più strutture vicine: chi usa il viewer chiede quale */
  onAmbiguous?: (cands: MeshInfo[]) => void;
  /** nome da mostrare nell'anteprima sotto il dito */
  nameOf?: (m: MeshInfo) => string;
  /** vista iniziale */
  initialView?: 'front' | 'back' | 'left' | 'right';
  /** modalità poster: disegna una volta, consegna l'immagine e libera il contesto WebGL */
  snapshot?: (dataUrl: string) => void;
}>(function Atlas3D({ buffer, selected, onSelect, paint, isolate, reduceMotion, onReady, onAmbiguous, nameOf, initialView, snapshot }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const st = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; meshes: THREE.Mesh[]; outlines: THREE.LineSegments[]; render: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onSelect); cb.current = onSelect;
  const amb = useRef(onAmbiguous); amb.current = onAmbiguous;
  const paintRef = useRef(paint); paintRef.current = paint;
  const nm = useRef(nameOf); nm.current = nameOf;
  const [preview, setPreview] = useState<{ key: string; name: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const t0 = performance.now();
    let disposed = false;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }); } catch { setError('WebGL non disponibile su questo dispositivo: uso l\'atlante 2D.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf4f1ea);
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Modello anatomico 3D: usa i pulsanti o la lista per selezionare');
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 1.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4); dir.position.set(1.5, 3, 2.5); scene.add(dir);
    const back = new THREE.DirectionalLight(0xffffff, 0.6); back.position.set(-1.5, 2, -2.5); scene.add(back);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; controls.autoRotate = false; controls.minDistance = 0.4; controls.maxDistance = 6; controls.target.set(0, 0.95, 0);
    const meshes: THREE.Mesh[] = [];
    const render = () => renderer.render(scene, camera);
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); render(); };
    controls.addEventListener('change', render);
    st.current = { renderer, scene, camera, controls, meshes, outlines: [], render };
    camera.position.set(0, 1.05, 3.4);
    if (initialView === 'back') camera.position.set(0, 1.05, -3.4);
    else if (initialView === 'left') camera.position.set(3.4, 1.05, 0);
    else if (initialView === 'right') camera.position.set(-3.4, 1.05, 0);
    controls.update();

    new GLTFLoader().parse(buffer.slice(0), '', (gltf) => {
      if (disposed) return;
      const infos: MeshInfo[] = [];
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const x = (m.userData ?? {}) as Record<string, string>;
        const mat = (m.material as THREE.Material).name || '';
        const kind = mat.includes('bone') ? 'bone' : mat.includes('connective') ? 'conn' : 'base';
        m.material = new THREE.MeshLambertMaterial({ color: COLORS[kind] });
        m.userData = { ...x, kind };
        meshes.push(m);
        if (x.key) infos.push({ key: x.key, side: x.side, label: x.label, group: x.group, layer: x.layer, sourceName: x.sourceName });
      });
      scene.add(gltf.scene);
      resize();
      onReady?.(infos, Math.round(performance.now() - t0));
      if (snapshot) {
        // colori del poster applicati subito (stesso criterio del visualizzatore), poi immagine e rilascio del contesto
        for (const m of meshes) { const u = m.userData as Record<string, string>; const pt = u.key ? paintRef.current?.get(u.key) : undefined; if (pt) (m.material as THREE.MeshLambertMaterial).color.setHex(COLORS[pt]); }
        render();
        snapshot(renderer.domElement.toDataURL('image/jpeg', 0.82));
      }
    }, (e) => setError(`Modello non leggibile: ${String((e as unknown as { message?: string })?.message ?? e)}`));

    // Tocco = selezione (se il dito non si è spostato); trascinamento = rotazione.
    // Strutture piccole: si campiona intorno al dito (raggio ~ mezzo polpastrello) e, se il punto è conteso, si chiede quale.
    let down: { x: number; y: number; t: number } | null = null;
    let hold: number | undefined;
    const ray = new THREE.Raycaster(); const v = new THREE.Vector2();
    const info = (u: Record<string, string>): MeshInfo => ({ key: u.key, side: u.side, label: u.label, group: u.group, layer: u.layer, sourceName: u.sourceName });
    const hitAt = (cx: number, cy: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      v.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v, camera);
      const h = ray.intersectObjects(meshes.filter((m) => m.visible && m.userData.key), false)[0];
      return h ? { u: h.object.userData as Record<string, string>, depth: h.distance } : null;
    };
    const radius = () => Math.max(12, Math.min(22, renderer.domElement.clientWidth / 24));
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: Date.now() };
      window.clearTimeout(hold);
      // anteprima: dito fermo per un attimo → nome e colore della struttura sotto il dito
      hold = window.setTimeout(() => {
        if (!down) return;
        const h = hitAt(down.x, down.y);
        if (h?.u.key) { const r = renderer.domElement.getBoundingClientRect(); const mi = info(h.u); setPreview({ key: mi.key, name: nm.current?.(mi) ?? mi.label, x: down.x - r.left, y: down.y - r.top }); }
      }, 220);
    };
    const onMove = (e: PointerEvent) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { window.clearTimeout(hold); setPreview(null); } };
    const onUp = (e: PointerEvent) => {
      window.clearTimeout(hold); setPreview(null);
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
      const { x, y } = down; down = null;
      const byKey = new Map<string, Record<string, string>>();
      const samples: Sample[] = sampleOffsets(radius()).map(([dx, dy], i) => {
        const h = hitAt(x + dx, y + dy);
        if (h?.u.key && !byKey.has(h.u.key)) byKey.set(h.u.key, h.u);
        return { key: h?.u.key ?? null, depth: h?.depth ?? null, center: i === 0 };
      });
      const res = decidePick(samples);
      if (res.kind === 'none') cb.current(null);
      else if (res.kind === 'select') cb.current(info(byKey.get(res.key)!));
      else if (amb.current) amb.current(res.keys.map((k) => info(byKey.get(k)!)));
      else cb.current(info(byKey.get(res.keys[0])!));
    };
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    const ro = new ResizeObserver(resize); ro.observe(el);
    return () => {
      disposed = true; ro.disconnect(); controls.dispose();
      meshes.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
      renderer.dispose(); renderer.domElement.remove(); st.current = null;
    };
  }, [buffer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Colori, selezione (colore + contorno) e isolamento
  useEffect(() => {
    const s = st.current; if (!s) return;
    s.outlines.forEach((l) => { l.parent?.remove(l); l.geometry.dispose(); (l.material as THREE.Material).dispose(); });
    s.outlines = [];
    for (const m of s.meshes) {
      const u = m.userData as Record<string, string>;
      const isSel = !!selected && u.key === selected;
      const p = u.key ? paint?.get(u.key) : undefined;
      const isPrev = !!preview && u.key === preview.key && !isSel;
      (m.material as THREE.MeshLambertMaterial).color.setHex(isSel ? COLORS.sel : isPrev ? PREVIEW : p ? COLORS[p] : COLORS[(u.kind as 'base' | 'bone' | 'conn') ?? 'base']);
      m.visible = !isolate || !selected || isSel || u.kind === 'bone';
      if (isSel) {
        const line = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 35), new THREE.LineBasicMaterial({ color: 0x0b1f5c }));
        m.add(line); s.outlines.push(line);
      }
    }
    s.render();
  });

  useImperativeHandle(ref, () => ({
    view(vw) {
      const s = st.current; if (!s) return;
      const d = s.camera.position.distanceTo(s.controls.target);
      const t = s.controls.target;
      const pos = { front: [0, 0, d], back: [0, 0, -d], left: [d, 0, 0], right: [-d, 0, 0] }[vw];
      s.camera.position.set(t.x + pos[0], t.y + 0.1, t.z + pos[2]); s.controls.update();
    },
    rotate(deg) {
      const s = st.current; if (!s) return;
      const off = s.camera.position.clone().sub(s.controls.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (deg * Math.PI) / 180);
      s.camera.position.copy(s.controls.target).add(off); s.controls.update();
    },
    zoom(f) {
      const s = st.current; if (!s) return;
      const off = s.camera.position.clone().sub(s.controls.target).multiplyScalar(f);
      const len = Math.min(6, Math.max(0.4, off.length()));
      s.camera.position.copy(s.controls.target).add(off.setLength(len)); s.controls.update();
    },
    center() {
      const s = st.current; if (!s || !selected) return;
      const box = new THREE.Box3();
      s.meshes.filter((m) => (m.userData as Record<string, string>).key === selected).forEach((m) => box.expandByObject(m));
      if (box.isEmpty()) return;
      const c = box.getCenter(new THREE.Vector3());
      const dirv = s.camera.position.clone().sub(s.controls.target).setLength(Math.max(0.7, box.getSize(new THREE.Vector3()).length() * 2.2));
      s.controls.target.copy(c); s.camera.position.copy(c).add(dirv); s.controls.update();
    },
    reset() {
      const s = st.current; if (!s) return;
      s.controls.target.set(0, 0.95, 0); s.camera.position.set(0, 1.05, 3.4); s.controls.update();
    }
  }), [selected]);

  void reduceMotion; // i movimenti sono già istantanei: nessuna animazione da ridurre
  return (
    <div className="atlas3d-wrap">
      <div ref={host} className="atlas3d" data-testid="atlas3d-canvas" />
      {preview && <div className="atlas3d-preview" style={{ left: preview.x, top: Math.max(4, preview.y - 64) }} aria-live="polite">{preview.name}</div>}
      {error && <p className="small" role="alert">{error}</p>}
    </div>
  );
});
