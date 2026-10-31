// 3D view: layer stack (heads, neurons, residual stream) + real weight matrix as height-field / point cloud.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CFG } from './model.js?v=15';
import { getMat } from './surgery.js?v=15';
const { L, H, ff, d } = CFG, GAP = 2.4;
export class Viz {
  constructor(canvas, onPick) {
    this.onPick = onPick; const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.75;
    const s = (this.scene = new THREE.Scene()); this.bgTex = backdrop(); s.background = this.bgTex; s.fog = new THREE.FogExp2(0x070b14, 0.011);
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.cam = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 500); this.cam.position.set(-8, 10, 34);
    this.ctl = new OrbitControls(this.cam, canvas); this.ctl.target.set(4, 5, 0); this.ctl.enableDamping = true;
    s.add(new THREE.AmbientLight(0xb8c8ff, 0.55)); const dl = new THREE.DirectionalLight(0xfff4e6, 1.6); dl.position.set(10, 30, 20); s.add(dl);
    const rim = new THREE.DirectionalLight(0x4fd8c4, 0.9); rim.position.set(-14, 8, -18); s.add(rim); const fill = new THREE.PointLight(0x8ea2ff, 30, 70); fill.position.set(14, 6, 16); s.add(fill);
    this.heads = []; this.neur = []; this.slabs = []; this.halos = []; this.deco = [];
    const hg = new THREE.SphereGeometry(0.22, 24, 16), dot = softDot(), haloTex = softDot(true);
    const grid = new THREE.GridHelper(40, 40, 0x24406a, 0x121c30); grid.position.set(2, -1.0, 0); grid.material.transparent = true; grid.material.opacity = 0.45; grid.userData.noFit = true; s.add(grid); this.deco.push(grid);
    for (let l = 0; l < L; l++) {
      const y = l * GAP + 0.6; const sg = new THREE.BoxGeometry(9, 0.05, 4.2), slab = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x14203a, transparent: true, opacity: 0.42, roughness: 0.25, metalness: 0.35, depthWrite: false })); slab.position.set(0, y - 0.3, 0); s.add(slab); this.slabs.push(slab);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(sg), new THREE.LineBasicMaterial({ color: 0x4fd8c4, transparent: true, opacity: 0.22 })); edge.position.copy(slab.position); s.add(edge); this.deco.push(edge);
      const lab = textSprite('L' + l); lab.position.set(-5.4, y - 0.15, 1.9); s.add(lab); this.deco.push(lab);
      const row = []; for (let h = 0; h < H; h++) { const m = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ color: 0x51627f, emissive: 0x000000, roughness: 0.32, metalness: 0.15 })); m.position.set(-4 + h * 0.53, y, 1.6); m.userData = { type: 'head', l, h }; s.add(m); row.push(m);
        const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xf472b6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); hs.scale.setScalar(1.3); hs.position.copy(m.position); hs.raycast = () => {}; s.add(hs); this.deco.push(hs); this.halos.push(hs); } this.heads.push(row);
      const pos = new Float32Array(ff * 3), col = new Float32Array(ff * 3); for (let n = 0; n < ff; n++) { const cx = n % 64, cz = (n / 64) | 0; pos[n * 3] = -4 + cx * 0.127; pos[n * 3 + 1] = y; pos[n * 3 + 2] = -1.8 + cz * 0.18; col[n * 3 + 2] = 0.25; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, map: dot, transparent: true, alphaTest: 0.02, blending: THREE.AdditiveBlending, depthWrite: false })); pts.userData = { type: 'neurons', l }; s.add(pts); this.neur.push(pts);
    }
    // residual stream: one cylinder segment per slot, radius ∝ ‖x‖
    this.res = []; for (let i = 0; i <= L; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, GAP * 0.9, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x4fd8c4, emissive: 0x0f5a50, emissiveIntensity: 1.2, transparent: true, opacity: 0.55, roughness: 0.3, depthWrite: false })); c.position.set(4.9, i * GAP - 0.6, 0); c.scale.set(0.15, 1, 0.15); s.add(c); this.res.push(c); }
    this.sel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 24), new THREE.MeshBasicMaterial({ color: 0xfbbf24 })); s.add(this.sel); this.sel.visible = false;
    this.wobj = null; this.wmode = 'height'; this.diff = false; this.wlabel = null;
    const ray = new THREE.Raycaster(), mv = new THREE.Vector2(); let down = null;
    canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
    canvas.addEventListener('pointerup', (e) => { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return; mv.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mv, this.cam); ray.params.Points.threshold = 0.06;
      const hit = ray.intersectObjects([...this.heads.flat(), ...this.neur, ...this.slabs])[0]; if (!hit) return; const u = hit.object.userData;
      if (u.type === 'head') this.onPick({ l: u.l, h: u.h }); else if (u.type === 'neurons') this.onPick({ l: u.l, n: hit.index }); else { const l = this.slabs.indexOf(hit.object); if (l >= 0) this.onPick({ l }); } });
    addEventListener('resize', () => { r.setSize(innerWidth, innerHeight); this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); });
    this.ctl.dampingFactor = this.reduced ? 0.5 : 0.08; this.ctl.minDistance = 4; this.ctl.maxDistance = 140;
    const loop = () => { requestAnimationFrame(loop); if (document.hidden) return; this.ctl.update(); r.render(s, this.cam); }; loop();
  }
  select(sel) { const l = sel.l ?? 0; this.slabs.forEach((s, i) => s.material.color.setHex(i === l ? 0x23406a : 0x14203a)); if (sel.h != null) { this.sel.visible = true; this.sel.position.copy(this.heads[l][sel.h].position); this.sel.rotation.x = Math.PI / 2; } else this.sel.visible = false; }
  // tr: a trace of one position (last token). Head glow = ‖z_h‖, neuron color = activation, stream radius = ‖resid‖
  activations(tr) {
    if (!tr) return; const norms = [tr.embed, ...tr.resid_post].map((v) => Math.hypot(...v)); const mxn = Math.max(...norms);
    this.res.forEach((c, i) => { const v = norms[Math.min(i, norms.length - 1)] / mxn; c.scale.set(0.08 + 0.5 * v, 1, 0.08 + 0.5 * v); });
    for (let l = 0; l < L; l++) { const s = tr.slotLayer.indexOf(l); const z = s >= 0 ? tr.z[s] : null, a = s >= 0 ? tr.mlp_act[s] : null;
      let mz = 1e-6; const hn = []; for (let h = 0; h < H; h++) { let n = 0; if (z) for (let i = h * 16; i < h * 16 + 16; i++) n += z[i] * z[i]; hn.push(Math.sqrt(n)); mz = Math.max(mz, hn[h]); }
      this.heads[l].forEach((m, h) => { const v = hn[h] / mz; m.material.emissive.setRGB(v * 0.95, v * 0.28, v * 0.62); m.scale.setScalar(0.6 + 0.8 * v); const hs = this.halos[l * H + h]; if (hs) { hs.material.opacity = 0.9 * v * v; hs.scale.setScalar(0.8 + 1.4 * v); } });
      const col = this.neur[l].geometry.attributes.color; for (let n = 0; n < ff; n++) { const v = a ? Math.tanh(a[n] / 1.5) : 0; col.array[n * 3] = v > 0 ? v : 0; col.array[n * 3 + 1] = Math.abs(v) * 0.8; col.array[n * 3 + 2] = v < 0 ? -v * 2 + 0.2 : 0.2; } col.needsUpdate = true; }
  }
  // Render a real weight matrix (current or diff vs original) beside the stack. Downsampled by max-|.| pooling to ≤ 128×128.
  weights(Wm, Wo, path, mode, diff) {
    if (this.wobj) { this.scene.remove(this.wobj); this.wobj.geometry.dispose(); this.wobj = null; }
    const { a, rows, cols } = getMat(Wm, path), o = getMat(Wo, path).a; const R = Math.min(128, rows), C = Math.min(128, cols), fr = rows / R, fc = cols / C;
    let sd = 0; for (let i = 0; i < Math.min(o.length, 200000); i++) sd += o[i] * o[i]; sd = Math.sqrt(sd / Math.min(o.length, 200000)) || 1;
    const vals = new Float32Array(R * C); for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { let best = 0; for (let ii = Math.floor(i * fr); ii < Math.floor((i + 1) * fr); ii++) for (let jj = Math.floor(j * fc); jj < Math.floor((j + 1) * fc); jj++) { const v = diff ? a[ii * cols + jj] - o[ii * cols + jj] : a[ii * cols + jj]; if (Math.abs(v) > Math.abs(best)) best = v; } vals[i * C + j] = best / sd; }
    const sx = 8 / C, sz = 8 / R, pos = new Float32Array(R * C * 3), col = new Float32Array(R * C * 3);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { const k = i * C + j, v = vals[k]; pos[k * 3] = j * sx; pos[k * 3 + 1] = Math.max(-3, Math.min(3, v * 0.35)); pos[k * 3 + 2] = i * sz; const t = Math.tanh(v / 2.5), u = Math.abs(t), hi = t > 0 ? [1.0, 0.62, 0.3] : [0.4, 0.66, 1.0]; col[k * 3] = 0.08 + (hi[0] - 0.08) * u; col[k * 3 + 1] = 0.11 + (hi[1] - 0.11) * u; col[k * 3 + 2] = 0.18 + (hi[2] - 0.18) * u; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (mode === 'height') { const idx = []; for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) { const k = i * C + j; idx.push(k, k + C, k + 1, k + 1, k + C, k + C + 1); } g.setIndex(idx); g.computeVertexNormals(); this.wobj = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.45, metalness: 0.1, flatShading: false })); }
    else this.wobj = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, vertexColors: true }));
    const m = path.match(/^L(\d)/); this.wobj.position.set(7, (m ? +m[1] : 0) * GAP + 0.6, -4); this.scene.add(this.wobj);
    return { rows, cols, R, C, sd };
  }
  setBg(light) { this.scene.background = light ? new THREE.Color(0xdfe6ef) : this.bgTex; this.scene.fog.color.setHex(light ? 0xdfe6ef : 0x070b14); for (const p of this.neur) p.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending; }
}

// soft round point / halo sprite (radial falloff), vertical gradient backdrop, and crisp text sprites for layer labels
function softDot(halo = false) { const n = 64, cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d'), g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  if (halo) { g.addColorStop(0, '#ffffffcc'); g.addColorStop(0.25, '#ffffff55'); g.addColorStop(1, '#ffffff00'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#ffffffd0'); g.addColorStop(0.75, '#ffffff40'); g.addColorStop(1, '#ffffff00'); }
  c.fillStyle = g; c.fillRect(0, 0, n, n); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function backdrop() { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 512; const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#0b1426'); g.addColorStop(0.55, '#070b14'); g.addColorStop(1, '#04060b'); c.fillStyle = g; c.fillRect(0, 0, 16, 512); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function textSprite(txt) { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d'); c.font = '600 34px "InterV",system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#9fb3d1'; c.fillText(txt, 64, 34);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.scale.set(1.1, 0.55, 1); sp.raycast = () => {}; return sp; }
