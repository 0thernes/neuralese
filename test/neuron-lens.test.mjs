// v14.0.0 Neuron Lens: lens math (vs finite differences of the RelP-patched primal), database integrity, validation harness.
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import crypto from 'node:crypto';
import * as NL from '../src/neuronlens.js';
import { rp } from './_paths.mjs';
const U = (f) => new URL(rp(f), import.meta.url), S = (f) => fs.readFileSync(U(f), 'utf8'), J = (f) => JSON.parse(S(f)), sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const cfg = { d: 8, H: 2, hd: 4, L: 3, ff: 16, V: 23, eps: 1e-5 };
function tiny(seed = 3) { const r = NL.mulberry(seed), g = (n, s = 0.5) => Float32Array.from({ length: n }, () => (r() - 0.5) * 2 * s), { d, ff, V, L } = cfg;
  const W = { wte: g(V * d, 1), wpe: g(64 * d, 0.3), lnfW: g(d, 0.3).map((x) => 1 + x), lnfB: g(d, 0.1), layers: [] };
  for (let l = 0; l < L; l++) W.layers.push({ ln1w: g(d, 0.3).map((x) => 1 + x), ln1b: g(d, 0.1), q: g(d * d, 0.8), k: g(d * d, 0.8), v: g(d * d), o: g(d * d), ob: g(d, 0.1), ln2w: g(d, 0.3).map((x) => 1 + x), ln2b: g(d, 0.1), fc: g(ff * d, 0.8), fcb: g(ff, 0.3), proj: g(d * ff), projb: g(d, 0.1) });
  return NL.prepare(W, cfg); }
// The RelP-patched primal of one layer: LayerNorm rstd and GELU's φ frozen at the recorded values, attention exact.
function patchedLayer(M, lin, l, h) { const { d, H, hd, ff } = cfg, P = M.layers[l], R = lin.rec[l], T = lin.T, ln = (x, w, b, r) => { const o = new Float64Array(T * d); for (let t = 0; t < T; t++) { let m = 0; for (let i = 0; i < d; i++) m += x[t * d + i]; m /= d; for (let i = 0; i < d; i++) o[t * d + i] = (x[t * d + i] - m) * r[t] * w[i] + b[i]; } return o; };
  const mv = (Wm, x, nO, nI) => { const o = new Float64Array(T * nO); for (let t = 0; t < T; t++) for (let i = 0; i < nO; i++) { let s = 0; for (let j = 0; j < nI; j++) s += Wm[i * nI + j] * x[t * nI + j]; o[t * nO + i] = s; } return o; };
  const x = ln(h, P.ln1w, P.ln1b, R.r1), q = mv(P.q, x, d, d), k = mv(P.k, x, d, d), v = mv(P.v, x, d, d), z = new Float64Array(T * d);
  for (let hh = 0; hh < H; hh++) for (let t = 0; t < T; t++) { const sc = []; for (let s = 0; s <= t; s++) { let a = 0; for (let e = 0; e < hd; e++) a += q[t * d + hh * hd + e] * k[s * d + hh * hd + e]; sc.push(a); } const mx = Math.max(...sc), ex = sc.map((a) => Math.exp(a - mx)), Z = ex.reduce((a, b) => a + b);
    for (let e = 0; e < hd; e++) { let a = 0; for (let s = 0; s <= t; s++) a += (ex[s] / Z) * v[s * d + hh * hd + e]; z[t * d + hh * hd + e] = a; } }
  const o = mv(P.o, z, d, d), mid = Float64Array.from(h, (a, i) => a + o[i] + P.ob[i % d]), x2 = ln(mid, P.ln2w, P.ln2b, R.r2), u = mv(P.fc, x2, ff, d);
  for (let i = 0; i < u.length; i++) u[i] = (u[i] + P.fcb[i % ff]) * R.phi[i]; const y = mv(P.proj, u, d, ff); return { out: Float64Array.from(mid, (a, i) => a + y[i] + P.projb[i % d]), mid }; }
test('V14-1 jvp matches finite differences of the RelP-patched layer (true attention derivative, frozen LN rstd and GELU φ)', () => {
  const M = tiny(), ids = Array.from({ length: 21 }, (_, i) => (i * 7 + 2) % cfg.V), lin = NL.tapeRelP(M, ids), { d } = cfg, N = lin.N, S0 = NL.SKIP_FIRST;
  const f = NL.forward(M, ids.slice(0, lin.T), { outs: true }); const r = NL.mulberry(5), X = Float32Array.from({ length: N * d }, () => r() - 0.5);
  for (let l = 0; l < cfg.L; l++) { const h0 = l ? f.outs[l - 1] : (() => { const e = new Float64Array(lin.T * d); for (let t = 0; t < lin.T; t++) for (let i = 0; i < d; i++) e[t * d + i] = M.W.wte[ids[t] * d + i] + M.W.wpe[t * d + i]; return e; })();
    const eps = 1e-4, hp = Float64Array.from(h0), hm = Float64Array.from(h0); for (let n = 0; n < N; n++) for (let i = 0; i < d; i++) { hp[(S0 + n) * d + i] += eps * X[n * d + i]; hm[(S0 + n) * d + i] -= eps * X[n * d + i]; }
    const a = patchedLayer(M, lin, l, hp), b = patchedLayer(M, lin, l, hm), j = NL.jvp(M, lin, l, X, 1);
    let err = 0, mag = 0; for (let n = 0; n < N; n++) for (let i = 0; i < d; i++) { const fd = (a.out[(S0 + n) * d + i] - b.out[(S0 + n) * d + i]) / (2 * eps), fm = (a.mid[(S0 + n) * d + i] - b.mid[(S0 + n) * d + i]) / (2 * eps); err = Math.max(err, Math.abs(fd - j.out[n * d + i]), Math.abs(fm - j.mid[n * d + i])); mag = Math.max(mag, Math.abs(fd)); }
    assert.ok(err < 2e-3 * Math.max(1, mag), `layer ${l}: max err ${err} (|fd| ${mag})`); } });
test('V14-2 vjp is the exact transpose of jvp (R-lens map = S-lens map transposed)', () => {
  const M = tiny(4), ids = Array.from({ length: 22 }, (_, i) => (i * 5 + 1) % cfg.V), lin = NL.tapeRelP(M, ids), n = lin.N * cfg.d * 2, r = NL.mulberry(9);
  const X = Float32Array.from({ length: n }, () => r() - 0.5), G = Float32Array.from({ length: n }, () => r() - 0.5); let Y = X, Zc = G;
  for (let l = 0; l < cfg.L; l++) Y = NL.jvp(M, lin, l, Y, 2).out; for (let l = cfg.L - 1; l >= 0; l--) Zc = NL.vjp(M, lin, l, Zc, 2).inp;
  let a = 0, b = 0; for (let i = 0; i < n; i++) { a += G[i] * Y[i]; b += Zc[i] * X[i]; } assert.ok(Math.abs(a - b) < 1e-4 * Math.max(1, Math.abs(a)), `${a} vs ${b}`); });
test('V14-3 docJacobianR/docJacobianS agree with explicit per-basis jvp sums, and dimBatch does not change the estimate', () => {
  const M = tiny(6), ids = Array.from({ length: 21 }, (_, i) => (i * 3 + 4) % cfg.V), { d, L } = cfg, R = NL.docJacobianR(M, ids, 3), R8 = NL.docJacobianR(M, ids, d), Sl = NL.docJacobianS(M, ids, 5), lin = NL.tapeRelP(M, ids), N = lin.N;
  for (let l = 0; l < L; l++) for (let i = 0; i < d * d; i++) assert.ok(Math.abs(R.mid[l][i] - R8.mid[l][i]) < 1e-5);
  // explicit: push basis e_j at all valid rows from layer 1's input (= out of L0) to the top; J_out[0][i][j] = mean_t of the final tangent
  for (let j = 0; j < d; j++) { let X = new Float32Array(N * d); for (let n = 0; n < N; n++) X[n * d + j] = 1; for (let l = 1; l < L; l++) X = NL.jvp(M, lin, l, X, 1).out;
    for (let i = 0; i < d; i++) { let m = 0; for (let n = 0; n < N; n++) m += X[n * d + i] / N; assert.ok(Math.abs(m - R.out[0][i * d + j]) < 1e-4, `J[${i}][${j}] ${m} vs ${R.out[0][i * d + j]}`); } }
  // S: identity at the embeddings, so K for a 0-layer stack would be I; check S.out[L-1] against an explicit forward too
  for (let j = 0; j < d; j++) { let X = new Float32Array(N * d); for (let n = 0; n < N; n++) X[n * d + j] = 1; for (let l = 0; l < L; l++) X = NL.jvp(M, lin, l, X, 1).out;
    for (let i = 0; i < d; i++) { let m = 0; for (let n = 0; n < N; n++) m += X[n * d + i] / N; assert.ok(Math.abs(m - Sl.out[L - 1][i * d + j]) < 1e-4); } } });
test('V14-4 reads: R-read with J=I is the logit lens of the bias-free ln_f; S-read of an embedding direction ranks its own token first', () => {
  const M = tiny(7), { d, V } = cfg, I = new Float32Array(d * d); for (let i = 0; i < d; i++) I[i * d + i] = 1; const w = M.W.wte.slice(5 * d, 6 * d);
  assert.deepEqual(Array.from(NL.rRead(M, w, I)), Array.from(NL.rRead(M, w, null)));
  const eb = NL.embMean(M), c = Float32Array.from(w, (x, i) => x - eb[i]), s = NL.sRead(M, c, I); assert.equal(NL.topK(s, 1)[0], 5);
  assert.ok(Math.abs(NL.pearson([1, 2, 3], [2, 4, 6.0]) - 1) < 1e-12); assert.ok(Math.abs(NL.spearman([1, 5, 3], [10, 30, 20]) - 1) < 1e-12);
  const [lo, hi] = NL.wilson(9, 10); assert.ok(lo > 0.55 && lo < 0.6 && hi > 0.98, `${lo} ${hi}`); void V; });
test('V14-5 ridgeLinear recovers an exact affine map', () => { const r = NL.mulberry(11), n = 200, din = 4, dout = 3, A0 = Float32Array.from({ length: dout * din }, () => r() - 0.5), X = Float32Array.from({ length: n * din }, () => r() - 0.5), Y = new Float32Array(n * dout);
  for (let k = 0; k < n; k++) for (let o = 0; o < dout; o++) { let s = 0.7; for (let i = 0; i < din; i++) s += A0[o * din + i] * X[k * din + i]; Y[k * dout + o] = s; }
  const A = NL.ridgeLinear(X, Y, n, din, dout, 1e-9); for (let i = 0; i < A.length; i++) assert.ok(Math.abs(A[i] - A0[i]) < 1e-3); });

// ---- v14.0.0 artifacts: pre-registration, shipped lens, DB integrity, validation output, wiring ----
const PREREG_SHA = '299a8ec6d99a59644e5322f2f0dfaf76a847f6baefe8152896a2f46511243590';
test('V14-6 PREREG-v14.md is frozen (sha256 pinned) and the validation run used exactly that file and the shipped lens', () => {
  assert.equal(sha(fs.readFileSync(U('docs/PREREG-v14.md'))), PREREG_SHA);
  const v = J('lens/ts8m/validation.json'), man = J('lens/ts8m/manifest.json');
  assert.equal(v.prereg_sha256, PREREG_SHA); assert.equal(v.lens_sha256, man.sha256); assert.equal(v.quick, false);
  assert.equal(sha(fs.readFileSync(U('lens/ts8m/lenses.f32'))), man.sha256);
  assert.equal(fs.statSync(U('lens/ts8m/lenses.f32')).size, man.blocks.length * man.d * man.d * 4); assert.equal(man.blocks.length, 31);
});
test('V14-7 validation.json schema: every layer × lens row present with CIs in [0,1]; verdicts are recomputable from the rows', async () => {
  const v = J('lens/ts8m/validation.json'), { verdicts } = await import('../tools/nlens-verdicts.mjs');
  for (const k of ['R.out', 'R.mid', 'S.out', 'S.mid', 'logit', 'tuned']) for (let l = 0; l < 8; l++) { if (k === 'R.out' && l === 7) continue; const r = v.testA.find((x) => x.layer === l && x.lens === k); assert.ok(r, `A ${k} L${l}`);
    for (const c of [r.passCI, r.top10RiseCI]) assert.ok(c[0] >= 0 && c[0] <= c[1] && c[1] <= 1); assert.ok(r.n >= 16); }
  for (const k of ['S.mid', 'R.mid', 'logit']) for (let l = 0; l < 8; l++) assert.ok(v.testB.find((x) => x.layer === l && x.lens === k && x.n === 1024), `B ${k} L${l}`);
  assert.deepEqual(v.verdicts, verdicts(v));
});
test('V14-8 Neuron Lens DB: every file matches db-manifest sha256, 8×1024 neurons and 8×16 heads with well-formed reads, token ids resolvable', () => {
  const man = J('lens/ts8m/db-manifest.json'), lm = J('lens/ts8m/manifest.json'); assert.equal(man.lens_sha256, lm.sha256); assert.equal(Object.keys(man.files).length, 9);
  for (const [f, h] of Object.entries(man.files)) assert.equal(sha(fs.readFileSync(U('lens/ts8m/' + f))), h, f);
  const tok = J('lens/ts8m/db/tokens.json');
  for (let l = 0; l < 8; l++) { const D = J(`lens/ts8m/db/L${l}.json`); assert.equal(D.layer, l); assert.equal(D.neurons.length, 1024); assert.equal(D.heads.length, 16);
    for (const n of D.neurons) { for (const k of ['in_S', 'in_R', 'out_R', 'out_S', 'out_logit']) { assert.equal(n[k][0].length, 10); for (let i = 1; i < 10; i++) assert.ok(n[k][1][i] <= n[k][1][i - 1], `${k} sorted`); for (const t of n[k][0]) assert.ok(t in tok); }
      assert.equal(n.drivers.length, 8); assert.ok(n.rate >= 0 && n.rate <= 1); }
    for (const h of D.heads) for (const k of ['ov_R', 'ov_S', 'writes_R', 'qk_S', 'qk_self']) assert.equal(h[k][0].length, 10); }
});
test('V14-9 wiring + provenance: three NEURON LENS tabs in INTERPRET, lens/ shipped in www, catalog sample attributed CC BY 4.0, original-implementation notice', () => {
  assert.match(S('lab-ui.js'), /'saed', 'nlens', 'nlval', 'nlext'\]/); assert.match(S('v5.js'), /lab-lens\.js\?v=170/); assert.match(S('tools/build-www.mjs'), /'lens'/);
  const x = J('lens/ext/neuron-lens-sample.json'); assert.match(x.license, /CC BY 4\.0/); assert.match(x.attribution, /a9lim/); assert.match(x.attribution, /treetowntree/);
  assert.ok(x.models['qwen3-8b'].heads.length === 1152 && x.models['gemma-4-12b'].heads.length === 768); assert.ok(!JSON.stringify(x).includes('"contexts"'));
  assert.match(S('lens/ext/ATTRIBUTION.md'), /creativecommons\.org\/licenses\/by\/4\.0/); assert.match(S('lab-lens.js'), /CC BY 4\.0/);
  for (const f of ['neuronlens.js', 'lab-lens.js', 'tools/nlens-fit.mjs', 'tools/nlens-db.mjs']) assert.ok(!/\bport(ed)? (of|to)\b|\bported\b/.test(S(f)), f + ' must not claim to be a port');
  assert.match(S('docs/NEURON_LENS_METHOD.md'), /Implementation status: original/); assert.match(S('docs/ROADMAP-v14.md'), /nested-model experiments \(slot reserved\)/);
});
