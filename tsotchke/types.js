// Type-checks the real NEURALESE computation graph with Eshkol's own compile-time type layer, compiled to WebAssembly
// (tsotchke/eshkol@341ac81, MIT: lib/types/dependent.cpp DimensionChecker + CTValue, lib/types/hott_types.cpp universe
// hierarchy / subtyping / numeric promotion; shim wasm/eshkol_types_shim.c++, build wasm/build-eshkol-types.sh).
// Every verdict below is returned by Eshkol code; this file only lists the judgments the model must satisfy.
// Judgment kinds: reshape  Id_Nat(rows·cols, len)  — a flat Float32Array really is a rows×cols matrix (CTValue::mul)
//                 matmul   (m×n)·(n2×p) requires n = n2                           (checkMatMulDimensions)
//                 eq / dot equal dimensions (residual adds, head split, q·k)      (checkDimensionsEqual)
//                 bounds   token id < V                                           (checkBounds)
//                 subtype  storage dtype <: Real; promotion of the accumulator    (TypeEnvironment, universe levels)
import { wasmBytes } from './wasmb64.js?v=10';
export const SOURCE = { repo: 'tsotchke/eshkol', commit: '341ac812ed600fd9d27c28e9509d66ab71363947', files: ['lib/types/dependent.cpp', 'lib/types/hott_types.cpp', 'lib/types/type_relation.cpp'], license: 'MIT' };
let M = null;
export async function load() { if (M) return M; const f = (await import('./eshkol_types.mjs')).default; M = await f({ wasmBinary: await wasmBytes('eshkolTypes'), print: () => {}, printErr: () => {} }); return M; }
const N = ['number', 'number', 'number', 'number'];
export async function api() { const m = await load(), c = (n, t, a) => m.ccall(n, 'number', t, a), msg = () => m.ccall('esk_msg', 'string', [], []);
  return { msg, matmul: (a, b, c2, d) => c('esk_matmul', N, [a, b, c2, d]) === 1, dot: (a, b) => c('esk_dot', N.slice(0, 2), [a, b]) === 1, reshape: (r, k, n) => c('esk_reshape', N.slice(0, 3), [r, k, n]) === 1,
    eq: (a, b) => c('esk_eq', N.slice(0, 2), [a, b]) === 1, bounds: (i, n) => c('esk_bounds', N.slice(0, 2), [i, n]) === 1,
    subtype: (a, b) => m.ccall('esk_subtype', 'number', ['string', 'string'], [a, b]) === 1, promote: (a, b) => m.ccall('esk_promote', 'string', ['string', 'string'], [a, b]), universe: (a) => m.ccall('esk_universe', 'number', ['string'], [a]) }; }
// Returns { ok, n, failed, rows:[{id, judgment, ok, msg}] }. cfg = {d,H,hd,L,ff,V}; ids = token ids to bounds-check.
export async function checkModel(W, cfg, ids = []) { const E = await api(), rows = [], { d, H, hd, L, ff, V } = cfg;
  const J = (id, judgment, ok) => rows.push({ id, judgment, ok, msg: ok ? '' : E.msg() });
  const len = (a) => (a && a.length != null ? a.length : -1);
  J('wte', `Id(${V}·${d}, |wte|=${len(W.wte)})`, E.reshape(V, d, len(W.wte)));
  const P = Math.round(len(W.wpe) / d); J('wpe', `Id(${P}·${d}, |wpe|=${len(W.wpe)})`, E.reshape(P, d, len(W.wpe)));
  J('ln_f', `|ln_f.w| = |ln_f.b| = ${d}`, E.eq(len(W.lnfW), d) && E.eq(len(W.lnfB), d));
  J('heads', `H·hd = d (${H}·${hd} = ${d})`, E.reshape(H, hd, d));
  J('q·k', `dot(hd, hd)`, E.dot(hd, hd));
  for (let l = 0; l < L; l++) { const p = W.layers[l] || {};
    for (const k of ['q', 'k', 'v', 'o']) J(`h${l}.${k}`, `Id(${d}·${d}, ${len(p[k])}) ∧ (${d}×${d})·(${d}×1)`, E.reshape(d, d, len(p[k])) && E.matmul(d, d, d, 1));
    J(`h${l}.fc`, `Id(${ff}·${d}, ${len(p.fc)}) ∧ (${ff}×${d})·(${d}×1)`, E.reshape(ff, d, len(p.fc)) && E.matmul(ff, d, d, 1));
    J(`h${l}.proj`, `Id(${d}·${ff}, ${len(p.proj)}) ∧ (${d}×${ff})·(${ff}×1)`, E.reshape(d, ff, len(p.proj)) && E.matmul(d, ff, ff, 1));
    J(`h${l}.bias/ln`, `|ob|=|projb|=|ln|=${d}, |fcb|=${ff}`, [p.ob, p.projb, p.ln1w, p.ln1b, p.ln2w, p.ln2b].every((a) => E.eq(len(a), d)) && E.eq(len(p.fcb), ff));
    J(`h${l}.resid`, `x + attn(x) + mlp(x): eq(d, rows(o)), eq(d, rows(proj))`, E.eq(d, len(p.o) / d) && E.eq(d, len(p.proj) / ff)); }
  J('unembed', `(${V}×${d})·(${d}×1)`, E.matmul(V, d, len(W.wte) / V, 1));
  ids.forEach((t, i) => { if (!E.bounds(t, V)) J(`tok[${i}]`, `${t} < ${V}`, false); }); if (ids.length) J('tokens', `${ids.length} ids < ${V}`, ids.every((t) => t >= 0 && t < V));
  const dt = W.wte instanceof Float32Array ? 'Float32' : W.wte instanceof Float64Array ? 'Float64' : 'Unknown';
  J('dtype', `${dt} <: Real`, E.subtype(dt, 'Real'));
  J('accum', `promote(${dt}, Float64) = Float64`, E.promote(dt, 'Float64') === 'Float64');
  const failed = rows.filter((r) => !r.ok); return { ok: !failed.length, n: rows.length, failed, rows }; }
