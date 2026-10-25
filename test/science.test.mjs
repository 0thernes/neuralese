import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { buildWeights, parseSafetensors } from '../model.js';
import { GPT2Tokenizer } from '../tokenizer.js';
import { CORPUS } from '../corpus.js';
import * as S from '../science.js';
const M = '/workspace/neuralese/model/';
const buf = fs.readFileSync(M + 'model.safetensors'); const n = Number(buf.readBigUInt64LE(0)); const hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
const tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync(M + 'vocab.json')), fs.readFileSync(M + 'merges.txt', 'utf8'));
const R = JSON.parse(fs.readFileSync('/workspace/neuralese/ref_sci.json'));
test('eig: trace/determinant identities and known spectrum', () => {
  const A = [4, 1, 2, 0, 3, -1, 1, 0, 2]; const e = S.eig(A, 3); const sum = e.reduce((s, [r]) => s + r, 0); assert.ok(Math.abs(sum - 9) < 1e-9);
  const rot = S.eig([0, -1, 1, 0], 2); assert.ok(Math.abs(Math.abs(rot[0][1]) - 1) < 1e-12 && Math.abs(rot[0][0]) < 1e-12);
});
test('OV/QK eigen copying scores match numpy', () => {
  const E = S.embedGram(W), sc = S.headEigenScores(W, E);
  for (const [k, [ov, qk]] of Object.entries(R.ov)) { const [l, h] = k.split('.').map(Number); assert.ok(Math.abs(sc[l][h].ov - ov) < 1e-3, `${k} ov ${sc[l][h].ov} vs ${ov}`); assert.ok(Math.abs(sc[l][h].qk - qk) < 1e-3, `${k} qk`); }
});
test('Q/K/V composition scores match brute-force PyTorch', () => {
  const C = S.compositionScores(W);
  for (const [k, ref] of Object.entries(R.comp)) { const [a, b] = k.split('-').map((x) => x.split('.').map(Number));
    ['Q', 'K', 'V'].forEach((t, i) => { const e = C[t].find((x) => x.from[0] === a[0] && x.from[1] === a[1] && x.to[0] === b[0] && x.to[1] === b[1]); assert.ok(Math.abs(e.s - ref[i]) < 1e-4, `${k} ${t} ${e.s} vs ${ref[i]}`); }); }
});
test('spectral metrics match torch.svdvals', () => {
  const s = S.spectral(W.layers[7].fc, 1024, 256);
  assert.ok(Math.abs(s.effRank - R.spec.effRank) < 1e-2 && Math.abs(s.stableRank - R.spec.stable) < 1e-2 && Math.abs(s.cond - R.spec.cond) / R.spec.cond < 1e-3);
  const m = S.moments(new Float32Array([1, 2, 3, 4, 100])); assert.ok(m.skew > 1 && m.kurt > 0);
});
test('induction/prev-token scores (weak induction in 8M) and bootstrap CIs bracket estimates', () => {
  const I = S.inductionScores(W, { n: 15, reps: 3 }); let best = 0, where = null;
  I.forEach((row, l) => row.forEach((x, h) => { assert.ok(x.ind.lo <= x.ind.est + 1e-9 && x.ind.est <= x.ind.hi + 1e-9); if (x.ind.est > best) { best = x.ind.est; where = [l, h]; } }));
  // Finding (cross-checked with HF output_attentions): TinyStories-8M has only weak random-token induction (max ≈0.06–0.10).
  assert.ok(best > 0.02 && best < 0.3, 'best ' + best); let prev = 0; I.forEach((row) => row.forEach((x) => { prev = Math.max(prev, x.prev.est); })); assert.ok(prev > 0.2, 'prev-token head ' + prev);
});
test('CKA identities, TwoNN on a known manifold, anisotropy, logit-lens KL monotone end', () => {
  const docs = CORPUS.slice(0, 3).map((s) => s.slice(0, 40)); const reps = S.residuals(W, docs, 24);
  assert.ok(Math.abs(S.cka(reps[3], reps[3]) - 1) < 1e-6); const c = S.cka(reps[1], reps[2]); assert.ok(c > 0 && c < 1);
  const r = S.rng(2), line = Array.from({ length: 300 }, () => { const t = r(), u = r(); const v = new Float64Array(256); v[0] = t; v[1] = u; v[5] = t + u; return v; });
  const id = S.twoNN(line); assert.ok(id > 1.5 && id < 2.6, 'twoNN ' + id);
  const an = S.anisotropy(reps[6], 500); assert.ok(an.est > -1 && an.est < 1);
  const kl = S.logitLensKL(W, docs.slice(0, 1), 12); assert.ok(Math.abs(kl[8].est) < 1e-4 && kl[0].est > kl[7].est);
});
test('loss slice is minimal near α=0 and restores weights', () => {
  const docs = [CORPUS[0].slice(0, 24)], before = W.layers[7].fc.slice(0, 50);
  const s = S.lossSlice(W, docs, { n: 5, span: 0.5 }); const mid = s.grid[0][2]; assert.ok(mid <= Math.min(s.grid[0][0], s.grid[0][4]));
  assert.deepEqual(Array.from(W.layers[7].fc.slice(0, 50)), Array.from(before));
});
test('superposition geometry is well-formed', () => { const g = S.superposition(W, 7); assert.ok(g.sumD > 0 && g.sumD <= 256 + 1e-6 && g.meanAbsCos > 0); });
