// 3D views of the three nested experiments, built only from their shipped artifacts in src/nested/:
//  RISC-V: runs the hand-compiled RV32I transformer (nested/riscv/cpu.js, unchanged) and plots every FFN unit's
//          activation per executed instruction (x = unit, y = layer stratum, z = step).
//  SLM:    every weight matrix of a chosen model in nested/slm/models.f32 as a stratum of points (colour = weight).
//  MoE:    nested/moe/routing.json — tokens × layers, coloured by the routed expert, height = gate probability.
import * as THREE from 'three/webgpu';
import type { Stage } from './stage';
const base = new URL('nested/', document.baseURI);
const getJSON = async <T,>(p: string): Promise<T> => { const r = await fetch(new URL(p, base)); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json() as Promise<T>; };
function cloud(pos: number[], colors: number[], size: number): THREE.Points {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, sizeAttenuation: true }));
}
interface RVApi { prep(spec: unknown): unknown; CPU: new (m: unknown, rom: number[], ram: number[]) => { step(rec?: Record<string, ArrayLike<number>>): unknown; pc: number } }
declare global { interface Window { RVTransformer?: RVApi } }
function loadScript(src: string): Promise<void> { return new Promise((res, rej) => { if (window.RVTransformer) return res(); const s = document.createElement('script'); s.src = new URL(src, base).href; s.onload = () => res(); s.onerror = () => rej(new Error('failed to load ' + src)); document.head.appendChild(s); }); }
export interface NestedResult { group: THREE.Group; info: string; center: THREE.Vector3; dist: number }
export async function riscv(steps = 24): Promise<NestedResult> {
  await loadScript('riscv/cpu.js');
  const [spec, progs] = await Promise.all([getJSON<{ layers: { type: string; name: string; H?: number }[] }>('riscv/riscv_spec.json'), getJSON<Record<string, { words: number[] }>>('riscv/programs.json')]);
  const name = Object.keys(progs)[0]!, prog = progs[name]!, RV = window.RVTransformer!; const cpu = new RV.CPU(RV.prep(spec), prog.words, Array(32).fill(0));
  const ffn = spec.layers.filter((l) => l.type === 'ffn'); const pos: number[] = [], colors: number[] = []; let active = 0, total = 0;
  for (let t = 0; t < steps; t++) {
    const rec: Record<string, ArrayLike<number>> = {}; cpu.step(rec);
    ffn.forEach((l, li) => { const a = rec[l.name]; if (!a) return; const n = a.length; for (let u = 0; u < n; u++) { const v = a[u]!; total++; if (v <= 0) continue; active++; pos.push((u / n - 0.5) * 30, li * 3, t * 0.8); const k = Math.min(1, v); colors.push(0.3 + 0.7 * k, 0.8, 1 - 0.6 * k); } });
  }
  const g = new THREE.Group(); g.add(cloud(pos, colors, 0.18));
  return { group: g, center: new THREE.Vector3(0, ffn.length * 1.5, steps * 0.4), dist: 42, info: `RISC-V transformer running “${name}” for ${steps} steps: ${active.toLocaleString()} of ${total.toLocaleString()} FFN unit activations were positive (only those are drawn). ${ffn.length} FFN strata.` };
}
export async function slm(model: 'guest' | 'composite' | 'emu' = 'composite'): Promise<NestedResult> {
  const idx = await getJSON<{ models: Record<string, { w: Record<string, { off: number; shape: number[] }> }> }>('slm/models.index.json');
  const r = await fetch(new URL('slm/models.f32', base)); if (!r.ok) throw new Error('models.f32: HTTP ' + r.status); const f = new Float32Array(await r.arrayBuffer());
  const m = idx.models[model]; if (!m) throw new Error('no model ' + model); const pos: number[] = [], colors: number[] = []; let li = 0, n = 0;
  for (const [, w] of Object.entries(m.w)) { if (w.shape.length !== 2) continue; const [rows, cols] = w.shape as [number, number]; let mx = 1e-9; for (let i = 0; i < rows * cols; i++) mx = Math.max(mx, Math.abs(f[w.off + i]!));
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const v = f[w.off + i * cols + j]! / mx; pos.push((j - cols / 2) * 0.12, li * 2, (i - rows / 2) * 0.12); colors.push(v > 0 ? 0.9 : 0.25, 0.4 + 0.4 * Math.abs(v), v > 0 ? 0.3 : 0.95); n++; } li++; }
  const g = new THREE.Group(); g.add(cloud(pos, colors, 0.07));
  return { group: g, center: new THREE.Vector3(0, li, 0), dist: 34, info: `SLM-in-SLM “${model}” weights: ${li} matrices as strata, ${n.toLocaleString()} weights (colour = sign, brightness = |w| / max per matrix).` };
}
export async function moe(sample = 0): Promise<NestedResult> {
  const r = await getJSON<{ samples: { text: string; layers: { g: number[]; e: number[]; pg: number[] }[] }[] }>('moe/routing.json');
  const s = r.samples[sample]; if (!s) throw new Error('no sample'); const pos: number[] = [], colors: number[] = [], hue = [0x38bdf8, 0xf472b6, 0xfbbf24, 0x34d399]; const c = new THREE.Color();
  s.layers.forEach((L, li) => L.e.forEach((e, t) => { const g = L.g[t] ?? 0, p = L.pg[t] ?? 0; pos.push((t - L.e.length / 2) * 0.35, li * 3 + p * 1.5, (g - 1.5) * 2.2); c.set(hue[e % 4]!); colors.push(c.r, c.g, c.b); }));
  const grp = new THREE.Group(); grp.add(cloud(pos, colors, 0.45));
  return { group: grp, center: new THREE.Vector3(0, s.layers.length * 1.5, 0), dist: 30, info: `MoE-in-MoE routing for “${s.text.slice(0, 60)}…”: ${s.layers.length} layers × ${s.layers[0]?.e.length ?? 0} tokens; depth = group, colour = expert, height = group gate probability.` };
}
export function mount(st: Stage, r: NestedResult): void { st.scene.clear(); st.scene.add(r.group); st.focus(r.center, r.dist); }
