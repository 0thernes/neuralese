import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { buildWeights, parseSafetensors } from '../model.js';
import { GPT2Tokenizer } from '../tokenizer.js';
import { Engine, defaultRuntime } from '../engine.js';
import { forward, logitsAt, grad, gradXInput, integratedGradients, attributionPatching, activationPatchingHeads, hvp, _test } from '../grad.js';
const M = 'model/';
const buf = fs.readFileSync(M + 'model.safetensors'); const n = Number(buf.readBigUInt64LE(0)); const hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
const tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync(M + 'vocab.json')), fs.readFileSync(M + 'merges.txt', 'utf8'));
const R = JSON.parse(fs.readFileSync('ref_grad.json'));
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-6, Math.abs(b));
const norm = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0));
test('grad.js forward matches engine KV-cache forward', () => {
  const ids = R.ids, A = forward(W, ids), e = new Engine(W, defaultRuntime()); const lg = e.logits(e.run(ids).last.h), l2 = logitsAt(W, A, ids.length - 1);
  let m = 0; for (let i = 0; i < lg.length; i++) m = Math.max(m, Math.abs(lg[i] - l2[i])); assert.ok(m < 2e-3, 'max diff ' + m);
});
test('dgelu matches finite difference', () => { for (const x of [-3, -1, -0.2, 0, 0.5, 2]) { const fd = (_test.gelu(x + 1e-3) - _test.gelu(x - 1e-3)) / 2e-3; assert.ok(Math.abs(fd - _test.dgelu(x)) < 1e-4, String(x)); } });
test('CE loss and weight gradients match PyTorch autograd', () => {
  const r = grad(W, R.ids, { kind: 'ce' }, { weights: true });
  assert.ok(rel(r.value, R.loss) < 1e-3, `loss ${r.value} vs ${R.loss}`);
  for (const [key, g] of Object.entries(R.wgrad)) { const [l, k] = key.split('.'); const a = r.G.layers[+l][k];
    assert.ok(rel(norm(a), g.norm) < 2e-3, `${key} norm ${norm(a)} vs ${g.norm}`);
    assert.ok(rel(a[g.argmax], g.max) < 5e-3, `${key} max ${a[g.argmax]} vs ${g.max}`);
    for (let i = 0; i < 8; i++) assert.ok(Math.abs(a[i] - g.head[i]) <= 2e-3 * g.norm / Math.sqrt(a.length) + 1e-3 * Math.abs(g.head[i]) + 1e-7, `${key}[${i}] ${a[i]} vs ${g.head[i]}`); }
  assert.ok(rel(norm(r.G.lnfW), R.lnfW_norm) < 2e-3);
  for (let i = 0; i < 8; i++) assert.ok(Math.abs(r.G.wpe[i] - R.wpe_head[i]) < 1e-5 + 2e-3 * Math.abs(R.wpe_head[i]));
});
test('logit-diff input gradient and grad×input match PyTorch', () => {
  const g = gradXInput(W, R.ids, { kind: 'logitdiff', a: R.ld.a, b: R.ld.b }); assert.ok(rel(g.value, R.ld.value) < 1e-3);
  g.scores.forEach((s, t) => assert.ok(Math.abs(s - R.ld.gxi[t]) < 1e-2 + 5e-3 * Math.abs(R.ld.gxi[t]), `t${t} ${s} vs ${R.ld.gxi[t]}`));
});
test('integrated gradients satisfy completeness', () => {
  const ids = tok.encode('Lily gave the ball to'); const ig = integratedGradients(W, ids, { kind: 'logitdiff', a: tok.encode(' Tom')[0], b: tok.encode(' Lily')[0] }, 24);
  assert.ok(Math.abs(ig.sum - ig.delta) < 0.1 * Math.max(1, Math.abs(ig.delta)), `sum ${ig.sum} vs delta ${ig.delta}`);
});
test('AtP correlates with true activation patching', () => {
  const c = tok.encode('Lily and Tom went to the park. Lily gave the ball to'), x = tok.encode('Lily and Tom went to the park. Tom gave the ball to');
  const obj = { kind: 'logitdiff', a: tok.encode(' Tom')[0], b: tok.encode(' Lily')[0] };
  const est = attributionPatching(W, c, x, obj).est.flat(), tru = activationPatchingHeads(W, c, x, obj).flat();
  const mu = (a) => a.reduce((s, y) => s + y, 0) / a.length, ma = mu(est), mb = mu(tru); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < est.length; i++) { sab += (est[i] - ma) * (tru[i] - mb); saa += (est[i] - ma) ** 2; sbb += (tru[i] - mb) ** 2; }
  const rr = sab / Math.sqrt(saa * sbb); console.log('AtP Pearson r =', rr.toFixed(3)); assert.ok(rr > 0.7, 'r=' + rr);
});
test('HVP is symmetric-consistent (vᵀHu ≈ uᵀHv)', () => {
  const ids = R.ids.slice(0, 10), L = W.layers[7].ob.length; const u = new Float32Array(L).map((_, i) => Math.sin(i)), v = new Float32Array(L).map((_, i) => Math.cos(3 * i));
  const Hu = hvp(W, ids, 7, 'ob', u), Hv = hvp(W, ids, 7, 'ob', v); const a = Hu.reduce((s, y, i) => s + y * v[i], 0), b = Hv.reduce((s, y, i) => s + y * u[i], 0);
  assert.ok(Math.abs(a - b) < 0.02 * Math.max(1, Math.abs(a)), `${a} vs ${b}`);
});
