// 3D view: layer stack (heads, neurons, residual stream) + real weight matrix as height-field / point cloud.
// v15.1: instanced heads, animated activation flow along head→residual edges (intensity = live ‖z_h‖), custom post chain
// (bloom + depth of field, adaptive quality), hover picking with info cards, smooth camera fly-to, fps meter.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CFG } from './model.js?v=170';
import { getMat } from './surgery.js?v=170';
import { Post } from './post.js?v=170';
import { classifyGpu, startLevel, readRenderer, store, LADDER } from './ui152.js?v=170';
const { L, H, ff, d } = CFG, GAP = 2.4, RX = 4.9;
const headPos = (l, h) => new THREE.Vector3(-4 + h * 0.53, l * GAP + 0.6, 1.6);
export class Viz {
  constructor(canvas, onPick) {
    this.onPick = onPick; const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })); this.dpr = Math.min(devicePixelRatio, 2); r.setPixelRatio(this.dpr); r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.75; this.rawRender = r.render.bind(r);
    const s = (this.scene = new THREE.Scene()); this.bgTex = backdrop(); s.background = this.bgTex; s.fog = new THREE.FogExp2(0x070b14, 0.011);
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.cam = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 500); this.cam.position.set(-8, 10, 34);
    this.ctl = new OrbitControls(this.cam, canvas); this.ctl.target.set(4, 5, 0); this.ctl.enableDamping = true;
    s.add(new THREE.AmbientLight(0xb8c8ff, 0.55)); const dl = new THREE.DirectionalLight(0xfff4e6, 1.6); dl.position.set(10, 30, 20); s.add(dl);
    const rim = new THREE.DirectionalLight(0x4fd8c4, 0.9); rim.position.set(-14, 8, -18); s.add(rim); const fill = new THREE.PointLight(0x8ea2ff, 30, 70); fill.position.set(14, 6, 16); s.add(fill);
    this.heads = []; this.neur = []; this.slabs = []; this.halos = []; this.deco = []; this.last = { hn: [], act: [], norms: [] };
    const dot = softDot(), haloTex = softDot(true);
    const grid = new THREE.GridHelper(40, 40, 0x24406a, 0x121c30); grid.position.set(2, -1.0, 0); grid.material.transparent = true; grid.material.opacity = 0.45; grid.userData.noFit = true; s.add(grid); this.deco.push(grid);
    // heads: one InstancedMesh for all L×H spheres (per-instance colour + scale); this.heads keeps lightweight proxies (position + userData)
    const him = (this.headIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.15 }), L * H)); him.userData = { type: 'headIM' };
    const m4 = new THREE.Matrix4(), base = new THREE.Color(0x51627f); for (let l = 0; l < L; l++) for (let h = 0; h < H; h++) { m4.makeTranslation(headPos(l, h)); him.setMatrixAt(l * H + h, m4); him.setColorAt(l * H + h, base); }
    him.instanceMatrix.needsUpdate = true; him.instanceColor.needsUpdate = true; s.add(him); this.deco.push(him);
    for (let l = 0; l < L; l++) {
      const y = l * GAP + 0.6; const sg = new THREE.BoxGeometry(9, 0.05, 4.2), slab = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x14203a, transparent: true, opacity: 0.42, roughness: 0.25, metalness: 0.35, depthWrite: false })); slab.position.set(0, y - 0.3, 0); slab.userData = { type: 'slab', l }; s.add(slab); this.slabs.push(slab);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(sg), new THREE.LineBasicMaterial({ color: 0x4fd8c4, transparent: true, opacity: 0.22 })); edge.position.copy(slab.position); s.add(edge); this.deco.push(edge);
      const lab = textSprite('L' + l); lab.position.set(-5.4, y - 0.15, 1.9); s.add(lab); this.deco.push(lab);
      const row = []; for (let h = 0; h < H; h++) { const o = new THREE.Object3D(); o.position.copy(headPos(l, h)); o.userData = { type: 'head', l, h }; row.push(o);
        const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: 0xf472b6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); hs.scale.setScalar(1.3); hs.position.copy(o.position); hs.raycast = () => {}; s.add(hs); this.deco.push(hs); this.halos.push(hs); } this.heads.push(row);
      const pos = new Float32Array(ff * 3), col = new Float32Array(ff * 3); for (let n = 0; n < ff; n++) { const cx = n % 64, cz = (n / 64) | 0; pos[n * 3] = -4 + cx * 0.127; pos[n * 3 + 1] = y; pos[n * 3 + 2] = -1.8 + cz * 0.18; col[n * 3 + 2] = 0.25; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, map: dot, transparent: true, alphaTest: 0.02, blending: THREE.AdditiveBlending, depthWrite: false })); pts.userData = { type: 'neurons', l }; s.add(pts); this.neur.push(pts);
    }
    // residual stream: one cylinder segment per slot, radius ∝ ‖x‖
    this.res = []; for (let i = 0; i <= L; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, GAP * 0.9, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x4fd8c4, emissive: 0x0f5a50, emissiveIntensity: 1.2, transparent: true, opacity: 0.55, roughness: 0.3, depthWrite: false })); c.position.set(RX, i * GAP - 0.6, 0); c.scale.set(0.15, 1, 0.15); c.userData = { type: 'resid', i }; s.add(c); this.res.push(c); }
    this.flow = flowField(dot); s.add(this.flow.lines, this.flow.pts); this.deco.push(this.flow.lines, this.flow.pts);
    this.sel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 24), new THREE.MeshBasicMaterial({ color: 0xfbbf24 })); s.add(this.sel); this.sel.visible = false;
    this.wobj = null; this.wmode = 'height'; this.diff = false; this.wlabel = null;
    const ray = new THREE.Raycaster(), mv = new THREE.Vector2(); let down = null, hovT = 0;
    const pick = (e) => { mv.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mv, this.cam); ray.params.Points.threshold = 0.06; if (!this.headIM.visible) return null;
      const hit = ray.intersectObjects([this.headIM, ...this.neur, ...this.slabs, ...this.res])[0]; if (!hit) return null; const u = hit.object.userData;
      if (u.type === 'headIM') { const l = (hit.instanceId / H) | 0; return { l, h: hit.instanceId % H }; } if (u.type === 'neurons') return { l: u.l, n: hit.index }; if (u.type === 'resid') return { resid: u.i }; return { l: u.l }; };
    canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
    canvas.addEventListener('pointerup', (e) => { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return; const p = pick(e); if (!p || p.resid != null) return; this.onPick(p); this.flyTo(p.l); });
    canvas.addEventListener('pointermove', (e) => { if (e.buttons) return this.card(null); const t = performance.now(); if (t - hovT < 45) return; hovT = t; const p = pick(e); this.card(p, e); canvas.style.cursor = p ? 'pointer' : ''; });
    canvas.addEventListener('pointerleave', () => this.card(null));
    this.post = new Post(r, this.rawRender); this.fx = { bloom: true, dof: true, auto: true }; this.light = false;
    this.gpu = readRenderer(r.getContext()); this.tier = classifyGpu(this.gpu, navigator.hardwareConcurrency || 8, navigator.deviceMemory || 8, matchMedia('(pointer: coarse)').matches);
    { const lv = startLevel(this.tier, parseInt(store.get('neuralese.q3d'), 10)); if (lv > 0) this.setLevel(lv, this.tier === 'high' ? 'saved from last session' : `${this.tier}-tier GPU default`); }
    const resize = () => { r.setSize(innerWidth, innerHeight); this.post.setSize(innerWidth, innerHeight, r.getPixelRatio()); this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); }; addEventListener('resize', resize); resize();
    this.ctl.dampingFactor = this.reduced ? 0.5 : 0.08; this.ctl.minDistance = 4; this.ctl.maxDistance = 140;
    // frame timing → fps meter + adaptive quality (drop DoF, then bloom, then pixel ratio when the 2 s average falls under target)
    const ft = (this.ft = { n: 0, t0: performance.now(), fps: 0, ms: 0, hist: [] }); let prev = performance.now(), tFlow = 0;
    const loop = () => { requestAnimationFrame(loop); if (document.hidden) return; const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000); prev = now; if (!this.reduced) tFlow += dt;
      const c0 = performance.now(); this.tick(now); this.flow.mat.uniforms.t.value = tFlow; this.ctl.update(); this.render(); const cpu = performance.now() - c0;
      ft.n++; ft.ms += cpu; if (now - ft.t0 >= 1000) { ft.fps = (ft.n * 1000) / (now - ft.t0); ft.cpu = ft.ms / ft.n; ft.hist.push(ft.fps); if (ft.hist.length > 6) ft.hist.shift(); ft.n = 0; ft.ms = 0; ft.t0 = now; this.adapt(); } }; loop();
  }
  render() { const usePost = !this.light && (this.fx.bloom || this.fx.dof) && this.post.ok; if (!usePost) return this.renderer.render(this.scene, this.cam);
    const dist = this.cam.position.distanceTo(this.ctl.target); this.post.render(this.scene, this.cam, { bloom: this.fx.bloom ? 0.85 : 0, dof: this.fx.dof ? 1 : 0, focus: dist, range: Math.max(6, dist * 0.55) }, this.renderer.render.bind(this.renderer)); }
  // v15.2: one quality ladder (ui152.LADDER). Start level = max(GPU-tier default, level the adaptive loop settled on last
  // session), so weak/software GPUs start light instead of stuttering for the first seconds; drops are persisted.
  setLevel(i, why) { const q = LADDER[i]; this.level = i; this.fx.bloom = q.bloom; this.fx.dof = q.dof; const px = Math.min(this.dpr, q.px);
    if (this.renderer.getPixelRatio() !== px) { this.renderer.setPixelRatio(px); window.dispatchEvent(new Event('resize')); } this.quality = q.name + (why ? ` · ${why}` : ''); }
  adapt() { if (!this.fx.auto || this.ft.hist.length < 3) return; const avg = this.ft.hist.slice(-3).reduce((a, b) => a + b, 0) / 3; if (avg >= 50) return; this.ft.hist.length = 0;
    const cur = this.fx.dof ? 0 : this.fx.bloom ? 1 : this.renderer.getPixelRatio() > 1 ? 2 : 3; if (cur >= LADDER.length - 1) return;
    this.setLevel(cur + 1, `auto (${avg.toFixed(0)} fps)`); store.set('neuralese.q3d', String(this.level)); }
  fps() { return { fps: +this.ft.fps.toFixed(1), cpuMs: +(this.ft.cpu || 0).toFixed(2), quality: this.quality || 'full (bloom + DoF)', fx: { ...this.fx }, pixelRatio: this.renderer.getPixelRatio(), tier: this.tier, level: this.level || 0 }; }
  // smooth camera fly-to a layer (keeps the viewing direction; eased; instant under reduced motion)
  flyTo(l) { if (l == null || (this.mode3d && this.mode3d !== 'stack')) return; const q1 = new THREE.Vector3(1.5, l * GAP + 0.6, 0.4), off = this.cam.position.clone().sub(this.ctl.target), len = Math.max(12, Math.min(off.length() * 0.8, 26)), p1 = q1.clone().add(off.setLength(len));
    if (this.reduced) { this.ctl.target.copy(q1); this.cam.position.copy(p1); return; } this.fly = { t0: performance.now(), ms: 850, p0: this.cam.position.clone(), q0: this.ctl.target.clone(), p1, q1 }; }
  tick(now) { const f = this.fly; if (!f) return; const t = Math.min(1, (now - f.t0) / f.ms), e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; this.cam.position.lerpVectors(f.p0, f.p1, e); this.ctl.target.lerpVectors(f.q0, f.q1, e); if (t >= 1) this.fly = null; }
  // hover info card (DOM), positioned next to the pointer and clamped to the viewport
  card(p, e) { let el = document.getElementById('hov3d'); if (!p) { if (el) el.classList.remove('on'); return; } if (!el) { el = document.createElement('div'); el.id = 'hov3d'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    const L0 = this.last; let h = '';
    if (p.h != null) { const v = L0.hn[p.l]?.[p.h], row = L0.hn[p.l] || [], rk = v != null ? row.filter((x) => x > v).length + 1 : null; h = `<b>Head L${p.l}·H${p.h}</b><div class="kv"><span>‖z<sub>h</sub>‖ (last token)</span><i>${v != null ? v.toFixed(3) : '—'}</i><span>rank in layer</span><i>${rk ? rk + ' / ' + H : '—'}</i></div><em>click to select · inspect in Attention / Heads</em>`; }
    else if (p.n != null) { const a = L0.act[p.l]?.[p.n]; h = `<b>Neuron L${p.l}·N${p.n}</b><div class="kv"><span>MLP activation</span><i>${a != null ? (+a).toFixed(3) : '—'}</i><span>sign</span><i>${a == null ? '—' : a > 0 ? 'positive (red)' : 'negative (blue)'}</i></div><em>click to select · open in Neuron Lens</em>`; }
    else if (p.resid != null) { const v = L0.norms[p.resid]; h = `<b>Residual stream · slot ${p.resid}</b><div class="kv"><span>‖x‖</span><i>${v != null ? v.toFixed(2) : '—'}</i><span>stage</span><i>${p.resid === 0 ? 'embedding' : 'after block ' + (p.resid - 1)}</i></div>`; }
    else h = `<b>Layer ${p.l}</b><div class="kv"><span>heads</span><i>${H}</i><span>MLP neurons</span><i>${ff}</i><span>d_model</span><i>${d}</i></div><em>click to select the layer</em>`;
    el.innerHTML = h; el.classList.add('on'); const w = el.offsetWidth || 220, hh = el.offsetHeight || 90; el.style.left = Math.max(6, Math.min(e.clientX + 16, innerWidth - w - 8)) + 'px'; el.style.top = Math.max(50, Math.min(e.clientY + 16, innerHeight - hh - 8)) + 'px'; }
  select(sel) { const l = sel.l ?? 0; this.slabs.forEach((s, i) => s.material.color.setHex(i === l ? 0x23406a : 0x14203a)); if (sel.h != null) { this.sel.visible = true; this.sel.position.copy(this.heads[l][sel.h].position); this.sel.rotation.x = Math.PI / 2; } else this.sel.visible = false; }
  // tr: a trace of one position (last token). Head glow = ‖z_h‖, neuron color = activation, stream radius = ‖resid‖, flow speed/brightness = ‖z_h‖
  activations(tr) {
    if (!tr) return; const norms = [tr.embed, ...tr.resid_post].map((v) => Math.hypot(...v)); const mxn = Math.max(...norms); this.last.norms = norms;
    this.res.forEach((c, i) => { const v = norms[Math.min(i, norms.length - 1)] / mxn; c.scale.set(0.08 + 0.5 * v, 1, 0.08 + 0.5 * v); });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color(), cold = new THREE.Color(0x51627f), hot = new THREE.Color(0xff5fb0), amp = this.flow.amp;
    for (let l = 0; l < L; l++) { const s = tr.slotLayer.indexOf(l); const z = s >= 0 ? tr.z[s] : null, a = s >= 0 ? tr.mlp_act[s] : null;
      let mz = 1e-6; const hn = []; for (let h = 0; h < H; h++) { let n = 0; if (z) for (let i = h * 16; i < h * 16 + 16; i++) n += z[i] * z[i]; hn.push(Math.sqrt(n)); mz = Math.max(mz, hn[h]); } this.last.hn[l] = hn; this.last.act[l] = a ? Array.from(a) : null;
      for (let h = 0; h < H; h++) { const v = hn[h] / mz, k = l * H + h; sc.setScalar(0.6 + 0.8 * v); m4.compose(headPos(l, h), q, sc); this.headIM.setMatrixAt(k, m4); col.copy(cold).lerp(hot, v).multiplyScalar(1 + 1.6 * v * v); this.headIM.setColorAt(k, col);
        const hs = this.halos[k]; if (hs) { hs.material.opacity = 0.9 * v * v; hs.scale.setScalar(0.8 + 1.4 * v); } for (let j = 0; j < this.flow.per; j++) amp.array[k * this.flow.per + j] = z ? 0.08 + v * v : 0.04; }
      const cc = this.neur[l].geometry.attributes.color; for (let n = 0; n < ff; n++) { const v = a ? Math.tanh(a[n] / 1.5) : 0; cc.array[n * 3] = v > 0 ? v : 0; cc.array[n * 3 + 1] = Math.abs(v) * 0.8; cc.array[n * 3 + 2] = v < 0 ? -v * 2 + 0.2 : 0.2; } cc.needsUpdate = true; }
    for (let j = L * H * this.flow.per; j < amp.count; j++) amp.array[j] = 0.25 + 0.75 * (norms[Math.min(norms.length - 1, Math.floor(((j - L * H * this.flow.per) / (amp.count - L * H * this.flow.per)) * norms.length))] / mxn);
    amp.needsUpdate = true; this.headIM.instanceMatrix.needsUpdate = true; this.headIM.instanceColor.needsUpdate = true;
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('nl-act', { detail: { hn: this.last.hn.map((r) => { const m = Math.max(...r, 1e-6); return r.map((x) => x / m); }) } }));
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
  setBg(light) { this.light = !!light; this.scene.background = light ? new THREE.Color(0xdfe6ef) : this.bgTex; this.scene.fog.color.setHex(light ? 0xdfe6ef : 0x070b14); for (const p of this.neur) p.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending; }
}

// activation-flow field: faint static edges head → residual stream (+ the stream itself), and additive particles that
// travel along them in a vertex shader (position = mix(a, b, fract(phase + t·speed)) with an arc); amp = live intensity.
function flowField(tex) {
  const PER = 4, COL = 160, edges = []; for (let l = 0; l < L; l++) for (let h = 0; h < H; h++) { const a = headPos(l, h); edges.push([a, new THREE.Vector3(RX, a.y + 0.1, 0), [1.0, 0.42, 0.75]]); }
  const nE = edges.length, N = nE * PER + COL, a0 = new Float32Array(N * 3), a1 = new Float32Array(N * 3), ph = new Float32Array(N), sp = new Float32Array(N), cl = new Float32Array(N * 3), am = new Float32Array(N).fill(0.06), lp = [];
  let k = 0; for (const [a, b, c] of edges) { lp.push(a.x, a.y, a.z, b.x, b.y, b.z); for (let j = 0; j < PER; j++, k++) { a.toArray(a0, k * 3); b.toArray(a1, k * 3); ph[k] = j / PER + Math.random() * 0.1; sp[k] = 0.32; cl.set(c, k * 3); } }
  for (let j = 0; j < COL; j++, k++) { a0.set([RX, -1.6, 0], k * 3); a1.set([RX, L * GAP - 0.4, 0], k * 3); ph[k] = j / COL; sp[k] = 0.07; cl.set([0.31, 0.85, 0.77], k * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a0, 3)); g.setAttribute('b', new THREE.BufferAttribute(a1, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); g.setAttribute('sp', new THREE.BufferAttribute(sp, 1)); g.setAttribute('c', new THREE.BufferAttribute(cl, 3)); const amp = new THREE.BufferAttribute(am, 1); amp.setUsage(THREE.DynamicDrawUsage); g.setAttribute('amp', amp);
  const mat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, map: { value: tex }, px: { value: Math.min(devicePixelRatio, 2) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 b; attribute float ph, sp, amp; attribute vec3 c; uniform float t, px; varying vec3 vc; varying float va; void main(){ float f = fract(ph + t * sp * (0.6 + amp)); vec3 p = mix(position, b, f); p.y += sin(f * 3.14159) * 0.35 * step(0.2, sp); va = amp * sin(f * 3.14159); vc = c; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = px * (2.0 + 9.0 * amp) * (12.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vc; varying float va; void main(){ vec4 m = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vc * (0.5 + 2.2 * va), m.a * clamp(va * 1.6, 0.0, 1.0)); }' });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.raycast = () => {}; pts.userData.noFit = true;
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x8ea2ff, transparent: true, opacity: 0.07, depthWrite: false })); lines.raycast = () => {}; lines.userData.noFit = true;
  return { pts, lines, mat, amp, per: PER };
}

// soft round point / halo sprite (radial falloff), vertical gradient backdrop, and crisp text sprites for layer labels
function softDot(halo = false) { const n = 64, cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d'), g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  if (halo) { g.addColorStop(0, '#ffffffcc'); g.addColorStop(0.25, '#ffffff55'); g.addColorStop(1, '#ffffff00'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#ffffffd0'); g.addColorStop(0.75, '#ffffff40'); g.addColorStop(1, '#ffffff00'); }
  c.fillStyle = g; c.fillRect(0, 0, n, n); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function backdrop() { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 512; const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#0b1426'); g.addColorStop(0.55, '#070b14'); g.addColorStop(1, '#04060b'); c.fillStyle = g; c.fillRect(0, 0, 16, 512); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function textSprite(txt) { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const c = cv.getContext('2d'); c.font = '600 34px "InterV",system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#9fb3d1'; c.fillText(txt, 64, 34);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.scale.set(1.1, 0.55, 1); sp.raycast = () => {}; return sp; }
