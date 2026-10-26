// Moonlab's native quantum-geometry module (tsotchke/moonlab@cd3b234, MIT: src/algorithms/quantum_geometry/qgt.c),
// compiled to WebAssembly by us (wasm/build-moonlab-qgt.sh). The npm package @tsotchkecorp/moonlab@1.2.1 does not export
// qgt_metric_at, so this is the only way to call it in a browser.
// Cross-check (v10, claim C2h): our Fubini–Study machinery — fidelity F = |⟨u(k)|u(k+δ)⟩|², angle s = fsFromFidelity(F),
// metric g_μμ ≈ s²/δ² (geometry.js) — applied to the QWZ lower band, against Moonlab's own qgt_metric_at. Fail if > 1e-6.
// Note on scope: Moonlab's QGT is defined for Bloch Hamiltonians H(k); NEURALESE's FS metric lives on softmax outputs.
// What is shared, and what this tests, is the fidelity → angle → metric pipeline, not the model itself.
import { wasmBytes } from './wasmb64.js?v=13';
import { fsFromFidelity } from './geometry.js?v=13';
export const SOURCE = { repo: 'tsotchke/moonlab', commit: 'cd3b2347e3739327548708073d7e4ac710cc6a6c', files: ['src/algorithms/quantum_geometry/qgt.c', 'src/utils/matrix_math.c'], license: 'MIT', toolchain: 'emscripten 4.0.23 -O2' };
let M = null;
export async function load() { if (M) return M; const f = (await import('./moonlab_qgt.mjs')).default; M = await f({ wasmBinary: await wasmBytes('moonlabQgt'), print: () => {}, printErr: () => {} }); return M; }
// Moonlab: Fubini–Study metric g (row-major 2×2) of the QWZ lower band at k, centred finite differences, step dk.
export async function moonlabMetric(m, kx, ky, dk = 1e-4) { const W = await load(), p = W._malloc(32);
  try { if (W._mlq_metric_qwz(m, kx, ky, dk, p) !== 0) throw new Error('qgt_metric_at failed'); return Array.from(W.HEAPF64.subarray(p / 8, p / 8 + 4)); } finally { W._free(p); } }
export async function moonlabCurvature(m, kx, ky, dk = 1e-4) { const W = await load(), p = W._malloc(40);
  try { if (W._mlq_curv_qwz(m, kx, ky, dk, p, p + 32) !== 0) throw new Error('qgt_curvature_at failed'); return W.HEAPF64[p / 8 + 4]; } finally { W._free(p); } }
// Ours: lower-band eigenvector of d·σ (any gauge; fidelity is gauge-invariant).
export function qwzLower(m, kx, ky) { const dx = Math.sin(kx), dy = Math.sin(ky), dz = m + Math.cos(kx) + Math.cos(ky), d = Math.hypot(dx, dy, dz);
  // H = [[dz, dx - i dy],[dx + i dy, -dz]]; eigenvector for -d: (dx - i dy, -d - dz) normalised (or the other form near its singularity)
  let a = [dx, -dy], b = [-d - dz, 0]; if (Math.hypot(...a, ...b) < 1e-8) { a = [dz - d, 0]; b = [dx, dy]; }
  const n = Math.hypot(...a, ...b); return [a[0] / n, a[1] / n, b[0] / n, b[1] / n]; }
const fid = (u, v) => { const re = u[0] * v[0] + u[1] * v[1] + u[2] * v[2] + u[3] * v[3], im = u[0] * v[1] - u[1] * v[0] + u[2] * v[3] - u[3] * v[2]; return re * re + im * im; };
// Diagonal g_xx, g_yy from the FS angle between k−δ and k+δ (centred: s(2δ)²/(2δ)²); off-diagonal by polarisation along (1,1).
export function ourMetric(m, kx, ky, h = 1e-4) { const s2 = (ex, ey) => { const s = fsFromFidelity(fid(qwzLower(m, kx - ex * h, ky - ey * h), qwzLower(m, kx + ex * h, ky + ey * h))); return (s * s) / (4 * h * h); };
  const gxx = s2(1, 0), gyy = s2(0, 1), gxy = (s2(1, 1) - gxx - gyy) / 2; return [gxx, gxy, gxy, gyy]; }
export async function crossCheck(m = 1, pts = [[0.3, -0.7], [1.1, 0.4], [-2.0, 2.5], [0.05, 0.05], [Math.PI / 2, -Math.PI / 3]]) {
  const rows = []; let maxErr = 0;
  for (const [kx, ky] of pts) { const a = await moonlabMetric(m, kx, ky), b = ourMetric(m, kx, ky), e = Math.max(...a.map((x, i) => Math.abs(x - b[i]))); maxErr = Math.max(maxErr, e); rows.push({ kx, ky, moonlab: a, ours: b, err: e }); }
  return { m, rows, maxErr, tol: 1e-6, ok: maxErr <= 1e-6 };
}
