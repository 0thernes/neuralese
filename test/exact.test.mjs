import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { buildWeights, parseSafetensors, cloneWeights } from '../model.js';
import { Editor } from '../surgery.js';
import { inspect, fromPath } from '../drill.js';
import { lossSlice } from '../science.js';
import { hvp } from '../grad.js';
const buf = fs.readFileSync('model/model.safetensors'), n = Number(buf.readBigUInt64LE(0)), hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
const tensors = (X) => [X.wte, X.wpe, X.lnfW, X.lnfB, ...X.layers.flatMap((P) => Object.keys(P).sort().map((k) => P[k]))];
const bitEq = (A, B) => { const a = tensors(A), b = tensors(B); for (let t = 0; t < a.length; t++) { const x = new Uint32Array(a[t].buffer, a[t].byteOffset, a[t].length), y = new Uint32Array(b[t].buffer, b[t].byteOffset, b[t].length); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return `tensor ${t} index ${i}`; } return true; };
const EDITS = [
  { kind: 'elem', target: { type: 'head', l: 3, i: 5 }, fn: 'noise', amt: 0.7, seed: 11 },
  { kind: 'elem', target: { type: 'neuron', l: 2, i: 7 }, fn: 'scale', amt: 2.5 },
  { kind: 'elem', target: { type: 'sel', path: 'L4.mlp.fc.N9' }, fn: 'zero', amt: 0 },
  { kind: 'svd', path: 'L1.v', mode: 'topk', k: 8 },
  { kind: 'lowrank', path: 'L5.fc', rank: 2, sigma: 0.5, seed: 3 },
  { kind: 'quant', layers: [6], mats: ['q', 'proj'], bits: 4 },
  { kind: 'chaos', pct: 7, seed: 5 },
];
test('edit + undo (rebuild by replay from original) is bitwise exact for every edit kind and order', () => {
  const M = cloneWeights(W), ed = new Editor(W, M);
  for (const e of EDITS) { ed.push({ ...e }); }
  const full = cloneWeights(M);
  for (let k = EDITS.length; k >= 0; k--) { ed.setEdits(ed.edits.slice(0, k)); const ref = cloneWeights(W), e2 = new Editor(W, ref); for (const e of EDITS.slice(0, k)) e2.push({ ...e }); assert.equal(bitEq(M, ref), true, 'after undo to ' + k); }
  assert.equal(bitEq(M, W), true, 'all undone == original');
  ed.setEdits(EDITS.map((e, i) => ({ ...e, id: i + 1 }))); assert.equal(bitEq(M, full), true, 'redo all == first application');
});
test('analyses that perturb weights in place restore them bitwise (drill FD/ablation, loss slice, HVP)', () => {
  const M = cloneWeights(W), ids = [50256, 7454, 2402, 257, 640, 612, 373, 257, 1310];
  inspect(M, fromPath('L3.attn.q.H5'), [ids], {}); assert.equal(bitEq(M, W), true, 'drill unit');
  inspect(M, fromPath('L2.mlp.fc'), [ids], { spectralMax: 0 }); assert.equal(bitEq(M, W), true, 'drill matrix');
  lossSlice(M, [ids], { mats: [[3, 'fc']], n: 3, span: 0.7, maxT: 9 }); assert.equal(bitEq(M, W), true, 'loss slice');
  hvp(M, ids, 7, 'ob', new Float32Array(256).fill(0.1)); assert.equal(bitEq(M, W), true, 'hvp');
});
