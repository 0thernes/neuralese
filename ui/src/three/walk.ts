// Deep-walk stage. Instanced blocks for tensors, bits, and gates. The voltage curve is the same
// blocks laid on a transfer characteristic. Large tensors are already sampled before they get here.
import * as THREE from 'three/webgpu';
import type { Stage } from './stage';
import type { WalkCell, WalkOp, WalkView, Zoom } from '../core/walk';

export interface GateBox { id: number; op: string; y: number }
export interface VoltPoint { vin: number; vout: number | null }

const MAX = 96;
const col = new THREE.Color();

function paint(v: number, max: number, light: boolean): THREE.Color {
  const t = max > 0 ? Math.max(-1, Math.min(1, v / max)) : 0;
  if (t >= 0) col.setRGB(0.08 + 0.15 * t, 0.45 + 0.4 * t, 0.48 + 0.15 * t);
  else col.setRGB(0.15 + 0.25 * -t, 0.28, 0.55 + 0.3 * -t);
  if (light) col.multiplyScalar(0.85);
  return col;
}

const GATE_COLOR: Record<string, number> = { AND: 0x2dd4bf, OR: 0xfbbf24, XOR: 0x38bdf8, NOT: 0xfb7185 };

export interface WalkScene {
  show(view: WalkView, zoom: Zoom, op: WalkOp | null, cell: WalkCell | null, gates: GateBox[] | null, curve: VoltPoint[] | null, light: boolean): void;
  pickables(): THREE.Object3D[];
  decode(hit: THREE.Intersection): { index: number } | null;
  aim(): { at: THREE.Vector3; dist: number };
  dispose(): void;
}

export function createWalk(st: Stage): WalkScene {
  const geo = new THREE.BoxGeometry(0.72, 0.72, 0.72);
  const pool: THREE.Mesh[] = [];
  for (let i = 0; i < MAX; i++) {
    const box = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    box.visible = false;
    box.frustumCulled = false;
    st.scene.add(box);
    pool.push(box);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.35, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.2;
  const ring = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.86, 0.86), new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true }));
  ring.visible = false;
  st.scene.add(floor, ring);
  let aimAt = new THREE.Vector3(0, 1, 0);
  let aimDist = 18;
  let used = 0;

  function hide(): void {
    for (const box of pool) box.visible = false;
    ring.visible = false;
    used = 0;
  }

  function put(i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.Color, tensorIndex: number): void {
    if (i >= MAX) return;
    const box = pool[i]!;
    box.visible = true;
    box.position.set(x, y, z);
    box.scale.set(sx, sy, sz);
    (box.material as THREE.MeshBasicMaterial).color.copy(color);
    box.userData.index = tensorIndex;
    used = Math.max(used, i + 1);
  }

  return {
    show(view, zoom, op, cell, gates, curve, light) {
      hide();
      const L = view.cfg.L;
      if (zoom === 'model') {
        for (let l = 0; l < L && l < MAX; l++) {
          const on = op?.layer === l;
          put(l, 0, l * 1.15, 0, on ? 4.2 : 3.4, on ? 0.72 : 0.5, on ? 2.2 : 1.7, col.set(on ? 0x14b8a6 : 0x1d4ed8), l);
        }
        aimAt = new THREE.Vector3(0, ((L - 1) * 1.15) / 2, 0);
        aimDist = 11;
      } else if (zoom === 'layer') {
        const layer = op?.layer ?? 0;
        const ops = view.ops.filter((o) => o.layer === layer && o.head == null);
        ops.forEach((o, i) => {
          const on = o.id === op?.id;
          put(i, (i - ops.length / 2) * 1.15, 0.4, 0, on ? 0.95 : 0.7, on ? 1.3 : 0.7, 0.7, col.set(on ? 0xfbbf24 : 0x2dd4bf), i);
        });
        aimAt = new THREE.Vector3(0, 0.4, 0);
        aimDist = 12;
      } else if (zoom === 'voltage' && curve?.length) {
        const finite = curve.filter((p) => p.vout != null) as { vin: number; vout: number }[];
        finite.forEach((p, i) => {
          const y = p.vout * 4;
          put(i, (i / Math.max(1, finite.length - 1) - 0.5) * 12, y, 0, 0.28, 0.28, 0.28, paint(p.vout - 0.5, 0.5, light), i);
        });
        aimAt = new THREE.Vector3(0, 2, 0);
        aimDist = 11;
      } else if (zoom === 'gates' && gates?.length) {
        const cols = 12;
        gates.slice(0, MAX).forEach((g, i) => {
          const x = (i % cols) - cols / 2;
          const z = Math.floor(i / cols) - 2;
          put(i, x * 0.9, 0.2 + g.y * 0.9, z * 0.9, 0.7, 0.45 + g.y * 0.5, 0.7, col.set(GATE_COLOR[g.op] ?? 0x94a3b8), g.id);
        });
        aimAt = new THREE.Vector3(0, 0.6, 0);
        aimDist = 10;
      } else if (zoom === 'float' && cell?.float) {
        const bits = cell.float.prod.bits;
        for (let i = 0; i < 32 && i < MAX; i++) {
          const on = bits[i] === '1';
          const region = i === 0 ? 0 : i < 9 ? 1 : 2;
          const x = (i - 16) * 0.55;
          put(i, x, on ? 0.9 : 0.15, region === 0 ? 0.8 : region === 1 ? 0 : -0.6, 0.42, on ? 1.1 : 0.35, 0.42, col.set(region === 0 ? 0xfb7185 : region === 1 ? 0xfbbf24 : 0x2dd4bf), i);
        }
        aimAt = new THREE.Vector3(0, 0.5, 0);
        aimDist = 12;
      } else if (zoom === 'dot' && cell?.terms.length) {
        const terms = cell.terms.slice(0, MAX);
        const max = Math.max(...terms.map((t) => Math.abs(t.prod)), 1e-8);
        terms.forEach((t, i) => {
          const h = 0.3 + 2.2 * (Math.abs(t.prod) / max);
          put(i, (i - terms.length / 2) * 0.95, h / 2, 0, 0.6, h, 0.6, paint(t.prod, max, light), t.j);
        });
        aimAt = new THREE.Vector3(0, 1, 0);
        aimDist = 9;
      } else if (op) {
        const vals = op.shown.map((v) => v ?? 0);
        const max = Math.max(...vals.map((v) => Math.abs(v)), 1e-8);
        const cols = zoom === 'unit' ? 8 : 12;
        const n = Math.min(vals.length, MAX);
        for (let i = 0; i < n; i++) {
          const v = vals[i] ?? 0;
          const x = (i % cols) - (cols - 1) / 2;
          const z = Math.floor(i / cols) - 1.5;
          const h = 0.25 + 1.8 * (Math.abs(v) / max);
          put(i, x * 0.85, h / 2, z * 0.85, 0.62, h, 0.62, paint(v, max, light), op.indices[i] ?? i);
        }
        aimAt = new THREE.Vector3(0, 0.8, 0);
        aimDist = zoom === 'matmul' ? 8 : 10;
      }
      if (used > 0) {
        ring.visible = zoom === 'matmul' || zoom === 'unit' || zoom === 'dot';
        ring.position.copy(aimAt);
      }
    },
    pickables: () => pool.filter((b) => b.visible),
    decode(hit) {
      const index = (hit.object.userData as { index?: number }).index;
      return index == null ? null : { index };
    },
    aim: () => ({ at: aimAt, dist: aimDist }),
    dispose() {
      geo.dispose();
      for (const box of pool) { (box.material as THREE.Material).dispose(); box.removeFromParent(); }
      (floor.material as THREE.Material).dispose(); floor.geometry.dispose();
      (ring.material as THREE.Material).dispose(); ring.geometry.dispose();
      floor.removeFromParent(); ring.removeFromParent();
    },
  };
}
