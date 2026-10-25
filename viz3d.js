// v6 3D modes on top of the base Viz scene: weight voxel field (instanced + LOD), loss surface, residual manifold,
// 3D attention graph, 3D circuit graph. Smooth camera tweens, morph transitions, metric-mapped color scales, per-token animation.
import * as THREE from 'three';
const VIR = [[68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142], [31, 158, 137], [53, 183, 121], [109, 205, 89], [180, 222, 44], [253, 231, 37]];
export function viridis(t) { t = Math.max(0, Math.min(1, t)) * (VIR.length - 1); const i = Math.min(VIR.length - 2, Math.floor(t)), f = t - i, a = VIR[i], b = VIR[i + 1]; return new THREE.Color((a[0] + f * (b[0] - a[0])) / 255, (a[1] + f * (b[1] - a[1])) / 255, (a[2] + f * (b[2] - a[2])) / 255); }
export function diverge(x) { x = Math.max(-1, Math.min(1, x)); return x >= 0 ? new THREE.Color(0.95, 0.95 - 0.7 * x, 0.95 - 0.8 * x) : new THREE.Color(0.95 + 0.8 * x, 0.95 + 0.45 * x, 0.95); }
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const PRESETS = { stack: [[-8, 10, 34], [4, 5, 0]], top: [[2, 46, 0.1], [2, 6, 0]], side: [[40, 9, 0], [2, 9, 0]], front: [[2, 9, 38], [2, 9, 0]], iso: [[26, 26, 26], [2, 6, 0]], field: [[4, 18, 22], [4, 0, 4]], surface: [[12, 14, 14], [0, 1, 0]], manifold: [[14, 10, 14], [0, 0, 0]], attn: [[0, 8, 20], [0, 0, 0]], circuit: [[-10, 12, 26], [8, 9, 0]] };
export function installModes(viz) {
  const s = viz.scene; s.add(new THREE.HemisphereLight(0x9fd8ff, 0x1a1030, 0.55)); const pl = new THREE.PointLight(0xf472b6, 40, 80); pl.position.set(-12, 18, 10); s.add(pl);
  const base = () => [...viz.heads.flat(), ...viz.neur, ...viz.slabs, ...viz.res, viz.sel, viz.wobj].filter(Boolean);
  let group = null, anim = null, tween = null; viz.mode3d = 'stack'; viz.info3d = '';
  const prevRender = viz.renderer.render.bind(viz.renderer);
  viz.renderer.render = (sc, cam) => { const t = performance.now(); if (tween) { const f = Math.min(1, (t - tween.t0) / tween.ms), e = ease(f); viz.cam.position.lerpVectors(tween.p0, tween.p1, e); viz.ctl.target.lerpVectors(tween.q0, tween.q1, e); if (group) group.scale.setScalar(0.001 + 0.999 * ease(Math.min(1, f * 1.4))); if (f >= 1) tween = null; } if (anim) anim(t); prevRender(sc, cam); };
  viz.preset = (name, ms = 900) => { const p = PRESETS[name]; if (!p) throw new Error('unknown camera preset ' + name + ' (' + Object.keys(PRESETS).join(', ') + ')'); tween = { t0: performance.now(), ms, p0: viz.cam.position.clone(), p1: new THREE.Vector3(...p[0]), q0: viz.ctl.target.clone(), q1: new THREE.Vector3(...p[1]) }; return name; };
  const clear = () => { if (group) { s.remove(group); group.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); group = null; } anim = null; };
  const mat = (o = {}) => new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.2, ...o });
  viz.mode = (name, data = {}) => {
    clear(); base().forEach((o) => (o.visible = name === 'stack')); if (name === 'stack') { viz.sel.visible = false; viz.mode3d = 'stack'; viz.preset('stack'); return { mode: 'stack' }; }
    group = new THREE.Group(); group.scale.setScalar(0.001); s.add(group); let info;
    if (name === 'field') info = field(group, data); else if (name === 'surface') info = surface(group, data); else if (name === 'manifold') info = manifold(group, data); else if (name === 'attn') info = attnGraph(group, data); else if (name === 'circuit') info = circuit(group, data); else throw new Error('unknown 3D mode ' + name);
    viz.mode3d = name; viz.info3d = info.text || ''; viz.preset(name); return { mode: name, ...info };
  };
  // ── weight voxel field: InstancedMesh, height = |w|, color = viridis(|w|/max) or diverging sign; LOD: coarse ↔ fine by camera distance
  function field(g, { a, rows, cols, label = '' }) {
    const mk = (R) => { const C = Math.max(1, Math.round((R * cols) / rows)) > 160 ? 160 : Math.max(1, Math.round((R * cols) / rows)), Rr = Math.min(R, rows), Cc = Math.min(C, cols), fr = rows / Rr, fc = cols / Cc, vals = new Float32Array(Rr * Cc); let mx = 1e-9;
      for (let i = 0; i < Rr; i++) for (let j = 0; j < Cc; j++) { let best = 0; for (let ii = Math.floor(i * fr); ii < Math.max(Math.floor(i * fr) + 1, Math.floor((i + 1) * fr)); ii++) for (let jj = Math.floor(j * fc); jj < Math.max(Math.floor(j * fc) + 1, Math.floor((j + 1) * fc)); jj++) { const v = a[ii * cols + jj]; if (Math.abs(v) > Math.abs(best)) best = v; } vals[i * Cc + j] = best; mx = Math.max(mx, Math.abs(best)); }
      const sz = 8 / Math.max(Rr, Cc), geo = new THREE.BoxGeometry(sz * 0.9, 1, sz * 0.9), im = new THREE.InstancedMesh(geo, mat(), Rr * Cc), m4 = new THREE.Matrix4();
      for (let i = 0; i < Rr; i++) for (let j = 0; j < Cc; j++) { const k = i * Cc + j, v = vals[k], h = 0.05 + 4 * Math.abs(v) / mx; m4.makeScale(1, h, 1); m4.setPosition(j * sz, h / 2 * Math.sign(v || 1), i * sz); im.setMatrixAt(k, m4); im.setColorAt(k, v >= 0 ? viridis(Math.abs(v) / mx) : diverge(-Math.abs(v) / mx)); }
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; return { im, n: Rr * Cc, R: Rr, C: Cc }; };
    const lod = new THREE.LOD(), fine = mk(Math.min(rows, 96)), coarse = mk(Math.min(rows, 24)); lod.addLevel(fine.im, 0); lod.addLevel(coarse.im, 45); g.add(lod);
    return { text: `${label} ${rows}×${cols} · LOD fine ${fine.R}×${fine.C} (${fine.n} instanced voxels) / coarse ${coarse.R}×${coarse.C} · height=|w| (max-|·| pooled) · color: viridis for w≥0, blue for w<0`, instances: fine.n + coarse.n };
  }
  // ── loss surface from science.lossSlice (2D) — z = loss, color = viridis(normalized loss), white dot at θ (α=β=0)
  function surface(g, { ax, grid }) {
    const n = ax.length, lo = Math.min(...grid.flat()), hi = Math.max(...grid.flat()), geo = new THREE.PlaneGeometry(10, 10, n - 1, n - 1), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = i * n + j, z = (grid[i][j] - lo) / (hi - lo || 1); pos.setZ(k, z * 4); const c = viridis(z); col.set([c.r, c.g, c.b], k * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat({ vertexColors: true, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; g.add(m);
    const w = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 })); w.rotation.x = -Math.PI / 2; g.add(w);
    const c0 = Math.floor(n / 2), dot = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); dot.position.set(0, ((grid[c0][c0] - lo) / (hi - lo || 1)) * 4 + 0.2, 0); g.add(dot);
    return { text: `loss surface ${n}×${n}: CE from ${lo.toFixed(4)} to ${hi.toFixed(4)} nats · white = current θ`, lo, hi };
  }
  // ── residual manifold: per-layer PCA-3 coordinates (shared basis), color = layer, trails connect one token across layers; animates layer by layer
  function manifold(g, { pts, layers, tokens = [] }) {
    const L = layers, per = pts.length / L, geo = new THREE.BufferGeometry(), pos = new Float32Array(pts.length * 3), col = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => { pos.set(p, i * 3); const c = viridis(Math.floor(i / per) / (L - 1)); col.set([c.r, c.g, c.b], i * 3); }); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const P = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true })); g.add(P);
    for (let t = 0; t < Math.min(per, 40); t++) { const lg = new THREE.BufferGeometry().setFromPoints([...Array(L).keys()].map((l) => new THREE.Vector3(...pts[l * per + t]))); g.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.25 }))); }
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfbbf24 })); g.add(marker);
    anim = (t) => { const f = (t / 600) % (L * per), l = Math.floor(f / per), k = Math.floor(f % per), p = pts[l * per + k]; if (p) marker.position.set(...p); };
    return { text: `${per} tokens × ${L} residual slots projected on the top-3 PCs of all points (shared basis) · color = depth (viridis) · grey trails follow a token through depth · gold marker animates token→layer`, tokens };
  }
  // ── 3D attention graph: tokens on a helix; arc thickness/opacity = attention prob; per-token pulse walks the query position
  function attnGraph(g, { att, T, labels = [], layer = 0, head = 0 }) {
    const node = (t) => new THREE.Vector3(Math.cos(t * 0.5) * 6, (t - T / 2) * 0.35, Math.sin(t * 0.5) * 6), nodes = [];
    for (let t = 0; t < T; t++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), mat({ color: 0x5eead4, emissive: 0x0c3530 })); m.position.copy(node(t)); g.add(m); nodes.push(m); }
    const edges = []; for (let t = 0; t < T; t++) for (let j = 0; j <= t; j++) { const p = att[t * T + j]; if (p < 0.04) continue; const a = node(t), b = node(j), mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.6 + (t - j) * 0.08, 0)); const cur = new THREE.QuadraticBezierCurve3(a, mid, b);
      const m = new THREE.Mesh(new THREE.TubeGeometry(cur, 16, 0.012 + 0.06 * p, 6), new THREE.MeshBasicMaterial({ color: viridis(p), transparent: true, opacity: 0.25 + 0.75 * p })); m.userData = { t, j, p }; g.add(m); edges.push(m); }
    anim = (time) => { const q = Math.floor(time / 450) % T; nodes.forEach((m, i) => m.scale.setScalar(i === q ? 1.8 : 1)); edges.forEach((e) => (e.material.opacity = e.userData.t === q ? 1 : 0.12 + 0.4 * e.userData.p)); };
    return { text: `L${layer}H${head} attention over ${T} tokens: ${edges.length} edges with p ≥ 0.04 · color/width = probability · pulse = current query token`, edges: edges.length, labels };
  }
  // ── circuit graph: node (l,h) colored by OV copying score (diverging), size by |score|; edges = top-k composition scores colored by type
  function circuit(g, { scores, comps, k = 40 }) {
    const pos = (l, h) => new THREE.Vector3(-4 + h * 0.75, l * 2.4 + 0.6, 0); const L = scores.length;
    for (let l = 0; l < L; l++) for (let h = 0; h < scores[l].length; h++) { const v = scores[l][h].ov, m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + 0.18 * Math.abs(v), 1), mat({ color: diverge(v), emissive: diverge(v).multiplyScalar(0.15) })); m.position.copy(pos(l, h)); g.add(m); }
    const col = { Q: 0x60a5fa, K: 0xf472b6, V: 0xfbbf24 }, all = ['Q', 'K', 'V'].flatMap((t) => comps[t].slice(0, k).map((e) => ({ ...e, t }))), mx = Math.max(...all.map((e) => e.s));
    for (const e of all) { const a = pos(...e.from), b = pos(...e.to), mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0, e.t === 'Q' ? 1.2 : e.t === 'K' ? -1.2 : 2.2)); const cur = new THREE.QuadraticBezierCurve3(a, mid, b);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(cur, 20, 0.015 + 0.05 * (e.s / mx), 6), new THREE.MeshBasicMaterial({ color: col[e.t], transparent: true, opacity: 0.3 + 0.7 * (e.s / mx) }))); }
    return { text: `${L}×16 heads · node color = OV copying score (red +1 copy, blue −1 anti-copy) · edges: top-${k} Q (blue), K (pink), V (gold) composition`, edges: all.length };
  }
  return viz;
}
