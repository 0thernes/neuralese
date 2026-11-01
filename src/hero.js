// v15.1 overview hero: a stylised 3D network (8 layer rings × 16 instanced head nodes + MLP dust, sparse inter-layer edges,
// shader-animated flow particles). Layout is illustrative; node colour/size and flow brightness are the real per-head ‖z_h‖
// of the last forward pass (from the 'nl-act' event). Renders only while the overview tab is visible.
import * as THREE from 'three';
const L = 8, H = 16;
export class Hero {
  constructor(cv) {
    this.cv = cv; this.active = false; this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const r = (this.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'low-power' })); r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.3;
    const s = (this.s = new THREE.Scene()), cam = (this.cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100)); cam.position.set(0, 1.5, 17); cam.lookAt(0, 0, 0);
    s.add(new THREE.AmbientLight(0xa8b8ff, 0.7)); const k = new THREE.DirectionalLight(0xffffff, 1.4); k.position.set(5, 8, 10); s.add(k);
    const g = (this.g = new THREE.Group()); s.add(g); const pos = (l, h) => { const y = (l - (L - 1) / 2) * 1.05, rad = 1.6 + 3.2 * Math.sqrt(Math.max(0.05, 1 - (y / 5.6) ** 2)), a = (h / H) * Math.PI * 2 + l * 0.35; return new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad * 0.8); };
    const im = (this.im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.16, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2, emissive: 0x111827 }), L * H)); const m4 = new THREE.Matrix4(), c0 = new THREE.Color(0x5b6b8c);
    this.P = []; for (let l = 0; l < L; l++) for (let h = 0; h < H; h++) { const p = pos(l, h); this.P.push(p); m4.makeTranslation(p); im.setMatrixAt(l * H + h, m4); im.setColorAt(l * H + h, c0); } g.add(im);
    // MLP dust: 96 points per ring slightly inside it
    const dp = []; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); for (let l = 0; l < L; l++) for (let n = 0; n < 96; n++) { const p = pos(l, rnd() * H).multiplyScalar(0.55 + 0.35 * rnd()); p.y += (rnd() - 0.5) * 0.4; dp.push(p.x, p.y, p.z); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3)); g.add(new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x4fd8c4, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    // sparse edges between consecutive layers + flow particles riding them
    const E = []; for (let l = 0; l < L - 1; l++) for (let h = 0; h < H; h++) for (let j = 0; j < 2; j++) E.push([l * H + h, (l + 1) * H + ((h + 1 + Math.floor(rnd() * 5)) % H)]);
    const lp = []; for (const [a, b] of E) lp.push(...this.P[a].toArray(), ...this.P[b].toArray()); const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x8ea2ff, transparent: true, opacity: 0.12, depthWrite: false })));
    const N = E.length * 2, A = new Float32Array(N * 3), B = new Float32Array(N * 3), ph = new Float32Array(N), amp = (this.amp = new THREE.BufferAttribute(new Float32Array(N).fill(0.3), 1)); this.E = E;
    E.forEach(([a, b], i) => { for (let j = 0; j < 2; j++) { const k2 = i * 2 + j; this.P[a].toArray(A, k2 * 3); this.P[b].toArray(B, k2 * 3); ph[k2] = rnd(); } });
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(A, 3)); fg.setAttribute('b', new THREE.BufferAttribute(B, 3)); fg.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); fg.setAttribute('amp', amp);
    this.fm = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, px: { value: r.getPixelRatio() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute vec3 b; attribute float ph, amp; uniform float t, px; varying float va; void main(){ float f = fract(ph + t * 0.35); vec3 p = mix(position, b, f); va = amp * sin(f * 3.14159); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = px * (3.0 + 10.0 * amp) * (8.0 / -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float va; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * clamp(va * 1.8, 0.0, 1.0); gl_FragColor = vec4(mix(vec3(0.31, 0.85, 0.77), vec3(1.0, 0.45, 0.75), clamp(va, 0.0, 1.0)) * 1.6, a); }' });
    const fp = new THREE.Points(fg, this.fm); fp.frustumCulled = false; g.add(fp);
    this.hn = null; document.addEventListener('nl-act', (e) => this.setAct(e.detail.hn));
    let mx = 0, my = 0; cv.addEventListener('pointermove', (e) => { const b = cv.getBoundingClientRect(); mx = (e.clientX - b.left) / b.width - 0.5; my = (e.clientY - b.top) / b.height - 0.5; });
    let prev = performance.now(), t = 0; this.frames = 0;
    const loop = () => { requestAnimationFrame(loop); if (!this.active || document.hidden || !cv.offsetParent) return; const now = performance.now(), dt = Math.min(0.1, (now - prev) / 1000); prev = now; this.size();
      if (!this.reduced) { t += dt; g.rotation.y += dt * 0.12; g.rotation.x += (my * 0.25 - g.rotation.x) * 0.05; g.rotation.z += (-mx * 0.15 - g.rotation.z) * 0.05; } this.fm.uniforms.t.value = t; r.render(s, cam); this.frames++; }; loop();
  }
  size() { const w = this.cv.clientWidth, h = this.cv.clientHeight; if (w && h && (w !== this._w || h !== this._h)) { this._w = w; this._h = h; this.r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); } }
  setAct(hn) { if (!hn) return; this.hn = hn; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), c = new THREE.Color(), cold = new THREE.Color(0x5b6b8c), hot = new THREE.Color(0xff5fb0); const v = (k) => hn[(k / H) | 0]?.[k % H] ?? 0;
    for (let k = 0; k < L * H; k++) { const x = v(k); sc.setScalar(0.7 + 1.1 * x); m4.compose(this.P[k], q, sc); this.im.setMatrixAt(k, m4); c.copy(cold).lerp(hot, x).multiplyScalar(1 + x); this.im.setColorAt(k, c); }
    this.E.forEach(([a], i) => { this.amp.array[i * 2] = this.amp.array[i * 2 + 1] = 0.1 + 0.9 * v(a); }); this.amp.needsUpdate = true; this.im.instanceMatrix.needsUpdate = true; this.im.instanceColor.needsUpdate = true; }
}
