// Shared three.js stage: WebGPURenderer (WebGPU backend when available, WebGL2 fallback otherwise), orbit-ish
// camera with spring-smoothed semantic zoom, resize observer, raycast picking, and the legacy GPU-tier logic.
import * as THREE from 'three/webgpu';
import { stepSpring, type Spring } from '../core/motion';
import { legacy } from '../core/bridge';
export type Tier = 'low' | 'mid' | 'high';
export function gpuTier(): Tier { const t = legacy()?.viz?.tier; return t === 'low' || t === 'mid' || t === 'high' ? t : 'mid'; }
export interface Stage { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGPURenderer; backend: string; tier: Tier; focus(p: THREE.Vector3, dist: number): void; dist(): number; onFrame(f: (dt: number) => void): void; pick(e: PointerEvent, objs: THREE.Object3D[]): THREE.Intersection | null; dispose(): void }
export async function createStage(host: HTMLElement, bg: () => string): Promise<Stage> {
  const tier = gpuTier(); const hasGPU = typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as Navigator & { gpu?: unknown }).gpu;
  const renderer = new THREE.WebGPURenderer({ antialias: tier !== 'low', forceWebGL: !hasGPU || tier === 'low' });
  // dispose() deliberately releases the context; only a loss while still mounted is worth reporting
  renderer.onDeviceLost = (info: { message?: string }) => { if (alive) console.warn('[cosmos] GPU device lost:', info?.message ?? 'unknown'); };
  renderer.setPixelRatio(Math.min(devicePixelRatio, tier === 'high' ? 2 : tier === 'mid' ? 1.5 : 1));
  await renderer.init();
  const backend = (renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  const canvas = renderer.domElement; canvas.className = 'cosmos-canvas'; canvas.tabIndex = 0; host.appendChild(canvas);
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);
  // spherical camera; each coordinate is a spring so zoom/orbit/fly-to are smooth (snap under reduced motion)
  const th: Spring = { x: 0.7, v: 0, target: 0.7 }, ph: Spring = { x: 1.1, v: 0, target: 1.1 }, rr: Spring = { x: 40, v: 0, target: 40 };
  const tx: Spring = { x: 0, v: 0, target: 0 }, ty: Spring = { x: 0, v: 0, target: 0 }, tz: Spring = { x: 0, v: 0, target: 0 };
  const springs = [th, ph, rr, tx, ty, tz]; const frames: ((dt: number) => void)[] = [];
  let drag: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; th.target -= (e.clientX - drag.x) * 0.006; ph.target = Math.min(3.0, Math.max(0.15, ph.target - (e.clientY - drag.y) * 0.006)); drag = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); rr.target = Math.min(400, Math.max(1.2, rr.target * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  canvas.addEventListener('keydown', (e) => { const k = e.key; if (k === 'ArrowLeft') th.target -= 0.15; else if (k === 'ArrowRight') th.target += 0.15; else if (k === 'ArrowUp') ph.target = Math.max(0.15, ph.target - 0.12); else if (k === 'ArrowDown') ph.target = Math.min(3, ph.target + 0.12); else if (k === '+' || k === '=') rr.target = Math.max(1.2, rr.target * 0.8); else if (k === '-') rr.target = Math.min(400, rr.target * 1.25); else return; e.preventDefault(); });
  let sized = false;
  const ro = new ResizeObserver(() => { sized = false; });
  ro.observe(host);
  let last = performance.now(), alive = true, visible = true;
  const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); }); io.observe(host);
  const loop = (): void => {
    if (!alive) return; const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!sized && host.clientWidth > 0) { sized = true; const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); renderer.setSize(w, h, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (visible && host.clientWidth > 0) {
      for (const s of springs) stepSpring(s, dt);
      camera.position.set(tx.x + rr.x * Math.sin(ph.x) * Math.sin(th.x), ty.x + rr.x * Math.cos(ph.x), tz.x + rr.x * Math.sin(ph.x) * Math.cos(th.x));
      camera.lookAt(tx.x, ty.x, tz.x); scene.background = new THREE.Color(bg());
      for (const f of frames) f(dt); renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const ray = new THREE.Raycaster(); ray.params.Points = { threshold: 0.25 };
  return {
    scene, camera, renderer, backend, tier,
    focus(p, d) { tx.target = p.x; ty.target = p.y; tz.target = p.z; rr.target = d; },
    dist: () => rr.x,
    onFrame: (f) => { frames.push(f); },
    pick(e, objs) { const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera); return ray.intersectObjects(objs, false)[0] ?? null; },
    dispose() { alive = false; ro.disconnect(); io.disconnect(); renderer.dispose(); canvas.remove(); },
  };
}
