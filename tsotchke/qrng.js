// Browser/Node wrapper over tsotchke/quantum_rng (commit 1a77e77, MIT, © 2024 Tsotchke) compiled to WebAssembly with
// Emscripten 4.0.23 (build: wasm/build-qrng.sh; flat C shim: wasm/qrng_shim.c). HONEST LABEL: this is a *classical
// simulation* of Born-rule measurement on a 2^n state vector. Its unpredictability comes only from the seed we feed it,
// which is drawn from crypto.getRandomValues (the browser/OS CSPRNG). It is NOT hardware quantum randomness, and the
// CHSH value it reports demonstrates that the simulator implements quantum mechanics correctly — not that the bits are
// quantum. In seeded mode the output is a pure function of the seed (upstream contract), which is what makes runs replayable.
import { battery } from './nist.js?v=9';
import { wasmBytes } from './wasmb64.js?v=9';
export const SOURCE = { repo: 'tsotchke/quantum_rng', commit: '1a77e77f803c63883349b658361c06401cd8ceb7', license: 'MIT', toolchain: 'emscripten 4.0.23 -O2' };
let M = null;
export async function load() { if (M) return M; const f = (await import('./qrng.mjs')).default; M = await f({ wasmBinary: await wasmBytes('qrng') }); return M; }
const withBuf = (m, bytes, fn) => { const p = m._malloc(Math.max(1, bytes.length)); m.HEAPU8.set(bytes, p); try { return fn(p); } finally { m._free(p); } };
export async function version() { const m = await load(); return m.UTF8ToString(m._qw_version()); }
export async function bytes(seed, n) { const m = await load(); const o = m._malloc(n); try { const r = withBuf(m, seed, (sp) => m._qw_bytes(sp, seed.length, o, n)); if (r !== 0) throw new Error('qrng_bytes error ' + r); return m.HEAPU8.slice(o, o + n); } finally { m._free(o); } }
export async function chsh(seed, n = 20000) { const m = await load(); const o = m._malloc(48); try { const r = withBuf(m, seed, (sp) => m._qw_chsh(sp, seed.length, n, o)); if (r !== 0) throw new Error('bell_test error ' + r); const v = m.HEAPF64.slice(o >> 3, (o >> 3) + 6); return { S: v[0], se: v[1], E: [...v.slice(2)], n }; } finally { m._free(o); } }
// NIST SP 800-90B Repetition Count + Adaptive Proportion tests (upstream health_tests.c). 0 = pass, -1 RCT fail, -2 APT fail.
export async function health(buf) { const m = await load(); return withBuf(m, buf, (p) => m._qw_health(p, buf.length)); }
export const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
// Draw a 32-bit seed with full provenance. entropy: 16 bytes from crypto.getRandomValues (or a caller-provided seed for replay).
export async function seed32({ seed, nTest = 65536 } = {}) {
  const s = seed || crypto.getRandomValues(new Uint8Array(16)), out = await bytes(s, nTest + 4), word = new DataView(out.buffer).getUint32(0, false);
  const h = await health(out), nist = battery(out.subarray(4));
  return { seed32: word, provenance: { generator: `${SOURCE.repo}@${SOURCE.commit.slice(0, 7)} (WASM, simulated Born-rule measurement)`, entropy: seed ? 'caller-supplied seed (replay)' : 'crypto.getRandomValues (browser CSPRNG)', seedHex: hex(s), health: h === 0 ? 'pass (SP 800-90B RCT+APT)' : 'FAIL code ' + h, nist: Object.fromEntries(['monobit', 'blockFrequency', 'runs', 'cusum'].map((k) => [k, +nist[k].p.toFixed(4)])), nistAllPass: ['monobit', 'blockFrequency', 'runs', 'cusum'].every((k) => nist[k].pass), testedBits: nist.n } };
}
