// v9: Eshkol's compile-time type layer (WASM) checks the real model graph; QGTL (WASM) fidelity cross-checks Moonlab.
// Each positive test has a negative twin that must be rejected by the same code path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { buildWeights, parseSafetensors, CFG } from '../model.js';
import * as TY from '../tsotchke/types.js';
import * as QG from '../tsotchke/qgtl.js';
import * as G from '../tsotchke/geometry.js';
import { wasmBytes } from '../tsotchke/wasmb64.js';
{ const f = new URL('../vendor/moonlab/dist/moonlab.wasm', import.meta.url); if (!fs.existsSync(f)) fs.writeFileSync(f, await wasmBytes('moonlab')); }
const buf = fs.readFileSync('model/model.safetensors'), n = Number(buf.readBigUInt64LE(0)), hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));

test('H1 Eshkol DimensionChecker: matmul / reshape-path / bounds accept valid and reject invalid', async () => {
  const E = await TY.api();
  assert.ok(E.matmul(1024, 256, 256, 1)); assert.ok(!E.matmul(1024, 256, 255, 1)); assert.match(E.msg(), /256 != 255/);
  assert.ok(E.reshape(256, 1024, 262144)); assert.ok(!E.reshape(256, 1024, 262143));
  assert.ok(E.bounds(50256, 50257)); assert.ok(!E.bounds(50257, 50257));
});
test('H2 Eshkol HoTT universe/subtyping: Float32 <: Real, Natural <: Integer; Real ≮: Int64; promotions', async () => {
  const E = await TY.api();
  assert.ok(E.subtype('Float32', 'Real')); assert.ok(E.subtype('Natural', 'Integer')); assert.ok(!E.subtype('Real', 'Int64'));
  assert.equal(E.promote('Int64', 'Float32'), 'Float64'); assert.equal(E.promote('Float32', 'Float64'), 'Float64');
  assert.equal(E.universe('Float32'), 0); assert.equal(E.universe('Tensor'), 1);
});
test('H3 the real TinyStories-8M graph type-checks under Eshkol (all judgments hold)', async () => {
  const r = await TY.checkModel(W, CFG, [0, 50256, 1000]);
  assert.ok(r.ok, JSON.stringify(r.failed)); assert.ok(r.n >= 60, 'judgment count ' + r.n);
});
test('H4 mutation: truncated weight, miswired MLP, out-of-vocab token, Float64-free dtype are each rejected', async () => {
  const t = { ...W, layers: W.layers.slice() }; t.layers[3] = { ...W.layers[3], fc: W.layers[3].fc.subarray(1) };
  let r = await TY.checkModel(t, CFG); assert.ok(!r.ok); assert.deepEqual(r.failed.map((x) => x.id), ['h3.fc']);
  r = await TY.checkModel(W, { ...CFG, ff: 1000 }); assert.ok(!r.ok && r.failed.some((x) => /fc|proj/.test(x.id)));
  r = await TY.checkModel(W, CFG, [5, 50257]); assert.ok(!r.ok && r.failed.some((x) => x.id === 'tok[1]'));
  r = await TY.checkModel({ ...W, wte: Array.from(W.wte.subarray(0, 4)) }, CFG); assert.ok(!r.ok && r.failed.some((x) => x.id === 'dtype') && r.failed.some((x) => x.id === 'wte'));
});
test('H5 QGTL fidelity (qgt_geometric_measure_fidelity, WASM) = Moonlab fidelity = Bhattacharyya² (float32 tolerance)', async () => {
  const p = G.softmax([1, 2, 3, 0.5, -1, 0, 0.3, 2.2]), q = G.softmax([1.2, 1.7, 3.1, 0.2, -0.5, 0.1, 0.3, 2]);
  const fq = await QG.fidelity(p, q), fm = await G.moonlabFidelity(p, q), fb = G.bhatt(p, q) ** 2;
  assert.ok(Math.abs(fq - fb) < 2e-6, `qgtl ${fq} vs ${fb}`); assert.ok(Math.abs(fq - fm) < 2e-6, `qgtl ${fq} vs moonlab ${fm}`);
  assert.ok(Math.abs((await QG.fidelity(p, p)) - 1) < 1e-6); assert.ok((await QG.fidelity([1, 0, 0, 0], [0, 0, 1, 0])) < 1e-12);
});
test('H6 QGTL fidelity on real model distributions (V = 50257) agrees with Bhattacharyya² to 1e-5', async () => {
  const d = 256, V = 50257, lg = (h) => { const o = new Float64Array(V); for (let v = 0; v < V; v++) { let s = 0; for (let k = 0; k < d; k++) s += W.wte[v * d + k] * h[k]; o[v] = s; } return G.softmax(o); };
  const h1 = Float64Array.from({ length: d }, (_, i) => Math.sin(i) * W.lnfW[i]), h2 = h1.map((x, i) => x + 0.05 * Math.cos(3 * i));
  const p = lg(h1), q = lg(h2), fq = await QG.fidelity(p, q), fb = G.bhatt(p, q) ** 2; assert.ok(fb < 0.9999 && Math.abs(fq - fb) < 1e-5, `${fq} vs ${fb}`);
});
test('H7 documented upstream limit: QGTL compute_metric is diag(1 − |ψ_i|²), not the Fubini–Study metric', async () => {
  const a = [0.6, 0.8, 0, 0], g = await QG.metric(a);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) assert.ok(Math.abs(g[i * 4 + j] - (i === j ? 1 - a[i] ** 2 : 0)) < 1e-6, `g[${i}][${j}]=${g[i * 4 + j]}`);
});
