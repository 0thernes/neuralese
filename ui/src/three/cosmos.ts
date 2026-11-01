// Model cosmos: layers as strata, neurons (32×32 grid per layer) and heads (ring) as instanced particles whose height,
// size and colour come from the real activations of the selected token; residual-stream ribbons run up through the
// strata, one per token, with radius from ‖resid‖. Semantic zoom: far = strata + ribbons, near = individual units.
import * as THREE from 'three/webgpu';
import type { CosmosData } from '../core/cosmos-data';
import type { Stage } from './stage';
export const GAP = 4, GRID = 32, CELL = 0.32;
export const layerY = (l: number): number => l * GAP;
export function neuronPos(l: number, n: number, v: number, maxV: number, out = new THREE.Vector3()): THREE.Vector3 {
  const gx = n % GRID, gz = Math.floor(n / GRID); return out.set((gx - GRID / 2) * CELL, layerY(l) + (maxV ? (v / maxV) * 1.6 : 0), (gz - GRID / 2) * CELL);
}
export function headPos(l: number, h: number, H: number, out = new THREE.Vector3()): THREE.Vector3 { const a = (h / H) * Math.PI * 2; return out.set(Math.cos(a) * 7.2, layerY(l), Math.sin(a) * 7.2); }
const col = new THREE.Color();
function diverge(v: number, m: number, light: boolean): THREE.Color { const t = m ? Math.max(-1, Math.min(1, v / m)) : 0; if (t >= 0) col.setRGB(0.15 + 0.85 * t, 0.35 + 0.35 * t, light ? 0.55 - 0.3 * t : 0.6 - 0.45 * t); else col.setRGB(0.2 + 0.1 * -t, 0.45 + 0.3 * -t, 0.65 + 0.35 * -t); return col; }
export interface Cosmos { update(c: CosmosData | null, light: boolean): void; select(l: number, h: number | null, n: number | null, fly: boolean): void; pickables(): THREE.Object3D[]; decode(hit: THREE.Intersection): { layer: number; head?: number; neuron?: number } | null; lod(): string }
export function createCosmos(st: Stage, L: number, H: number, ff: number): Cosmos {
  const seg = st.tier === 'low' ? 4 : 8;
  const nGeo = new THREE.BoxGeometry(CELL * 0.7, CELL * 0.7, CELL * 0.7), hGeo = new THREE.SphereGeometry(0.42, seg * 2, seg);
  const neurons = new THREE.InstancedMesh(nGeo, new THREE.MeshBasicMaterial(), L * ff), heads = new THREE.InstancedMesh(hGeo, new THREE.MeshBasicMaterial(), L * H);
  neurons.name = 'neurons'; heads.name = 'heads'; neurons.frustumCulled = false; heads.frustumCulled = false;
  const slabs = new THREE.Group(); for (let l = 0; l < L; l++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(GRID * CELL + 1, GRID * CELL + 1), new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = layerY(l) - 0.05; slabs.add(m); }
  const ribbons = new THREE.Group(), marker = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 24), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
  marker.visible = false; st.scene.add(slabs, neurons, heads, ribbons, marker);
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let data: CosmosData | null = null;
  const hide = (): void => { m4.makeScale(0, 0, 0); for (let i = 0; i < L * ff; i++) neurons.setMatrixAt(i, m4); for (let i = 0; i < L * H; i++) heads.setMatrixAt(i, m4); neurons.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; };
  hide();
  st.onFrame(() => { const d = st.dist(); neurons.visible = d < 120; slabs.children.forEach((c) => ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = d > 60 ? 0.14 : 0.05); });
  return {
    update(c, light) {
      data = c; ribbons.clear(); if (!c) { hide(); return; }
      for (let l = 0; l < L; l++) for (let n = 0; n < ff; n++) { const v = c.neurons[l * ff + n]!; neuronPos(l, n, v, c.maxNeuron, p); const k = 0.35 + 1.2 * Math.min(1, Math.abs(v) / (c.maxNeuron || 1)); s.set(k, k, k); m4.compose(p, q, s); neurons.setMatrixAt(l * ff + n, m4); neurons.setColorAt(l * ff + n, diverge(v, c.maxNeuron, light)); }
      for (let l = 0; l < L; l++) for (let h = 0; h < H; h++) { const v = c.heads[l * H + h]!; headPos(l, h, H, p); const k = 0.3 + 1.4 * (c.maxHead ? v / c.maxHead : 0); s.set(k, k, k); m4.compose(p, q, s); heads.setMatrixAt(l * H + h, m4); heads.setColorAt(l * H + h, col.setHSL(0.08 + 0.1 * (h / H), 0.85, light ? 0.45 : 0.6)); }
      neurons.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; if (neurons.instanceColor) neurons.instanceColor.needsUpdate = true; if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
      // residual ribbons: one tube per token through embed (y=-GAP) and every layer output; radius ∝ ‖resid‖
      const T = c.T, span = Math.min(14, T * 0.5);
      for (let t = 0; t < T; t++) {
        const x = T > 1 ? -span / 2 + (span * t) / (T - 1) : 0, pts: THREE.Vector3[] = [];
        for (let r = 0; r <= L; r++) pts.push(new THREE.Vector3(x, layerY(r - 1) + 0.5, -GRID * CELL / 2 - 2 - (c.maxResid ? (c.resid[r * T + t]! / c.maxResid) * 2.5 : 0)));
        const curve = new THREE.CatmullRomCurve3(pts); const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, L * 6, t === c.token ? 0.12 : 0.05, 5, false), new THREE.MeshBasicMaterial({ color: t === c.token ? 0xfbbf24 : 0x38bdf8, transparent: true, opacity: t === c.token ? 0.95 : 0.45 }));
        tube.userData = { token: t }; ribbons.add(tube);
      }
    },
    select(l, h, n, fly) {
      if (h != null) headPos(l, h, H, p); else if (n != null) neuronPos(l, n, data ? data.neurons[l * ff + n]! : 0, data?.maxNeuron ?? 0, p); else p.set(0, layerY(l), 0);
      marker.visible = true; marker.position.copy(p); marker.rotation.x = Math.PI / 2;
      if (fly) st.focus(p, h != null || n != null ? 5 : 22);
    },
    pickables: () => [neurons, heads, ...ribbons.children],
    decode(hit) {
      if (hit.object === neurons && hit.instanceId != null) return { layer: Math.floor(hit.instanceId / ff), neuron: hit.instanceId % ff };
      if (hit.object === heads && hit.instanceId != null) return { layer: Math.floor(hit.instanceId / H), head: hit.instanceId % H };
      return null;
    },
    lod: () => { const d = st.dist(); return d > 120 ? 'model (strata + residual ribbons)' : d > 30 ? 'layers (heads + neurons)' : d > 8 ? 'layer detail' : 'single unit'; },
  };
}
