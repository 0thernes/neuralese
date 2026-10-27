import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { buildWeights, parseSafetensors } from '../model.js';
import { CORPUS } from '../corpus.js';
import * as D from '../drill.js';
const M = 'model/';
const buf = fs.readFileSync(M + 'model.safetensors'); const n = Number(buf.readBigUInt64LE(0)); const hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
test('hierarchy: counts, paths and index resolution', () => {
  assert.equal(D.children(W, {}).length, 8); assert.equal(D.children(W, { l: 2, sub: 'attn' }).length, 5);
  const h = { l: 3, sub: 'attn', key: 'q', unit: 5 }; const p = D.resolve(W, h)[0]; assert.equal(p.idx.length, 16 * 256); assert.equal(p.idx[0], 80 * 256);
  const o = D.resolve(W, { l: 3, sub: 'attn', key: 'o', unit: 5, line: 2, lineAxis: 'c', w: 7 })[0]; assert.deepEqual(Array.from(o.idx), [7 * 256 + 82]);
  const nr = D.resolve(W, { l: 1, sub: 'mlp', key: 'proj', unit: 9 })[0]; assert.equal(nr.idx.length, 256); assert.equal(nr.idx[1], 1024 + 9);
  for (const s of ['L3.attn.q.H5.r2.w17', 'L0.mlp.fcb.w3', 'L7.ln2.ln2w', 'L2']) assert.equal(D.toPath(D.fromPath(s)), s);
  assert.equal(D.crumbs(D.fromPath('L3.attn.q.H5.r2.w17')).length, 7);
});
test('inspector: finite difference agrees with analytic gradient, ablation restores weights', () => {
  const docs = CORPUS.slice(0, 2).map((x) => x.slice(0, 16)), node = D.fromPath('L5.mlp.fc.N100'), before = W.layers[5].fc.slice(100 * 256, 101 * 256);
  const r = D.inspect(W, node, docs, { eps: 1e-3 }); console.log(JSON.stringify(r.grad));
  assert.ok(r.grad.fdRelErr < 0.05, 'fd rel err ' + r.grad.fdRelErr); assert.equal(r.count, 256);
  assert.deepEqual(Array.from(W.layers[5].fc.slice(100 * 256, 101 * 256)), Array.from(before)); assert.ok(r.provenance.length > 0 && r.logitDirect.up.length === 8);
  const m = D.inspect(W, D.fromPath('L2.attn.v'), docs.slice(0, 1)); assert.ok(m.spectral && m.spectral.effRank > 1);
});
