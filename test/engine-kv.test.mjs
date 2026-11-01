// KV-cache correctness: logits from the incremental (KV-cached) engine must equal an independent, cache-free, full-sequence
// recomputation (written separately below: whole-sequence matrices, no Seq/K/V state), and the cross-call prefix cache must
// return identical logits and be invalidated by runtime changes, weight edits and hooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { buildWeights, parseSafetensors, cloneWeights, CFG } from '../src/model.js';
import { Engine, defaultRuntime } from '../src/engine.js';
import { Editor } from '../src/surgery.js';

const buf = fs.readFileSync('model/model.safetensors'), n = Number(buf.readBigUInt64LE(0)), hdr = JSON.parse(buf.subarray(8, 8 + n).toString());
const W = buildWeights(parseSafetensors(buf.buffer.slice(buf.byteOffset + 8 + n), n, hdr));
const { d, H, hd, ff, V, eps, window: WIN } = CFG;
const IDS = [7454, 2402, 257, 640, 11, 612, 373, 257, 1310, 2576, 3706, 20037, 13, 1375, 6151, 284];

// Independent reference: processes the WHOLE prompt at once at every call (no cache of any kind), returns [T][V] logits.
function refLogits(Wt, ids) {
  const T = ids.length, ln = (x, w, b) => { let m = 0; for (const v of x) m += v; m /= x.length; let q = 0; for (const v of x) q += (v - m) ** 2; const r = 1 / Math.sqrt(q / x.length + eps); return x.map((v, i) => (v - m) * r * w[i] + b[i]); };
  const mv = (M, x, rows, cols, b) => { const o = new Float64Array(rows); for (let i = 0; i < rows; i++) { let s = b ? b[i] : 0; for (let j = 0; j < cols; j++) s += M[i * cols + j] * x[j]; o[i] = s; } return o; };
  let X = ids.map((t, p) => Float64Array.from({ length: d }, (_, i) => Wt.wte[t * d + i] + Wt.wpe[p * d + i]));
  Wt.layers.forEach((P, l) => {
    const Hn = X.map((x) => ln(x, P.ln1w, P.ln1b)), Q = Hn.map((h) => mv(P.q, h, d, d)), K = Hn.map((h) => mv(P.k, h, d, d)), Vv = Hn.map((h) => mv(P.v, h, d, d));
    const win = l % 2 ? WIN : 1e9;
    X = X.map((x, t) => { const z = new Float64Array(d);
      for (let h = 0; h < H; h++) { const sc = []; for (let j = 0; j <= t; j++) { if (j < t + 1 - win) { sc.push(-Infinity); continue; } let a = 0; for (let i = 0; i < hd; i++) a += Q[t][h * hd + i] * K[j][h * hd + i]; sc.push(a); }
        const mx = Math.max(...sc), e = sc.map((v) => (v === -Infinity ? 0 : Math.exp(v - mx))), s = e.reduce((a, b) => a + b, 0);
        e.forEach((w, j) => { for (let i = 0; i < hd; i++) z[h * hd + i] += (w / s) * Vv[j][h * hd + i]; }); }
      const ao = mv(P.o, z, d, d, P.ob); return x.map((v, i) => v + ao[i]); });
    X = X.map((x) => { const h = ln(x, P.ln2w, P.ln2b), a = mv(P.fc, h, ff, d, P.fcb).map((u) => 0.5 * u * (1 + Math.tanh(0.7978845608028654 * (u + 0.044715 * u ** 3)))), mo = mv(P.proj, a, d, ff, P.projb); return x.map((v, i) => v + mo[i]); });
  });
  return X.map((x) => mv(Wt.wte, ln(x, Wt.lnfW, Wt.lnfB), V, d));
}
const maxRel = (a, b) => { let m = 0, s = 0; for (let i = 0; i < a.length; i++) { m = Math.max(m, Math.abs(a[i] - b[i])); s = Math.max(s, Math.abs(b[i])); } return m / s; };

test('KV-cached incremental logits == cache-free full recomputation at every position (rel ≤ 1e-5)', () => {
  const ref = refLogits(W, IDS), e = new Engine(W, defaultRuntime()), s = e.newSeq(IDS.length);
  IDS.forEach((t, p) => { const l = e.logits(e.step(s, t).h); const r = maxRel(l, ref[p]); assert.ok(r < 1e-5, `pos ${p}: rel ${r}`); });
});
test('prefix KV cache: identical logits to uncached, hits on shared prefix, extends past it', () => {
  const a = new Engine(W, defaultRuntime()), b = new Engine(W, defaultRuntime()); b.prefixCache = true;
  const p1 = IDS.slice(0, 10), p2 = IDS.slice(0, 14);
  for (const ids of [p1, p1, p2, IDS]) { const la = a.logits(a.run(ids).last.h), r = b.run(ids), lb = b.logits(r.last.h); assert.equal(maxRel(lb, la), 0, 'bit-identical'); }
  assert.ok(b.cacheHits >= 3, 'hits ' + b.cacheHits);
  const r = b.run(IDS); assert.equal(r.cached, IDS.length); // continuing generation from a cached seq still works
  const s2 = r.seq, x = b.logits(b.step(s2, 13).h), ref = a.logits(a.run([...IDS, 13]).last.h); assert.equal(maxRel(x, ref), 0);
});
test('prefix KV cache is invalidated by runtime interventions, weight edits and hooks', () => {
  const Wm = cloneWeights(W), ed = new Editor(W, Wm), e = new Engine(Wm, defaultRuntime()); e.prefixCache = true; const fresh = () => new Engine(Wm, structuredClone(e.R));
  const base = e.logits(e.run(IDS).last.h);
  e.R.headAbl[3][5] = 'zero'; let l = e.logits(e.run(IDS).last.h), f = fresh(); assert.equal(e.run(IDS).cached, IDS.length); assert.equal(maxRel(l, f.logits(f.run(IDS).last.h)), 0); assert.ok(maxRel(l, base) > 1e-4, 'ablation changed logits');
  e.R.headAbl[3][5] = null; ed.push({ kind: 'elem', target: { type: 'neuron', l: 2, i: 7 }, fn: 'zero' }); l = e.logits(e.run(IDS).last.h); f = fresh(); assert.equal(maxRel(l, f.logits(f.run(IDS).last.h)), 0, 'weights edit invalidates');
  let called = 0; const rh = e.run(IDS, { hook: (site, sl, ly, t, x) => { called++; if (site === 'resid_post' && ly === 7) x[0] += 5; } }); assert.ok(called > 0, 'hooked run is not served from cache'); assert.equal(rh.cached, undefined);
  assert.ok(maxRel(e.logits(rh.last.h), l) > 0, 'hook changed logits');
  Wm.layers[0].fc[0] += 1; e.invalidate(); l = e.logits(e.run(IDS).last.h); f = fresh(); assert.equal(maxRel(l, f.logits(f.run(IDS).last.h)), 0, 'manual invalidate()');
});
