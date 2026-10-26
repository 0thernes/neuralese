// Information geometry of next-token distributions, after the quantum geometric tensor of tsotchke/quantum_geometric_tensor
// (QGTL v0.777, commit 770994a, MIT): Q_μν = ⟨∂μψ|∂νψ⟩ − ⟨∂μψ|ψ⟩⟨ψ|∂νψ⟩, whose real part is the Fubini–Study metric
// (README "The Quantum Geometric Tensor"; src/quantum_geometric/core/quantum_geometric_metric.c). We embed a categorical
// distribution p as the real unit vector ψ = √p (padded to 2^16 amplitudes). Then |⟨ψ_p|ψ_q⟩|² is the squared
// Bhattacharyya coefficient, the Fubini–Study distance is arccos Σ√(p q), and for a smooth path p(ε) the FS metric equals
// one quarter of the Fisher information (Berry curvature is identically 0 because ψ is real). These are standard facts
// (e.g. Amari & Nagaoka 2000; Bengtsson & Życzkowski 2006); the fidelity itself is computed by Moonlab's WASM simulator.
export const SOURCE = { qgtl: { repo: 'tsotchke/quantum_geometric_tensor', commit: '770994aa8ddd858e6bb16eebb25250a7b9f67c96' }, moonlab: { repo: 'tsotchke/moonlab', npm: '@tsotchkecorp/moonlab@1.2.1', commit: 'cd3b2347e3739327548708073d7e4ac710cc6a6c' } };
import { wasmBytes } from './wasmb64.js?v=10';
export const NQ = 16, NA = 1 << NQ;
export function softmax(l) { let m = -Infinity; for (const x of l) if (x > m) m = x; const p = new Float64Array(l.length); let s = 0; for (let i = 0; i < l.length; i++) { p[i] = Math.exp(l[i] - m); s += p[i]; } for (let i = 0; i < l.length; i++) p[i] /= s; return p; }
export const bhatt = (p, q) => { let s = 0; for (let i = 0; i < p.length; i++) s += Math.sqrt(p[i] * q[i]); return s; };
export const fsAngle = (p, q) => Math.acos(Math.min(1, bhatt(p, q)));
// Fisher information of softmax(a + ε b) at ε = 0: Var_p(b).
export const fisherDir = (p, b) => { let m = 0; for (let i = 0; i < p.length; i++) m += p[i] * b[i]; let v = 0; for (let i = 0; i < p.length; i++) v += p[i] * (b[i] - m) ** 2; return v; };
let ML = null;
// Browser: load the unmodified Emscripten glue, then wrap its factory so it instantiates the SHA-256-verified bytes
// (Moonlab's own loader uses window.MoonlabModule when present). Node: Moonlab's server loader reads dist/moonlab.wasm,
// which the test suite materialises from the same verified base64 (see test/tsotchke.test.mjs).
export async function moonlab() { if (ML) return ML; const mod = await import('../vendor/moonlab/dist/index.mjs?v=10');
  if (typeof window !== 'undefined') { const bytes = await wasmBytes('moonlab'), js = new URL('../vendor/moonlab/dist/moonlab.js', import.meta.url).href;
    if (!window.MoonlabModule) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = js; s.onload = res; s.onerror = () => rej(new Error('failed to load ' + js)); document.head.appendChild(s); });
    const F = window.MoonlabModule; if (!F.__neuralese) { window.MoonlabModule = Object.assign((cfg = {}) => F({ ...cfg, wasmBinary: bytes }), { __neuralese: true }); } await mod.preload({ jsPath: js }); }
  else await mod.preload(); ML = mod; return mod; }
const amps = (p) => { const a = new Array(NA); for (let i = 0; i < NA; i++) a[i] = { real: i < p.length ? Math.sqrt(p[i]) : 0, imag: 0 }; return a; };
// Fidelity |⟨√p|√q⟩|² computed by Moonlab (QuantumState.fidelity on two 16-qubit states).
export async function moonlabFidelity(p, q) { const M = await moonlab(); const A = await M.QuantumState.create({ numQubits: NQ, amplitudes: amps(p) }), B = await M.QuantumState.create({ numQubits: NQ, amplitudes: amps(q) }); try { return A.fidelity(B); } finally { A.dispose(); B.dispose(); } }
export const fsFromFidelity = (F) => Math.acos(Math.min(1, Math.sqrt(Math.max(0, F))));
// Chern number of the Qi–Wu–Zhang model, lower band, by the Fukui–Hatsugai–Suzuki lattice method (independent JS),
// used only to cross-check Moonlab's qwzChern (Berry-curvature machinery), H(k) = sin kx σx + sin ky σy + (m + cos kx + cos ky) σz.
export function qwzChernFHS(m, N = 48) { const vec = (kx, ky) => { const dx = Math.sin(kx), dy = Math.sin(ky), dz = m + Math.cos(kx) + Math.cos(ky), d = Math.hypot(dx, dy, dz);
    // lower-band eigenvector of d·σ: (dz − d, dx + i dy) normalised (gauge irrelevant for FHS)
    let a = [dz - d, 0], b = [dx, dy]; if (Math.hypot(a[0], b[0], b[1]) < 1e-12) { a = [-dx, dy]; b = [dz + d, 0]; } const n = Math.hypot(a[0], a[1], b[0], b[1]); return [a[0] / n, a[1] / n, b[0] / n, b[1] / n]; };
  const ip = (u, v) => [u[0] * v[0] + u[1] * v[1] + u[2] * v[2] + u[3] * v[3], u[0] * v[1] - u[1] * v[0] + u[2] * v[3] - u[3] * v[2]];
  const mulc = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]]; const S = (2 * Math.PI) / N; const U = []; for (let i = 0; i <= N; i++) { U.push([]); for (let j = 0; j <= N; j++) U[i].push(vec(i * S, j * S)); }
  let C = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const u1 = ip(U[i][j], U[i + 1][j]), u2 = ip(U[i + 1][j], U[i + 1][j + 1]), u3 = ip(U[i + 1][j + 1], U[i][j + 1]), u4 = ip(U[i][j + 1], U[i][j]); const z = mulc(mulc(u1, u2), mulc(u3, u4)); C += Math.atan2(z[1], z[0]); }
  return C / (2 * Math.PI); }
// Logits at position t are affine in ε when the final-LayerNorm weight moves along v: l(ε) = a + ε b. Returns {a, b}.
export function lnfLogitLine(W, xPre, t, v) { const d = W.lnfW.length, V = W.wte.length / d, eps = 1e-5, n = new Float64Array(d), y0 = new Float64Array(d), y1 = new Float64Array(d);
  let mu = 0; for (let i = 0; i < d; i++) mu += xPre[t * d + i]; mu /= d; let va = 0; for (let i = 0; i < d; i++) va += (xPre[t * d + i] - mu) ** 2; va /= d; const r = 1 / Math.sqrt(va + eps);
  for (let i = 0; i < d; i++) { n[i] = (xPre[t * d + i] - mu) * r; y0[i] = n[i] * W.lnfW[i] + W.lnfB[i]; y1[i] = n[i] * v[i]; }
  const a = new Float64Array(V), b = new Float64Array(V); for (let o = 0; o < V; o++) { let s0 = 0, s1 = 0; const off = o * d; for (let i = 0; i < d; i++) { s0 += W.wte[off + i] * y0[i]; s1 += W.wte[off + i] * y1[i]; } a[o] = s0; b[o] = s1; } return { a, b }; }
// Mean (over predicted positions) Fisher information along v. Prediction checked in tests: equals g''(0) of the mean CE,
// i.e. 2·c₂ of the Eshkol-recurrence Taylor jet, and 4× the Fubini–Study metric measured from Moonlab fidelities.
export function fisherLnf(W, xPre, ids, v) { let s = 0; for (let t = 0; t < ids.length - 1; t++) { const { a, b } = lnfLogitLine(W, xPre, t, v); s += fisherDir(softmax(a), b); } return s / (ids.length - 1); }
