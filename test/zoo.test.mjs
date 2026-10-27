import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { fileURLToPath } from 'node:url';
import { loadZoo, weightDiff } from '../zoo.js';
import { forward, logitsAt, grad } from '../grad.js';
import { cloneWeights } from '../model.js';
const R = JSON.parse(fs.readFileSync('ref_zoo.json'));
const fileRange = async (p, a, b) => { const fd = fs.openSync(p, 'r'), buf = Buffer.alloc(b - a + 1); fs.readSync(fd, buf, 0, buf.length, a); fs.closeSync(fd); return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length); };
const ids = [7454, 2402, 257, 640, 11, 612, 373, 257, 1310, 2576];
for (const m of ['1M', '3M']) test(`zoo ${m}: range-loaded weights reproduce HF logits and loss`, async () => {
  const { W, requests } = await loadZoo(fileURLToPath(new URL(`../model/ts${m}.safetensors`, import.meta.url)), fileRange); assert.equal(W.cfg.d, m === '1M' ? 64 : 128); assert.ok(requests < 12, 'requests ' + requests);
  const lg = logitsAt(W, forward(W, ids), ids.length - 1); R[m].logits.forEach((v, i) => assert.ok(Math.abs(lg[i] - v) < 2e-3 * Math.max(1, Math.abs(v)), `${m} logit ${i}: ${lg[i]} vs ${v}`));
  const g = grad(W, ids, { kind: 'ce' }); assert.ok(Math.abs(g.value - R[m].loss) < 1e-3, `${g.value} vs ${R[m].loss}`);
  const B = cloneWeights(W); B.cfg = W.cfg; B.layers[2].fc[5] += 1; const D = weightDiff(W, B); const e = D.find((x) => x.name === 'L2.fc'); assert.ok(Math.abs(e.dF - 1) < 1e-5 && e.changed > 0); assert.equal(D.filter((x) => x.dF > 0).length, 1);
});
