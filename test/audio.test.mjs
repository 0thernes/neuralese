import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../audio.js';

test('tokenPitch: monotone in probability, lower for worse rank, stays in mode', () => {
  const sc = A.MODES.phrygian, root = 36; let prev = -1;
  for (const p of [1e-6, 1e-4, 1e-2, 0.1, 0.9]) { const m = A.tokenPitch(p, 0, root, 'phrygian'); assert.ok(m >= prev); prev = m; assert.ok(sc.includes((((m - root - 24) % 12) + 12) % 12)); }
  assert.ok(A.tokenPitch(0.3, 5000, root, 'phrygian') < A.tokenPitch(0.3, 0, root, 'phrygian'));
});
test('modeFromHidden: gaussian → bright mode, heavy-tailed → alien mode; root from argmax dim', () => {
  let s = 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); const g = () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  const x = Float32Array.from({ length: 256 }, g); const a = A.modeFromHidden(x); const y = x.slice(); y[40] = 80; y[41] = 60; const b = A.modeFromHidden(y);
  const order = ['dorian', 'aeolian', 'harmonic', 'phrygian', 'locrian', 'octatonic', 'wholetone']; assert.ok(order.indexOf(b.mode) > order.indexOf(a.mode));
  assert.equal(b.root, 33 + (40 % 12)); assert.ok(Math.abs(A.hiddenStats([1, 2, 3, 4]).skew) < 1e-9);
});
test('timbreFromNorms / attentionFocus / tension / glitch', () => {
  assert.ok(A.timbreFromNorms([1, 2, 4, 8, 16]).bright > A.timbreFromNorms([1, 1, 1, 1]).bright); assert.equal(A.timbreFromNorms([3, 3, 3]).rough, 0);
  assert.equal(A.attentionFocus([[1, 0, 0, 0]]).pan, -1); assert.equal(A.attentionFocus([[0, 0, 0, 1]]).pan, 1); assert.ok(Math.abs(A.attentionFocus([[0.25, 0.25, 0.25, 0.25]]).ent - 1) < 1e-9); assert.equal(A.attentionFocus([[0, 1, 0]]).ent, 0);
  assert.equal(A.tension(0), 0); assert.ok(A.tension(4) > A.tension(1)); assert.ok(A.tension(100) <= 1);
  assert.equal(A.glitchAmount(0.5), 0); assert.ok(A.glitchAmount(1e-5) > 0);
});
test('klDiv and beatHz: zero for identical, positive and capped otherwise', () => {
  const ls = (a) => { const z = Math.log(a.reduce((s, v) => s + Math.exp(v), 0)); return a.map((v) => v - z); };
  const p = ls([2, 1, 0, -1]), q = ls([0, 1, 2, -1]); assert.ok(A.klDiv(p, p) < 1e-12); const k = A.klDiv(p, q); assert.ok(k > 0);
  let ex = 0; for (let i = 0; i < 4; i++) ex += Math.exp(p[i]) * (p[i] - q[i]); assert.ok(Math.abs(k - ex) < 1e-12);
  assert.equal(A.beatHz(0), 0); assert.ok(A.beatHz(1) > A.beatHz(0.1)); assert.equal(A.beatHz(1e9), 30);
});
test('detectPhenomena finds loops, collapse, superposition, explosions and nothing in noise', () => {
  const base = { ent: [2, 2, 2, 2, 2, 2, 2, 2], ids: [1, 2, 3, 4, 5, 6, 7, 8], probs: [[0.4, 0.1]], norms: [5, 5, 5, 5, 5, 5] };
  assert.deepEqual(A.detectPhenomena(base), []);
  assert.ok(A.detectPhenomena({ ...base, ids: [9, 1, 2, 1, 2, 1, 2] }).includes('repetition_loop'));
  assert.ok(A.detectPhenomena({ ...base, ent: [2, 2, 2, 2, 0.1, 0.05, 0.02, 0.01] }).includes('entropy_collapse'));
  assert.ok(A.detectPhenomena({ ...base, probs: [[0.42, 0.40]] }).includes('superposition'));
  assert.ok(A.detectPhenomena({ ...base, norms: [5, 5, 5, 5, 5, 40] }).includes('residual_explosion'));
});
test('editKind maps every surgery label to its SFX', () => {
  for (const [l, k] of [['SVD top-k L3 c_fc', 'svd'], ['ROME " Lily"→" Max"', 'rome'], ['int4 quant mlp', 'quant'], ['chaos σ=0.1', 'chaos'], ['steer + joy', 'steer'], ['swap s2↔s3', 'swap'], ['zero-ablate L2H5', 'ablate'], ['something', 'generic']]) assert.equal(A.editKind(l), k, l);
  assert.equal(A.formantsFor('a')[0], 800); assert.equal(A.formantsFor('z').length, 3); assert.ok(Math.abs(A.midiToHz(69) - 440) < 1e-9);
});
