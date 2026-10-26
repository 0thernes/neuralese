// v10 cross-checks: (a) Fubini–Study vs Moonlab's native qgt_metric_at, (c) the natural-gradient vs Adam artifact,
// (f) the cross-libm quantum_rng finding. (b) is test/eshkol-taylor.test.mjs, (d) is test/eshkol-ad.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crossCheck, moonlabMetric, ourMetric, moonlabCurvature } from '../tsotchke/moonlabqgt.js';
import * as Q from '../tsotchke/qrng.js';
import * as NS from '../tsotchke/neurosym.js';
const J = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
test('A1 our fidelity→FS-angle metric equals Moonlab native qgt_metric_at (QWZ lower band) to ≤ 1e-6, 4 masses × 5 k-points', async () => {
  for (const m of [1, -1, 3, 0.5]) { const r = await crossCheck(m); console.log(`  qgt m=${m} max|Δg| ${r.maxErr.toExponential(2)}`); assert.ok(r.ok, `m=${m} maxErr ${r.maxErr}`); } });
test('A2 the check can fail: forgetting that the centred step spans 2δ (metric off by 4×) is rejected', async () => {
  const a = await moonlabMetric(1, 0.3, -0.7), b = ourMetric(1, 0.3, -0.7).map((x) => 4 * x); assert.ok(Math.max(...a.map((x, i) => Math.abs(x - b[i]))) > 1e-6); });
test('A3 Moonlab metric is positive semidefinite and its curvature obeys |Ω| ≤ 2√det g (quantum-geometry inequality)', async () => {
  for (const [kx, ky] of [[0.3, -0.7], [1.1, 0.4], [-2, 2.5]]) { const g = await moonlabMetric(1, kx, ky), om = await moonlabCurvature(1, kx, ky), det = g[0] * g[3] - g[1] * g[2];
    assert.ok(g[0] >= 0 && g[3] >= 0 && det >= -1e-12); assert.ok(Math.abs(om) <= 2 * Math.sqrt(Math.max(det, 0)) + 1e-6, `Ω=${om} det=${det}`); } });
test('C1 natural gradient vs Adam artifact: NG wins the training objective, Adam wins held-out (both protocols; 95% CIs exclude 0)', () => {
  for (const f of ['../tsotchke/data/ngvsadam.json', '../tsotchke/data/ngvsadam-heldout.json']) { const s = J(f).summary;
    assert.ok(s.train.ngMinusAdam.hi < 0, `${f} train`); assert.ok(s.heldout.ngMinusAdam.lo > 0, `${f} heldout`); assert.equal(s.train.adam.n, 8); } });
test('F1 cross-libm finding: WASM bytes == native musl (SIMD on or off), ≠ native glibc (SIMD on or off)', async () => {
  const L = J('../tsotchke/data/qrng_libm.json'), w = Q.hex(await Q.bytes(new TextEncoder().encode('neuralese-v8'), 64));
  assert.equal(w, L.musl_sse3); assert.equal(w, L.musl_scalar); assert.notEqual(w, L.glibc_sse3); assert.equal(L.glibc_sse3, L.glibc_scalar); });
test('N1 soft-unify port reproduces the real eshkol-run trace of neurosymbolic.esk (58 values) to < 1e-12', () => {
  const r = NS.compareGolden(readFileSync(new URL('../tsotchke/data/eshkol_neurosym_golden.txt', import.meta.url), 'utf8')); console.log(`  neurosym max|Δ| ${r.err.toExponential(2)} n=${r.n}`); assert.ok(r.ok); assert.equal(r.n, 58); assert.ok(r.sFel > 0.9 && r.sRock < 0.1); });
test('N2 the check can fail: a sigmoid-derivative bug (c instead of c(1−c)) breaks agreement', () => {
  const t = NS.makeTable(8), u = NS.makeTable(8); NS.softUnifyTrain(t, 'cat', 'feline', 1, 0.5); const va = NS.embed(u, 'cat'), vb = NS.embed(u, 'feline'), sc = 1 / Math.sqrt(8), c = NS.sigmoid(sc * va.reduce((s, x, i) => s + x * vb[i], 0)), g = 2 * (c - 1) * c * sc;
  const wrong = va.map((x, i) => x - 0.5 * g * vb[i]); assert.ok(Math.max(...wrong.map((x, i) => Math.abs(x - NS.embed(t, 'cat')[i]))) > 1e-6); });
