// Claims & Evidence for the Tsotchke-powered components (see docs/CLAIMS.md). Every test here can fail; the
// "mutation" tests prove it by showing the same checks reject a deliberately broken implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { buildWeights, parseSafetensors, cloneWeights } from '../model.js';
import { forward, grad } from '../grad.js';
import { Editor } from '../surgery.js';
import * as T from '../tsotchke/taylor.js';
import * as N from '../tsotchke/nist.js';
import * as Q from '../tsotchke/qrng.js';
import * as G from '../tsotchke/geometry.js';
import { wasmBytes } from '../tsotchke/wasmb64.js';
// Moonlab's Node loader reads dist/moonlab.wasm from disk; the repo stores it as SHA-256-pinned base64 text, so
// materialise it (after the integrity check) if it is not already present.
{ const f = new URL('../vendor/moonlab/dist/moonlab.wasm', import.meta.url); if (!fs.existsSync(f)) fs.writeFileSync(f, await wasmBytes('moonlab')); }
const buf = fs.readFileSync('model/model.safetensors'), n = Number(buf.readBigUInt64LE(0)), hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
const REF = JSON.parse(fs.readFileSync(new URL('./ref_taylor.json', import.meta.url)));
const v = Float64Array.from({ length: 256 }, (_, i) => Math.sin(i + 1) / 16), A = forward(W, REF.ids);
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const enc = (s) => new TextEncoder().encode(s);

// ---- C1 Eshkol Taylor recurrences (port of lib/core/taylor_recurrences.def) -----------------------------------
test('C1a every ported recurrence matches closed-form derivatives / identities to 1e-12 (K=8)', () => {
  for (const r of T.selfTest(8)) assert.ok(r.relErr < 1e-12, `${r.name}: ${r.relErr}`);
});
test('C1b mutation: a wrong exp recurrence (s_k = Σ j u_j s_{k-j} / (k+1)) is rejected by the same check', () => {
  const badExp = (u) => { const K = u.K, s = new Float64Array(K + 1); s[0] = Math.exp(u.c[0]); for (let k = 1; k <= K; k++) { let t = 0; for (let j = 1; j <= k; j++) t += j * u.c[j] * s[k - j]; s[k] = t / (k + 1); } return new T.Jet(s); };
  const j = badExp(T.Jet.vari(0.5, 8)); let err = 0; for (let k = 0; k <= 8; k++) err = Math.max(err, Math.abs(j.deriv(k) - Math.exp(0.5)) / (1 + Math.exp(0.5)));
  assert.ok(err > 1e-3, 'broken recurrence should be detected, err=' + err);
});
test('C1c CE Taylor jet along an ln_f direction agrees with PyTorch float64 autograd (d1,d2,d3) and with grad.js', () => {
  const j = T.ceJetLnf(W, A.xf, REF.ids, v, 3);
  assert.ok(rel(j.c[0], REF.g0) < 1e-5, 'g0'); assert.ok(rel(j.deriv(1), REF.d1) < 1e-4, 'd1'); assert.ok(rel(j.deriv(2), REF.d2) < 1e-4, 'd2'); assert.ok(rel(j.deriv(3), REF.d3) < 1e-3, 'd3');
  const g = grad(W, REF.ids, { kind: 'ce' }, { weights: true }); let dot = 0; for (let i = 0; i < 256; i++) dot += g.G.lnfW[i] * v[i];
  assert.ok(rel(dot, j.deriv(1)) < 1e-4, `grad.js ${dot} vs jet ${j.deriv(1)}`);
});

// ---- C2 QGTL metric / Moonlab fidelity --------------------------------------------------------------------------
test('C2a Moonlab WASM fidelity |<√p|√q>|² equals the direct JS Bhattacharyya² to 1e-12 on real model distributions', async () => {
  const t = REF.ids.length - 2, { a, b } = G.lnfLogitLine(W, A.xf, t, v), p = G.softmax(a);
  for (const e of [0.05, 0.5, 3]) { const q = G.softmax(a.map((x, i) => x + e * b[i])); assert.ok(Math.abs((await G.moonlabFidelity(p, q)) - G.bhatt(p, q) ** 2) < 1e-12); }
});
test('C2b Fubini–Study metric measured from Moonlab fidelity = Fisher/4 (QGT real part for ψ=√p), error shrinks as ε→0', async () => {
  const t = REF.ids.length - 2, { a, b } = G.lnfLogitLine(W, A.xf, t, v), p = G.softmax(a), pred = Math.sqrt(G.fisherDir(p, b)) / 2; const errs = [];
  for (const e of [1e-1, 1e-2]) { const q = G.softmax(a.map((x, i) => x + e * b[i])); errs.push(rel(G.fsFromFidelity(await G.moonlabFidelity(p, q)) / e, pred)); }
  assert.ok(errs[1] < 1e-3 && errs[1] < errs[0] / 5, 'errs ' + errs);
});
test('C2c three independent routes agree: mean Fisher (QGTL metric) = CE g″(0) from Eshkol jets = PyTorch autograd', () => {
  const F = G.fisherLnf(W, A.xf, REF.ids, v), j = T.ceJetLnf(W, A.xf, REF.ids, v, 2);
  assert.ok(rel(F, j.deriv(2)) < 1e-6, `fisher ${F} jet ${j.deriv(2)}`); assert.ok(rel(F, REF.d2) < 1e-4, `torch ${REF.d2}`);
});
test('C2d Moonlab QWZ Chern numbers equal an independent JS Fukui–Hatsugai–Suzuki computation (up to Moonlab’s orientation sign)', async () => {
  const M = await G.moonlab();
  for (const m of [-1.5, -1, -0.5, 0.5, 1, 1.5, -3, 3]) { const c = await M.qwzChern({ m }), f = Math.round(G.qwzChernFHS(m)); assert.ok(c + f === 0, `m=${m} moonlab=${c} fhs=${f}`); }
});
test('C2e Moonlab Bell state + CHSH: P = [½,0,0,½]; S within 4σ of Tsirelson 2√2 and > 2 by > 10σ', async () => {
  const M = await G.moonlab(); const s = await M.QuantumState.create({ numQubits: 2 }); s.h(0).cnot(0, 1);
  const P = s.getProbabilities(); [0.5, 0, 0, 0.5].forEach((x, i) => assert.ok(Math.abs(P[i] - x) < 1e-12));
  const r = await M.chshTest(s, 0, 1, 20000); const S = r.chshValue, se = r.standardError || 0.02; s.dispose();
  assert.ok(Math.abs(S - 2 * Math.SQRT2) < 4 * se && S - 2 > 10 * se, `S=${S} se=${se}`);
});

// ---- C3 quantum_rng compiled to WASM ----------------------------------------------------------------------------
const GOLD = '52d659a0';
test('C3z integrity: the shipped base64 WASM decodes to the pinned SHA-256, and a one-byte change is rejected', async () => {
  await wasmBytes('qrng'); await wasmBytes('moonlab'); const P = (await import('../tsotchke/wasmb64.js')).PINS, keep = P.qrng.sha256;
  P.qrng.sha256 = keep.replace(/^./, (c) => (c === '0' ? '1' : '0')); await assert.rejects(() => wasmBytes('qrng'), /integrity/); P.qrng.sha256 = keep;
});
test('C3a seeded quantum_rng WASM is a pure function of the seed (golden prefix shared with the browser smoke test)', async () => {
  const x = await Q.bytes(enc('neuralese-v8'), 64), y = await Q.bytes(enc('neuralese-v8'), 64), z = await Q.bytes(enc('neuralese-v9'), 64);
  assert.equal(Q.hex(x), Q.hex(y)); assert.ok(Q.hex(x).startsWith(GOLD), Q.hex(x)); assert.notEqual(Q.hex(x), Q.hex(z));
  assert.equal(await Q.version(), '1.1.0');
});
test('C3b upstream SP 800-90B health tests pass on generator output and FAIL on a stuck source (negative control)', async () => {
  assert.equal(await Q.health(await Q.bytes(enc('h'), 100000)), 0); assert.notEqual(await Q.health(new Uint8Array(2000)), 0);
});
test('C3c SP 800-22 subset: 20 seeds × 1 Mbit, each test passes ≥ 19/20 at α=0.01 (NIST proportion rule); biased control fails', async () => {
  const fails = { monobit: 0, blockFrequency: 0, runs: 0, cusum: 0 };
  for (let s = 0; s < 20; s++) { const r = N.battery(await Q.bytes(enc('nist-' + s), 125000)); for (const k in fails) if (!r[k].pass) fails[k]++; }
  for (const k in fails) assert.ok(fails[k] <= 1, `${k} failed ${fails[k]}/20`);
  const biased = (await Q.bytes(enc('b'), 125000)).map((x, i) => (i % 4 === 0 ? x | 1 : x)); assert.ok(!N.battery(biased).monobit.pass, 'biased stream must fail monobit');
});
test('C3d simulated CHSH from quantum_rng exceeds 2 (simulator implements QM) — NOT evidence the bits are quantum', async () => {
  const r = await Q.chsh(enc('neuralese-v8'), 20000); assert.ok(r.S > 2.6 && r.S <= 2 * Math.SQRT2 + 5 * r.se, JSON.stringify(r));
});

// ---- C4 our SP 800-22 implementation vs NIST worked examples ------------------------------------------------------
test('C4 nist.js reproduces SP 800-22 rev1a worked examples to 6 decimals', () => {
  const e100 = N.bitsFromString('1100100100001111110110101010001000100001011010001100001000110100110001001100011001100010100010111000');
  const near = (a, b) => assert.ok(Math.abs(a - b) < 5e-7, `${a} vs ${b}`);
  near(N.monobit(N.bitsFromString('1011010101')).p, 0.527089); near(N.blockFrequency(N.bitsFromString('0110011010'), 3).p, 0.801252); near(N.runs(N.bitsFromString('1001101011')).p, 0.147232);
  near(N.monobit(e100).p, 0.109599); near(N.blockFrequency(e100, 10).p, 0.706438); near(N.runs(e100).p, 0.500798); near(N.cusum(e100).p, 0.219194);
});

// ---- C5 path laws of the edit groupoid (HoTT-*inspired* property tests; not formal proofs) -------------------------
const tensors = (X) => [X.wte, X.wpe, X.lnfW, X.lnfB, ...X.layers.flatMap((P) => Object.keys(P).sort().map((k) => P[k]))];
const bitEq = (A2, B) => tensors(A2).every((a, t) => { const b = tensors(B)[t]; for (let i = 0; i < a.length; i++) if (Object.is(a[i], b[i]) === false && a[i] !== b[i]) return false; return true; });
const run = (list) => { const M = cloneWeights(W), ed = new Editor(W, M); list.forEach((e) => ed.push({ ...e })); return M; };
const e1 = { kind: 'elem', target: { type: 'head', l: 3, i: 5 }, fn: 'scale', amt: 2 }, e2 = { kind: 'elem', target: { type: 'neuron', l: 2, i: 7 }, fn: 'scale', amt: -1 };
const e3 = { kind: 'elem', target: { type: 'matrix', path: 'L1.v' }, fn: 'noise', amt: 1, seed: 4 }, e4 = { kind: 'svd', path: 'L1.v', mode: 'topk', k: 4 };
test('C5a inverse law: edit ; undo ≡ refl (bitwise)', () => { const M = cloneWeights(W), ed = new Editor(W, M); ed.push({ ...e3 }); ed.setEdits([]); assert.ok(bitEq(M, W)); });
test('C5b disjoint-support edits commute bitwise; overlapping non-linear edits do not (the check can fail)', () => {
  assert.ok(bitEq(run([e1, e2]), run([e2, e1])), 'disjoint should commute'); assert.ok(!bitEq(run([e3, e4]), run([e4, e3])), 'noise∘svd ≠ svd∘noise');
});
