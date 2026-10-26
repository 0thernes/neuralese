// QGTL (tsotchke/quantum_geometric_tensor@770994a, MIT) geometric-measure core, compiled to WebAssembly by us
// (wasm/build-qgtl.sh; 6 upstream C files + wasm/qgtl_shim.c + one link-glue function in wasm/qgtl_stubs.c).
// fidelity(): QGTL's own qgt_geometric_measure_fidelity, |⟨ψ|φ⟩|², with ψ = √p, φ = √q. QGTL stores amplitudes as
// ComplexFloat (single precision), so agreement with Moonlab (double) is ~1e-7, not 1e-12.
// metric(): QGTL's qgt_geometric_compute_metric. Upstream it fills only the diagonal with 1 − |ψ_i|² (a "simple
// implementation"), which is NOT the Fubini–Study metric of the state; we expose it to show that fact, and test it.
// Not used: QGTL's tensor-network QGT (compute_quantum_geometric_tensor): in our WASM build get_quantum_state returns an
// all-zero state after gates are applied and the parameter-shift path fails ("Invalid tensor network state").
// Reproducer: wasm/qgtl_qgt_repro.c. See docs/TSOTCHKE.md.
import { wasmBytes } from './wasmb64.js?v=9';
export const SOURCE = { repo: 'tsotchke/quantum_geometric_tensor', commit: '770994aa8ddd858e6bb16eebb25250a7b9f67c96', license: 'MIT', toolchain: 'emscripten 4.0.23 -O2' };
let M = null;
export async function load() { if (M) return M; const f = (await import('./qgtl.mjs')).default; M = await f({ wasmBinary: await wasmBytes('qgtl'), print: () => {}, printErr: () => {} }); if (M._qgtl_init() !== 0) throw new Error('qgt_create_context failed'); return M; }
const put = (m, a) => { const p = m._malloc(16 * a.length); for (let i = 0; i < a.length; i++) { m.HEAPF64[p / 8 + 2 * i] = a[i]; m.HEAPF64[p / 8 + 2 * i + 1] = 0; } return p; };
// p, q: probability vectors of equal length (embedded as real amplitudes √p).
export async function fidelity(p, q) { const m = await load(), A = put(m, Array.from(p, Math.sqrt)), B = put(m, Array.from(q, Math.sqrt));
  try { const f = m._qgtl_fidelity(p.length, A, B); if (f < 0) throw new Error('qgt_geometric_measure_fidelity failed'); return f; } finally { m._free(A); m._free(B); } }
export async function metric(amps) { const m = await load(), n = amps.length, A = put(m, amps), O = m._malloc(8 * n * n);
  try { if (m._qgtl_metric(n, A, O) !== 0) throw new Error('qgt_geometric_compute_metric failed'); return Float64Array.from(m.HEAPF64.subarray(O / 8, O / 8 + n * n)); } finally { m._free(A); m._free(O); } }
