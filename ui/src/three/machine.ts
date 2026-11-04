// Machine Room board. Blocks are the components. Small spheres are bus packets.
// Zoom cubes are the selected gadget's weights, gates, or simulated voltage samples.
import * as THREE from 'three/webgpu';
import type { Stage } from './stage';

export interface BoardBlock { id: string; name: string; x: number; y: number; z: number; color: number }
export interface PacketMark { id: number; x: number; y: number; z: number; drop: boolean; live: boolean }
export interface ZoomCube { x: number; y: number; z: number; color: number }

const MAX_PK = 48;
const MAX_Z = 64;

export interface MachineScene {
  show(selected: string, packets: PacketMark[], fb: number[] | null, cubes: ZoomCube[]): void;
  pickables(): THREE.Object3D[];
  decode(hit: THREE.Intersection): { component: string } | null;
  aim(): { at: THREE.Vector3; dist: number };
  dispose(): void;
}

export function createMachine(st: Stage, blocks: BoardBlock[]): MachineScene {
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(12.5, 0.12, 8.2),
    new THREE.MeshBasicMaterial({ color: 0x0f172a }),
  );
  board.position.set(0.2, -0.2, 0.4);
  st.scene.add(board);

  const bodies: THREE.Mesh[] = [];
  const labelGeo = new THREE.PlaneGeometry(1.5, 0.38);
  for (const b of blocks) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 0.85), new THREE.MeshBasicMaterial({ color: b.color }));
    mesh.position.set(b.x, b.y, b.z);
    mesh.userData.component = b.id;
    st.scene.add(mesh);
    bodies.push(mesh);
    const origin = new THREE.Vector3(b.x, b.y, b.z);
    const hub = new THREE.Vector3(-2.2, 0.15, 0.2);
    if (b.id !== 'cpu') {
      const dir = origin.clone().sub(hub);
      const len = dir.length();
      const link = new THREE.Mesh(new THREE.BoxGeometry(1, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0x334155 }));
      link.position.copy(hub.clone().add(origin).multiplyScalar(0.5));
      link.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
      link.scale.set(len, 1, 1);
      st.scene.add(link);
    }
    const tag = document.createElement('canvas');
    tag.width = 256; tag.height = 64;
    const g = tag.getContext('2d');
    if (g) {
      g.fillStyle = '#020617';
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#e2e8f0';
      g.font = '600 28px sans-serif';
      g.textAlign = 'center';
      g.fillText(b.name, 128, 42);
    }
    const plane = new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tag), transparent: true }));
    plane.position.set(b.x, b.y + 0.62, b.z);
    plane.rotation.x = -0.85;
    st.scene.add(plane);
  }

  const fbData = new Uint8Array(32 * 32 * 4);
  const fbTex = new THREE.DataTexture(fbData, 32, 32);
  fbTex.magFilter = THREE.NearestFilter;
  fbTex.minFilter = THREE.NearestFilter;
  fbTex.needsUpdate = true;
  const fbBody = bodies.find((m) => m.userData.component === 'fb');
  if (fbBody) (fbBody.material as THREE.MeshBasicMaterial).map = fbTex;

  const pkGeo = new THREE.SphereGeometry(0.22, 12, 10);
  const packets: THREE.Mesh[] = [];
  for (let i = 0; i < MAX_PK; i++) {
    const s = new THREE.Mesh(pkGeo, new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
    s.visible = false;
    st.scene.add(s);
    packets.push(s);
  }
  const cubeGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const cubes: THREE.Mesh[] = [];
  for (let i = 0; i < MAX_Z; i++) {
    const c = new THREE.Mesh(cubeGeo, new THREE.MeshBasicMaterial({ color: 0x2dd4bf }));
    c.visible = false;
    st.scene.add(c);
    cubes.push(c);
  }
  const ring = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.7, 1.05), new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true }));
  ring.visible = false;
  st.scene.add(ring);

  return {
    show(selected, marks, fb, zoomCubes) {
      for (const mesh of bodies) {
        const on = mesh.userData.component === selected;
        mesh.scale.setScalar(on ? 1.12 : 1);
        if (on) ring.position.copy(mesh.position);
      }
      ring.visible = true;
      if (fb && fbBody) {
        for (let i = 0; i < 32 * 32; i++) {
          const v = fb[i] ?? 0;
          fbData[i * 4] = v;
          fbData[i * 4 + 1] = Math.min(255, v + 30);
          fbData[i * 4 + 2] = 48;
          fbData[i * 4 + 3] = 255;
        }
        fbTex.needsUpdate = true;
      }
      packets.forEach((s) => { s.visible = false; });
      marks.slice(0, MAX_PK).forEach((p, i) => {
        const s = packets[i]!;
        s.visible = true;
        s.position.set(p.x, p.y, p.z);
        (s.material as THREE.MeshBasicMaterial).color.set(p.drop ? 0xfb7185 : 0xf97316);
      });
      cubes.forEach((c) => { c.visible = false; });
      zoomCubes.slice(0, MAX_Z).forEach((c, i) => {
        const mesh = cubes[i]!;
        mesh.visible = true;
        mesh.position.set(c.x, c.y, c.z);
        (mesh.material as THREE.MeshBasicMaterial).color.set(c.color);
      });
    },
    pickables: () => bodies,
    decode(hit) {
      const id = hit.object.userData.component as string | undefined;
      return id ? { component: id } : null;
    },
    aim() { return { at: new THREE.Vector3(0.2, 0.4, 0.3), dist: 16 }; },
    dispose() {
      fbTex.dispose();
    },
  };
}
