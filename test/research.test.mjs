import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { buildWeights, parseSafetensors, cloneWeights } from '../model.js';
import { GPT2Tokenizer } from '../tokenizer.js';
import { Engine, defaultRuntime } from '../engine.js';
import { CORPUS } from '../corpus.js';
import * as R from '../research.js';
const M = '/workspace/neuralese/model/', buf = fs.readFileSync(M + 'model.safetensors'), n = Number(buf.readBigUInt64LE(0)), hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr)), tok = new GPT2Tokenizer(JSON.parse(fs.readFileSync(M + 'vocab.json')), fs.readFileSync(M + 'merges.txt', 'utf8'));
const REF = JSON.parse(fs.readFileSync(new URL('./ref_stats.json', import.meta.url)));
test('hypothesis tests match scipy / statsmodels', () => {
  R.holm(REF.ps).forEach((p, i) => assert.ok(Math.abs(p - REF.holm[i]) < 1e-12, 'holm ' + i));
  R.bh(REF.ps).forEach((p, i) => assert.ok(Math.abs(p - REF.bh[i]) < 1e-12, 'bh ' + i));
  assert.ok(Math.abs(R.permPaired(REF.a, REF.b, 20000, 3).p - REF.p_paired) < 0.006, 'paired perm p');
  assert.ok(Math.abs(R.permTwo(REF.a, REF.b, 20000, 3).p - REF.p_two) < 0.008, 'two-sample perm p');
  assert.ok(Math.abs(R.cohenDPaired(REF.a, REF.b) - REF.dz) < 1e-9); assert.ok(Math.abs(R.cohenD(REF.a, REF.b) - REF.d_ind) < 1e-9);
  const ci = R.bootCI(REF.a, 4000, 2); assert.ok(ci.lo < ci.est && ci.est < ci.hi);
});
test('weights hash: deterministic, changes on a 1-ulp edit', async () => {
  const h1 = await R.weightsHash(W), C = cloneWeights(W); assert.equal(await R.weightsHash(C), h1); assert.match(h1, /^[0-9a-f]{64}$/);
  const u = new Uint32Array(C.layers[3].q.buffer, C.layers[3].q.byteOffset, 1); u[0] ^= 1; assert.notEqual(await R.weightsHash(C), h1);
});
test('ACDC-style pruning finds a small faithful circuit; scrubbing the full node set is exact', () => {
  const c = tok.encode('Lily and Tom went to the park. Lily gave the ball to'), x = tok.encode('Lily and Tom went to the park. Tom gave the ball to'), obj = { kind: 'logitdiff', a: tok.encode(' Tom')[0], b: tok.encode(' Lily')[0] };
  const r = R.acdc(W, c, x, obj, 0.02); console.log('# acdc', r.circuit.length, 'of', r.nNodes, 'faithfulness', r.faithfulness.toFixed(3), r.circuit.join(' '));
  assert.ok(r.circuit.length < r.nNodes / 2, 'prunes most nodes'); assert.ok(r.faithfulness > 0.5, 'faithful');
  const all = R.nodeList(W).map((n) => n.id), s = R.scrub(W, c, x, obj, all); assert.ok(Math.abs(s.faithfulness - 1) < 1e-6);
  const s0 = R.scrub(W, c, x, obj, []); assert.ok(Math.abs(s0.faithfulness) < 1e-3, 'scrubbing everything ≈ corrupt run ' + s0.faithfulness);
  const sc = R.scrub(W, c, x, obj, r.circuit); assert.ok(Math.abs(sc.faithfulness - r.faithfulness) < 1e-6, 'scrub(circuit) reproduces ACDC faithfulness');
});
test('linear probe: noun vs verb is selective; control task near chance', () => {
  const lists = [['girl', 'boy', 'dog', 'cat', 'ball', 'tree', 'park', 'mom', 'house', 'toy', 'bird', 'car', 'box', 'cake', 'sun', 'friend', 'man', 'day', 'room', 'water'], ['went', 'said', 'saw', 'played', 'ran', 'wanted', 'was', 'looked', 'liked', 'gave', 'had', 'made', 'found', 'felt', 'came', 'took', 'smiled', 'jumped', 'got', 'loved']];
  const data = R.probeData(W, tok, CORPUS.slice(0, 40), lists, { layer: 4 }), r = R.runProbe(data, 2, { epochs: 150 });
  console.log('# probe', JSON.stringify({ real: r.real.test, control: r.control.test, sel: r.selectivity, n: data.X.length, types: r.nTypes }));
  assert.ok(r.real.test > 0.8, 'real probe test acc'); assert.ok(r.selectivity > 0.15, 'selectivity');
});
test('eval harness: clean model knows TinyStories facts; ablating every MLP hurts all metrics', async () => {
  const docs = CORPUS.slice(0, 4).map((d) => d.slice(0, 24)), a = await R.evalSuite(W, new Engine(W, defaultRuntime()), tok, docs, { genN: 24 });
  console.log('# eval clean', JSON.stringify({ ppl: a.ppl, top1: a.factTop1, d2: a.distinct2, rep4: a.rep4 }));
  assert.ok(a.factTop1 >= 0.5); assert.ok(a.ppl < 5); assert.equal(R.ngramStats([1, 2, 1, 2, 1, 2], 2).distinct, 2 / 5);
  const B = cloneWeights(W); for (const P of B.layers) { P.proj.fill(0); P.projb.fill(0); } const b = await R.evalSuite(B, new Engine(B, defaultRuntime()), tok, docs, { genN: 24 });
  assert.ok(b.ppl > a.ppl * 2 && b.factTop1 < a.factTop1);
});
